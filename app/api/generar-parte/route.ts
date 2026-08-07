import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { limiteIaSuperado, ERROR_LIMITE_IA } from "@/lib/limite";
import { llamarAGemini, respuestaDeError, leerJson, extraerLista, comoDato, type Parte } from "@/lib/gemini";
import { aplicarCatalogo, type PartidaCatalogo } from "@/lib/coincidencia";
import { lineasSinCantidad, type LineaGeneradaParte } from "@/lib/parteTrabajo";

export const maxDuration = 60;

/**
 * Estructura por IA lo que el técnico ha dictado tras una visita, en líneas de
 * mano de obra y de material.
 *
 * NO ES UN ASISTENTE QUE ESTIME, es un asistente que ORDENA. La diferencia
 * importa: un presupuesto es una previsión de lo que hará falta, así que tiene
 * sentido que la IA proponga cantidades razonables sobre las que el usuario
 * corrige. Un parte de trabajo es el registro de lo que YA HA PASADO, y es lo
 * que el cliente firma — si la IA rellenara unas horas o una cantidad de
 * material que no dijo nadie, el parte dejaría de ser un registro de la
 * realidad para ser una redacción plausible de ella.
 *
 * Por eso el prompt exige 0 en cualquier cifra que el técnico no haya dicho
 * explícitamente, y esta ruta NO SE FÍA de que el modelo lo cumpla: cualquier
 * línea que llegue sin cantidad se manda de vuelta al cliente en `revisar`,
 * igual que `faltan()` hace con un presupuesto incompleto. Y el precio nunca
 * lo pone la IA — sale del catálogo si hay coincidencia, o se queda a 0 para
 * que lo ponga el técnico o administración, como cualquier línea manual.
 */
