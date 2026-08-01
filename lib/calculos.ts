/**
 * Cálculos de material de obra.
 *
 * Los hace el programa, no la IA, por la misma razón que la normativa vive en un
 * fichero: "¿cuántos sacos de cemento necesito?" tiene una respuesta comprobable,
 * y un modelo que multiplica de cabeza se equivoca de vez en cuando sin avisar.
 * Aquí el número sale siempre igual y se puede rehacer a mano.
 *
 * Los rendimientos son los que se manejan en obra para trabajo corriente. No
 * sustituyen a la ficha técnica del fabricante, que manda cuando la hay.
 */

export type Calculo = {
  titulo: string;
  /** Filas del desglose, para que se vea de dónde sale el número. */
  detalle: { concepto: string; valor: string }[];
  /** La cifra que se busca, ya redondeada a lo que se compra. */
  resultado: string;
  supuestos: string;
};

/** Redondeo hacia arriba: el material se compra entero, no en fracciones. */
const sacos = (kg: number, porSaco: number) => Math.ceil(kg / porSaco);
/** "1 bote" y no "1 botes": el número lo lee alguien, no una máquina. */
const plural = (n: number, sing: string, pl: string) => `${n} ${n === 1 ? sing : pl}`;
const dec = (n: number, d = 2) => Number(n.toFixed(d));

/**
 * Mortero de agarre y sacos de cemento para un solado o alicatado.
 *
 * Con adhesivo cementoso (lo normal hoy) el consumo va por espesor de peine:
 * ~1,5 kg/m² por cada mm. Un peine de 8 mm en formato grande deja unos 5 kg/m².
 */
export function morteroSolado(m2: number, peineMm = 8): Calculo {
  const kgPorM2 = 1.5 * peineMm * 0.42; // el peine deja surcos: no cubre el 100%
  const kg = m2 * kgPorM2;
  return {
    titulo: `Adhesivo para ${dec(m2)} m² de solado o alicatado`,
    detalle: [
      { concepto: "Superficie", valor: `${dec(m2)} m²` },
      { concepto: "Peine", valor: `${peineMm} mm` },
      { concepto: "Consumo", valor: `${dec(kgPorM2)} kg/m²` },
      { concepto: "Total", valor: `${dec(kg, 1)} kg` },
    ],
    resultado: `${plural(sacos(kg, 25), "saco", "sacos")} de 25 kg`,
    supuestos:
      "Adhesivo cementoso C1/C2 aplicado con llana dentada sobre soporte plano. En doble encolado o soporte irregular, cuenta un 30-40% más.",
  };
}

/** Baldosas, contando la merma por cortes y roturas. */
export function baldosas(m2: number, formatoCm: [number, number], mermaPct = 10): Calculo {
  const areaPieza = (formatoCm[0] / 100) * (formatoCm[1] / 100);
  const conMerma = m2 * (1 + mermaPct / 100);
  const piezas = Math.ceil(conMerma / areaPieza);
  return {
    titulo: `Baldosas de ${formatoCm[0]}x${formatoCm[1]} cm para ${dec(m2)} m²`,
    detalle: [
      { concepto: "Superficie a cubrir", valor: `${dec(m2)} m²` },
      { concepto: "Merma", valor: `${mermaPct} %` },
      { concepto: "Superficie a comprar", valor: `${dec(conMerma)} m²` },
      { concepto: "Superficie por pieza", valor: `${dec(areaPieza, 3)} m²` },
    ],
    resultado: `${plural(piezas, "pieza", "piezas")} · ${dec(conMerma)} m² a pedir`,
    supuestos:
      "Merma del 10% para colocación recta. En diagonal o en espiga sube al 15-20%, y con piezas grandes en estancia pequeña, más.",
  };
}

/** Mortero de albañilería y sus componentes, para hacer en obra. */
export function morteroObra(m3: number, dosificacion: "1:4" | "1:6" = "1:6"): Calculo {
  // Rendimientos habituales de mortero de cemento por m³ de mortero fresco.
  const cementoKg = dosificacion === "1:4" ? 350 : 250;
  const arenaM3 = 1.1;
  const aguaL = dosificacion === "1:4" ? 190 : 170;
  return {
    titulo: `Mortero ${dosificacion} para ${dec(m3, 2)} m³`,
    detalle: [
      { concepto: "Cemento", valor: `${dec(cementoKg * m3, 0)} kg` },
      { concepto: "Arena", valor: `${dec(arenaM3 * m3, 2)} m³` },
      { concepto: "Agua", valor: `${dec(aguaL * m3, 0)} litros` },
    ],
    resultado: `${plural(sacos(cementoKg * m3, 25), "saco", "sacos")} de cemento de 25 kg`,
    supuestos:
      "Dosificación en volumen, mortero fresco. La arena debe estar seca: si viene húmeda, baja el agua.",
  };
}

