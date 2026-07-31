import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { llamarAGemini, respuestaDeError, leerJson, extraerLista } from "@/lib/gemini";
import { normalizarUnidad } from "@/lib/unidades";
import { aplicarCatalogo } from "@/lib/coincidencia";
import { revisarMediciones } from "@/lib/revision";
import { bloqueBaremo } from "@/lib/baremo";
import { normalizarIndirectos } from "@/lib/indirectos";

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
  const materiales = productos.filter((p) => p.tipo !== "PARTIDA");
  const partidasPropias = productos.filter((p) => p.tipo === "PARTIDA");

  const catalogo = materiales
    .map((p) => {
      const prov = proveedores.find((x) => x.id === p.provId);
      return `${p.nombre} (${prov ? prov.nombre : "—"}): ${p.precio} €/${p.unidad}`;
    })
    .join("; ");

  /**
   * Las partidas del catálogo NO se le pasan a la IA.
   *
   * Se hacía y salió mal: enumerárselas, aunque fuera con un "úsalas si
   * coinciden", bastaba para que las metiera en todos los presupuestos. Pedías
   * alicatar un aseo y aparecía "sustitución de plato de ducha" solo porque
   * estaba en el catálogo.
   *
   * Ahora la IA decide el contenido de la obra sin verlas, y el cruce se hace
   * después en `aplicarCatalogo`: si un trabajo que la IA ya decidió incluir
   * coincide con una partida tarifada, se le pone el precio y la redacción del
   * usuario. Así el catálogo puede cambiar precios, pero no añadir trabajo.
   */

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

  /**
   * Presupuesto de solo ejecución.
   *
   * Un reformista pide esto a menudo: el cliente compra por su cuenta sanitarios,
   * muebles o pavimento, y quiere presupuestar únicamente el trabajo. Sin esta
   * opción había que borrar a mano media docena de líneas cada vez.
   */
  const sinMateriales = !!f.sinMateriales;
  const reglaSinMateriales = sinMateriales
    ? `- PRIORITARIO — PRESUPUESTO DE SOLO EJECUCIÓN: el cliente aporta los materiales de acabado y equipamiento. NO incluyas ninguna partida de suministro de sanitarios, grifería, platos de ducha, mamparas, muebles, electrodomésticos, pavimentos, alicatados, azulejos, puertas ni ventanas.
  SÍ incluyes: mano de obra de colocación y montaje, demoliciones, retirada de escombros y gestión de residuos, ayudas de albañilería, instalaciones (fontanería, electricidad), medios auxiliares, seguridad y salud, y el pequeño material de agarre imprescindible (mortero, cola, sellantes, tacos, tubería, cable).
  En cada partida deja claro en la descripción que el material lo aporta el cliente, por ejemplo: "Colocación de plato de ducha aportado por la propiedad".
`
    : "";

  const prompt = `Eres un jefe de obra español experto en mediciones y presupuestos, y trabajas con la estructura de capítulos de los bancos de precios españoles (Generador de Precios de CYPE, IVE, BCCA). Cubres CUALQUIER trabajo de construcción: desde cambiar un plato de ducha hasta obra nueva, rehabilitación estructural, cubiertas, naves industriales o urbanización.

Datos del trabajo:
- Tipo de obra: ${f.tipo}
- Superficie aproximada: ${f.m2 || "no indicada"} m²
- Calidad de materiales: ${f.calidad}
- Zonas o estancias afectadas: ${f.estancias || "no indicadas"}
- Detalles adicionales: ${f.detalles || "ninguno"}
${sinMateriales ? "- ALCANCE: solo ejecución. Los materiales de acabado y equipamiento los aporta el cliente." : ""}
${bloquePlano}

Precios del catálogo propio de la empresa (úsalos cuando encajen, tienen prioridad sobre tu estimación): ${catalogo || "(vacío)"}
${bloqueBaremo(sinMateriales)}

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
${reglaSinMateriales}${reglaPlano}- CIÑE EL PRESUPUESTO A LO QUE PIDEN. Presupuesta el trabajo descrito y lo que sea imprescindible para ejecutarlo y rematarlo, nada más. Si piden alicatar, no añadas el solado; si piden cambiar una ventana, no toques la persiana; si piden un baño completo, ahí sí entra todo. Ampliar el alcance por tu cuenta le hace perder una obra al usuario por precio.
- Cada trabajo, UNA sola partida. No desdobles la misma unidad de obra en dos líneas ni repitas un trabajo con otro nombre. Solado (suelo) y alicatado (paredes) son distintos y se miden aparte, pero solo van los que se hayan pedido.
- Dentro de ese alcance, no dejes fuera ningún trabajo necesario para ejecutarlo y rematarlo, aunque no lo mencionen los detalles. Si para sustituir una viga hay que apear antes, incluye el apeo. Si hay estructura, incluye control de calidad. En toda obra, seguridad y salud.
- El concepto es el nombre de la unidad de obra. La descripción es técnica y de una línea (material, formato, colocación; incluye mano de obra, medios auxiliares y parte proporcional de pequeño material).
- Unidades según el trabajo: ud, m², m³, ml, kg, t, h, día, pa (partida alzada). m³ para excavaciones, rellenos y hormigones; kg o t para acero; ml para vigas, canalones y zócalos; pa para lo difícil de medir.
- Precios unitarios realistas del mercado español actual para calidad ${String(f.calidad || "").toLowerCase()}, coherentes con los bancos de precios oficiales. El precio ES la unidad de obra completa (material + mano de obra + medios auxiliares), NO el material suelto.
- MANDAN LOS DETALLES SOBRE EL TIPO DE OBRA. El tipo es solo la familia del trabajo; lo que hay que hacer está en los detalles. Si el tipo dice "Baño completo" pero los detalles piden únicamente alicatar el suelo, presupuesta SOLO eso: nada de fontanería, sanitarios ni electricidad.
- LA SUPERFICIE INDICADA ES LA MEDICIÓN DEL TRABAJO. Si piden alicatar 4 m², son 4 m² de alicatado, no la superficie de la estancia. Solo conviertes de suelo a paredes cuando el trabajo abarca la estancia entera (un baño completo, una reforma integral) y, si lo haces, escribe el cálculo en la descripción ("perímetro 8 m × 2,5 m de altura"). Nunca multipliques la medición que te han dado sin decir por qué.
- CANTIDADES REALISTAS, Y NUNCA UNA SUPERFICIE COMO NÚMERO DE UNIDADES. Lo que se mide en "ud" lleva las unidades que de verdad hay: un plato de ducha, un inodoro, un lavabo, una mampara son 1 ud en un baño normal. Un "15 ud" de plato de ducha significa quince platos de ducha y es un disparate. Si dudas entre medir en ud o en m², elige la que corresponda al trabajo y ajusta el precio unitario a esa unidad.
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

    const lineas = extraerLista(parsed, "partidas").map((p: PartidaIA) => ({
      capitulo: limpiarCapitulo(p.capitulo),
      // A veces el modelo deja el concepto en blanco, sobre todo en las partidas
      // de seguridad o residuos. Una fila sin concepto en el documento que ve el
      // cliente es peor que una redundante: se rellena con el capítulo.
      concepto: (p.concepto || "").trim() || limpiarCapitulo(p.capitulo),
      descripcion: p.descripcion || "",
      cantidad: Number(p.cantidad) || 1,
      // La IA escribe "m2" o "M²" según le da; sin normalizar, dos líneas iguales
      // quedarían medidas en unidades distintas y el desplegable no las reconocería.
      unidad: normalizarUnidad(p.unidad),
      precio: Number(p.precio) || 0,
    }));

    if (!lineas.length) throw new Error("sin partidas");

    // El catálogo entra AQUÍ, sobre lo que la IA ya decidió incluir: puede
    // cambiar el precio y la redacción de un trabajo, nunca añadir uno nuevo.
    const { lineas: conCatalogo, aplicadas } = aplicarCatalogo(
      lineas,
      partidasPropias.map((p) => ({
        nombre: p.nombre,
        descripcion: p.descripcion,
        capitulo: p.capitulo,
        unidad: p.unidad,
        precio: p.precio,
      }))
    );

    // Los indirectos (seguridad y salud, residuos, control de calidad) se calculan
    // como porcentaje de la obra en vez de estimarse. Es lo que hace que el mismo
    // trabajo cueste lo mismo en dos generaciones distintas.
    const { lineas: finales } = normalizarIndirectos(conCatalogo);

    // Red de seguridad: las reglas del prompt reducen los disparates de medicion,
    // pero no los eliminan. Lo dudoso se le senala al usuario en vez de corregirlo
    // a su espalda, porque una medicion es decision suya.
    const avisos = revisarMediciones(finales, Number(f.m2) || undefined);

    return NextResponse.json({ lineas: finales, partidasPropiasAplicadas: aplicadas, avisos });
  } catch (e: any) {
    console.error("Error generando presupuesto con IA:", e);

    // El mensaje no culpa al usuario de escribir de más: llegar aquí significa
    // que Gemini no contestó ni al reintento, y eso pasa igual con un baño de
    // cuatro líneas que con una obra entera. Pedirle "descríbelo más concreto"
    // le hacía perder el tiempo reescribiendo algo que no era el problema.
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "El servicio de IA no ha respondido a tiempo. Vuelve a intentarlo: casi siempre va a la segunda."
          : "No se pudo generar el presupuesto. Vuelve a intentarlo o crea las partidas a mano.",
      },
      { status: 502 }
    );
  }
}
