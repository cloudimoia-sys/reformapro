/**
 * Resultado de una acción de servidor que puede fallar de forma esperable.
 *
 * Por qué no lanzamos y ya está: Next.js **borra el mensaje** de las excepciones
 * que salen de una acción cuando corre en producción, para no filtrar detalles
 * internos al navegador. El usuario ve entonces "An error occurred in the Server
 * Components render...", que no le dice nada y a nosotros nos oculta el fallo real.
 *
 * Devolviendo el error como un valor normal, el mensaje llega intacto.
 */
export type Resultado<T = void> = ({ ok: true } & (T extends void ? {} : { datos: T })) | { ok: false; error: string };

export function bien(): Resultado;
export function bien<T>(datos: T): Resultado<T>;
export function bien<T>(datos?: T) {
  return datos === undefined ? { ok: true as const } : { ok: true as const, datos };
}

export function mal(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Ejecuta el cuerpo de una acción y convierte cualquier excepción en un resultado.
 *
 * Los `Error` que lanzamos nosotros a propósito (validaciones, "no encontrado")
 * conservan su texto; cualquier otro fallo se registra en el servidor y al usuario
 * se le da un mensaje genérico, para no exponer detalles internos.
 */
export async function ejecutar<T>(
  descripcion: string,
  fn: () => Promise<T>
): Promise<Resultado<T>> {
  try {
    const datos = await fn();
    return (datos === undefined ? { ok: true } : { ok: true, datos }) as Resultado<T>;
  } catch (e: any) {
    // redirect() y notFound() de Next lanzan excepciones especiales para navegar:
    // tienen que seguir subiendo o la navegación no ocurre.
    if (typeof e?.digest === "string" && (e.digest.startsWith("NEXT_REDIRECT") || e.digest === "NEXT_NOT_FOUND")) {
      throw e;
    }
    if (e instanceof Error && e.message) {
      console.error(`[${descripcion}]`, e);
      return mal(e.message);
    }
    console.error(`[${descripcion}] fallo inesperado`, e);
    return mal("Algo ha fallado. Vuelve a intentarlo.");
  }
}
