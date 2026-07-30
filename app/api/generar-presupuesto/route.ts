import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { llamarAGemini, respuestaDeError, leerJson } from "@/lib/gemini";

/**
 * Una obra completa tarda ~18 s en generarse, y el límite por defecto de una
 * función en Vercel son 10 s: sin esto la petición se corta a media generación y
 * el asistente parece "no hacer nada". 60 s es el máximo del plan gratuito.
 */
export const maxDuration = 60;

type PartidaIA = {
  capitulo?: string;
  concepto?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precio?: number;
};

export async function POST(req: Request) {
  let db;
  try {
    ({ db } = await requireTenant());
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar GEMINI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const f = await req.json();

  // Filtrado por empresa: antes esto cargaba el catálogo de TODAS las empresas y lo
  // metía en el prompt que se manda a Google, así que cada cliente veía los precios
  // negociados de los demás en las partidas generadas.
  const [productos, proveedores] = await Promise.all([
    db.producto.findMany(),
    db.proveedor.findMany(),
  ]);
  const catalogo = productos
    .map((p) => {
      const prov = proveedores.find((x) => x.id === p.provId);
      return `${p.nombre} (${prov ? prov.nombre : "—"}): ${p.precio} €/${p.unidad}`;
    })
    .join("; ");

  /**
   * Superficies sacadas de un plano y **confirmadas por el usuario** en el
   * asistente. Se marcan como verificadas en el prompt para que el modelo mida
   * por estancia en lugar de repartir un total a ojo. Nunca llegan aquí cifras
   * que la IA haya estimado midiendo sobre el dibujo: la ruta que lee el plano
   * devuelve null cuando el dato no está escrito, precisamente para evitarlo.
   */
  const p = f.plano;
  const hayPlano = !!(p && (p.estancias?.length || p.superficieConstruida));

  const bloquePlano = hayPlano
    ? `
MEDICIONES DEL PLANO (verificadas por el usuario — son datos firmes, NO los cambies):
${(p.estancias || []).map((e: { nombre: string; m2: number }) => `- ${e.nombre}: ${e.m2} m²`).join("\n") || "- (sin desglose por estancia)"}
${p.superficieConstruida ? `- Superficie construida: ${p.superficieConstruida} m²` : ""}
${p.plantas ? `- Plantas: ${p.plantas}` : ""}
${p.estructura ? `- Estructura: ${p.estructura}` : ""}
${p.notas ? `- Notas del plano: ${p.notas}` : ""}`
    : "";

  /**
   * La orden de medir por estancia va en las REGLAS, no junto a los datos.
   *
   * Medido: poniéndola arriba, el modelo la ignoraba y presupuestaba con totales
   * redondos — quedaba sepultada bajo los 17 capítulos y la regla genérica de
   * "mediciones coherentes con la superficie indicada", que es la que ganaba.
   * Al final del prompt y en imperativo, sí desglosa por estancia.
   */
  const reglaPlano = hayPlano
    ? `- PRIORITARIO: mide cada partida sobre las MEDICIONES DEL PLANO, estancia por estancia, y usa esas cifras exactas como cantidad (28,4 m² se presupuesta como 28,4, no como 28 ni como 30). Cuando una partida afecte a varias estancias, suma solo las afectadas y detalla la suma en la descripción. Para paramentos verticales (alicatados, pintura, tabiquería) calcula la superficie a partir de los m² de suelo de esa estancia con altura libre de 2,50 m salvo que se indique otra, y explica el cálculo en la descripción. Esta regla manda sobre cualquier estimación por superficie total.
`
    : "";

  const prompt = `Eres un jefe de obra español experto en mediciones y presupuestos, y trabajas con la estructura de capítulos de los bancos de precios españoles (Generador de Precios de CYPE, IVE, BCCA). Cubres CUALQUIER trabajo de construcción: desde cambiar un plato de ducha hasta obra nueva, rehabilitación estructural, cubiertas, naves industriales o urbanización.

Datos del trabajo:
- Tipo de obra: ${f.tipo}
- Superficie aproximada: ${f.m2 || "no indicada"} m²
- Calidad de materiales: ${f.calidad}
- Zonas o estancias afectadas: ${f.estancias || "no indicadas"}
- Detalles adicionales: ${f.detalles || "ninguno"}
${bloquePlano}

Precios del catálogo propio de la empresa (úsalos cuando encajen, tienen prioridad sobre tu estimación): ${catalogo || "(vacío)"}

CAPÍTULOS DISPONIBLES — usa solo los que apliquen. Los números son solo para indicarte el orden de ejecución: NO los incluyas en el nombre del capítulo (escribe "Estructuras", nunca "5. Estructuras").
1. Actuaciones previas — desmontajes, apeos, apuntalamientos, catas.
2. Demoliciones
3. Acondicionamiento del terreno — desbroce, excavación, vaciados, rellenos, drenajes.
4. Cimentaciones — zapatas, losas, encepados, muros de sótano, recalces.
5. Estructuras — vigas, viguetas, bovedillas, pilares, forjados, losas, refuerzos metálicos, zunchos, cargaderos, reparación de estructura de hormigón o madera.
6. Fachadas y particiones — cerramientos, tabiquería, trasdosados.
7. Cubiertas — tejados, faldones, canalones, impermeabilización de cubierta, lucernarios.
8. Aislamientos e impermeabilizaciones
9. Instalaciones — fontanería, saneamiento, electricidad, climatización, ventilación, gas, telecomunicaciones, protección contra incendios, energía solar.
10. Carpintería, cerrajería y vidrios — puertas, ventanas, barandillas, rejas.
11. Revestimientos — solados, alicatados, enfoscados, falsos techos, pinturas.
12. Equipamiento — sanitarios, mobiliario de cocina, electrodomésticos.
13. Urbanización exterior — pavimentos, cerramientos de parcela, jardinería, redes exteriores.
14. Maquinaria y medios auxiliares — andamios, grúas, plataformas, contenedores, alquiler de maquinaria y herramienta específica de esta obra.
15. Gestión de residuos — obligatoria siempre que haya demoliciones o movimiento de tierras.
16. Seguridad y salud — obligatoria en toda obra: EPIs, protecciones colectivas, señalización.
17. Control de calidad — ensayos; inclúyelo cuando haya estructura o cimentación.

REGLAS:
${reglaPlano}- No dejes fuera ningún trabajo necesario para ejecutar y rematar la obra, aunque no lo mencionen los detalles. Si para sustituir una viga hay que apear antes, incluye el apeo. Si hay estructura, incluye control de calidad. En toda obra, seguridad y salud.
- El concepto es el nombre de la unidad de obra. La descripción es técnica y de una línea (material, formato, colocación; incluye mano de obra, medios auxiliares y parte proporcional de pequeño material).
- Unidades según el trabajo: ud, m², m³, ml, kg, t, h, día, pa (partida alzada). m³ para excavaciones, rellenos y hormigones; kg o t para acero; ml para vigas, canalones y zócalos; pa para lo difícil de medir.
- Precios unitarios realistas del mercado español actual para calidad ${String(f.calidad || "").toLowerCase()}, coherentes con los bancos de precios oficiales. El precio ES la unidad de obra completa (material + mano de obra + medios auxiliares), NO el material suelto.
- Mediciones coherentes con la superficie indicada. Si no la dan, estima una razonable para el tipo de obra y dilo en la descripción.
- La herramienta de uso general (radial, taladro, borriquetas) va incluida en el precio de cada partida, no como línea aparte. En "Maquinaria y medios auxiliares" solo va lo que se alquila o es específico de esta obra.

Responde SOLO con JSON válido, sin markdown ni texto adicional, con este formato exacto:
{"partidas":[{"capitulo":"...","concepto":"...","descripcion":"...","cantidad":1,"unidad":"ud|m²|m³|ml|kg|t|h|día|pa","precio":0}]}
Hasta 40 partidas, ordenadas por capítulo en el orden lógico de ejecución. Usa las que hagan falta: un baño necesita pocas, una obra nueva muchas.`;

  try {
    const r = await llamarAGemini(apiKey, [{ text: prompt }], {
      // Generoso: los modelos Gemini "thinking" gastan parte del presupuesto
      // razonando antes de escribir el JSON, y una obra completa llega a 40
      // partidas. Si se queda corto, el JSON sale cortado y no se puede leer.
      maxOutputTokens: 24576,
      responseMimeType: "application/json",
      // Baja el razonamiento interno: reduce la espera de ~46 s a ~18 s sin
      // perder calidad (mismos capítulos y partidas en las pruebas), y deja
      // margen de sobra frente al límite de 60 s de la función.
      thinkingConfig: { thinkingLevel: "low" },
    });
    if (!r.ok) return respuestaDeError(r, "generar-presupuesto");

    const parsed = leerJson(await r.json());

    // Aunque el prompt lo pide, el modelo a veces devuelve "5. Estructuras" con el
    // número de orden delante. Se quita aquí para que el presupuesto que ve el
    // cliente no lleve una numeración interna nuestra.
    const limpiarCapitulo = (c?: string) => (c || "Varios").replace(/^\s*\d+\s*[.)-]\s*/, "").trim() || "Varios";

    const lineas = (parsed.partidas || []).map((p: PartidaIA) => ({
      capitulo: limpiarCapitulo(p.capitulo),
      concepto: p.concepto || "",
      descripcion: p.descripcion || "",
      cantidad: Number(p.cantidad) || 1,
      unidad: p.unidad || "ud",
      precio: Number(p.precio) || 0,
    }));

    if (!lineas.length) throw new Error("sin partidas");

    return NextResponse.json({ lineas });
  } catch (e) {
    console.error("Error generando presupuesto con IA:", e);

    // Distinguir el caso lento del resto: es el más probable en obras grandes y
    // el consejo útil ("dilo más concreto") es distinto al de un fallo genérico.
    const seAgotoElTiempo = e instanceof DOMException && e.name === "TimeoutError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "La IA tardó demasiado. Prueba a describir la obra de forma más concreta o vuelve a intentarlo."
          : "No se pudo generar el presupuesto. Vuelve a intentarlo o crea las partidas a mano.",
      },
      { status: 502 }
    );
  }
}
