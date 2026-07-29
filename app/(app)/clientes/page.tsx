import { requireTenant } from "@/lib/session";
import ClientesClient from "./ClientesClient";

export default async function ClientesPage() {
  const { user, db } = await requireTenant();
  const clientes = await db.cliente.findMany({
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
