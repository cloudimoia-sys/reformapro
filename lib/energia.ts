/**
 * Evaluación energética previa de una vivienda existente.
 *
 * QUÉ ES ESTO Y QUÉ NO ES
 *
 * Esto NO calcula un certificado de eficiencia energética, y no puede hacerlo.
 * El RD 390/2021 exige tres cosas que no están en el código de nadie:
 *
 *   1. Lo firma un TÉCNICO COMPETENTE (arquitecto, arquitecto técnico o
 *      ingeniero con la titulación habilitante).
 *   2. La calificación sale de un PROGRAMA RECONOCIDO por el Ministerio —
 *      CE3X, CERMA, HULC o SG SAVE. Ningún otro cálculo vale, por bueno que sea.
 *   3. Se REGISTRA en el registro de la comunidad autónoma, y es ese registro
 *      el que asigna el número y emite la etiqueta. Sin registro no hay
 *      certificado: hay un papel que se le parece.
 *
 * Un documento que imitara al original sin ese registro es el que mete en un
 * problema al técnico que lo firma y a quien vende el programa que lo genera.
 * Por eso aquí la letra sale siempre como RANGO orientativo y el documento dice
 * en su primera línea que no es un certificado.
 *
 * PARA QUÉ SIRVE ENTONCES
 *
 * Para lo que de verdad le hace falta a un reformista, que es lo de antes y lo
 * de después del certificado:
 *
 *   - Saber por dónde anda la vivienda antes de gastarse el dinero, y qué
 *     obras suben la letra y cuáles no la mueven.
 *   - Llevarle al técnico la toma de datos hecha, que es lo que convierte una
 *     visita de dos horas en una de veinte minutos.
 *   - Poner precio a las mejoras con el mismo baremo que el resto de la app.
 *
 * TODO LO DE AQUÍ SE CALCULA EN CÓDIGO. La IA solo redacta la prosa alrededor.
 */

/* ────────────────────────── Datos que se recogen ────────────────────────── */

export type Ventana =
  | "SIMPLE_METAL"
  | "SIMPLE_MADERA"
  | "DOBLE_SIN_ROTURA"
  | "DOBLE_CON_ROTURA"
  | "DOBLE_PVC"
  | "TRIPLE";

export type Sistema =
  | "NINGUNO"
  | "ELECTRICO_DIRECTO"
  | "CALDERA_GASOLEO"
  | "CALDERA_GAS"
  | "CALDERA_GAS_CONDENSACION"
  | "BOMBA_CALOR"
  | "AEROTERMIA"
  | "BIOMASA";

export type DatosEnergeticos = {
  /** Provincia, tal y como se escribe. Se usa para la zona climática. */
  provincia: string;
  /** Metros de altitud sobre el nivel del mar, si se sabe. */
  altitud?: number;
  /** Año de construcción del edificio. Es el dato que más pesa. */
  anio: number;
  /** Superficie útil en m². */
  superficie: number;
  /** Piso intermedio, bajo cubierta, unifamiliar... */
  tipo: "PISO_INTERMEDIO" | "PISO_ULTIMA_PLANTA" | "PISO_BAJO" | "UNIFAMILIAR";
  ventanas: Ventana;
  /** Se le añadió aislamiento a la fachada después de construirse. */
  fachadaAislada: boolean;
  /** Se aisló la cubierta o el bajo cubierta. */
  cubiertaAislada: boolean;
  sistemaCalefaccion: Sistema;
  sistemaAcs: Sistema;
  /** Placas solares térmicas o fotovoltaicas. */
  renovables: boolean;
};

/* ─────────────────────────── Zona climática ───────────────────────────── */

/**
 * Zona climática de cada capital de provincia, del CTE DB-HE (apéndice B).
 *
 * La primera letra es la severidad de INVIERNO (α la más suave, E la más dura)
 * y el número la de VERANO (1 la más suave, 4 la más dura). Es lo que decide
 * si en esa vivienda compensa antes aislar o antes proteger del sol.
 *
 * ⚠️ PENDIENTE DE VALIDAR POR UN TÉCNICO, igual que lib/normativa.ts. Está
 * transcrito de la tabla del CTE, pero una transcripción no es una lectura
 * profesional y aquí un error se propaga a la recomendación.
 *
 * Para localidades que no son capital, el CTE corrige por altitud: por eso
 * `zonaClimatica` acepta los metros y endurece el invierno al subir.
 */
