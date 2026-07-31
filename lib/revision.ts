/**
 * Revisa las mediciones que devuelve la IA y avisa de las que no cuadran.
 *
 * Existe porque una regla en el prompt nunca es garantía. Caso real: pidiendo un
 * baño de 4 m², la IA calculó 15 m² de paredes y luego usó ese 15 como NÚMERO DE
 * UNIDADES del plato de ducha — quince platos de ducha, 1.200 €. El presupuesto
 * salía con pinta de correcto y el disparate estaba en una celda.
 *
 * Aquí no se corrige nada automáticamente: una medición es una decisión del
 * técnico y cambiarla a su espalda sería peor. Solo se señala lo sospechoso para
 * que lo mire antes de mandárselo al cliente.
 */

/** Elementos que en una vivienda van de uno en uno, o casi. */
const ELEMENTOS_UNICOS = [
  "plato de ducha", "bañera", "banera", "mampara", "inodoro", "wc", "lavabo",
  "bide", "bidé", "fregadero", "caldera", "termo", "cuadro electrico",
  "cuadro eléctrico", "puerta de entrada", "encimera",
];

/** Por encima de esto, un elemento único deja de ser creíble en una reforma. */
const MAX_UNIDADES_ELEMENTO = 4;

export type LineaRevisable = {
  concepto: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

/**
 * Devuelve los avisos en lenguaje llano, listos para enseñar.
 *
 * `m2Declarados` es lo que el usuario escribió en el asistente: sirve para pillar
 * el error concreto de arrastrar una superficie a una casilla de unidades.
 */
export function revisarMediciones(lineas: LineaRevisable[], m2Declarados?: number): string[] {
  const avisos: string[] = [];

  for (const l of lineas) {
    const concepto = (l.concepto || "").toLowerCase();
    const esUnidad = l.unidad === "ud";
    const elemento = ELEMENTOS_UNICOS.find((e) => concepto.includes(e));

    if (esUnidad && elemento && l.cantidad > MAX_UNIDADES_ELEMENTO) {
      avisos.push(
        `"${l.concepto}": ${l.cantidad} unidades. Comprueba la cantidad, parece que se ha colado una superficie.`
      );
      continue;
    }

    // El error de arrastrar los m² a una casilla de unidades, aunque el elemento
    // no esté en la lista de arriba.
    if (esUnidad && m2Declarados && l.cantidad === m2Declarados && m2Declarados > 4) {
      avisos.push(
        `"${l.concepto}": ${l.cantidad} unidades coincide con los m² de la obra. Revisa si debería ir en m².`
      );
    }
  }

  return avisos;
}
