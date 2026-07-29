import { requireTenant } from "@/lib/session";
import { totalPres } from "@/lib/presupuesto";
import PresupuestosListClient from "./PresupuestosListClient";

export default async function PresupuestosPage() {
  const { user, db } = await requireTenant();
  const presupuestos = await db.presupuesto.findMany({
    orderBy: { createdAt: "desc" },
    include: { lineas: true, cliente: true },
  });

  const data = presupuestos.map((p) => ({
    id: p.id,
    numero: p.numero,
    titulo: p.titulo,
    clienteNombre: p.cliente?.nombre || "—",
    fecha: p.fecha.toISOString().slice(0, 10),
    total: totalPres(p),
    estado: p.estado,
  }));

  return <PresupuestosListClient presupuestos={data} isAdmin={user.rol === "ADMIN"} />;
}
