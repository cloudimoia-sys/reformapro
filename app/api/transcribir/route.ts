import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { limiteIaSuperado, ERROR_LIMITE_IA } from "@/lib/limite";
import { llamarAGemini, respuestaDeError, type Parte } from "@/lib/gemini";

export const maxDuration = 60;

/**
 * Transcribe un dictado.
 *
 * POR QUÉ NO LO HACE YA EL NAVEGADOR, que era la implementación anterior:
 *
 *   La primera versión usaba la Web Speech API (`webkitSpeechRecognition`). Es
 *   gratis e instantánea, pero se apoya en un servicio de Google al que el
 *   navegador tiene que poder llegar, y eso falla en más sitios de los que
 *   parece: Brave la trae presente pero sin claves, así que pide permiso al
 *   micrófono y acto seguido devuelve `network`; Firefox no la trae; y en
 *   cualquier red que filtre ese servicio, tampoco. El síntoma es siempre el
 *   mismo y desconcertante: el botón pide permiso, lo concedes y se para.
 *
 *   Grabando y transcribiendo aquí funciona en todo lo que tenga micrófono, que
 *   es todo. Y encima transcribe mejor: entiende el vocabulario de obra y
 *   devuelve "45º" y "4 m²" donde el navegador escribía "cuarenta y cinco
 *   grados" y "cuatro metros cuadrados".
 *
 * EL COSTE, dicho claro: esto sí consume cupo de IA, y el audio sí sale del
 * dispositivo — va a Google, igual que las fotos del diagnóstico. No se guarda
 * en ninguna parte: se transcribe y se descarta.
 */

/**
 * Tope del audio ya en base64.
 *
 * El cliente graba a 16 kHz mono de 16 bits, que son unos 43 KB de base64 por
 * segundo, y corta solo al minuto. 3 MB deja margen de sobra y se queda lejos
 * del límite de Vercel para el cuerpo de una petición (~4,5 MB).
 */
const MAX_BASE64 = 3 * 1024 * 1024;

/** Valor eficaz por debajo del cual se da el audio por vacío. Ver `hayVoz`. */
const SILENCIO_RMS = 0.004;

/**
 * ¿Hay algo que transcribir, o es silencio?
 *
 * ESTO NO ES UNA OPTIMIZACIÓN, es una barrera. Probado con audio en silencio, el
 * modelo devuelve frases enteras que nadie ha dicho: dos segundos de nada dieron
 * "4 m²" primero y "19 m² de recebido de obra" después. Una medición inventada
 * metida en la descripción de un presupuesto es mucho peor que un dictado que no
 * funciona, porque nadie la va a poner en duda.
 *
 * Se le pide al modelo que lo detecte —y con audios largos lo hace—, pero un
 * dato que se puede medir no se deja al criterio de un modelo. Se mide aquí, en
 * el servidor, donde no depende de que el navegador colabore, y de paso ese
 * audio no gasta cupo.
 *
 * El cliente manda siempre WAV PCM de 16 bits, así que basta con recorrer las
 * muestras. Si el formato no se reconoce, se deja pasar: prefiero transcribir de
 * más a bloquear un dictado bueno por no saber leer la cabecera.
 */
function hayVoz(wav: Buffer): boolean {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF") return true;

  // Buscar el trozo "data": la cabecera no siempre mide exactamente 44 bytes.
  let pos = 12;
  while (pos + 8 <= wav.length) {
    const id = wav.toString("ascii", pos, pos + 4);
    const tam = wav.readUInt32LE(pos + 4);
    if (id === "data") {
      const fin = Math.min(wav.length, pos + 8 + tam);
      let suma = 0;
      let n = 0;
      for (let i = pos + 8; i + 1 < fin; i += 2) {
        const m = wav.readInt16LE(i) / 32768;
        suma += m * m;
        n++;
      }
      if (!n) return false;
      return Math.sqrt(suma / n) >= SILENCIO_RMS;
    }
    pos += 8 + tam + (tam % 2); // los trozos van alineados a par
  }
  return true;
}

