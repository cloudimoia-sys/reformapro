/**
 * Cálculos de un parte de trabajo: horas, materiales y su valoración.
 *
 * Nace del mismo principio que el resto de la aplicación: lo que tiene que ser
 * correcto vive en código, no en lo que escriba el técnico ni en lo que redacte
 * una IA. Aquí no hay ninguna IA en absoluto — el material lo pone el técnico
 * porque es el único que sabe lo que ha usado, y las horas las cuenta él mismo.
 * Este fichero solo suma lo que ya está escrito.
 */

export type LineaParteCalc = { tipo: "MANO_OBRA" | "MATERIAL"; cantidad: number; precio: number };

export const ETIQUETA_TIPO_LINEA: Record<"MANO_OBRA" | "MATERIAL", string> = {
  MANO_OBRA: "Mano de obra",
  MATERIAL: "Material",
};

/** Importe de una línea. Sin descuento: a diferencia de un presupuesto, un
 * parte de trabajo no negocia precio, registra lo que ha costado. */
export function importeLineaParte(l: LineaParteCalc) {
  return l.cantidad * l.precio;
}

export type TotalesParte = {
  horas: number;
  costeManoObra: number;
  costeMaterial: number;
  total: number;
};

/**
 * Totales del parte, separando mano de obra de material.
 *
 * Van aparte porque se leen distinto: las horas le dicen al jefe de obra cuánto
 * ha costado el técnico, el material le dice a administración qué comprar de
 * nuevo. Sumarlos en una sola cifra escondería las dos preguntas.
 */
export function totalesParte(lineas: LineaParteCalc[]): TotalesParte {
  const manoObra = lineas.filter((l) => l.tipo === "MANO_OBRA");
  const material = lineas.filter((l) => l.tipo === "MATERIAL");
  const costeManoObra = manoObra.reduce((s, l) => s + importeLineaParte(l), 0);
  const costeMaterial = material.reduce((s, l) => s + importeLineaParte(l), 0);
  return {
    horas: manoObra.reduce((s, l) => s + l.cantidad, 0),
    costeManoObra,
    costeMaterial,
    total: costeManoObra + costeMaterial,
  };
}

export function estadoParteClase(estado: string) {
  return estado === "FIRMADO" ? "b-aprobado" : "b-borrador";
}

export function estadoParteLabel(estado: string) {
  return estado === "FIRMADO" ? "Firmado" : "Borrador";
}
