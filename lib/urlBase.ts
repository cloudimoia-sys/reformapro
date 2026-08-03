import { headers } from "next/headers";

/**
 * URL base de la aplicación, tomada de la petición y no de una variable.
 *
 * POR QUÉ NO SE USA NEXTAUTH_URL: porque estaba mal puesta en producción y nadie
 * se enteró. Apuntaba a la URL de rama del despliegue
 * (`reformapro-git-main-....vercel.app`), que Vercel protege con su propio inicio
 * de sesión. Consecuencias, las dos silenciosas:
 *
 *   - Al pulsar "Salir", el usuario acababa en la pantalla de acceso DE VERCEL.
 *   - Los enlaces de recuperar contraseña llegaban al correo apuntando a esa URL
 *     protegida, así que nadie podía recuperar su contraseña. Y como el flujo
 *     responde siempre lo mismo para no revelar qué correos existen, tampoco
 *     había forma de notarlo desde fuera.
 *
 * Leyendo la cabecera de la petición, el enlace apunta siempre al sitio por el
 * que ha entrado el usuario, esté la variable como esté. Detrás del proxy de
 * Vercel, `x-forwarded-host` la escribe la plataforma.
 */
export function urlBase(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (!host) return process.env.NEXTAUTH_URL || "http://localhost:3000";

  const protocolo =
    h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${protocolo}://${host}`;
}
