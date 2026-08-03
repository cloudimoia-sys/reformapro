/**
 * Comprobación de que no falta ningún capítulo obligatorio.
 *
 * Nace de una revisión técnica de un presupuesto de obra nueva de 68 m² generado
 * por la app: le faltaban entre 26.000 y 55.000 € en partidas que no estaban por
 * ninguna parte. La más grave, calefacción y ACS: sin aporte renovable la
 * vivienda no obtiene el certificado energético ni la licencia de primera
 * ocupación (CTE DB-HE). No es un extra, es requisito legal.
 *
 * La lista se usa dos veces: se le da a la IA para que las incluya de entrada, y
 * se comprueba después sobre lo generado. Lo segundo es lo que de verdad protege,
 * porque una instrucción en el prompt se cumple casi siempre, y "casi" no vale
 * cuando lo que falta cuesta 40.000 € o impide licenciar la obra.
 */

export type Obligatoria = {
  /** Cómo se detecta en las partidas generadas. */
  patron: RegExp;
  /** Nombre para el aviso. */
  nombre: string;
  /** Por qué es obligatoria: lo lee el usuario en el aviso. */
  motivo: string;
};

/** Familias de obra a las que se les exige el listado completo de vivienda. */
const OBRA_NUEVA = /obra nueva|unifamiliar|ampliaci[oó]n|levante|vivienda de obra/i;
const REFORMA_INTEGRAL = /reforma integral|reforma completa/i;

/**
 * Palabras que solo aparecen cuando se habla de la vivienda ENTERA.
 *
 * "Reforma integral" a secas no basta: "reforma integral de la cocina" es una
 * cocina de 8 m², y exigirle el listado de una vivienda es absurdo.
 */
const VIVIENDA_ENTERA = /\b(vivienda|piso|casa|chalet|adosad\w*|paread\w*|[aá]tico|d[uú]plex|apartamento|unifamiliar)\b/i;

/**
 * El único tipo del desplegable que no dice de qué obra se trata.
 *
 * Con cualquier otro, el tipo manda y el texto libre no se mira. Con este hay
 * que leer los detalles porque no hay otra cosa.
 */
const TIPO_SIN_DEFINIR = /^\s*otra\b|descr[ií]bela/i;

/**
 * Lo que no puede faltar en una vivienda de obra nueva.
 *
 * El orden es el de ejecución, para que el aviso se lea como un repaso de obra.
 */
const VIVIENDA_NUEVA: Obligatoria[] = [
  { patron: /geot[eé]cnic/i, nombre: "Estudio geotécnico", motivo: "obligatorio para cimentar y exigido por el CTE DB-SE-C" },
  { patron: /acometida|enganche/i, nombre: "Acometidas de agua, luz y saneamiento", motivo: "sin ellas la vivienda no se puede poner en servicio" },
  { patron: /cimentaci[oó]n|zapata|losa de cimentaci/i, nombre: "Cimentación", motivo: "" },
  { patron: /estructura|forjado|pilar/i, nombre: "Estructura", motivo: "" },
  { patron: /cubierta|tejado|faldón|faldon/i, nombre: "Cubierta", motivo: "" },
  { patron: /fachada|cerramiento/i, nombre: "Cerramiento de fachada", motivo: "" },
  { patron: /revoco|revestimiento exterior|monocapa|sate|acabado exterior|vierteaguas/i, nombre: "Acabado exterior de fachada", motivo: "el cerramiento sin su acabado y remates deja la obra a medias" },
  { patron: /aislamiento/i, nombre: "Aislamiento térmico", motivo: "exigido por el CTE DB-HE" },
  { patron: /ventana|carpinter[ií]a exterior/i, nombre: "Carpintería exterior", motivo: "" },
  { patron: /persiana|protecci[oó]n solar/i, nombre: "Persianas o protección solar", motivo: "exigido por el CTE DB-HE para el control solar" },
  { patron: /puerta de entrada|puerta blindada|puerta acorazada/i, nombre: "Puerta de entrada", motivo: "" },
  { patron: /fontaner[ií]a|abastecimiento de agua/i, nombre: "Fontanería", motivo: "" },
  { patron: /saneamiento|evacuaci[oó]n/i, nombre: "Saneamiento", motivo: "" },
  { patron: /electricidad|el[eé]ctrica|cuadro/i, nombre: "Instalación eléctrica", motivo: "" },
  {
    patron: /calefacci[oó]n|acs|agua caliente|aerotermia|caldera|radiador|suelo radiante|bomba de calor|termo/i,
    nombre: "Calefacción y agua caliente sanitaria",
    motivo: "SIN ESTO NO HAY LICENCIA DE PRIMERA OCUPACIÓN: el CTE DB-HE exige ACS con aporte de energía renovable",
  },
  {
    patron: /ventilaci[oó]n/i,
    nombre: "Ventilación mecánica",
    motivo: "obligatoria por el CTE DB-HS3 en vivienda",
  },
  {
    patron: /telecomunicaci|ict|antena|fibra/i,
    nombre: "Infraestructura de telecomunicaciones (ICT)",
    motivo: "obligatoria en obra nueva",
  },
  { patron: /solado|pavimento|tarima/i, nombre: "Solados", motivo: "" },
  { patron: /alicatado|azulejo/i, nombre: "Alicatados", motivo: "" },
  { patron: /pintura/i, nombre: "Pintura", motivo: "" },
  // Separados a propósito: juntos, la puerta de paso daba por buena la regla y los
  // armarios se colaban sin presupuestar (1.500-3.000 € que aparecían luego).
  { patron: /carpinter[ií]a interior|puerta de paso/i, nombre: "Carpintería interior", motivo: "" },
  { patron: /armario/i, nombre: "Armarios empotrados", motivo: "" },
  { patron: /cocina|mobiliario|encimera/i, nombre: "Mobiliario de cocina", motivo: "" },
  { patron: /sanitario|inodoro|lavabo|plato de ducha|ba[ñn]era/i, nombre: "Aparatos sanitarios", motivo: "" },
  { patron: /urbanizaci[oó]n|acceso|acera|cerramiento de parcela|jardiner/i, nombre: "Urbanización exterior", motivo: "" },
  { patron: /seguridad|salud/i, nombre: "Seguridad y salud", motivo: "obligatoria en toda obra" },
  { patron: /residuo|escombro/i, nombre: "Gestión de residuos", motivo: "obligatoria" },
  { patron: /control de calidad|ensayo/i, nombre: "Control de calidad", motivo: "obligatorio cuando hay estructura" },
];