/** Hormigón hecho en obra. Para volúmenes grandes sale a cuenta pedirlo hecho. */
export function hormigon(m3: number): Calculo {
  const cementoKg = 300 * m3;
  return {
    titulo: `Hormigón HM-20 para ${dec(m3, 2)} m³`,
    detalle: [
      { concepto: "Cemento", valor: `${dec(cementoKg, 0)} kg` },
      { concepto: "Arena", valor: `${dec(0.65 * m3, 2)} m³` },
      { concepto: "Grava", valor: `${dec(0.95 * m3, 2)} m³` },
      { concepto: "Agua", valor: `${dec(160 * m3, 0)} litros` },
    ],
    resultado: `${plural(sacos(cementoKg, 25), "saco", "sacos")} de cemento de 25 kg`,
    supuestos:
      "HM-20 de dosificación corriente, amasado en obra. Por encima de 1,5-2 m³ suele salir mejor pedir hormigón preparado: sale más regular y más barato.",
  };
}

/** Pintura, contando siempre dos manos. */
export function pintura(m2: number, manos = 2, rendimientoM2L = 9): Calculo {
  const litros = (m2 * manos) / rendimientoM2L;
  return {
    titulo: `Pintura para ${dec(m2)} m² a ${manos} manos`,
    detalle: [
      { concepto: "Superficie", valor: `${dec(m2)} m²` },
      { concepto: "Manos", valor: String(manos) },
      { concepto: "Rendimiento", valor: `${rendimientoM2L} m²/litro y mano` },
      { concepto: "Total", valor: `${dec(litros, 1)} litros` },
    ],
    resultado: `${plural(Math.ceil(litros / 15), "bote", "botes")} de 15 litros · ${dec(litros, 1)} litros`,
    supuestos:
      "Pintura plástica sobre paramento liso ya imprimado. Sobre yeso nuevo o color oscuro cuenta una mano más, y sobre gotelé el rendimiento baja casi a la mitad.",
  };
}

/** Ladrillos por m² de tabique, con su mortero. */
export function ladrillos(m2: number, tipo: "hueco doble" | "hueco sencillo" | "perforado" = "hueco doble"): Calculo {
  const porM2 = tipo === "hueco sencillo" ? 60 : tipo === "perforado" ? 48 : 33;
  const conMerma = Math.ceil(m2 * porM2 * 1.05);
  return {
    titulo: `Ladrillo ${tipo} para ${dec(m2)} m² de fábrica`,
    detalle: [
      { concepto: "Piezas por m²", valor: String(porM2) },
      { concepto: "Merma", valor: "5 %" },
      { concepto: "Mortero de agarre", valor: `${dec(m2 * 0.02, 2)} m³ aprox.` },
    ],
    resultado: plural(conMerma, "pieza", "piezas"),
    supuestos: "Fábrica tomada con mortero, juntas de 1 cm. Con pegamento de yeso el consumo de agarre es distinto.",
  };
}

/** Superficie a pintar de una vivienda, que no es la de suelo. */
export function superficiePintura(m2Construidos: number): Calculo {
  const bajo = m2Construidos * 4.5;
  const alto = m2Construidos * 5.5;
  return {
    titulo: `Superficie a pintar en una vivienda de ${dec(m2Construidos)} m² construidos`,
    detalle: [
      { concepto: "Techos", valor: `${dec(m2Construidos * 0.9)} m² aprox.` },
      { concepto: "Paramentos verticales", valor: `${dec(bajo - m2Construidos * 0.9)} a ${dec(alto - m2Construidos * 0.9)} m²` },
    ],
    resultado: `${dec(bajo, 0)} a ${dec(alto, 0)} m²`,
    supuestos:
      "Se pintan las dos caras de cada tabique, el perímetro interior de fachada y los techos: sale en torno a 4,5-5,5 veces la superficie construida. Medir sobre el plano siempre es mejor que estimar.",
  };
}

/**
 * Reconoce la pregunta y devuelve el cálculo, o null si no es de este tipo.
 *
 * Se hace en código para que el modelo no tenga que decidir qué fórmula aplicar
 * ni multiplicar nada: solo redacta el resultado que se le da hecho.
 */
export function calcularDesdePregunta(pregunta: string): Calculo | null {
  const t = pregunta.toLowerCase();
  const num = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1].replace(",", ".")) : null;
  };
  // "8 m2", "8 metros cuadrados", "8m²"
  const m2 = num(/(\d+[.,]?\d*)\s*(?:m2|m²|metros? cuadrados?)/);
  const m3 = num(/(\d+[.,]?\d*)\s*(?:m3|m³|metros? c[uú]bicos?)/);

  const pideCemento = /cemento|sacos?/.test(t);
  const pideMortero = /mortero|agarre|adhesivo|cola/.test(t);

  if (m3 && /hormig[oó]n/.test(t)) return hormigon(m3);
  if (m3 && (pideMortero || pideCemento)) return morteroObra(m3);

  if (m2) {
    if (/pintar|pintura/.test(t)) return pintura(m2);
    if (/baldosa|azulejo|gres|porcel[aá]nico|pieza/.test(t)) {
      const f = t.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})/);
      return baldosas(m2, f ? [Number(f[1]), Number(f[2])] : [60, 60]);
    }
    if (/ladrillo|tabique|f[aá]brica/.test(t)) return ladrillos(m2);
    if (pideMortero || pideCemento) return morteroSolado(m2);
  }

  if (/cu[aá]nto.*pintar|superficie.*pintar/.test(t)) {
    const c = num(/(\d+[.,]?\d*)\s*(?:m2|m²|metros)/);
    if (c) return superficiePintura(c);
  }

  return null;
}