const ZONAS: Record<string, string> = {
  albacete: "D3", alicante: "B4", almeria: "A4", avila: "E1", badajoz: "C4",
  barcelona: "C2", bilbao: "C1", burgos: "E1", caceres: "C4", cadiz: "A3",
  castellon: "B3", "ciudad real": "D3", cordoba: "B4", cuenca: "D2",
  girona: "C2", granada: "C3", guadalajara: "D3", huelva: "B4", huesca: "D2",
  jaen: "C4", "a coruna": "C1", leon: "E1", lleida: "D3", logrono: "D2",
  lugo: "D1", madrid: "D3", malaga: "A3", murcia: "B3", ourense: "C2",
  oviedo: "C1", palencia: "D1", "las palmas": "A3", pamplona: "D1",
  pontevedra: "C1", salamanca: "D2", "san sebastian": "C1",
  "santa cruz de tenerife": "A3", santander: "C1", segovia: "D2", sevilla: "B4",
  soria: "E1", tarragona: "B3", teruel: "D2", toledo: "C4", valencia: "B3",
  valladolid: "D2", vitoria: "D1", zamora: "D2", zaragoza: "D3",
  ceuta: "B3", melilla: "A3",
};

/** Orden de dureza del invierno, para poder subir o bajar un escalón. */
const INVIERNOS = ["A", "B", "C", "D", "E"] as const;

const sinTildes = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function zonaClimatica(provincia: string, altitud?: number): string | null {
  const zona = ZONAS[sinTildes(provincia)];
  if (!zona) return null;
  if (!altitud || altitud < 600) return zona;

  /*
   * Corrección por altitud, simplificada a propósito.
   *
   * El CTE la hace por diferencia de cota con la capital y con una tabla por
   * provincia. Aquí se endurece el invierno un escalón por encima de 600 m y
   * otro por encima de 1.000, que es lo que hace falta para ORDENAR mejoras.
   * Para la calificación de verdad ya está CE3X, que lo hace bien.
   */
  const escalones = altitud >= 1000 ? 2 : 1;
  const i = INVIERNOS.indexOf(zona[0] as (typeof INVIERNOS)[number]);
  if (i < 0) return zona; // α: las Canarias no se endurecen por esta vía
  return INVIERNOS[Math.min(i + escalones, INVIERNOS.length - 1)] + zona.slice(1);
}

/** Cuánto pesa el frío en esta zona: decide si aislar va antes que proteger del sol. */
export function inviernoDuro(zona: string | null) {
  return !!zona && ["D", "E"].includes(zona[0]);
}

/* ──────────────────────── Época de construcción ──────────────────────── */

export type Periodo = {
  hasta: number;
  nombre: string;
  /** Qué normativa de aislamiento le aplicaba, que es lo que explica su estado. */
  normativa: string;
  /** Punto de partida de la escala antes de aplicar lo que tenga la vivienda. */
  base: number;
};

/**
 * La época manda por encima de todo lo demás.
 *
 * Hasta 1979 en España no había ninguna exigencia de aislamiento: un edificio de
 * esos años, sin reformar, es prácticamente siempre G o F. Lo que vino después
 * son tres saltos normativos, y cada uno se nota en la letra.
 */
/*
 * Los valores están calibrados, no puestos a ojo.
 *
 * La primera versión arrancaba la época más antigua en 0, y eso hundía el
 * resultado por debajo del suelo de la escala: una vivienda de 1972 salía G con
 * gasóleo y G también con aerotermia, porque el recorte a G se comía la
 * diferencia. En la realidad ese cambio mueve la letra, porque la calificación
 * se calcula sobre emisiones. Lo detectó la prueba, no una revisión a ojo.
 *
 * Ahora las bases están puestas para que los casos habituales del parque
 * español caigan donde suele dejarlos CE3X: un piso de los setenta sin tocar en
 * G, uno de los noventa en E, uno de 2010 en D, y uno de 2020 en A o B. Sigue
 * siendo una estimación, y por eso el resultado se da en rango.
 */
const PERIODOS: Periodo[] = [
  { hasta: 1979, nombre: "Anterior a 1979", normativa: "Sin exigencia de aislamiento: la NBE-CT-79 aún no existía", base: 1.2 },
  { hasta: 2006, nombre: "1980-2006", normativa: "NBE-CT-79, la primera que exigió aislamiento", base: 1.9 },
  { hasta: 2013, nombre: "2007-2013", normativa: "CTE DB-HE de 2006", base: 3 },
  { hasta: 2019, nombre: "2014-2019", normativa: "CTE DB-HE de 2013, con exigencias bastante más duras", base: 4 },
  { hasta: 9999, nombre: "2020 en adelante", normativa: "CTE DB-HE de 2019 (edificio de consumo casi nulo)", base: 5.5 },
];

