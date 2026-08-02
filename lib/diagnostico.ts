/**
 * Reglas que afinan el diagnóstico con el contexto de la visita.
 *
 * Una fotografía sola no separa una condensación de una filtración: en la
 * pantalla son la misma mancha oscura. Lo que las separa son cuatro datos que el
 * reformista ya sabe y que no cuestan nada de preguntar — en qué planta está, si
 * el paramento da al exterior, qué hay encima y si la mancha aparece con el frío
 * o con la lluvia.
 *
 * Esas reglas están aquí, en código, y no en el prompt, por tres razones:
 *  1. No cambian de una ejecución a otra.
 *  2. Cada ajuste lleva escrito su motivo, así que el resultado se puede
 *     discutir: el usuario ve "he bajado filtración de cubierta porque hay una
 *     vivienda encima" y puede darle la vuelta si el dato era otro.
 *  3. Se pueden probar. Un prompt no.
 *
 * El modelo aporta solo la parte que un programa no puede hacer: mirar la foto y
 * decir a qué se parece.
 */

import { ORDEN_URGENCIA, patologiaPorId, type Patologia, type Urgencia } from "./patologias";

export type Contexto = {
  /** Dónde está la lesión. */
  estancia?: string;
  planta?: "sotano" | "baja" | "intermedia" | "ultima" | "";
  /** Si el paramento afectado da al exterior. */
  exterior?: boolean | null;
  /** Qué hay justo encima del punto afectado. */
  encima?: "vivienda" | "bano-cocina" | "cubierta" | "nada" | "";
  /** Cuándo aparece o empeora. Es el dato que más discrimina de todos. */
  cuando?: "invierno" | "lluvia" | "siempre" | "empeorando" | "";
  /** Antigüedad del edificio en años. */
  antiguedad?: number | null;
  /** Obra, excavación o derribo reciente en la parcela contigua o en la calle. */
  obraCerca?: boolean;
  /** Si la estancia tiene ventilación o extracción que funcione. */
  ventilacion?: "si" | "no" | "";
};

export type Confianza = "alta" | "media" | "baja";

/** Lo que devuelve el modelo por cada imagen, ya validado contra el catálogo. */
export type Observacion = {
  imagen: number;
  /** Descripción literal de lo que se aprecia, sin interpretar. */
  loQueSeVe: string;
  candidatos: { id: string; confianza: Confianza }[];
};

export type Candidato = {
  patologia: Patologia;
  puntos: number;
  /** Por qué ha subido o bajado. Se enseña al usuario tal cual. */
  motivos: string[];
  /** Descartado por el contexto pese a parecerse en la foto. */
  descartado: boolean;
};

const PUNTOS_CONFIANZA: Record<Confianza, number> = { alta: 3, media: 2, baja: 1 };

type Regla = {
  /** Cuándo aplica. */
  cuando: (c: Contexto) => boolean;
  /** Ajustes por patología. */
  ajustes: Record<string, number>;
  motivo: string;
};

/**
 * Las reglas.
 *
 * Están escritas para ser leídas por alguien de obra: si una regla no se puede
 * defender delante de un aparejador, no debería estar aquí.
 */