export async function POST(req: Request) {
  let empresaId: string;
  let db: Awaited<ReturnType<typeof requireTenant>>["db"];
  try {
    ({ empresaId, db } = await requireTenant());
  } catch {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  // Mismo freno que el resto de rutas de IA: el cupo es por proyecto, no por
  // empresa, así que una sola cuenta en bucle lo deja seco para todas.
  if (await limiteIaSuperado(empresaId)) {
    return NextResponse.json({ error: ERROR_LIMITE_IA }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta la clave de la IA. Avisa al administrador (GEMINI_API_KEY)." },
      { status: 500 }
    );
  }

  let f: { descripcion?: string };
  try {
    f = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const descripcion = (f.descripcion || "").trim();
  if (!descripcion) {
    return NextResponse.json(
      { error: "Dicta o escribe qué has hecho: la IA solo estructura lo que le cuentes, no puede partir de nada." },
      { status: 400 }
    );
  }

  const catalogo = await db.producto.findMany();
  // Separado por tipo para que una tarea de mano de obra no case por error con
  // un material del catálogo, ni al revés: son dos listas de nombres muy
  // distintas y mezclarlas solo aumenta el riesgo de una coincidencia falsa.
  const catalogoManoObra: PartidaCatalogo[] = catalogo
    .filter((p) => p.tipo === "PARTIDA")
    .map((p) => ({ nombre: p.nombre, descripcion: p.descripcion, capitulo: null, unidad: p.unidad, precio: p.precio }));
  const catalogoMaterial: PartidaCatalogo[] = catalogo
    .filter((p) => p.tipo !== "PARTIDA")
    .map((p) => ({ nombre: p.nombre, descripcion: p.descripcion, capitulo: null, unidad: p.unidad, precio: p.precio }));

  const prompt = `Eres un ayudante que ESTRUCTURA en líneas lo que un técnico ha dictado tras una visita de obra. No calculas nada, no estimas nada, no rellenas huecos: solo separas en líneas lo que el técnico YA HA DICHO con sus propias palabras.

${comoDato("descripción dictada por el técnico", descripcion)}

REGLAS, TODAS OBLIGATORIAS Y SIN EXCEPCIÓN:
- Una línea de MANO DE OBRA por cada tarea o bloque de tareas que el técnico distinga como una unidad de tiempo. Si dice "he tardado 3 horas entre el grifo y la ducha", eso es UNA línea de 3 horas que las agrupa a las dos, no dos líneas repartidas a ojo entre ambas.
- "horas" va a 0 si el técnico NO ha dicho un número de horas para esa tarea en concreto. Prohibido estimar cuánto "suele" tardar un trabajo así: si no hay un número dicho, es 0.
- Una línea de MATERIAL por cada material que el técnico nombre.
- "cantidad" va a 0 si el técnico NO ha dicho cuántas unidades, metros, litros, etc. Prohibido adivinar una cantidad "razonable": si no hay un número dicho, es 0.
- "unidad" del material: ud, m, m², m³, kg, l, ml, caja, saco, rollo — la que mejor encaje; si no está claro, "ud".
- "precio" va SIEMPRE a 0 en las dos listas, en todas las líneas, sin excepción. El precio no lo decides tú: lo pone el catálogo de la empresa o el propio técnico.
- PROHIBIDO añadir ninguna tarea ni ningún material que el texto no nombre, por muy obvio que parezca que hacía falta. Si el técnico no lo dijo, no existe.
- Si el técnico no ha dicho nada de mano de obra, o nada de material, esa lista se queda vacía. No inventes una línea para no dejarla en blanco.

Devuelve SOLO este JSON, sin explicación ni texto alrededor:
{"manoObra":[{"concepto":"...","horas":0}],"material":[{"concepto":"...","cantidad":0,"unidad":"ud"}]}`;

  const partes: Parte[] = [{ text: prompt }];

  try {
    const r = await llamarAGemini(apiKey, partes, {
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
    if (!r.ok) return respuestaDeError(r, "generar-parte");

    const parsed = leerJson(await r.json());

    const manoObraCruda = extraerLista(parsed, "manoObra")
      .map((l: any) => ({
        tipo: "MANO_OBRA" as const,
        concepto: String(l.concepto ?? "").trim(),
        descripcion: "",
        // Nunca negativo: una IA divagando podría devolver -1 y aquí se
        // trataría como "sin cantidad", que es exactamente lo correcto.
        cantidad: Math.max(0, Number(l.horas) || 0),
        unidad: "h",
        precio: 0,
        capitulo: "",
      }))
      .filter((l) => l.concepto);

    const materialCrudo = extraerLista(parsed, "material")
      .map((l: any) => ({
        tipo: "MATERIAL" as const,
        concepto: String(l.concepto ?? "").trim(),
        descripcion: "",
        cantidad: Math.max(0, Number(l.cantidad) || 0),
        unidad: String(l.unidad ?? "ud").trim() || "ud",
        precio: 0,
        capitulo: "",
      }))
      .filter((l) => l.concepto);

    if (!manoObraCruda.length && !materialCrudo.length) {
      throw new Error("sin lineas");
    }

    // El catálogo pone el precio real cuando hay coincidencia clara — el mismo
    // criterio, ya probado, que usan los presupuestos. Si no hay coincidencia,
    // la línea se queda a precio 0: nunca lo inventa la IA.
    const { lineas: manoObraConPrecio, aplicadas: aplicadasManoObra } = aplicarCatalogo(manoObraCruda, catalogoManoObra);
    const { lineas: materialConPrecio, aplicadas: aplicadasMaterial } = aplicarCatalogo(materialCrudo, catalogoMaterial);

    // `aplicarCatalogo` es genérica y su tipo de salida no lleva "tipo": se
    // vuelve a etiquetar aquí a partir de qué lista es cada una, no leyéndolo
    // del objeto (que ya no lo tiene en su tipo, aunque en runtime sí).
    const lineas: LineaGeneradaParte[] = [
      ...manoObraConPrecio.map((l) => ({ tipo: "MANO_OBRA" as const, concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad, precio: l.precio })),
      ...materialConPrecio.map((l) => ({ tipo: "MATERIAL" as const, concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad, precio: l.precio })),
    ];

    return NextResponse.json({
      lineas,
      aplicadas: [...aplicadasManoObra, ...aplicadasMaterial],
      revisar: lineasSinCantidad(lineas),
    });
  } catch (e: any) {
    console.error("Error generando parte con IA:", e);
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "El servicio de IA no ha respondido a tiempo. Vuelve a intentarlo."
          : "No se pudo estructurar el texto. Vuelve a intentarlo o rellena las líneas a mano.",
      },
      { status: 502 }
    );
  }
}
