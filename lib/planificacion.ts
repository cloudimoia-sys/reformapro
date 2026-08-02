/**
 * Motor de planificación de obra.
 *
 * Calcula en qué día empieza y acaba cada fase a partir de su duración, de qué
 * fase tiene que esperar y del calendario laboral. Está en código, como los
 * precios y la normativa, porque una fecha de entrega es un compromiso: si sale
 * distinta cada vez que se recalcula, no sirve para dársela a un cliente.
 *
 * Lo que resuelve y no es evidente:
 *  - Los días son LABORABLES. Una fase de 5 días que empieza un jueves acaba el
 *    miércoles siguiente, no el lunes.
 *  - Las esperas de fraguado y secado corren en días de calendario, no laborables:
 *    el hormigón fragua también el domingo. Confundir las dos cosas es el error
 *    clásico de las planificaciones hechas a mano, y siempre en la dirección de
 *    prometer antes de lo posible.
 *  - Dos fases pueden depender de la misma anterior y correr en paralelo
 *    (fontanería y electricidad después de las rozas).
 *  - El camino crítico: qué fases, si se retrasan un día, retrasan la entrega un
 *    día. Es lo único que hay que vigilar de verdad.
 */

import { aDia, calendarioLaboral, fechaISO, sumarDiasUTC, type CalendarioLaboral } from "./festivos";

export type FaseEntrada = {
  id: string;
  nombre: string;
  /** Días de trabajo efectivo. */
  dias: number;
  /** Id de la fase que tiene que terminar antes. Vacío = arranca con la obra. */
  dependeDe?: string | null;
  /** Días de calendario de espera obligada al terminar (fraguado, secado, curado). */
  esperaDias?: number;
  oficio?: string;
  /** Punto en el que hay que comprobar o decidir algo antes de seguir. */
  hito?: boolean;
  notas?: string;
};

export type FasePlanificada = FaseEntrada & {
  /** Ya normalizada: la entrada la trae opcional, la salida siempre. */
  esperaDias: number;
  inicio: string;
  fin: string;
  /** Fin de la espera posterior: hasta aquí no puede empezar lo que dependa de ella. */
  disponibleDesde: string;
  /** Días naturales que ocupa en el calendario, festivos incluidos. */
  diasNaturales: number;
  critica: boolean;
};

export type Planificacion = {
  fases: FasePlanificada[];
  inicio: string;
  fin: string;
  /** Días de trabajo efectivo sumando el camino crítico. */
  diasLaborables: number;
  /** Días naturales de principio a fin, que es lo que percibe el cliente. */
  diasNaturales: number;
  /** Problemas que impiden planificar o que conviene avisar. */
  avisos: string[];
};

/** Avanza hasta el primer día laborable, incluido el propio si lo es. */
function primerLaborable(desde: Date, cal: CalendarioLaboral): Date {
  let d = desde;
  // Tope de seguridad: con un calendario mal configurado (todo festivo) esto
  // sería un bucle infinito dentro de una petición.
  for (let i = 0; i < 400; i++) {
    if (cal.esLaborable(d)) return d;
    d = sumarDiasUTC(d, 1);
  }
  return d;
}

/** Fecha en la que termina una fase de `dias` jornadas que empieza en `inicio`. */
function finDeFase(inicio: Date, dias: number, cal: CalendarioLaboral): Date {
  let restantes = Math.max(1, Math.round(dias));
  let d = primerLaborable(inicio, cal);
  restantes--;
  for (let i = 0; i < 2000 && restantes > 0; i++) {
    d = sumarDiasUTC(d, 1);
    if (cal.esLaborable(d)) restantes--;
  }
  return d;
}

const diferenciaDias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000) + 1;

/**
 * Ordena las fases respetando las dependencias.
 *
 * Devuelve null si hay un bucle (A espera a B y B espera a A), que es un error
 * del usuario y hay que decírselo en vez de colgar la pantalla.
 */
function ordenTopologico(fases: FaseEntrada[]): FaseEntrada[] | null {
  const porId = new Map(fases.map((f) => [f.id, f]));
  const hechas = new Set<string>();
  const salida: FaseEntrada[] = [];

  while (salida.length < fases.length) {
    const antes = salida.length;
    for (const f of fases) {
      if (hechas.has(f.id)) continue;
      const dep = f.dependeDe && porId.has(f.dependeDe) ? f.dependeDe : null;
      if (dep && !hechas.has(dep)) continue;
      hechas.add(f.id);
      salida.push(f);
    }
    if (salida.length === antes) return null; // nadie ha podido avanzar: hay bucle
  }
  return salida;
}