const REGLAS: Regla[] = [
  {
    cuando: (c) => c.cuando === "invierno",
    ajustes: {
      "humedad-condensacion": 3,
      moho: 2,
      "carpinteria-deteriorada": 1,
      "humedad-filtracion-fachada": -2,
      "humedad-filtracion-cubierta": -2,
      "humedad-fuga-fontaneria": -1,
    },
    motivo: "aparece o empeora en invierno y con la casa cerrada, que es el patrón de la condensación y no el del agua que entra de fuera",
  },
  {
    cuando: (c) => c.cuando === "lluvia",
    ajustes: {
      "humedad-filtracion-fachada": 3,
      "humedad-filtracion-cubierta": 3,
      "desague-obstruido": 2,
      "cubierta-tejas": 1,
      "humedad-condensacion": -3,
      "humedad-capilaridad": -2,
    },
    motivo: "aparece o crece con la lluvia, así que el agua entra de fuera",
  },
  {
    cuando: (c) => c.cuando === "siempre",
    ajustes: { "humedad-capilaridad": 2, eflorescencias: 1, "humedad-condensacion": -1 },
    motivo: "está igual todo el año, sin depender del frío ni de la lluvia",
  },
  {
    cuando: (c) => c.cuando === "empeorando",
    ajustes: { "humedad-fuga-fontaneria": 3, "flecha-forjado": 1, "grieta-asiento": 1 },
    motivo: "crece de forma continua, y eso es propio de una causa que sigue activa",
  },

  {
    cuando: (c) => c.planta === "baja" || c.planta === "sotano",
    ajustes: { "humedad-capilaridad": 2, eflorescencias: 1 },
    motivo: "está en planta baja o sótano, en contacto con el terreno",
  },
  {
    cuando: (c) => c.planta === "intermedia" || c.planta === "ultima",
    ajustes: { "humedad-capilaridad": -3, eflorescencias: -1 },
    motivo: "la capilaridad sube desde el terreno: por encima de la planta baja no se sostiene",
  },
  {
    cuando: (c) => c.planta === "ultima",
    ajustes: { "humedad-filtracion-cubierta": 2, "fisura-dilatacion": 2, "cubierta-tejas": 1 },
    motivo: "está en la última planta, que es la que recibe la cubierta y la que más dilata",
  },

  {
    cuando: (c) => c.encima === "bano-cocina",
    ajustes: { "humedad-fuga-fontaneria": 3, "humedad-filtracion-cubierta": -2 },
    motivo: "hay un baño o una cocina justo encima",
  },
  {
    cuando: (c) => c.encima === "vivienda",
    ajustes: { "humedad-filtracion-cubierta": -3, "humedad-fuga-fontaneria": 1 },
    motivo: "hay una vivienda encima, así que el agua no puede venir de la cubierta",
  },
  {
    cuando: (c) => c.encima === "cubierta",
    ajustes: { "humedad-filtracion-cubierta": 3, "cubierta-tejas": 2, "desague-obstruido": 1 },
    motivo: "el punto afectado está directamente bajo cubierta",
  },

  {
    cuando: (c) => c.exterior === false,
    ajustes: { "humedad-filtracion-fachada": -3, "carpinteria-deteriorada": -2 },
    motivo: "es un paramento interior, sin cara expuesta a la lluvia",
  },
  {
    cuando: (c) => c.exterior === true,
    ajustes: { "humedad-filtracion-fachada": 1 },
    motivo: "el paramento da al exterior",
  },

  {
    cuando: (c) => /ba[ñn]o|aseo|cocina|ducha/i.test(c.estancia || ""),
    ajustes: { "humedad-fuga-fontaneria": 1, "humedad-condensacion": 1, moho: 1 },
    motivo: "es un baño o una cocina: hay agua y se genera mucho vapor",
  },
  {
    cuando: (c) => c.ventilacion === "no",
    ajustes: { "humedad-condensacion": 2, moho: 2 },
    motivo: "la estancia no tiene ventilación ni extracción que funcione",
  },
  {
    cuando: (c) => c.ventilacion === "si",
    ajustes: { "humedad-condensacion": -1 },
    motivo: "la estancia ventila, lo que hace la condensación menos probable",
  },

  {
    cuando: (c) => c.obraCerca === true,
    ajustes: { "grieta-asiento": 3 },
    motivo: "hay obra, excavación o derribo reciente cerca, que es la causa más habitual de un asiento",
  },
  {
    cuando: (c) => (c.antiguedad ?? 0) >= 50,
    ajustes: {
      "oxidacion-vigueta-metalica": 1,
      "corrosion-armaduras": 1,
      xilofagos: 1,
      "instalacion-electrica-obsoleta": 1,
      "humedad-capilaridad": 1,
      "dintel-degradado": 1,
    },
    motivo: "el edificio tiene más de 50 años: sin barrera antihumedad, con estructura y con instalaciones de su época",
  },
  {
    cuando: (c) => (c.antiguedad ?? 99) <= 15,
    ajustes: {
      "humedad-capilaridad": -2,
      "oxidacion-vigueta-metalica": -2,
      "instalacion-electrica-obsoleta": -2,
      xilofagos: -1,
      "fisura-retraccion": 1,
    },
    motivo: "es un edificio reciente: lo propio de esta edad son defectos de ejecución, no degradación por el tiempo",
  },
];

/**
 * Combina lo que ha visto el modelo con el contexto de la visita.
 *
 * Un candidato que baja de 1 punto se marca como descartado en vez de borrarse:
 * el usuario tiene que poder ver que se había considerado y por qué se cayó. Si
 * el dato de contexto era erróneo, lo corrige y vuelve a salir.
 */