export function periodoDe(anio: number): Periodo {
  return PERIODOS.find((p) => anio <= p.hasta) ?? PERIODOS[PERIODOS.length - 1];
}

/* ───────────────────── Estimación de la calificación ───────────────────── */

const LETRAS = ["G", "F", "E", "D", "C", "B", "A"] as const;
export type Letra = (typeof LETRAS)[number];

/** Lo que suma o resta cada elemento sobre la base de la época. */
const PESO_VENTANA: Record<Ventana, number> = {
  SIMPLE_METAL: -1,
  SIMPLE_MADERA: -0.5,
  DOBLE_SIN_ROTURA: 0,
  DOBLE_CON_ROTURA: 0.5,
  DOBLE_PVC: 1,
  TRIPLE: 1.5,
};

/**
 * El sistema pesa mucho porque la letra se calcula sobre EMISIONES de CO2.
 *
 * Por eso una vivienda con gasóleo puede quedar por debajo de otra idéntica con
 * aerotermia, aunque la envolvente sea la misma: no es cuánta energía gasta,
 * es cuánto CO2 emite para conseguirla.
 */
const PESO_SISTEMA: Record<Sistema, number> = {
  NINGUNO: -0.5,
  ELECTRICO_DIRECTO: -1,
  CALDERA_GASOLEO: -1,
  CALDERA_GAS: 0,
  CALDERA_GAS_CONDENSACION: 0.5,
  BOMBA_CALOR: 1,
  AEROTERMIA: 1.5,
  BIOMASA: 1,
};

/** Cuánta envolvente toca el exterior: un piso intermedio tiene mucha menos. */
const PESO_TIPO: Record<DatosEnergeticos["tipo"], number> = {
  PISO_INTERMEDIO: 0.5,
  PISO_BAJO: 0,
  PISO_ULTIMA_PLANTA: -0.5,
  UNIFAMILIAR: -1,
};

export type Estimacion = {
  /** Rango, nunca una letra sola: el margen del método no da para más. */
  desde: Letra;
  hasta: Letra;
  zona: string | null;
  periodo: Periodo;
  /** Cada cosa que ha movido la estimación, para poder enseñarla. */
  motivos: string[];
};

/**
 * Estima el rango de calificación.
 *
 * SIEMPRE devuelve un rango de dos letras. No es prudencia de más: sin el
 * cálculo de CE3X sobre la geometría real, la orientación y los puentes
 * térmicos, dar una letra concreta sería inventarse una precisión que no
 * existe, y alguien la usaría para vender un piso.
 */
