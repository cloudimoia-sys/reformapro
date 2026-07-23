import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import EquipoClient from "./EquipoClient";

export default async function EquipoPage() {
  const user = await requireUser();
  if (user.rol !== "ADMIN") redirect("/panel");

  const usuarios = await prisma.usuario.findMany({ orderBy: { nombre: "asc" } });

  return (
    <EquipoClient
      usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol }))}
      miId={user.id}
    />
  );
}
