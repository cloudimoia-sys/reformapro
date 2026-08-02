import { getServerSession } from "next-auth";
import type { Rol } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { tenantDbCacheado, type TenantDb } from "@/lib/tenantDb";
import { prismaUnsafe } from "@/lib/prisma";
import { estadoDeSuscripcion, type EstadoSuscripcion, type Suscripcion } from "@/lib/suscripcion";

export type ContextoTenant = {
  user: { id: string; nombre: string; email: string; rol: Rol };
  empresaId: string;
  /** Cliente de base de datos ya filtrado por esta empresa. Usa SIEMPRE este, nunca `prismaUnsafe`. */
  db: TenantDb;
  /** Qué puede hacer la empresa hoy: escribir, solo leer, y cuánto le queda de prueba. */
  suscripcion: Suscripcion;
};

/**
 * Punto de entrada único para cualquier página o acción que toque datos.
 *
 * Devuelve el `db` ya atado a la empresa del usuario, de modo que no hace falta
 * (ni se puede olvidar) escribir `where: { empresaId }` en cada consulta.
 */
export async function requireTenant(): Promise<ContextoTenant> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("No autenticado");

  const { id, empresaId, rol, name, email } = session.user;

  // Un token antiguo (emitido antes de que la app fuera multi-empresa) no lleva
  // empresaId. Sin esta comprobación, ese hueco se convertiría en "sin filtro".
  if (typeof empresaId !== "string" || empresaId.length === 0) {
    throw new Error("Sesión sin empresa asociada: vuelve a iniciar sesión");
  }

  /**
   * El estado de la suscripción se lee de la base de datos en cada petición, no
   * del token.
   *
   * Es una consulta por clave primaria, de las más baratas que hay. Y guardarlo
   * en el JWT tendría un problema serio en la dirección que más molesta: una
   * empresa que acaba de pagar seguiría bloqueada hasta que su sesión caducara,
   * con el cliente delante y sin nada que se pueda hacer desde la aplicación.
   *
   * Va por `prismaUnsafe` a propósito: es la consulta que decide si el cliente
   * filtrado puede escribir, así que no puede depender de él. Está acotada por
   * clave primaria al `empresaId` que ya viene autenticado en la sesión.
   */
  const empresa = await prismaUnsafe.empresa.findUnique({
    where: { id: empresaId },
    select: { estadoSusc: true, trialFinaliza: true },
  });

  // La empresa se ha borrado con la sesión todavía viva.
  if (!empresa) throw new Error("La empresa de esta sesión ya no existe: vuelve a iniciar sesión");

  const suscripcion = estadoDeSuscripcion({
    estadoSusc: empresa.estadoSusc as EstadoSuscripcion,
    trialFinaliza: empresa.trialFinaliza,
  });

  return {
    user: { id, nombre: name ?? "", email: email ?? "", rol },
    empresaId,
    db: tenantDbCacheado(empresaId, suscripcion.soloLectura),
    suscripcion,
  };
}

/** Igual que `requireTenant` pero además exige rol de administrador. */
export async function requireTenantAdmin(): Promise<ContextoTenant> {
  const ctx = await requireTenant();
  if (ctx.user.rol !== "ADMIN") throw new Error("Requiere permisos de administrador");
  return ctx;
}

/**
 * Exige ser el dueño de ReformaPro, no el administrador de una empresa cliente.
 *
 * Se identifica por `ADMIN_EMAIL`, una variable de entorno: no hay ningún campo
 * en la base de datos que un cliente pudiera llegar a activarse a sí mismo, ni
 * pantalla desde la que concedérselo. Si la variable no está puesta, no entra
 * nadie — el fallo por defecto es negar el acceso, no darlo.
 */
export async function requireDuenoApp() {
  const ctx = await requireTenant();
  const dueno = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!dueno || ctx.user.email.trim().toLowerCase() !== dueno) {
    throw new Error("No autorizado");
  }
  return ctx;
}
