import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import EquipoClient from "./EquipoClient";

export default async function EquipoPage() {
  const { user, db } = await requireTenant();
  if (user.rol !== "ADMIN") redirect("/panel");

  const usuarios = await db.usuario.findMany({ orderBy: { nombre: "asc" } });

  return (
    <EquipoClient
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol }))}
      miId={user.id}
    />
  );
}