export function estimar(d: DatosEnergeticos): Estimacion {
  const zona = zonaClimatica(d.provincia, d.altitud);
  const periodo = periodoDe(d.anio);
  const motivos: string[] = [];

  let puntos = periodo.base;
  motivos.push(`Época de construcción (${periodo.nombre}): ${periodo.normativa}.`);

  puntos += PESO_TIPO[d.tipo];
  if (d.tipo === "UNIFAMILIAR") motivos.push("Unifamiliar: toda la envolvente da al exterior, así que pierde más que un piso.");
  if (d.tipo === "PISO_INTERMEDIO") motivos.push("Piso intermedio: los vecinos de arriba y abajo le hacen de aislamiento.");
  if (d.tipo === "PISO_ULTIMA_PLANTA") motivos.push("Última planta: la cubierta es suya, y por ahí se va buena parte del calor.");

  puntos += PESO_VENTANA[d.ventanas];
  if (d.ventanas === "SIMPLE_METAL") motivos.push("Ventana de vidrio simple con carpintería metálica sin rotura: es el punto más débil de la vivienda.");
  if (d.ventanas === "TRIPLE" || d.ventanas === "DOBLE_PVC") motivos.push("Carpintería moderna con buen vidrio: suma.");

  if (d.fachadaAislada) {
    puntos += 2;
    motivos.push("Fachada aislada por reforma posterior: es la mejora que más mueve la letra.");
  }
  if (d.cubiertaAislada) {
    puntos += 1;
    motivos.push("Cubierta aislada.");
  }

  // Se toma el peor de los dos sistemas: el que más emite es el que arrastra.
  const sistema = Math.min(PESO_SISTEMA[d.sistemaCalefaccion], PESO_SISTEMA[d.sistemaAcs]);
  puntos += sistema;
  if (d.sistemaCalefaccion === "CALDERA_GASOLEO" || d.sistemaAcs === "CALDERA_GASOLEO") {
    motivos.push("Gasóleo: la letra se calcula sobre emisiones de CO2, y el gasóleo es el combustible que más emite.");
  }
  if (d.sistemaCalefaccion === "AEROTERMIA" || d.sistemaAcs === "AEROTERMIA") {
    motivos.push("Aerotermia: rinde varias veces lo que consume, así que baja mucho las emisiones.");
  }

  if (d.renovables) {
    puntos += 1;
    motivos.push("Aporte renovable propio (solar térmica o fotovoltaica).");
  }

  /*
   * Techo por época: una rehabilitación no convierte un edificio viejo en uno nuevo.
   *
   * Sin esto, un piso de 1972 con la fachada aislada, ventanas nuevas y
   * aerotermia salía A, que es la letra de un edificio de consumo casi nulo. En
   * la realidad una rehabilitación profunda de un bloque de los setenta se queda
   * en C o B: lo que no se puede arreglar a posteriori son los puentes térmicos
   * del forjado, la hermeticidad y la ventilación con recuperación de calor.
   *
   * Prometer una A que luego el técnico no confirma es la forma más rápida de
   * que el cliente se sienta engañado, y el que da la cara es el reformista.
   */
  const TECHO_POR_EPOCA: Record<string, number> = {
    "Anterior a 1979": d.renovables ? 5 : 4, // B con renovables, C sin ellas
    "1980-2006": d.renovables ? 6 : 5,
  };
  const techo = TECHO_POR_EPOCA[periodo.nombre];
  if (techo !== undefined && Math.round(puntos) > techo) {
    puntos = techo;
    motivos.push(
      `Aun rehabilitada, una vivienda de esta época no suele pasar de ${LETRAS[techo]}: los puentes térmicos del forjado, la hermeticidad y la ventilación con recuperación no se arreglan a posteriori.`
    );
  }

  const indice = Math.max(0, Math.min(LETRAS.length - 1, Math.round(puntos)));
  // El rango se abre hacia arriba porque el método tiende a ser conservador:
  // no ve la orientación ni los puentes térmicos, que suelen restar.
  const arriba = Math.min(LETRAS.length - 1, indice + 1);

  return { desde: LETRAS[indice], hasta: LETRAS[arriba], zona, periodo, motivos };
}

/* ─────────────────────────── Mejoras y su precio ─────────────────────────── */

export type Mejora = {
  /** Concepto tal y como está escrito en lib/baremo.ts, para que herede precio. */
  concepto: string;
  unidad: "m²" | "ud";
  /** Cuánta superficie se mide, calculada sobre los datos de la vivienda. */
  medir: (d: DatosEnergeticos) => number;
  /** Cuántos escalones de letra puede subir, orientativo. */
  escalones: number;
  porQue: string;
};

/**
 * Las mejoras que de verdad mueven la letra, en orden de impacto.
 *
 * Deliberadamente NO están todas las que existen: están las que un reformista
 * puede ejecutar y le cambian el resultado. Cambiar bombillas no sube una letra
 * y ponerlo aquí solo serviría para engordar el presupuesto.
 *
 * Las superficies se estiman a partir de la superficie útil con proporciones de
 * vivienda española al uso. Son estimaciones para presupuestar, y el documento
 * lo dice: las definitivas salen de medir.
 */
