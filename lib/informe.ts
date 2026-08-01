/**
 * Estructura de los informes y las plantillas de apartados.
 *
 * Los guiones no están inventados: salen de dos informes reales que aportó el
 * usuario —un informe técnico de patologías y un dictamen pericial judicial de
 * asiento de medianera—, así que respetan el orden y la nomenclatura que espera
 * un técnico español.
 */

export type TipoInforme = "PATOLOGIAS" | "PERICIAL";

/** Una partida del presupuesto de reparación que acompaña al informe. */
export type PartidaInforme = {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
  /**
   * Mejora recomendable que no hace falta para resolver la patología.
   *
   * Va aparte porque cambia la conversación con el cliente: el total obligatorio
   * es lo que hay que hacer, y lo opcional se ofrece sin inflar esa cifra. Si se
   * mezclan, el cliente ve un número más alto del necesario y se echa atrás.
   */
  opcional?: boolean;
};

/** Capítulo del presupuesto: "01.01" pertenece al capítulo "01". */
export function capituloDe(codigo: string) {
  return (codigo || "").split(".")[0] || "01";
}

/** Agrupa las partidas por capítulo conservando el orden de aparición. */
export function porCapitulos(partidas: PartidaInforme[]) {
  const grupos = new Map<string, PartidaInforme[]>();
  for (const p of partidas) {
    const c = capituloDe(p.codigo);
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c)!.push(p);
  }
  return [...grupos.entries()].map(([codigo, lineas]) => ({
    codigo,
    lineas,
    subtotal: lineas.filter((l) => !l.opcional).reduce((s, l) => s + importePartida(l), 0),
    subtotalOpcional: lineas.filter((l) => l.opcional).reduce((s, l) => s + importePartida(l), 0),
  }));
}

/** Un apartado del informe: título y cuerpo, más subapartados si los lleva. */
export type Apartado = {
  numero: string;
  titulo: string;
  texto: string;
  subapartados?: { titulo: string; texto: string }[];
};

export type ContenidoInforme = {
  apartados: Apartado[];
  partidas: PartidaInforme[];
  /** Dictamen final: es lo que el técnico firma y lo que lee primero un juez. */
  dictamen: string;
};

/** Importe de una partida, en un único sitio para que no se calcule de dos formas. */
export function importePartida(p: PartidaInforme) {
  return (Number(p.cantidad) || 0) * (Number(p.precio) || 0);
}

/**
 * Presupuesto de ejecución material, sin GG, BI ni IVA.
 *
 * Por defecto NO cuenta las partidas opcionales: la cifra que se compara y se
 * decide es la de lo necesario. Lo opcional se enseña aparte.
 */
export function pem(partidas: PartidaInforme[], incluirOpcionales = false) {
  return partidas
    .filter((p) => incluirOpcionales || !p.opcional)
    .reduce((s, p) => s + importePartida(p), 0);
}

/**
 * Porcentajes del presupuesto de contrata en obra española.
 *
 * 13% de gastos generales y 6% de beneficio industrial son los que fija la
 * legislación de contratos públicos y los que se usan por costumbre en privada.
 */
const GASTOS_GENERALES = 0.13;
const BENEFICIO_INDUSTRIAL = 0.06;

/**
 * Desglose desde el PEM hasta lo que de verdad paga el cliente.
 *
 * El informe solo enseñaba el PEM con una nota a pie diciendo que no incluía
 * gastos generales, beneficio ni IVA. Un particular lee 2.048 € y entiende que
 * eso es lo que le cuesta la obra, cuando en realidad son cerca de 2.700 €. La
 * nota está bien, pero la cifra grande manda sobre la letra pequeña: es mejor
 * enseñar las dos y que no haya sorpresa cuando llegue la factura.
 */
export function desglosePresupuesto(partidas: PartidaInforme[], iva = 10) {
  const ejecucionMaterial = pem(partidas);
  const gastosGenerales = ejecucionMaterial * GASTOS_GENERALES;
  const beneficio = ejecucionMaterial * BENEFICIO_INDUSTRIAL;
  const contrata = ejecucionMaterial + gastosGenerales + beneficio;
  const importeIva = contrata * (iva / 100);

  // Lo opcional se calcula por separado y con los mismos porcentajes, para poder
  // enseñar "sin opcionales" y "con opcionales" sin que el cliente tenga que
  // sumar nada de cabeza.
  const opcional = pem(partidas, true) - ejecucionMaterial;
  const contrataConOpcional = (ejecucionMaterial + opcional) * (1 + GASTOS_GENERALES + BENEFICIO_INDUSTRIAL);

  return {
    ejecucionMaterial,
    gastosGenerales,
    beneficio,
    contrata,
    iva,
    importeIva,
    total: contrata + importeIva,
    porcentajeGG: GASTOS_GENERALES * 100,
    porcentajeBI: BENEFICIO_INDUSTRIAL * 100,
    hayOpcionales: opcional > 0,
    opcional,
    totalConOpcional: contrataConOpcional * (1 + iva / 100),
  };
}

export const ETIQUETA_TIPO: Record<TipoInforme, string> = {
  PATOLOGIAS: "Informe técnico de patologías",
  PERICIAL: "Dictamen pericial",
};

/**
 * Guion del informe técnico de patologías: el que un reformista entrega a su
 * cliente para justificar una intervención.
 */
