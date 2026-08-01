/**
 * Estructura de los informes y las plantillas de apartados.
 *
 * Los guiones no están inventados: salen de dos informes reales que aportó el
 * usuario —un informe técnico de patologías y un dictamen pericial judicial de
 * asiento de medianera—, así que respetan el orden y la nomenclatura que espera
 * un técnico español.
 */

import { DOCUMENTOS, type TipoDocumento } from "@/lib/documentos";

/** Alias histórico: el resto del código llama "informe" a cualquier documento. */
export type TipoInforme = TipoDocumento;

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

/** Etiqueta legible de cada tipo, derivada de la tabla de documentos. */
export const ETIQUETA_TIPO = Object.fromEntries(
  Object.entries(DOCUMENTOS).map(([t, d]) => [t, d.etiqueta])
) as Record<TipoInforme, string>;

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
  return (DOCUMENTOS[tipo] || DOCUMENTOS.PATOLOGIAS).guion;
}
