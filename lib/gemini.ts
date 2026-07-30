import { NextResponse } from "next/server";

/**
 * Modelo fijo a propósito, NO un alias "-latest".
 *
 * `gemini-flash-latest` apunta siempre al modelo más reciente, y los recién
 * salidos traen el cupo gratuito más estrecho: acabó resolviendo a
 * gemini-3.6-flash, con un tope de **20 peticiones al día para todo el
 * proyecto** (`generate_content_free_tier_requests, limit: 20`). Como el cupo es
 * por modelo y lo comparten todas las empresas de la app, se agotaba en una
 * tarde y el asistente fallaba sin motivo aparente.
 *
 * Fijando la versión, el cupo deja de cambiar bajo nuestros pies cuando Google
 * publica un modelo nuevo. Medido con una obra nueva completa: 28 partidas en 12
 * capítulos, 6,2 s, ~985 €/m² (realista). Si algún día conviene otro, se cambia
 * con la variable GEMINI_MODEL sin tocar código.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/** Una parte del mensaje: texto, o un archivo (imagen/PDF) en base64. */
export type Parte =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

/** Presupuesto total de la petición: la función de Vercel muere a los 60 s. */
const LIMITE_TOTAL_MS = 52000;
/** Por debajo de esto no merece la pena reintentar: no daría tiempo a terminar. */
const MINIMO_PARA_REINTENTAR_MS = 18000;
/**
 * Tope de cada intento por separado.
 *
 * Es la pieza clave: una generación normal tarda 6-8 s, así que 22 s ya es de
 * sobra. Sin este tope, un único intento colgado se comía los 52 s enteros y no
 * quedaba margen para reintentar — y quedarse colgado es precisamente el fallo
 * más habitual de la capa gratuita (medido: 26 s para un texto trivial). Cortando
 * antes, un cuelgue deja sitio a un segundo intento que casi siempre va bien.
 */
const LIMITE_POR_INTENTO_MS = 22000;

/**
 * Llama a Gemini reintentando los fallos pasajeros, sin pasarse del reloj.
 *
 * La capa gratuita satura a ratos (429), Google devuelve 500/503 de vez en
 * cuando, y a ratos simplemente no contesta. Sin reintento, ese tropiezo
 * momentáneo se le presenta al usuario como "no se pudo generar", justo cuando
 * puede estar enseñándoselo a un cliente.
 *
 * Los tres fallos —error, caída y cuelgue— se tratan igual: si queda tiempo, se
 * vuelve a intentar. Nunca se sobrepasa el presupuesto total, así que reintentar
 * jamás provoca que Vercel corte la función a medias.
 */
export async function llamarAGemini(
  apiKey: string,
  partes: Parte[],
  generationConfig: Record<string, unknown>
): Promise<Response> {
  const cuerpo = JSON.stringify({ contents: [{ parts: partes }], generationConfig });
  const empezoEn = Date.now();
  const restante = () => LIMITE_TOTAL_MS - (Date.now() - empezoEn);
  let ultima: Response | null = null;

  for (let intento = 1; ; intento++) {
    const margen = restante();
    if (margen <= 0) break;

    let r: Response;
    try {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: cuerpo,
          signal: AbortSignal.timeout(Math.min(margen, LIMITE_POR_INTENTO_MS)),
        }
      );
    } catch (e: any) {
      // Cuelgue o corte de red. Se reintenta como cualquier otro fallo pasajero;
      // si ya no queda tiempo, se propaga y la ruta avisa de que tardó demasiado.
      const esCuelgue = e?.name === "TimeoutError" || e?.name === "AbortError";
      if (!esCuelgue || restante() < MINIMO_PARA_REINTENTAR_MS) throw e;
      console.warn(`Gemini no respondió a tiempo; reintento ${intento}`);
      continue;
    }

    if (r.ok) return r;
    ultima = r;

    const esPasajero = r.status === 429 || r.status >= 500;
    if (!esPasajero || restante() < MINIMO_PARA_REINTENTAR_MS) return r;

    console.warn(`Gemini respondió ${r.status}; reintento ${intento}`);
    await new Promise((res) => setTimeout(res, 1500));
  }
  return ultima!;
}

/**
 * Convierte un fallo de Gemini en una respuesta con un motivo en español.
 *
 * Mensajes distintos porque lo que puede hacer el usuario es distinto en cada
 * caso: esperar, avisar al administrador, o revisar la cuenta de Google.
 */
export async function respuestaDeError(r: Response, contexto: string) {
  const detalle = await r.text();
  console.error(`Error de Gemini (${contexto}):`, r.status, detalle);

  const porEstado: Record<number, string> = {
    429: "El servicio de IA está saturado o has agotado la cuota diaria gratuita. Espera un minuto y vuelve a intentarlo.",
    400: "La IA rechazó la petición. Prueba con un archivo más pequeño o menos detalles.",
    403: "La clave de la IA no es válida o no tiene permiso. Revisa GEMINI_API_KEY.",
  };
  return NextResponse.json(
    {
      error:
        porEstado[r.status] ||
        (r.status >= 500
          ? "El servicio de IA está caído ahora mismo. Inténtalo en unos minutos."
          : "El proveedor de IA no respondió correctamente."),
    },
    { status: 502 }
  );
}

/** Extrae el JSON de la respuesta, tolerando que venga envuelto en markdown. */
export function leerJson(data: any): any {
  const texto = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n") || "";
  return JSON.parse(texto.replace(/```json|```/g, "").trim());
}