/**
 * Planifica la obra.
 *
 * `festivosPropios` son los autonómicos, locales y los cierres de la empresa, en
 * formato AAAA-MM-DD.
 */
export function planificar(
  fases: FaseEntrada[],
  inicioObra: Date | string,
  opciones: { festivosPropios?: string[]; sabadosSeTrabaja?: boolean } = {}
): Planificacion {
  const avisos: string[] = [];
  const arranque = aDia(inicioObra);

  if (!fases.length) {
    const hoy = fechaISO(arranque);
    return { fases: [], inicio: hoy, fin: hoy, diasLaborables: 0, diasNaturales: 0, avisos: ["La obra no tiene ninguna fase."] };
  }

  // El calendario se construye con margen de sobra por delante: una obra de un
  // año con esperas largas puede irse bastante más allá de la duración sumada.
  const margen = fases.reduce((s, f) => s + Math.max(1, f.dias) + (f.esperaDias || 0), 0) * 2 + 400;
  const cal = calendarioLaboral(
    arranque,
    sumarDiasUTC(arranque, margen),
    opciones.festivosPropios,
    opciones.sabadosSeTrabaja
  );

  const orden = ordenTopologico(fases);
  if (!orden) {
    return {
      fases: [],
      inicio: fechaISO(arranque),
      fin: fechaISO(arranque),
      diasLaborables: 0,
      diasNaturales: 0,
      avisos: [
        "Hay fases que se esperan unas a otras en círculo, así que no se pueden ordenar. Revisa el campo «empieza después de».",
      ],
    };
  }

  const porId = new Map(fases.map((f) => [f.id, f]));
  for (const f of fases) {
    if (f.dependeDe && !porId.has(f.dependeDe)) {
      avisos.push(`«${f.nombre}» depende de una fase que ya no existe: se ha planificado desde el inicio de la obra.`);
    }
  }

  const calculadas = new Map<string, FasePlanificada>();
  for (const f of orden) {
    const dep = f.dependeDe ? calculadas.get(f.dependeDe) : undefined;
    // Si depende de otra, arranca al día siguiente de quedar disponible; si no,
    // el día que empieza la obra.
    const deseado = dep ? sumarDiasUTC(aDia(dep.disponibleDesde), 1) : arranque;
    const inicio = primerLaborable(deseado, cal);
    const fin = finDeFase(inicio, f.dias, cal);
    const espera = Math.max(0, Math.round(f.esperaDias || 0));
    const disponible = sumarDiasUTC(fin, espera);

    calculadas.set(f.id, {
      ...f,
      esperaDias: espera,
      inicio: fechaISO(inicio),
      fin: fechaISO(fin),
      disponibleDesde: fechaISO(disponible),
      diasNaturales: diferenciaDias(inicio, fin),
      critica: false,
    });
  }

  const planificadas = fases.map((f) => calculadas.get(f.id)!);
  const fin = planificadas.reduce((max, f) => (f.fin > max ? f.fin : max), planificadas[0].fin);
  const inicio = planificadas.reduce((min, f) => (f.inicio < min ? f.inicio : min), planificadas[0].inicio);

  /**
   * Camino crítico: se recorre hacia atrás desde la fase que cierra la obra,
   * saltando por las dependencias. Lo que queda fuera tiene holgura y puede
   * retrasarse sin mover la entrega.
   */
  const ultima = planificadas.find((f) => f.fin === fin);
  let cursor = ultima;
  const vistas = new Set<string>();
  while (cursor && !vistas.has(cursor.id)) {
    vistas.add(cursor.id);
    cursor.critica = true;
    cursor = cursor.dependeDe ? calculadas.get(cursor.dependeDe) : undefined;
  }

  const diasLaborables = planificadas.filter((f) => f.critica).reduce((s, f) => s + Math.max(1, f.dias), 0);

  // Avisos que le ahorran un disgusto a quien planifica.
  const sinDependencia = planificadas.filter((f) => !f.dependeDe);
  if (sinDependencia.length > 1) {
    avisos.push(
      `Hay ${sinDependencia.length} fases que arrancan a la vez el primer día (${sinDependencia
        .map((f) => f.nombre)
        .join(", ")}). Si no tienes gente para todas en paralelo, encadénalas.`
    );
  }
  const largas = planificadas.filter((f) => f.dias > 40);
  if (largas.length) {
    avisos.push(
      `«${largas[0].nombre}» dura ${largas[0].dias} días de trabajo. Las fases muy largas esconden el retraso hasta que ya no hay margen: pártela en tramos que puedas comprobar.`
    );
  }

  return {
    fases: planificadas,
    inicio,
    fin,
    diasLaborables,
    diasNaturales: diferenciaDias(aDia(inicio), aDia(fin)),
    avisos,
  };
}

