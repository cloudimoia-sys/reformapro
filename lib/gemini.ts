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
const MINIMO_PARA_REINTENTAR_MS = 20000;

/**
 * Llama a Gemini reintentando los fallos pasajeros, sin pasarse del reloj.
 *
 * La capa gratuita satura a ratos (429) y Google devuelve 500/503 de vez en
 * cuando; también se ralentiza mucho bajo carga. Sin reintento, ese tropiezo
 * momentáneo se le presenta al usuario como "no se pudo generar", justo cuando
 * puede estar enseñándoselo a un cliente.
 *
 * Cada intento solo dispone del tiempo que quede del presupuesto total, así que
 * reintentar nunca provoca que Vercel corte la función a medias.
 */
export async function llamarAGemini(
  apiKey: string,
  partes: Parte[],
  generationConfig: Record<string, unknown>
): Promise<Response> {
  const cuerpo = JSON.stringify({ contents: [{ parts: partes }], generationConfig });
  const empezoEn = Date.now();
  let ultima: Response | null = null;

  for (let intento = 1; ; intento++) {
    const restante = LIMITE_TOTAL_MS - (Date.now() - empezoEn);
    if (restante <= 0) break;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
        signal: AbortSignal.timeout(restante),
      }
    );
    if (r.ok) return r;
    ultima = r;

    const esPasajero = r.status === 429 || r.status >= 500;
    const quedaTiempo = LIMITE_TOTAL_MS - (Date.now() - empezoEn) > MINIMO_PARA_REINTENTAR_MS;
    if (!esPasajero || !quedaTiempo) return r;

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