const MEJORAS: Mejora[] = [
  {
    concepto: "Aislamiento térmico por el exterior (SATE), con andamio y acabado",
    unidad: "m²",
    // Fachada expuesta: en unifamiliar, del orden de la superficie útil; en piso,
    // bastante menos porque solo cuentan las fachadas propias.
    medir: (d) => Math.round(d.superficie * (d.tipo === "UNIFAMILIAR" ? 1.1 : 0.45)),
    escalones: 2,
    porQue: "Es la que más mueve la letra: corta los puentes térmicos y deja la fachada nueva.",
  },
  {
    concepto: "Aislamiento insuflado en cámara de aire existente",
    unidad: "m²",
    medir: (d) => Math.round(d.superficie * (d.tipo === "UNIFAMILIAR" ? 1.1 : 0.45)),
    escalones: 1,
    porQue: "Mucho más barata que el SATE y sin andamio, pero solo vale si hay cámara y no corta los puentes térmicos.",
  },
  {
    concepto: "Aislamiento térmico de cubierta por el interior",
    unidad: "m²",
    medir: (d) => (d.tipo === "PISO_INTERMEDIO" || d.tipo === "PISO_BAJO" ? 0 : Math.round(d.superficie * 0.9)),
    escalones: 1,
    porQue: "En última planta y en unifamiliar, por la cubierta se va una parte grande del calor.",
  },
  {
    concepto: "Ventana de aluminio o PVC con RPT y vidrio 4/16/6 bajo emisivo",
    unidad: "m²",
    // Regla de oro: el hueco ronda el 12-15 % de la superficie útil en vivienda.
    medir: (d) => Math.max(6, Math.round(d.superficie * 0.13)),
    escalones: 1,
    porQue: "Quita las corrientes y las condensaciones en el marco, que es lo que el cliente nota el primer día.",
  },
  {
    concepto: "Calefacción y ACS con aerotermia (bomba de calor + emisores)",
    // En m² y no por unidad porque así está en el baremo: el precio incluye los
    // emisores, y esos dependen de la vivienda, no de la máquina.
    unidad: "m²",
    medir: (d) => d.superficie,
    escalones: 2,
    porQue: "Cambia el combustible por electricidad con un rendimiento de varias veces uno, y la letra se calcula sobre emisiones.",
  },
];

export type MejoraPropuesta = {
  concepto: string;
  unidad: string;
  cantidad: number;
  escalones: number;
  porQue: string;
};

/**
 * Qué mejoras tiene sentido proponer en ESTA vivienda.
 *
 * Lo que ya está hecho no se propone —presupuestar un aislamiento de fachada a
 * quien ya lo tiene es el error que más credibilidad quita— y lo que no aplica
 * a su tipología tampoco.
 */
export function mejorasPara(d: DatosEnergeticos): MejoraPropuesta[] {
  const zona = zonaClimatica(d.provincia, d.altitud);
  const propuestas: MejoraPropuesta[] = [];

  for (const m of MEJORAS) {
    if (d.fachadaAislada && /SATE|insuflado/i.test(m.concepto)) continue;
    if (d.cubiertaAislada && /cubierta/i.test(m.concepto)) continue;
    if (/Ventana/i.test(m.concepto) && ["DOBLE_PVC", "TRIPLE"].includes(d.ventanas)) continue;
    if (/Aerotermia/i.test(m.concepto) && (d.sistemaCalefaccion === "AEROTERMIA" || d.sistemaAcs === "AEROTERMIA")) continue;

    const cantidad = m.medir(d);
    if (cantidad <= 0) continue;
    propuestas.push({ concepto: m.concepto, unidad: m.unidad, cantidad, escalones: m.escalones, porQue: m.porQue });
  }

  /*
   * El SATE y el insuflado hacen lo mismo por caminos distintos: se ofrecen los
   * dos, pero el orden cambia con el clima. Donde el invierno es duro compensa
   * el SATE aunque cueste el triple; donde es suave, el insuflado da casi todo
   * el resultado por una fracción del precio.
   */
  if (!inviernoDuro(zona)) {
    const i = propuestas.findIndex((p) => /SATE/i.test(p.concepto));
    const j = propuestas.findIndex((p) => /insuflado/i.test(p.concepto));
    if (i >= 0 && j > i) {
      const [sate] = propuestas.splice(i, 1);
      propuestas.splice(j, 0, sate);
    }
  }

  return propuestas;
}

/* ─────────────────────── Toma de datos para el técnico ─────────────────── */

export const ETIQUETA_VENTANA: Record<Ventana, string> = {
  SIMPLE_METAL: "Vidrio simple, carpintería metálica sin rotura de puente térmico",
  SIMPLE_MADERA: "Vidrio simple, carpintería de madera",
  DOBLE_SIN_ROTURA: "Doble acristalamiento, carpintería sin rotura de puente térmico",
  DOBLE_CON_ROTURA: "Doble acristalamiento, carpintería con rotura de puente térmico",
  DOBLE_PVC: "Doble acristalamiento, carpintería de PVC",
  TRIPLE: "Triple acristalamiento",
};

