import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { limiteIaSuperado, ERROR_LIMITE_IA } from "@/lib/limite";
import { llamarAGemini, respuestaDeError, leerJson, comoDato } from "@/lib/gemini";
import {
  buscarNormativa,
  invocaNormativaSinRespaldo,
  AVISO_NORMATIVA,
  AVISO_PRACTICA,
} from "@/lib/normativa";
import { calcularDesdePregunta } from "@/lib/calculos";
import { BAREMO } from "@/lib/baremo";
import { importeLinea } from "@/lib/presupuesto";

export const maxDuration = 60;

/**
 * Copiloto técnico de obra.
 *
 * La regla de oro: el modelo NO aporta datos, solo redacta los que le da el
 * programa. La normativa sale de lib/normativa.ts y los cálculos de
 * lib/calculos.ts; si para una pregunta no hay ni una cosa ni la otra, se
 * responde que no se tiene y se acabó.
 *
 * Es deliberadamente más limitado que un chat general. Un copiloto que contesta
 * a todo y acierta el 90% es peor herramienta que uno que contesta a menos y
 * acierta siempre: al primero hay que comprobarle cada respuesta, y entonces ya
 * no ahorra nada.
 */

type Mensaje = { rol: "usuario" | "copiloto"; texto: string };

export async function POST(req: Request) {
  let db;
  let empresaId: string;
  try {
    ({ db, empresaId } = await requireTenant());
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

  let f: { pregunta?: string; historial?: Mensaje[]; presupuestoId?: string };
  try {
    f = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const pregunta = (f.pregunta || "").trim();
  if (!pregunta) return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });

  // 1. Datos verificados que responden a la pregunta.
  const entradas = buscarNormativa(pregunta);
  let calculo = calcularDesdePregunta(pregunta);

  // 2. Contexto de la obra, si el copiloto se abre desde un presupuesto.
  let contextoObra = "";
  if (f.presupuestoId) {
    const p = await db.presupuesto.findFirst({
      where: { id: f.presupuestoId },
      include: { lineas: { orderBy: { orden: "asc" } } },
    });
    if (p) {
      /**
       * La medición puede estar en el presupuesto y no en la pregunta.
       *
       * "¿Cuántas baldosas necesito para el solado de este presupuesto?" no lleva
       * ningún número: los 8 m² están en una partida. Sin esto el copiloto
       * respondía que no podía calcularlo teniendo el dato delante.
       */
      if (!calculo) {
        const palabras = pregunta
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 4);
        const linea = p.lineas.find((l) =>
          palabras.some((w) => `${l.capitulo} ${l.concepto}`.toLowerCase().includes(w))
        );
        if (linea) {
          calculo = calcularDesdePregunta(`${pregunta} ${linea.cantidad} ${linea.unidad}`);
        }
      }
      const base = p.lineas.reduce((s, l) => s + importeLinea(l), 0);
      contextoObra = `
OBRA SOBRE LA QUE SE PREGUNTA (datos reales de la aplicación, puedes usarlos):
- Presupuesto ${p.numero}: ${p.titulo}
- Base imponible: ${base.toFixed(2)} €, IVA ${p.iva}%${p.margen ? `, margen ${p.margen}%` : ""}
- Partidas (${p.lineas.length}):
${p.lineas.map((l) => `  · ${l.capitulo || "Sin capítulo"} | ${l.concepto} | ${l.cantidad} ${l.unidad} × ${l.precio} €`).join("\n")}`;
    }
  }

  // 3. Precios de referencia, solo cuando la pregunta va de dinero.
  const preguntaPrecio = /precio|cuesta|caro|barato|valorad|presupuest|coste|cobrar|€/i.test(pregunta);
  const bloquePrecios = preguntaPrecio
    ? `
PRECIOS DE REFERENCIA DE LA APLICACIÓN (mercado español, calidad media, unidad de obra completa):
${BAREMO.slice(0, 40).map((p) => `- ${p.concepto}: ${p.conMaterial} €/${p.unidad}`).join("\n")}`
    : "";

  /**
   * Los dos tipos de dato viajan en bloques separados, y eso es intencionado.
   *
   * Si fueran en una sola lista, el modelo redactaría "según el CTE, la
   * grifería del lavabo va a 55-60 cm" en cuanto una entrada de normativa y una
   * de práctica cayeran juntas en la misma respuesta — que es exactamente el
   * caso más frecuente. Separados y con instrucciones distintas, no tiene por
   * dónde confundirlos.
   */
  const deNormativa = entradas.filter((e) => e.tipo === "normativa");
  const dePractica = entradas.filter((e) => e.tipo === "practica");

  const describir = (e: (typeof entradas)[number]) =>
    `- ${e.tema}\n  Dato: ${e.respuesta}\n  Fuente: ${e.fuente}${e.matiz ? `\n  Matiz: ${e.matiz}` : ""}`;

  const bloqueNormativa = deNormativa.length
    ? `
DATOS DE NORMATIVA VERIFICADOS (obligado cumplimiento). Son los ÚNICOS con los que puedes afirmar que algo es exigible:
${deNormativa.map(describir).join("\n")}`
    : "";

  const bloquePractica = dePractica.length
    ? `
PRÁCTICA HABITUAL DEL OFICIO (NO es normativa, NO es exigible):
${dePractica.map(describir).join("\n")}

Cómo usar este bloque, sin excepción:
- Da el dato, que es útil y es lo que se hace en obra.
- Di SIEMPRE y de forma explícita que es la práctica habitual y no una exigencia.
- NUNCA lo atribuyas al CTE, al REBT ni a ninguna norma, y no digas "es obligatorio" ni "hay que" al hablar de estos valores.
- Remite a la ficha técnica del producto o a la hoja de montaje del aparato, que es lo que de verdad manda aquí.`
    : "";

  const bloqueCalculo = calculo
    ? `
CÁLCULO YA HECHO POR LA APLICACIÓN. El número es este, no lo recalcules:
- ${calculo.titulo}
- Desglose: ${calculo.detalle.map((d) => `${d.concepto} ${d.valor}`).join(" · ")}
- RESULTADO: ${calculo.resultado}
- Supuestos: ${calculo.supuestos}`
    : "";

  const hayDatos = !!(entradas.length || calculo || contextoObra || bloquePrecios);

  const historial = (f.historial || [])
    .slice(-6)
    .map((m) => `${m.rol === "usuario" ? "Usuario" : "Tú"}: ${m.texto}`)
    .join("\n");

  const prompt = `Eres el copiloto técnico de una aplicación española de reformas y construcción. Hablas con un reformista o un constructor: al grano, en su lenguaje, sin adornos y sin dar lecciones.

REGLA QUE NO PUEDES SALTARTE
No aportas datos propios. Solo puedes usar lo que viene en los bloques de abajo. En concreto:
- NO cites ningún artículo, tabla o valor de normativa que no esté en "DATOS DE NORMATIVA VERIFICADOS". Ni uno.
- NO conviertas en exigencia lo que venga en "PRÁCTICA HABITUAL DEL OFICIO". Es costumbre, y se dice que lo es.
- NO hagas cálculos de tu cabeza. Si hay un bloque de cálculo, el resultado es ese.
- Si la pregunta necesita un dato que no tienes, dilo claramente y di dónde mirarlo. Es la respuesta correcta, no un fracaso.
Un constructor que ejecuta con un dato inventado y no pasa la inspección se vuelve contra quien se lo dio. Prefiere quedarte corto.
${bloqueNormativa}${bloquePractica}${bloqueCalculo}${contextoObra}${bloquePrecios}
${hayDatos ? "" : "\nNO HAY DATOS para esta pregunta. Responde que no lo tienes cargado, sugiere dónde consultarlo y ofrécete a ayudar con lo que sí cubres: mediciones, cantidades de material, precios de referencia y las partidas del presupuesto abierto.\n"}
${historial ? `CONVERSACIÓN HASTA AHORA:\n${historial}\n` : ""}
PREGUNTA:
${comoDato("pregunta del usuario", pregunta)}

Responde en JSON:
{
 "respuesta": "tu respuesta, en 2-6 frases. Usa saltos de línea si enumeras. Nada de markdown.",
 "seguridad": "alta" si todo lo que dices sale de los bloques, "sin_datos" si has tenido que decir que no lo tienes
}`;

  try {
    const r = await llamarAGemini(apiKey, [{ text: prompt }], {
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
    if (!r.ok) return respuestaDeError(r, "copiloto");

    const parsed = leerJson(await r.json());
    const respuesta = String(parsed.respuesta || "").trim();
    if (!respuesta) throw new Error("sin respuesta");

    /**
     * Si el modelo ha reconocido que no tiene el dato, las fuentes NO se enseñan.
     *
     * La búsqueda por palabras clave puede traer una entrada que comparte una
     * palabra con la pregunta pero no la responde. Pasó en pruebas: a "distancia
     * mínima entre pilares según la EHE" respondía correctamente que no lo tenía
     * y debajo aparecía "EHE-08, artículo 37.2.4 (Recubrimientos)". La respuesta
     * era honesta y la cita la desmentía, que es peor que no citar nada.
     */
    const sinDatos = !hayDatos || parsed.seguridad === "sin_datos";
    const citadas = sinDatos ? [] : entradas;

    /**
     * Cada tipo de dato lleva su aviso, y si la respuesta se apoya en los dos
     * salen los dos. Antes había uno solo porque solo había normativa.
     */
    const avisos: string[] = [];
    if (citadas.some((e) => e.tipo === "normativa")) avisos.push(AVISO_NORMATIVA);
    if (citadas.some((e) => e.tipo === "practica")) avisos.push(AVISO_PRACTICA);

    /**
     * Última comprobación, en código y no por prompt: si la respuesta se apoya
     * SOLO en práctica del oficio pero el texto invoca el CTE o habla de
     * obligación, se corrige aquí. El dato sigue siendo útil; lo que no puede
     * salir de aquí es la autoridad legal que no tiene.
     */
    if (!sinDatos && invocaNormativaSinRespaldo(respuesta, citadas)) {
      avisos.unshift(
        "Ojo: esta respuesta habla de obligación o cita normativa, pero no se apoya en ningún dato normativo cargado. Trátala como práctica del oficio y compruébala antes de darla por exigible."
      );
    }

    return NextResponse.json({
      respuesta,
      // Las fuentes las manda el servidor, no el modelo: así lo que se cita
      // siempre existe, aunque el texto de la respuesta se desvíe.
      fuentes: citadas.map((e) => ({
        tema: e.tema,
        fuente: e.fuente,
        tipo: e.tipo,
        revisado: !!e.revisado,
      })),
      calculo,
      avisos,
      sinDatos,
    });
  } catch (e: any) {
    console.error("Error en el copiloto:", e);
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "El servicio de IA no ha respondido a tiempo. Vuelve a intentarlo."
          : "No se pudo responder. Vuelve a intentarlo.",
      },
      { status: 502 }
    );
  }
}
