import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { llamarAGemini, respuestaDeError, leerJson, type Parte } from "@/lib/gemini";

export const maxDuration = 60;

/**
 * Tope del archivo ya en base64. Vercel corta el cuerpo de una petición en torno
 * a 4,5 MB, y base64 engorda ~33%, así que 3 MB de base64 ≈ 2,2 MB de archivo.
 * El cliente además reduce las imágenes antes de enviarlas.
 */
const MAX_BASE64 = 3 * 1024 * 1024;

const TIPOS_ACEPTADOS = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

type EstanciaIA = { nombre?: string; m2?: number | null };

/**
 * Lee un plano y devuelve SOLO lo que está escrito en él.
 *
 * La regla de oro es que la IA lee, nunca mide. Medido en pruebas: leyendo el
 * cuadro de superficies acierta al centímetro, pero estimando sobre el dibujo se
 * equivocó hasta un 338% (una cocina de 12,1 m² la dio como 53 m²) y encima se
 * autocalificó de fiabilidad "media", así que ni siquiera avisa de que va
 * perdida. Un presupuesto de obra nueva con esas cifras delante de un cliente es
 * peor que no tener la función.
 *
 * Por eso el prompt prohíbe estimar, la respuesta viaja con `sinSuperficies`
 * cuando el plano no las trae, y el usuario confirma la tabla antes de generar.
 */
export async function POST(req: Request) {
  try {
    await requireTenant();
  } catch {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta la clave de la IA. Avisa al administrador (GEMINI_API_KEY)." },
      { status: 500 }
    );
  }

  let archivo: { mimeType?: string; datos?: string };
  try {
    archivo = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const { mimeType, datos } = archivo;
  if (!datos || !mimeType) {
    return NextResponse.json({ error: "No se recibió ningún plano." }, { status: 400 });
  }
  if (!TIPOS_ACEPTADOS.includes(mimeType)) {
    return NextResponse.json(
      { error: "Formato no admitido. Sube el plano en PDF, PNG o JPG." },
      { status: 400 }
    );
  }
  if (datos.length > MAX_BASE64) {
    return NextResponse.json(
      { error: "El plano pesa demasiado. Prueba a subirlo con menos resolución o solo la planta que te interesa." },
      { status: 400 }
    );
  }

  const prompt = `Eres un aparejador español leyendo un plano de arquitectura.

Extrae ÚNICAMENTE los datos que estén ESCRITOS en el plano: rótulos de estancias,
cuadro de superficies, cotas y notas de estructura o calidades.

REGLA INNEGOCIABLE: no estimes ni midas nada sobre el dibujo. Si una superficie no
está escrita, ponla a null. Es mucho mejor un null que un número inventado: el
usuario lo va a completar a mano. No deduzcas superficies a partir de las cotas
generales ni de la escala.

Responde SOLO con JSON válido, sin markdown, con este formato exacto:
{
  "estancias": [{"nombre": "Salón-comedor", "m2": 28.4}],
  "superficieUtil": 78.0,
  "superficieConstruida": 94.5,
  "plantas": 1,
  "estructura": "muros de carga y forjado unidireccional",
  "notas": "lo relevante para presupuestar que aparezca escrito (calidades, demoliciones marcadas, instalaciones)"
}
Cualquier campo que no aparezca escrito en el plano va a null. "estancias" puede
ser una lista vacía si el plano no rotula ninguna.`;

  const partes: Parte[] = [
    { inline_data: { mime_type: mimeType, data: datos } },
    { text: prompt },
  ];

  try {
    const r = await llamarAGemini(apiKey, partes, {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    });
    if (!r.ok) return respuestaDeError(r, "leer-plano");

    const parsed = leerJson(await r.json());

    const numeroONulo = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const estancias = (parsed.estancias || [])
      .map((e: EstanciaIA) => ({ nombre: (e.nombre || "").trim(), m2: numeroONulo(e.m2) }))
      .filter((e: { nombre: string }) => e.nombre);

    const superficieUtil = numeroONulo(parsed.superficieUtil);
    const superficieConstruida = numeroONulo(parsed.superficieConstruida);

    return NextResponse.json({
      estancias,
      superficieUtil,
      superficieConstruida,
      plantas: numeroONulo(parsed.plantas),
      estructura: (parsed.estructura || "").toString().trim() || null,
      notas: (parsed.notas || "").toString().trim() || null,
      // Lo usa el asistente para pedir las superficies a mano en vez de dejar que
      // el usuario dé por bueno un plano del que no se sacó nada medible.
      sinSuperficies:
        !superficieUtil && !superficieConstruida && !estancias.some((e: { m2: number | null }) => e.m2),
    });
  } catch (e: any) {
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    console.error("Error leyendo el plano:", e);
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "La lectura del plano tardó demasiado. Prueba con un archivo más ligero."
          : "No se pudo leer el plano. Comprueba que se ve con claridad, o escribe las superficies a mano.",
      },
      { status: 502 }
    );
  }
}
