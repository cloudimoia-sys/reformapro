import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("No autenticado");
  return session.user;
}

/** Lanza si el usuario autenticado no es admin. Úsalo al principio de cada Server Action sensible. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.rol !== "ADMIN") throw new Error("Requiere permisos de administrador");
  return user;
}
