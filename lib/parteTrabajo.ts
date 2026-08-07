/**
 * Cálculos de un parte de trabajo: horas, materiales y su valoración.
 *
 * Nace del mismo principio que el resto de la aplicación: lo que tiene que ser
 * correcto vive en código, no en lo que redacte una IA. El material y las
 * horas los dice el técnico, porque es el único que sabe lo que ha usado y
 * cuánto ha tardado — eso no cambia.
 *
 * Lo que SÍ hay ahora es una IA que ESTRUCTURA lo que el técnico ya ha dicho:
 * dicta una descripción con sus propias cifras dentro y la IA la separa en
 * líneas de mano de obra y de material, buscando el material en el catálogo.
 * No estima nada que no esté dicho — ver `lineasSinCantidad` más abajo, que es
 * la comprobación que impide que un hueco se rellene solo.
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

/* ──────────────── Estructurar por IA lo que el técnico dictó ──────────────── */

export type LineaGeneradaParte = {
  tipo: "MANO_OBRA" | "MATERIAL";
  concepto: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

/**
 * Líneas a las que la IA no ha podido ponerles cantidad, porque el técnico no
 * dijo un número para ellas.
 *
 * ES LA RED DE SEGURIDAD DE TODO ESTE MECANISMO. Al modelo se le prohíbe por
 * prompt inventar horas o cantidades que no estén dichas, pero "se le prohíbe"
 * no es garantía —un prompt se cumple casi siempre, y "casi" no vale cuando el
 * documento resultante es lo que firma el cliente—. Así que en vez de confiar
 * en que el modelo puso 0 cuando tocaba, se comprueba en código: cualquier
 * línea sin cantidad se señala para que el técnico la rellene él mismo, igual
 * que `faltan()` señala lo que le falta a un presupuesto.
 */
export function lineasSinCantidad(lineas: LineaGeneradaParte[]): string[] {
  return lineas
    .filter((l) => !(l.cantidad > 0))
    .map((l) =>
      l.tipo === "MANO_OBRA"
        ? `No has dicho cuántas horas dedicaste a "${l.concepto}": complétalo antes de guardar.`
        : `No has dicho cuánta cantidad de "${l.concepto}" usaste: complétalo antes de guardar.`
    );
}
