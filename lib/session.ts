import { getServerSession } from "next-auth";
import type { Rol } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { tenantDbCacheado, type TenantDb } from "@/lib/tenantDb";

export type ContextoTenant = {
  user: { id: string; nombre: string; email: string; rol: Rol };
  empresaId: string;
  /** Cliente de base de datos ya filtrado por esta empresa. Usa SIEMPRE este, nunca `prismaUnsafe`. */
  db: TenantDb;
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

  return {
    user: { id, nombre: name ?? "", email: email ?? "", rol },
    empresaId,
    db: tenantDbCacheado(empresaId),
  };
}

/** Igual que `requireTenant` pero además exige rol de administrador. */
export async function requireTenantAdmin(): Promise<ContextoTenant> {
  const ctx = await requireTenant();
  if (ctx.user.rol !== "ADMIN") throw new Error("Requiere permisos de administrador");
  return ctx;
}