export const ETIQUETA_SISTEMA: Record<Sistema, string> = {
  NINGUNO: "Sin sistema fijo",
  ELECTRICO_DIRECTO: "Eléctrico directo (radiadores o acumuladores)",
  CALDERA_GASOLEO: "Caldera de gasóleo",
  CALDERA_GAS: "Caldera de gas natural o propano",
  CALDERA_GAS_CONDENSACION: "Caldera de gas de condensación",
  BOMBA_CALOR: "Bomba de calor",
  AEROTERMIA: "Aerotermia",
  BIOMASA: "Biomasa (pellet o leña)",
};

export const ETIQUETA_TIPO_VIVIENDA: Record<DatosEnergeticos["tipo"], string> = {
  PISO_INTERMEDIO: "Piso en planta intermedia",
  PISO_ULTIMA_PLANTA: "Piso en última planta",
  PISO_BAJO: "Piso en planta baja",
  UNIFAMILIAR: "Vivienda unifamiliar",
};

/**
 * La ficha que se le entrega al técnico que sí va a certificar.
 *
 * Es la parte más útil de todo esto y la que no hace ningún competidor: el
 * técnico llega con los datos tomados y solo tiene que comprobarlos, medir lo
 * que falte y meterlo en CE3X. La visita pasa de dos horas a veinte minutos, y
 * eso se nota en lo que cobra.
 */
export function fichaParaElTecnico(d: DatosEnergeticos): { campo: string; valor: string }[] {
  const zona = zonaClimatica(d.provincia, d.altitud);
  return [
    { campo: "Provincia", valor: d.provincia },
    { campo: "Altitud", valor: d.altitud ? `${d.altitud} m` : "No indicada — compruébala, corrige la zona climática" },
    { campo: "Zona climática estimada (CTE DB-HE)", valor: zona || "No determinada: provincia no reconocida" },
    { campo: "Año de construcción", valor: String(d.anio) },
    { campo: "Normativa de aislamiento aplicable", valor: periodoDe(d.anio).normativa },
    { campo: "Superficie útil", valor: `${d.superficie} m²` },
    { campo: "Tipología", valor: ETIQUETA_TIPO_VIVIENDA[d.tipo] },
    { campo: "Huecos", valor: ETIQUETA_VENTANA[d.ventanas] },
    { campo: "Fachada", valor: d.fachadaAislada ? "Aislada en reforma posterior" : "Sin aislamiento añadido" },
    { campo: "Cubierta", valor: d.cubiertaAislada ? "Aislada" : "Sin aislamiento añadido" },
    { campo: "Calefacción", valor: ETIQUETA_SISTEMA[d.sistemaCalefaccion] },
    { campo: "ACS", valor: ETIQUETA_SISTEMA[d.sistemaAcs] },
    { campo: "Renovables", valor: d.renovables ? "Sí" : "No" },
  ];
}

/**
 * El aviso, literal, que va impreso en el documento.
 *
 * Va aquí y no en la plantilla para que no se pueda quitar editando el texto
 * generado: es lo que separa una herramienta de venta de un problema legal.
 */
export const AVISO_NO_ES_CERTIFICADO =
  "Este documento NO es un certificado de eficiencia energética. La calificación oficial solo la puede emitir un técnico competente, calculándola con un programa reconocido (CE3X, CERMA, HULC o SG SAVE) y registrándola después en el registro de la comunidad autónoma, que es quien asigna el número y emite la etiqueta (RD 390/2021). Lo que hay aquí es una evaluación previa orientativa para decidir qué obras merecen la pena y para llevarle la toma de datos hecha al técnico que sí va a certificar.";

/** Bloque de datos ya calculados que se le pasa a la IA para que solo redacte. */
export function bloqueParaElModelo(d: DatosEnergeticos): string {
  const e = estimar(d);
  const mejoras = mejorasPara(d);
  return `
DATOS YA CALCULADOS POR EL PROGRAMA. Úsalos tal cual: NO los recalcules, NO los cambies y NO añadas una letra distinta.
- Zona climática: ${e.zona || "no determinada"}
- Época y normativa: ${e.periodo.nombre} — ${e.periodo.normativa}
- Rango de calificación estimado: entre ${e.desde} y ${e.hasta}
- Por qué: ${e.motivos.join(" ")}
- Mejoras que procede proponer, en este orden: ${mejoras.map((m) => `${m.concepto} (${m.cantidad} ${m.unidad})`).join("; ") || "ninguna"}

PROHIBIDO en este documento: llamarlo certificado, dar una letra única en lugar del rango, mencionar un número de registro, o dar a entender que sirve para vender o alquilar. Si el texto puede confundirse con un certificado oficial, está mal escrito.`;
}
