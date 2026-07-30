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
};

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

/** Presupuesto de ejecución material: la suma de las partidas, sin GG, BI ni IVA. */
export function pem(partidas: PartidaInforme[]) {
  return partidas.reduce((s, p) => s + importePartida(p), 0);
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
1. IDENTIFICACIÓN Y OBJETO — qué se dictamina y a instancia de quién.
2. SOLICITANTE — quién encarga el dictamen.
3. LOCALIDAD Y EMPLAZAMIENTO — situación del inmueble.
4. PERITO Y JURAMENTO — datos del técnico y juramento del art. 335 LEC.
5. INTERVINIENTES — agentes de la edificación conocidos (promotor, constructor, dirección facultativa, OCT, aseguradoras). Si no constan, dilo expresamente.
6. DOCUMENTACIÓN EXAMINADA — la aportada; si no hay, indícalo.
7. TIPOLOGÍA ESTRUCTURAL Y CONSTRUCTIVA — descripción del inmueble y su cimentación.
8. INSPECCIÓN OCULAR E IDENTIFICACIÓN DE DAÑOS — fecha, alcance y descripción de cada lesión observada.
9. METODOLOGÍA — cómo se ha analizado (inspección visual, catas, testigos, nivelación, cálculo).
10. ORIGEN DE LAS LESIONES Y ANÁLISIS DE CAUSAS — relación causa-efecto y causas concurrentes.
11. CONCLUSIONES SOBRE LA LESIÓN Y SU REPARACIÓN — si el movimiento está estabilizado, límites admisibles y solución.
12. MEDICIÓN Y PRESUPUESTO DE REPARACIÓN — se genera de las partidas, no lo redactes como texto.
13. ANEXO DE CÁLCULO — justificación numérica cuando proceda; si no procede, dilo.`;

/** Juramento literal del art. 335.2 LEC. Va tal cual: es una fórmula legal. */
export const JURAMENTO =
  "El perito que suscribe manifiesta cumplir todo lo requerido en el artículo 335 de la Ley 1/2000 de Enjuiciamiento Civil al emitir el presente dictamen, y declara, bajo juramento o promesa de decir verdad, que ha actuado y, en su caso, actuará con la mayor objetividad posible, tomando en consideración tanto lo que pueda favorecer como lo que sea susceptible de causar perjuicio a cualquiera de las partes, y que conoce las sanciones penales en las que podría incurrir si incumpliere su deber como perito.";

export function guionDe(tipo: TipoInforme) {
  return tipo === "PERICIAL" ? GUION_PERICIAL : GUION_PATOLOGIAS;
}