export async function POST(req: Request) {
  let empresaId: string;
  try {
    ({ empresaId } = await requireTenant());
  } catch {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  /**
   * Freno al abuso del cupo de IA.
   *
   * Sin esto, una sola cuenta en bucle vacía el cupo diario de Gemini y deja el
   * asistente muerto para TODAS las empresas de la plataforma, porque el cupo es
   * por proyecto. Con clave de pago, además, es dinero.
   */
  if (await limiteIaSuperado(empresaId)) {
    return NextResponse.json({ error: ERROR_LIMITE_IA }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta configurar GEMINI_API_KEY." }, { status: 500 });
  }

  let f: { audio?: string };
  try {
    f = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const audio = f.audio || "";
  if (!audio) return NextResponse.json({ error: "No se recibió ningún audio." }, { status: 400 });
  if (audio.length > MAX_BASE64) {
    return NextResponse.json({ error: "El dictado es demasiado largo. Dilo en tramos más cortos." }, { status: 400 });
  }

  if (!hayVoz(Buffer.from(audio, "base64"))) {
    return NextResponse.json(
      { error: "No se ha oído nada. Comprueba que el micrófono es el que crees y que no está silenciado." },
      { status: 422 }
    );
  }

  /**
   * OJO CON PONER EJEMPLOS DE MEDICIONES EN ESTE PROMPT.
   *
   * La primera versión decía: «escribe las mediciones en notación de obra: "4 m²",
   * "2,5 ml", "45º"». Probado con dos segundos de SILENCIO, devolvió «4 m²»:
   * copió el ejemplo del propio prompt. Un dictado que se inventa una medición y
   * la mete en la descripción de un presupuesto es mucho peor que uno que no
   * transcribe. Por eso la regla se describe sin dar ni un valor concreto.
   */
  const prompt = `Transcribe literalmente este dictado en español. Lo dicta un reformista o un constructor describiendo una obra, así que espera vocabulario de construcción: partidas, materiales, mediciones y patologías.

REGLAS
- Devuelve SOLO lo que se ha dicho. Nada de comillas, nada de comentarios, nada de "el audio dice".
- No resumas, no corrijas el estilo y no completes frases a medias. Es un dictado, no una redacción.
- Las cantidades y unidades que se digan, escríbelas con cifra y símbolo en lugar de con letra, tal y como se escriben en una medición de obra.
- Puntúa y acentúa con normalidad para que el texto se pueda leer.
- Si no se entiende un tramo, escribe [...] en su lugar en vez de inventarlo.
- Si el audio está en silencio, o no se oye ninguna voz humana, o no se entiende absolutamente nada, devuelve exactamente SIN_VOZ y nada más. No es un fallo: es la respuesta correcta, y es preferible a escribir algo que nadie ha dicho.`;

  const partes: Parte[] = [
    { inline_data: { mime_type: "audio/wav", data: audio } },
    { text: prompt },
  ];

  try {
    const r = await llamarAGemini(apiKey, partes, {
      maxOutputTokens: 2048,
      // Sin razonamiento: transcribir es literal, y pensarlo solo añade latencia
      // a algo que el usuario está esperando con el móvil en la mano.
      thinkingConfig: { thinkingLevel: "low" },
    });
    if (!r.ok) return respuestaDeError(r, "transcribir");

    const j = await r.json();
    // Se juntan todas las partes de texto en vez de coger la primera: cuando el
    // modelo razona, la respuesta puede venir repartida en varias.
    const texto = (j?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();

    // Alguna vez devuelve el texto entrecomillado pese a pedirle que no: se quita
    // aquí en vez de fiarlo al prompt.
    const limpio = texto.replace(/^["“”']+|["“”']+$/g, "").trim();

    if (!limpio || /^SIN_VOZ\b/i.test(limpio)) {
      return NextResponse.json(
        { error: "No se ha entendido nada. Acércate el micrófono y repítelo." },
        { status: 422 }
      );
    }

    return NextResponse.json({ texto: limpio });
  } catch (e: any) {
    console.error("Error transcribiendo:", e);
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "La transcripción ha tardado demasiado. Prueba con un dictado más corto."
          : "No se pudo transcribir. Vuelve a intentarlo.",
      },
      { status: 502 }
    );
  }
}