/**
 * En reforma integral no hay cimentación ni estructura, pero sí instalaciones.
 *
 * El control de calidad también se cae: su propio motivo dice "obligatorio
 * cuando hay estructura", y en una reforma no la hay. Reclamarlo era pedir un
 * ensayo de hormigón a quien solo está cambiando instalaciones y acabados.
 */
const REFORMA_COMPLETA: Obligatoria[] = VIVIENDA_NUEVA.filter(
  (o) =>
    !/geot[eé]cnic|cimentaci|estructura|cubierta|fachada|acabado exterior|urbanizaci|acometida|control de calidad/i.test(
      o.nombre
    )
);

/**
 * Qué capítulos son obligatorios en esta obra.
 *
 * MANDA EL TIPO, NO EL TEXTO LIBRE. `tipo` sale de un desplegable cerrado del
 * asistente; `detalles` lo escribe el usuario a su manera.
 *
 * Antes se concatenaban los dos y se buscaba "reforma integral" en el resultado.
 * Un presupuesto de "Cocina completa" cuyos detalles empezaban por "Reforma
 * integral de la cocina" pasaba a exigir el listado entero de una vivienda: para
 * 8 m² de cocina reclamaba aislamiento térmico, carpintería exterior, persianas,
 * puerta de entrada, ACS con aporte renovable, ventilación mecánica y control de
 * calidad. Once avisos, todos falsos, en el primer presupuesto que alguien probó.
 *
 * Y eso es lo peor que puede hacer esta comprobación: un aviso que salta cuando
 * no toca enseña a ignorarlos todos, incluido el que un día avise de verdad de
 * que falta la calefacción en una obra nueva.
 */
export function listaObligatoria(tipo: string, detalles: string): Obligatoria[] {
  if (OBRA_NUEVA.test(tipo)) return VIVIENDA_NUEVA;
  if (REFORMA_INTEGRAL.test(tipo)) return REFORMA_COMPLETA;

  // Cualquier otro tipo del desplegable es un trabajo concreto —una cocina, un
  // baño, unos suelos— y no se le exige nada. El texto libre no puede
  // convertirlo en una vivienda entera.
  if (!TIPO_SIN_DEFINIR.test(tipo)) return [];

  // Solo cuando el tipo es "Otra (descríbela en los detalles)" hay que leer la
  // prosa, y ahí "integral" tiene que venir acompañado de la vivienda entera.
  if (OBRA_NUEVA.test(detalles)) return VIVIENDA_NUEVA;
  if (REFORMA_INTEGRAL.test(detalles) && VIVIENDA_ENTERA.test(detalles)) return REFORMA_COMPLETA;
  return [];
}

/** Bloque para el prompt: lo que la IA tiene que incluir sí o sí. */
export function bloqueObligatorias(lista: Obligatoria[]): string {
  if (!lista.length) return "";
  return `
CAPÍTULOS QUE NO PUEDEN FALTAR EN ESTA OBRA. Repásalos uno a uno antes de responder; si dejas alguno fuera, el presupuesto se queda corto en decenas de miles de euros o la obra no se puede licenciar:
${lista.map((o) => `- ${o.nombre}${o.motivo ? ` (${o.motivo})` : ""}`).join("\n")}`;
}

/** Los que no aparecen en lo generado. */
export function faltan(lista: Obligatoria[], lineas: { capitulo: string; concepto: string; descripcion: string }[]) {
  if (!lista.length) return [];
  const texto = lineas.map((l) => `${l.capitulo} ${l.concepto} ${l.descripcion}`).join(" ");
  return lista.filter((o) => !o.patron.test(texto));
}