export function ordenarCandidatos(observaciones: Observacion[], contexto: Contexto): Candidato[] {
  const puntos = new Map<string, number>();
  const motivos = new Map<string, string[]>();

  for (const obs of observaciones) {
    for (const c of obs.candidatos) {
      if (!patologiaPorId(c.id)) continue;
      // Varias fotos de la misma lesión no deben multiplicar la puntuación: se
      // queda la vista más clara, no la suma de todas.
      const previo = puntos.get(c.id) ?? 0;
      puntos.set(c.id, Math.max(previo, PUNTOS_CONFIANZA[c.confianza]));
    }
  }

  const reglasAplicadas = REGLAS.filter((r) => r.cuando(contexto));
  for (const regla of reglasAplicadas) {
    for (const [id, delta] of Object.entries(regla.ajustes)) {
      if (!puntos.has(id)) continue; // no se inventan candidatos que la foto no sugiere
      puntos.set(id, (puntos.get(id) ?? 0) + delta);
      const lista = motivos.get(id) ?? [];
      lista.push(`${delta > 0 ? "Sube" : "Baja"}: ${regla.motivo}.`);
      motivos.set(id, lista);
    }
  }

  return [...puntos.entries()]
    .map(([id, p]) => ({
      patologia: patologiaPorId(id)!,
      puntos: p,
      motivos: motivos.get(id) ?? [],
      descartado: p < 1,
    }))
    .sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      // A igualdad de puntos manda lo más grave: es el orden en que conviene
      // comprobarlo en la visita.
      return ORDEN_URGENCIA[b.patologia.urgencia] - ORDEN_URGENCIA[a.patologia.urgencia];
    });
}

/**
 * ¿Se puede cerrar el diagnóstico con lo que hay?
 *
 * Casi nunca. Y decirlo es justo lo que hace útil la herramienta: el resultado
 * honesto de mirar una foto no suele ser "es esto", sino "es esto o esto otro, y
 * para saber cuál hay que hacer esta comprobación en la visita".
 */
export function esConcluyente(vivos: Candidato[]): boolean {
  if (vivos.length === 0) return false;
  if (vivos.length === 1) return vivos[0].puntos >= 3;
  const [primero, segundo] = vivos;
  if (primero.puntos - segundo.puntos < 2) return false;
  // Si el segundo es de los que se confunden con el primero, la foto no los
  // separa por definición: hay que ir a la comprobación de obra.
  const seConfunden = primero.patologia.confundibleCon.some((c) => c.id === segundo.patologia.id);
  return !(seConfunden && segundo.puntos >= 2);
}

/** Cómo distinguir el candidato principal de los que le siguen. */
export function diferencial(vivos: Candidato[]) {
  if (vivos.length < 2) return [];
  const principal = vivos[0].patologia;
  return vivos
    .slice(1, 4)
    .map((c) => {
      const directo = principal.confundibleCon.find((x) => x.id === c.patologia.id);
      const inverso = c.patologia.confundibleCon.find((x) => x.id === principal.id);
      const texto = directo?.comoDistinguir || inverso?.comoDistinguir;
      return texto ? { con: c.patologia.etiqueta, comoDistinguir: texto } : null;
    })
    .filter((x): x is { con: string; comoDistinguir: string } => !!x);
}

/** La urgencia del conjunto es la del candidato vivo más grave. */
export function urgenciaGlobal(vivos: Candidato[]): { nivel: Urgencia; porQue: string } | null {
  if (!vivos.length) return null;
  const peor = [...vivos].sort(
    (a, b) => ORDEN_URGENCIA[b.patologia.urgencia] - ORDEN_URGENCIA[a.patologia.urgencia]
  )[0];
  return { nivel: peor.patologia.urgencia, porQue: peor.patologia.porQueUrgencia };
}

/** Comprobaciones a hacer en la visita, sin repetir, ordenadas por candidato. */
export function comprobacionesPendientes(vivos: Candidato[], maximo = 8): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const c of vivos) {
    for (const comp of c.patologia.comprobaciones) {
      const clave = comp.toLowerCase().slice(0, 40);
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      salida.push(comp);
      if (salida.length >= maximo) return salida;
    }
  }
  return salida;
}
