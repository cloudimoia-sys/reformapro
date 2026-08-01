import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { llamarAGemini, respuestaDeError, leerJson, extraerLista, type Parte } from "@/lib/gemini";
import { guionDe, JURAMENTO, DECLARACION_TACHAS, type TipoInforme } from "@/lib/informe";
import { textoSospechoso, faltanReposiciones } from "@/lib/revision";
import { normalizarIndirectos } from "@/lib/indirectos";
import { bloqueBaremo } from "@/lib/baremo";
import { definicionDe } from "@/lib/documentos";

export const maxDuration = 60;

/**
 * Tope de imágenes que se mandan a analizar.
 *
 * No es un capricho: cada foto ocupa cientos de tokens y alarga la respuesta, y
 * Vercel corta el cuerpo de la petición en torno a 4,5 MB. Con ocho hay de sobra
 * para documentar una inspección; las demás se guardan en el informe igualmente,
 * solo que no entran en el análisis.
 */
const MAX_IMAGENES = 8;
const MAX_BASE64_TOTAL = 3.5 * 1024 * 1024;

type Imagen = { mimeType: string; datos: string; pie?: string; esPlano?: boolean };

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

  let f: {
    tipo?: TipoInforme;
    inmueble?: string;
    solicitante?: string;
    perito?: string;
    titulacion?: string;
    colegiado?: string;
    antecedentes?: string;
    danos?: string;
    imagenes?: Imagen[];
  };
  try {
    f = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  // El tipo se valida contra la tabla: lo que llegue del navegador no elige
  // plantilla por su cuenta.
  const { tipo, def } = definicionDe(String(f.tipo || ""));
  if (!f.danos?.trim()) {
    return NextResponse.json(
      { error: `${def.pregunta}: es lo que da contenido al documento.` },
      { status: 400 }
    );
  }

  const imagenes = (f.imagenes || []).slice(0, MAX_IMAGENES);
  const pesoTotal = imagenes.reduce((s, i) => s + (i.datos?.length || 0), 0);
  if (pesoTotal > MAX_BASE64_TOTAL) {
    return NextResponse.json(
      { error: "Las fotos pesan demasiado en conjunto. Sube menos fotos o de menor resolución." },
      { status: 400 }
    );
  }

  const listaImagenes = imagenes.length
    ? imagenes
        .map((im, i) => `[Imagen ${i + 1}] ${im.esPlano ? "PLANO" : "FOTO"}${im.pie ? ` — ${im.pie}` : ""}`)
        .join("\n")
    : "(no se aportan imágenes)";

  const prompt = `Eres un arquitecto técnico español con veinte años de oficio, y redactas la documentación de obra que se entrega a clientes, aseguradoras, administraciones y juzgados. Escribes en el registro propio de cada documento: preciso, impersonal y sin adornos.

TIPO DE DOCUMENTO: ${def.etiqueta}

DATOS APORTADOS
- Inmueble: ${f.inmueble || "no indicado"}
- Solicitante: ${f.solicitante || "no indicado"}
- Perito que firma: ${f.perito || "no indicado"}${f.titulacion ? ` (${f.titulacion})` : ""}${f.colegiado ? `, colegiado nº ${f.colegiado}` : ""}
- Antecedentes: ${f.antecedentes || "no se aportan"}
- ${def.pregunta}: ${f.danos}

IMÁGENES ADJUNTAS (analízalas de verdad, están al principio de este mensaje):
${listaImagenes}

APARTADOS OBLIGATORIOS, en este orden y con esta numeración:
${guionDe(tipo)}

REGLAS DE REDACCIÓN
- Describe SOLO lo que se sostenga en los datos aportados o se aprecie en las imágenes. Cuando algo no conste, escribe "no consta" o "no se ha podido determinar con los datos disponibles". Es preferible a inventarlo: este documento puede acabar ante un juez.
- Cuando una afirmación se apoye en una imagen, cítala como (Imagen 2). No cites imágenes que no existan.
- FORMATO DE LOS TEXTOS: usa etiquetas al principio de línea y un SALTO DE LÍNEA entre cada una. Nunca encadenes las etiquetas en un párrafo corrido. Para cada lesión, exactamente así:
Ubicación: dónde está.
Patología: qué le pasa al elemento.
Efectos colaterales: qué provoca en lo que tiene alrededor.
Causa origen: por qué ha pasado.
Evolución previsible: qué ocurrirá si no se interviene.
- En la valoración de riesgos, la primera línea es siempre "NIVEL DE GRAVEDAD: BAJO|MODERADO|ALTO|MUY ALTO (motivo entre paréntesis)" y debajo, en líneas aparte, el riesgo concreto.
- En la propuesta de actuación, cada fase lleva su propio subapartado, y dentro los trabajos van uno por línea con su etiqueta ("Apeo preventivo: ...", "Saneado: ...").
- Gradúa la gravedad con criterio estructural: MUY ALTO solo si hay riesgo de colapso o pérdida de capacidad portante.
- Propón soluciones constructivas concretas y ejecutables, con su justificación técnica (por qué esa y no otra).
${def.conPresupuesto ? `- EL PRESUPUESTO TIENE QUE CUBRIR LA PROPUESTA ENTERA. Repasa las fases que has escrito y comprueba que cada trabajo tiene su partida. Si propones reponer bovedillas, presupuesta la reposición, no solo el saneado.
- TODO LO QUE SE PICA SE REPONE. Detrás de cada demolición, picado o retirada van sus partidas de reposición y acabado: reponer el elemento, enfoscar, enlucir y pintar. Un presupuesto que abre la obra y no la cierra deja al cliente con el techo abierto y al reformista pagando la diferencia.` : ""}
${tipo === "PERICIAL" ? `- El juramento y la declaración de tachas los añade el sistema: no los redactes ni los resumas.\n- Delimita el ALCANCE con honestidad: di expresamente qué no se ha podido comprobar (sin catas, sin acceso, sin proyecto). Un informe que no acota su alcance se vuelve en contra del perito.\n` : ""}${def.conPresupuesto ? '- No redactes el apartado económico como texto: rellena "partidas".' : ""}

${def.conPresupuesto ? bloqueBaremo(false) : ""}

${def.conPresupuesto ? `PARTIDAS, POR CAPÍTULOS. Agrupa el presupuesto en capítulos de obra y numera en dos niveles: el capítulo es "01", "02", "03" y sus partidas "01.01", "01.02". Todas las partidas de un mismo elemento o fase van en el mismo capítulo.

Marca con "opcional": true las mejoras recomendables que NO hacen falta para resolver la patología (por ejemplo, revestir y pintar todo un techo cuando solo se ha intervenido en una zona). Van al final de su capítulo. Lo obligatorio y lo opcional se suman por separado: si se mezclan, el cliente ve una cifra más alta de la necesaria y se echa atrás.

Presupuesto de ejecución material de la reparación, con precios reales del mercado español actual. Incluye SIEMPRE seguridad y salud y gestión de residuos: son obligatorias en cualquier obra y su ausencia deja el presupuesto corto. Escribe todo en español, sin una sola palabra ni carácter de otro idioma. El precio es la unidad de obra completa (material, mano de obra y medios auxiliares). Códigos jerárquicos por capítulos: 01, 01.01, 01.02, 02, 02.01…` : "Este documento NO lleva presupuesto: devuelve \"partidas\" como lista vacía."}

Responde SOLO con JSON válido, sin markdown:
{
 "titulo": "título del informe",
 "apartados": [{"numero":"1","titulo":"...","texto":"...","subapartados":[{"titulo":"...","texto":"..."}]}],
 "partidas": [{"codigo":"01.01","descripcion":"...","unidad":"ud|m|m²|m³|kg|pa","cantidad":1,"precio":0,"opcional":false}],
 "dictamen": "conclusión final, con la urgencia de la intervención"
}
"subapartados" solo cuando el apartado los necesite; si no, omítelo.`;

  // Las imágenes van ANTES del texto: Gemini las relaciona mejor con las
  // instrucciones cuando ya las ha visto al llegar a ellas.
  const partes: Parte[] = [
    ...imagenes.map(
      (im): Parte => ({ inline_data: { mime_type: im.mimeType, data: im.datos } })
    ),
    { text: prompt },
  ];

  try {
    const r = await llamarAGemini(apiKey, partes, {
      // Un pericial son 13 apartados con texto extenso: se queda corto por debajo.
      maxOutputTokens: 32768,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
    if (!r.ok) return respuestaDeError(r, "generar-informe");

    const parsed = leerJson(await r.json());

    const apartados = extraerLista(parsed, "apartados")
      .map((a: any) => ({
        numero: String(a.numero ?? "").trim(),
        titulo: String(a.titulo ?? "").trim(),
        texto: String(a.texto ?? "").trim(),
        subapartados: (a.subapartados || [])
          .map((s: any) => ({ titulo: String(s.titulo ?? "").trim(), texto: String(s.texto ?? "").trim() }))
          .filter((s: any) => s.titulo || s.texto),
      }))
      .filter((a: any) => a.titulo);

    if (!apartados.length) throw new Error("sin apartados");

    /**
     * El juramento se pone aquí, no se le pide a la IA.
     *
     * Es una fórmula legal del art. 335 LEC: si el modelo la parafrasea —y en las
     * pruebas a veces la resumía— el dictamen deja de cumplir el requisito y no
     * sirve ante un juzgado. Insertándolo nosotros, el texto es siempre exacto.
     */
    if (tipo === "PERICIAL") {
      const iPerito = apartados.findIndex((a: any) => /perito|juramento|tacha/i.test(a.titulo));
      if (iPerito >= 0) {
        let t = apartados[iPerito].texto;
        if (!t.includes("335")) t = `${t}\n\n${JURAMENTO}`;
        // La tacha (art. 343) es lo que permite a la parte contraria recusar al
        // perito: declararla expresamente se adelanta a esa objeción.
        if (!t.includes("343")) t = `${t}\n\n${DECLARACION_TACHAS}`;
        apartados[iPerito].texto = t.trim();
      }
    }

    /**
     * Apartados que la IA dejó en blanco.
     *
     * Pasa de vez en cuando, y justo en los largos: en una prueba dejó vacío
     * "Origen de las lesiones y análisis de causas", que es el corazón de un
     * pericial. Se avisa al usuario en el editor en lugar de dejar que lo
     * descubra el día que lo presenta.
     */
    const vacios = apartados
      .filter((a: any) => !a.texto && !a.subapartados?.length)
      .map((a: any) => `${a.numero}. ${a.titulo}`);

    const partidas = extraerLista(parsed, "partidas")
      .map((p: any) => ({
        codigo: String(p.codigo ?? "").trim(),
        descripcion: String(p.descripcion ?? "").trim(),
        unidad: String(p.unidad ?? "ud").trim(),
        cantidad: Number(p.cantidad) || 0,
        precio: Number(p.precio) || 0,
        opcional: p.opcional === true,
      }))
      .filter((p: any) => p.descripcion);

    /**
     * Los indirectos del informe pasan por el mismo cálculo por porcentaje que
     * los del presupuesto. Sin esto salían a ojo: en un informe real, seguridad
     * y salud (200 €) más gestión de residuos (250 €) sumaban 450 € sobre 1.397 €
     * de obra, un 32%.
     */
    const partidasFinales = normalizarIndirectos(
      partidas.map((p: any) => ({
        capitulo: "",
        concepto: p.descripcion,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        unidad: p.unidad,
        precio: p.precio,
      }))
    ).lineas.map((l: any, i: number) => ({ ...partidas[i], cantidad: l.cantidad, unidad: l.unidad, precio: l.precio }));

    const dictamen = String(parsed.dictamen || "").trim();

    /**
     * Avisos de calidad sobre el documento generado.
     *
     * Salen de un informe real entregado a un cliente: llevaba caracteres chinos
     * en una partida ("tablones de repart荷重"), no incluía seguridad y salud pese
     * a presupuestar un apuntalamiento de forjado, y calificaba el riesgo de MUY
     * ALTO sin una sola fotografía que lo respaldara.
     */
    const avisos: string[] = [];

    avisos.push(
      ...textoSospechoso([
        ...apartados.map((a: any) => ({ donde: `Apartado ${a.numero}`, texto: `${a.titulo} ${a.texto}` })),
        ...partidasFinales.map((p: any) => ({ donde: `Partida ${p.codigo || p.descripcion.slice(0, 20)}`, texto: p.descripcion })),
        { donde: "Dictamen", texto: dictamen },
      ])
    );

    const textoPartidas = JSON.stringify(partidasFinales).toLowerCase();
    if (def.conPresupuesto && partidasFinales.length && !/seguridad|salud|epi/.test(textoPartidas)) {
      avisos.push("El presupuesto no incluye seguridad y salud, que es obligatoria en toda obra.");
    }
    if (def.conPresupuesto && partidasFinales.length && !/residuo|escombro|vertedero|contenedor/.test(textoPartidas)) {
      avisos.push("El presupuesto no incluye gestión de residuos.");
    }

    // Un informe que califica el riesgo de alto y no aporta una sola foto se
    // sostiene mucho peor, sobre todo si acaba discutiéndose.
    const gravedadAlta = /MUY ALTO|GRAVEDAD: ALTO/i.test(JSON.stringify(apartados) + dictamen);
    if (gravedadAlta && !imagenes.length) {
      avisos.push(
        "El informe califica el riesgo de alto y no lleva ninguna fotografía. Sube fotos de las lesiones: son la prueba de lo que afirmas."
      );
    }

    // Lo que se pica y no se repone: el hueco mas caro de un presupuesto de
    // reparacion, porque es trabajo que hay que hacer si o si.
    avisos.push(
      ...faltanReposiciones(partidasFinales.map((p: any) => ({ concepto: p.descripcion, descripcion: p.descripcion })))
    );

    return NextResponse.json({
      titulo: String(parsed.titulo || "").trim() || "Informe técnico",
      contenido: { apartados, partidas: partidasFinales, dictamen },
      vacios,
      avisos,
    });
  } catch (e: any) {
    console.error("Error generando informe con IA:", e);
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "El servicio de IA no ha respondido a tiempo. Vuelve a intentarlo: casi siempre va a la segunda."
          : "No se pudo generar el informe. Vuelve a intentarlo o redáctalo a mano.",
      },
      { status: 502 }
    );
  }
}
