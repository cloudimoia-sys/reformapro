/**
 * Resultado de una acción de servidor que puede fallar de forma esperable.
 *
 * Por qué no lanzamos y ya está: Next.js **borra el mensaje** de las excepciones
 * que salen de una acción cuando corre en producción, para no filtrar detalles
 * internos al navegador. El usuario ve entonces "An error occurred in the Server
 * Components render...", que no le dice nada y a nosotros nos oculta el fallo real.
 * Nos costó dos fallos en producción antes de detectarlo.
 *
 * Devolviendo el error como un valor normal, el mensaje llega intacto.
 */
export type Resultado<T = void> = { ok: true; datos: T } | { ok: false; error: string };

/**
 * Ejecuta el cuerpo de una acción y convierte cualquier excepción en un resultado.
 *
 * Los `Error` que lanzamos nosotros a propósito (validaciones, "no encontrado")
 * conservan su texto; cualquier otro fallo se registra en el servidor y al usuario
 * se le da un mensaje genérico, para no exponer detalles internos.
 */
export async function ejecutar<T>(descripcion: string, fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn() };
  } catch (e: any) {
    // redirect() y notFound() de Next lanzan excepciones especiales para navegar:
    // tienen que seguir subiendo o la navegación no ocurre.
    if (typeof e?.digest === "string" && (e.digest.startsWith("NEXT_REDIRECT") || e.digest === "NEXT_NOT_FOUND")) {
      throw e;
    }
    console.error(`[${descripcion}]`, e);
    if (e instanceof Error && e.message) return { ok: false, error: e.message };
    return { ok: false, error: "Algo ha fallado. Vuelve a intentarlo." };
  }
}
