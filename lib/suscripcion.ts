/**
 * Estado de la suscripción de una empresa.
 *
 * Hasta ahora `trialFinaliza` y `estadoSusc` se escribían al registrarse y no los
 * leía NADIE: el período de prueba existía en la base de datos y no existía en la
 * aplicación. Una cuenta de prueba no caducaba nunca y había que entrar a mano a
 * borrarla.
 *
 * La decisión está aquí, en una función pura, por la misma razón que los precios
 * y el calendario laboral: es una regla de negocio que tiene que dar siempre lo
 * mismo, poder probarse sin base de datos y poder leerse de un vistazo cuando
 * dentro de un año haya que cambiar los días de prueba.
 *
 * PRINCIPIO: al vencer NO se le quita nada al cliente. La cuenta pasa a SOLO
 * LECTURA: sigue viendo sus presupuestos, sus informes y sus obras, y no puede
 * crear nada nuevo. Borrarle el trabajo a alguien que se está pensando si pagar
 * es la forma más rápida de que no pague, y de que además lo cuente.
 */

export type EstadoSuscripcion = "PRUEBA" | "ACTIVA" | "SUSPENDIDA" | "CANCELADA";

export type EmpresaSuscripcion = {
  estadoSusc: EstadoSuscripcion;
  trialFinaliza: Date | null;
};

export type Suscripcion = {
  estado: EstadoSuscripcion;
  /** Días completos que quedan de prueba. null si no está en prueba. */
  diasRestantes: number | null;
  /** Si no puede crear ni modificar nada. */
  soloLectura: boolean;
  /** Si conviene enseñar un aviso, y qué decir. */
  aviso: { tono: "info" | "atencion" | "bloqueo"; texto: string } | null;
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** Se avisa a partir de aquí, no desde el primer día: antes solo es ruido. */
const DIAS_PARA_AVISAR = 5;

const plural = (n: number) => (n === 1 ? "1 día" : `${n} días`);

/**
 * Decide qué puede hacer una empresa.
 *
 * `ahora` se pasa como argumento en lugar de leer el reloj dentro para que la
 * prueba pueda situarse en cualquier fecha sin tocar el sistema.
 */
export function estadoDeSuscripcion(e: EmpresaSuscripcion, ahora: Date = new Date()): Suscripcion {
  if (e.estadoSusc === "ACTIVA") {
    return { estado: "ACTIVA", diasRestantes: null, soloLectura: false, aviso: null };
  }

  if (e.estadoSusc === "SUSPENDIDA" || e.estadoSusc === "CANCELADA") {
    return {
      estado: e.estadoSusc,
      diasRestantes: null,
      soloLectura: true,
      aviso: {
        tono: "bloqueo",
        texto:
          e.estadoSusc === "SUSPENDIDA"
            ? "Tu cuenta está suspendida. Puedes consultar todo tu trabajo, pero no crear nada nuevo hasta que se reactive."
            : "Tu cuenta está cancelada. Sigues teniendo acceso a todo lo que hiciste; para volver a trabajar, reactívala.",
      },
    };
  }

  /**
   * PRUEBA sin fecha de fin: no caduca.
   *
   * Es el caso de las cuentas creadas antes de que existiera esto, y sirve además
   * como forma de dejar una cuenta abierta indefinidamente sin marcarla como
   * pagada. Se prefiere esto a caducarlas por defecto: dejar sin escribir a un
   * cliente por un campo vacío sería un fallo mucho peor que lo contrario.
   */
  if (!e.trialFinaliza) {
    return { estado: "PRUEBA", diasRestantes: null, soloLectura: false, aviso: null };
  }

  const restanMs = e.trialFinaliza.getTime() - ahora.getTime();

  if (restanMs <= 0) {
    return {
      estado: "PRUEBA",
      diasRestantes: 0,
      soloLectura: true,
      aviso: {
        tono: "bloqueo",
        texto:
          "Se ha terminado el período de prueba. Todo tu trabajo sigue aquí y lo puedes consultar y descargar; para volver a crear presupuestos, informes y obras hay que activar la cuenta.",
      },
    };
  }

  // Hacia arriba: con 30 horas por delante quedan dos días, no uno. Redondear
  // hacia abajo haría que el último día se anunciara como "0 días".
  const diasRestantes = Math.ceil(restanMs / DIA_MS);

  return {
    estado: "PRUEBA",
    diasRestantes,
    soloLectura: false,
    aviso:
      diasRestantes <= DIAS_PARA_AVISAR
        ? {
            tono: diasRestantes <= 2 ? "atencion" : "info",
            texto: `Te quedan ${plural(diasRestantes)} de prueba. Cuando termine podrás seguir consultando todo lo que hayas hecho, pero no crear nada nuevo.`,
          }
        : null,
  };
}

/** Mensaje que se le devuelve al usuario cuando intenta escribir sin poder. */
export const ERROR_SOLO_LECTURA =
  "Tu cuenta está en solo lectura: puedes consultar y descargar todo tu trabajo, pero no crear ni modificar nada. Escríbenos para activarla.";
