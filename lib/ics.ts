/**
 * Calendario en formato iCalendar (RFC 5545).
 *
 * Es lo que permite que la planificación de la obra aparezca en el Google
 * Calendar del jefe de obra, en el iPhone del encargado y en el Outlook de la
 * oficina sin integrarse con ninguno de los tres: todos entienden este formato
 * desde hace veinte años.
 *
 * SE USA DE DOS MANERAS, y conviene entender la diferencia porque no son
 * intercambiables:
 *
 *  - SUSCRIPCIÓN: el calendario se añade "desde una URL". Se actualiza solo
 *    cuando cambia la planificación, pero Google refresca cuando le parece y
 *    puede tardar horas. Vale para ver la obra; no vale para enterarse de un
 *    cambio de mañana.
 *  - DESCARGA: se importa el archivo. Entra al instante y en el sitio, pero es
 *    una foto fija: si luego se mueve el inicio de la obra, esos eventos se
 *    quedan como estaban.
 *
 * Las dos cosas se ofrecen, y en pantalla se dice cuál hace qué. Prometer
 * "sincronizado con Google" a secas sería vender algo que no es.
 */

import type { FasePlanificada } from "./planificacion";

/**
 * Escapa el texto según la norma: coma, punto y coma y contrabarra van con
 * contrabarra delante, y el salto de línea es literalmente "\n".
 */
function esc(t: string): string {
  return String(t || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Parte las líneas a 75 octetos, como exige la norma.
 *
 * No es una formalidad: Outlook rompe el archivo con líneas largas, y un
 * calendario que no abre es peor que no tenerlo. Se cuenta en bytes UTF-8, no en
 * caracteres, porque una "ñ" ocupa dos.
 */
function plegar(linea: string): string {
  const bytes = Buffer.from(linea, "utf8");
  if (bytes.length <= 75) return linea;
  const trozos: string[] = [];
  let inicio = 0;
  let limite = 75;
  while (inicio < bytes.length) {
    let fin = Math.min(inicio + limite, bytes.length);
    // No partir un carácter multibyte por la mitad.
    while (fin > inicio && fin < bytes.length && (bytes[fin] & 0xc0) === 0x80) fin--;
    trozos.push(bytes.subarray(inicio, fin).toString("utf8"));
    inicio = fin;
    limite = 74; // las continuaciones llevan un espacio delante
  }
  return trozos.join("\r\n ");
}

const soloFecha = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

/** Día siguiente: en un evento de día completo, DTEND es exclusivo. */
function diaSiguiente(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

const ahora = () => new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

export type DatosCalendario = {
  obraId: string;
  nombreObra: string;
  direccion?: string;
  fases: FasePlanificada[];
  /** Para el UID: los eventos tienen que ser los mismos entre refrescos. */
  dominio: string;
};

/**
 * Genera el archivo .ics de una obra.
 *
 * Un evento de día completo por fase, más un evento aparte para cada hito. Los
 * UID son estables (obra + fase): así, cuando el calendario vuelve a leer el
 * feed, ACTUALIZA los eventos en vez de duplicarlos. Es el detalle que separa un
 * calendario que funciona de uno que a la tercera semana tiene todo por
 * triplicado.
 */
export function generarICS(d: DatosCalendario): string {
  const lineas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReformaPro//Planificacion de obra//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(d.nombreObra)}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    // Sugerencia de refresco. Google la ignora a menudo, pero Apple y Outlook la
    // respetan, así que se pone igualmente.
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
  ];

  const sello = ahora();

  /**
   * El aviso de camino crítico solo se pone si hay algo que NO lo sea.
   *
   * En una obra encadenada de principio a fin todas las fases son críticas, y un
   * calendario donde los doce eventos llevan el mismo símbolo de alerta no
   * informa de nada: solo enseña a ignorarlo.
   */
  const marcarCriticas = d.fases.some((f) => !f.critica);

  for (const f of d.fases) {
    const descripcion = [
      f.oficio ? `Oficio: ${f.oficio}` : "",
      `Duración: ${f.dias} ${f.dias === 1 ? "día" : "días"} de trabajo`,
      f.esperaDias ? `Después: ${f.esperaDias} días de espera antes de la fase siguiente` : "",
      f.critica ? "En el camino crítico: si se retrasa, se retrasa la entrega." : "Tiene holgura.",
    ]
      .filter(Boolean)
      .join("\n");

    lineas.push(
      "BEGIN:VEVENT",
      `UID:fase-${f.id}@${d.dominio}`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${soloFecha(f.inicio)}`,
      `DTEND;VALUE=DATE:${diaSiguiente(f.fin)}`,
      `SUMMARY:${esc(`${f.nombre}${marcarCriticas && f.critica ? " ⚠" : ""}`)}`,
      `DESCRIPTION:${esc(descripcion)}`,
      d.direccion ? `LOCATION:${esc(d.direccion)}` : "",
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );

    if (f.hito) {
      lineas.push(
        "BEGIN:VEVENT",
        `UID:hito-${f.id}@${d.dominio}`,
        `DTSTAMP:${sello}`,
        `DTSTART;VALUE=DATE:${soloFecha(f.fin)}`,
        `DTEND;VALUE=DATE:${diaSiguiente(f.fin)}`,
        `SUMMARY:${esc(`Punto de control: ${f.nombre}`)}`,
        `DESCRIPTION:${esc("Hay que comprobar o decidir algo antes de seguir con lo siguiente.")}`,
        d.direccion ? `LOCATION:${esc(d.direccion)}` : "",
        "END:VEVENT"
      );
    }
  }

  lineas.push("END:VCALENDAR");

  // CRLF obligatorio por norma: con solo \n hay clientes que no lo abren.
  return lineas.filter(Boolean).map(plegar).join("\r\n") + "\r\n";
}
