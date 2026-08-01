/**
 * Recalcula las partidas indirectas como porcentaje de la obra, que es como se
 * presupuestan de verdad.
 *
 * Motivo: eran la mayor fuente de incoherencia. En dos presupuestos del mismo
 * solado de 4 m², la gestión de residuos salió 9 € en uno y 120 € en el otro, y
 * la seguridad y salud 35 € frente a 45 €. Resultado: el presupuesto SIN material
 * (306,90 €) acabó más caro que el mismo trabajo CON material (217,80 €), que es
 * imposible de defender ante un cliente.
 *
 * La IA sigue decidiendo si estas partidas hacen falta y cómo se llaman; lo que
 * deja de decidir es su importe, porque un porcentaje del trabajo ejecutado es
 * una cifra reproducible y proporcional al tamaño de la obra. Un aseo de 4 m² deja
 * de llevar 45 € de seguridad y salud sobre 114 € de obra.
 */

export type LineaIndirecta = {
  capitulo: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

/**
 * Porcentajes sobre el presupuesto de ejecución de los trabajos directos.
 *
 * Son los que se manejan en obra: seguridad y salud entre el 1 y el 2 %, y
 * gestión de residuos en torno al 1-2 % según haya demoliciones. Se usan los
 * valores altos de la horquilla porque en obra pequeña estos costes pesan más.
 */
const PORCENTAJES: { patron: RegExp; porcentaje: number; minimo: number }[] = [
  // Los mínimos son costes reales que no bajan por pequeña que sea la obra: los
  // EPIs y la señalización se compran igual, y un contenedor de escombros cuesta
  // 150-200 € aunque se llene a medias. Estaban en 30 y 45 € y dejaban un
  // presupuesto que no pagaba ni el contenedor.
  { patron: /seguridad|salud|epi|protecci[oó]n colectiva/i, porcentaje: 0.02, minimo: 60 },
  { patron: /residuo|escombro|contenedor|vertedero|rcd/i, porcentaje: 0.03, minimo: 150 },
  { patron: /control de calidad|ensayo/i, porcentaje: 0.01, minimo: 90 },
];

/** Detecta las líneas cuyo importe pasa a calcularse, no a estimarse. */
function esIndirecta(l: LineaIndirecta) {
  const texto = `${l.capitulo} ${l.concepto}`;
  return PORCENTAJES.find((p) => p.patron.test(texto)) || null;
}

/** Importe de una línea. */
const importe = (l: LineaIndirecta) => (Number(l.cantidad) || 0) * (Number(l.precio) || 0);

export function normalizarIndirectos(lineas: LineaIndirecta[]): {
  lineas: LineaIndirecta[];
  ajustadas: number;
} {
  // Base: solo los trabajos directos. Incluir los indirectos aquí los haría
  // depender unos de otros y el resultado cambiaría según el orden.
  const directas = lineas.filter((l) => !esIndirecta(l));
  const base = directas.reduce((s, l) => s + importe(l), 0);
  if (base <= 0) return { lineas, ajustadas: 0 };

  let ajustadas = 0;

  const resultado = lineas.map((l) => {
    const regla = esIndirecta(l);
    if (!regla) return l;

    const calculado = Math.max(regla.minimo, Math.round(base * regla.porcentaje));
    if (calculado === Math.round(importe(l))) return l;

    ajustadas++;
    // Se pasa a partida alzada con cantidad 1: el importe ya está calculado y
    // repartirlo en unidades daría precios unitarios sin sentido.
    return {
      ...l,
      cantidad: 1,
      unidad: "pa",
      precio: calculado,
      descripcion:
        `${l.descripcion || ""}`.trim() ||
        `Partida alzada proporcional al importe de ejecución de la obra.`,
    };
  });

  return { lineas: resultado, ajustadas };
}
