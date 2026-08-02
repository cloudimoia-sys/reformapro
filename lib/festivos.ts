/**
 * Calendario laboral español.
 *
 * Una obra se planifica en días de trabajo, no en días de calendario. Decirle a
 * un cliente que la reforma acaba el 15 de agosto porque se han contado los días
 * corridos es la clase de error que se paga con una reclamación, así que los días
 * los cuenta el programa y no una estimación a ojo.
 *
 * ALCANCE, dicho claro: aquí solo están los festivos NACIONALES. Los autonómicos
 * y los locales cambian con cada comunidad y cada municipio, y no hay forma
 * honesta de adivinarlos desde el código. Por eso cada obra puede añadir los
 * suyos a mano, y la aplicación lo pide expresamente en lugar de callarse y dar
 * una fecha optimista.
 */

/**
 * Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher (calendario gregoriano).
 *
 * Hace falta porque el Viernes Santo es festivo nacional y cae en fecha distinta
 * cada año: sin calcularlo, toda obra que cruce la Semana Santa sale corta.
 */
export function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function sumarDiasUTC(d: Date, dias: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + dias);
  return r;
}

/**
 * Festivos de ámbito nacional de un año, en formato AAAA-MM-DD.
 *
 * El Jueves Santo NO está: es festivo en casi toda España pero no en Cataluña ni
 * en la Comunidad Valenciana, así que entra por la vía de los festivos propios de
 * la obra. Es preferible quedarse corto y que el usuario añada uno, a dar por
 * festivo un día en el que su cuadrilla sí trabaja.
 */
export function festivosNacionales(anio: number): { fecha: string; nombre: string }[] {
  const pascua = domingoDePascua(anio);
  return [
    { fecha: `${anio}-01-01`, nombre: "Año Nuevo" },
    { fecha: `${anio}-01-06`, nombre: "Epifanía del Señor" },
    { fecha: iso(sumarDiasUTC(pascua, -2)), nombre: "Viernes Santo" },
    { fecha: `${anio}-05-01`, nombre: "Fiesta del Trabajo" },
    { fecha: `${anio}-08-15`, nombre: "Asunción de la Virgen" },
    { fecha: `${anio}-10-12`, nombre: "Fiesta Nacional de España" },
    { fecha: `${anio}-11-01`, nombre: "Todos los Santos" },
    { fecha: `${anio}-12-06`, nombre: "Día de la Constitución" },
    { fecha: `${anio}-12-08`, nombre: "Inmaculada Concepción" },
    { fecha: `${anio}-12-25`, nombre: "Natividad del Señor" },
  ];
}

export type CalendarioLaboral = {
  /** Devuelve true si ese día se trabaja. */
  esLaborable: (f: Date) => boolean;
  /** Por qué no se trabaja ese día, para poder explicarlo en pantalla. */
  motivoNoLaborable: (f: Date) => string | null;
};

/**
 * Construye el calendario laboral de un periodo.
 *
 * `festivosPropios` son los autonómicos y locales que añade el usuario, más los
 * cierres de la empresa (la semana de vacaciones de agosto, por ejemplo).
 */
export function calendarioLaboral(
  desde: Date,
  hasta: Date,
  festivosPropios: string[] = [],
  sabadosSeTrabaja = false
): CalendarioLaboral {
  const festivos = new Map<string, string>();
  for (let a = desde.getUTCFullYear(); a <= hasta.getUTCFullYear() + 1; a++) {
    for (const f of festivosNacionales(a)) festivos.set(f.fecha, f.nombre);
  }
  for (const f of festivosPropios) {
    const limpio = f.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) festivos.set(limpio, "Festivo propio");
  }

  const motivoNoLaborable = (f: Date): string | null => {
    const dia = f.getUTCDay();
    if (dia === 0) return "Domingo";
    if (dia === 6 && !sabadosSeTrabaja) return "Sábado";
    return festivos.get(iso(f)) ?? null;
  };

  return { esLaborable: (f) => motivoNoLaborable(f) === null, motivoNoLaborable };
}

/** Normaliza a medianoche UTC: las fechas de obra son días, no instantes. */
export function aDia(f: Date | string): Date {
  const d = typeof f === "string" ? new Date(`${f.slice(0, 10)}T00:00:00Z`) : f;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export { iso as fechaISO, sumarDiasUTC };