const GUION_PATOLOGIAS = `
1. ANTECEDENTES Y OBJETO DEL INFORME — qué se inspecciona y por qué.
2. DESCRIPCIÓN TÉCNICA DE LOS DESPERFECTOS — un subapartado por elemento afectado, cada uno con Ubicación, Patología, Efectos colaterales y Causa origen.
3. VALORACIÓN TÉCNICA Y DIAGNÓSTICO DE RIESGOS — un subapartado por elemento, empezando por "NIVEL DE GRAVEDAD: BAJO|MODERADO|ALTO|MUY ALTO" y el riesgo concreto (estructural, de caída de objetos, de habitabilidad).
4. PROPUESTA DE ACTUACIÓN Y PLAN DE REMEDIACIÓN — fases ordenadas por urgencia, con la solución constructiva concreta y su justificación.
5. VALORACIÓN ECONÓMICA ESTIMADA — se genera de las partidas, no lo redactes como texto.
6. CONCLUSIÓN DEL INFORME — criterio seguido y recomendación.`;

/**
 * Guion del dictamen pericial judicial. Incluye las piezas que exige un juzgado:
 * juramento del art. 335 LEC, intervinientes, documentación examinada y
 * metodología. Sin ellas, el informe no vale como prueba.
 */
const GUION_PERICIAL = `
1. IDENTIFICACIÓN — datos del técnico redactor y su formación, solicitante del dictamen y ubicación del inmueble.
2. OBJETO Y ALCANCE — qué cuestiones concretas se pide resolver y, muy importante, hasta dónde llega el informe: qué NO se ha podido comprobar y por qué (sin catas, sin acceso a determinada zona, sin documentación de proyecto).
3. ANTECEDENTES — hechos previos relevantes en orden cronológico.
4. PERITO, JURAMENTO Y DECLARACIÓN DE TACHAS — juramento del art. 335 LEC y declaración de no incurrir en las causas de tacha del art. 343 LEC.
5. INTERVINIENTES — agentes de la edificación conocidos (promotor, constructor, dirección facultativa, OCT, aseguradoras). Si no constan, dilo expresamente.
6. DOCUMENTACIÓN CONSULTADA Y NORMATIVA APLICADA — documentos examinados y normativa técnica en que se apoya el dictamen (CTE y sus documentos básicos, EHE-08, NTE, normas UNE, ordenanzas). Cita solo la que realmente aplique al caso.
7. CONSIDERACIONES PRELIMINARES — criterios, definiciones y técnicas necesarias para entender el estudio (qué es un asiento diferencial, cómo se interpreta una fisura, límites admisibles de distorsión angular…).
8. TIPOLOGÍA ESTRUCTURAL Y CONSTRUCTIVA — descripción del inmueble y su cimentación.
9. INSPECCIÓN OCULAR E IDENTIFICACIÓN DE DAÑOS — fecha, alcance y descripción de cada lesión observada.
10. METODOLOGÍA — cómo se ha analizado (inspección visual, catas, testigos, nivelación, cálculo).
11. ORIGEN DE LAS LESIONES Y ANÁLISIS DE CAUSAS — relación causa-efecto y causas concurrentes.
12. CONCLUSIONES SOBRE LA LESIÓN Y SU REPARACIÓN — si el movimiento está estabilizado, límites admisibles y solución.
13. MEDICIÓN Y PRESUPUESTO DE REPARACIÓN — se genera de las partidas, no lo redactes como texto.
14. ANEXO DE CÁLCULO — justificación numérica cuando proceda; si no procede, dilo.`;

/** Juramento literal del art. 335.2 LEC. Va tal cual: es una fórmula legal. */
export const JURAMENTO =
  "El perito que suscribe manifiesta cumplir todo lo requerido en el artículo 335 de la Ley 1/2000 de Enjuiciamiento Civil al emitir el presente dictamen, y declara, bajo juramento o promesa de decir verdad, que ha actuado y, en su caso, actuará con la mayor objetividad posible, tomando en consideración tanto lo que pueda favorecer como lo que sea susceptible de causar perjuicio a cualquiera de las partes, y que conoce las sanciones penales en las que podría incurrir si incumpliere su deber como perito.";

/**
 * Declaración de tachas del art. 343 LEC.
 *
 * Va junto al juramento y por el mismo motivo: es una fórmula legal y la escribe
 * el servidor, no la IA. La parte contraria puede tachar al perito por cualquiera
 * de estas causas, así que declararlas expresamente se adelanta a la objeción.
 * Enumeradas una a una a propósito: un "no incurro en causa de tacha" genérico
 * dice bastante menos.
 */
export const DECLARACION_TACHAS =
  "Asimismo, a los efectos del artículo 343 de la Ley 1/2000 de Enjuiciamiento Civil, el perito declara no incurrir en ninguna de las causas de tacha legalmente previstas y, en particular: no ser cónyuge ni pariente por consanguinidad o afinidad dentro del cuarto grado civil de ninguna de las partes ni de sus abogados o procuradores; no tener interés directo ni indirecto en el asunto ni en otro semejante; no estar ni haber estado en situación de dependencia, comunidad o contraposición de intereses con alguna de las partes ni con sus abogados o procuradores; no mantener amistad íntima ni enemistad con ninguna de ellas; y no concurrir ninguna otra circunstancia que le haga desmerecer en el concepto profesional.";

export function guionDe(tipo: TipoInforme) {
  return tipo === "PERICIAL" ? GUION_PERICIAL : GUION_PATOLOGIAS;
}
