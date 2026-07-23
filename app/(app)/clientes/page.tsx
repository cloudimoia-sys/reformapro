import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import ClientesClient from "./ClientesClient";

export default async function ClientesPage() {
  const user = await requireUser();
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { presupuestos: true } } },
  });

  const data = clientes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tel: c.tel ?? "",
    email: c.email ?? "",
    direccion: c.direccion ?? "",
    nif: c.nif ?? "",
    notas: c.notas ?? "",
    numPresupuestos: c._count.presupuestos,
  }));

  return <ClientesClient clientes={data} isAdmin={user.rol === "ADMIN"} />;
}