/**
 * Fases de partida a partir de los capítulos de un presupuesto.
 *
 * Las duraciones son un punto de arranque para editar, NO una estimación fiable:
 * dependen de la cuadrilla, del acceso y de mil cosas que el programa no sabe. Se
 * dice así en pantalla. Lo que sí aporta es el orden y las esperas, que es donde
 * se equivoca todo el mundo al planificar de memoria.
 */
const ORDEN_OFICIOS: { patron: RegExp; oficio: string; espera: number; porCada: number }[] = [
  { patron: /demolici|derribo|levantado|desmontaje|picado/i, oficio: "Demoliciones", espera: 0, porCada: 900 },
  { patron: /movimiento de tierra|excavaci|cimentaci|zapata|solera/i, oficio: "Cimentación", espera: 21, porCada: 1500 },
  { patron: /estructura|forjado|pilar|vigueta|apeo|dintel|cargadero/i, oficio: "Estructura", espera: 14, porCada: 1500 },
  { patron: /cubierta|tejado|impermeabiliza/i, oficio: "Cubierta", espera: 0, porCada: 1200 },
  { patron: /albañiler|tabique|cerramiento|fábrica|fachada/i, oficio: "Albañilería", espera: 2, porCada: 1000 },
  { patron: /saneamiento|fontaner|agua/i, oficio: "Fontanería", espera: 0, porCada: 900 },
  { patron: /electric|iluminaci|telecomunicaci/i, oficio: "Electricidad", espera: 0, porCada: 900 },
  { patron: /climatiza|calefacci|aerotermia|ventilaci/i, oficio: "Climatización", espera: 0, porCada: 1400 },
  { patron: /alicatado|solado|pavimento|revestimiento|enfoscado|enlucido|yeso/i, oficio: "Revestimientos", espera: 3, porCada: 800 },
  { patron: /carpinter|puerta|ventana|armario/i, oficio: "Carpintería", espera: 0, porCada: 1200 },
  { patron: /cocina|mobiliario|encimera|electrodom/i, oficio: "Mobiliario", espera: 0, porCada: 1600 },
  { patron: /sanitario|ducha|inodoro|lavabo|mampara|griferia|grifería/i, oficio: "Aparatos sanitarios", espera: 0, porCada: 900 },
  { patron: /pintura|pintado/i, oficio: "Pintura", espera: 0, porCada: 900 },
  { patron: /limpieza|remate|urbanizaci/i, oficio: "Remates y limpieza", espera: 0, porCada: 900 },
];

export function fasesDesdeCapitulos(
  capitulos: { nombre: string; importe: number }[]
): (FaseEntrada & { motivoEspera?: string })[] {
  const encajadas = capitulos.map((c) => {
    const i = ORDEN_OFICIOS.findIndex((o) => o.patron.test(c.nombre));
    const regla = i >= 0 ? ORDEN_OFICIOS[i] : null;
    return { capitulo: c, regla, orden: i >= 0 ? i : ORDEN_OFICIOS.length };
  });

  encajadas.sort((a, b) => a.orden - b.orden);

  let anterior: string | null = null;
  return encajadas.map(({ capitulo, regla }, i) => {
    const porCada = regla?.porCada ?? 1000;
    const dias = Math.max(1, Math.round(capitulo.importe / porCada));
    const fase: FaseEntrada & { motivoEspera?: string } = {
      id: `f${i + 1}`,
      nombre: capitulo.nombre,
      dias,
      dependeDe: anterior,
      esperaDias: regla?.espera ?? 0,
      oficio: regla?.oficio ?? "",
      hito: false,
      motivoEspera: regla?.espera
        ? regla.oficio === "Cimentación" || regla.oficio === "Estructura"
          ? "fraguado del hormigón antes de cargar"
          : "secado antes de la fase siguiente"
        : undefined,
    };
    anterior = fase.id;
    return fase;
  });
}
