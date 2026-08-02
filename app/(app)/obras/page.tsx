import { requireTenant } from "@/lib/session";
import { planificar } from "@/lib/planificacion";
import ObrasListClient from "./ObrasListClient";

export const dynamic = "force-dynamic";

export default async function ObrasPage() {
  const { db, user } = await requireTenant();

  const [obras, clientes, presupuestos] = await Promise.all([
    db.obra.findMany({
      orderBy: { inicio: "desc" },
      include: {
        cliente: { select: { nombre: true } },
        fases: {
          orderBy: { orden: "asc" },
          select: { id: true, nombre: true, dias: true, esperaDias: true, dependeDe: true, hito: true, oficio: true },
        },
      },
    }),
    db.cliente.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.presupuesto.findMany({
      // Solo los que tienen sentido como obra: un borrador aún se está negociando.
      where: { estado: { in: ["APROBADO", "FACTURADO"] } },
      orderBy: { fecha: "desc" },
      select: { id: true, numero: true, titulo: true },
    }),
  ]);

  // Las fechas NO están en la base de datos: se calculan aquí, siempre igual, a
  // partir de la duración de cada fase y del calendario laboral.
  const data = obras.map((o) => {
    const plan = planificar(o.fases, o.inicio, {
      festivosPropios: o.festivosPropios.split(",").filter(Boolean),
      sabadosSeTrabaja: o.sabadosSeTrabaja,
    });
    return {
      id: o.id,
      nombre: o.nombre,
      direccion: o.direccion,
      clienteNombre: o.cliente?.nombre || "—",
      estado: o.estado,
      inicio: plan.inicio,
      fin: plan.fin,
      fases: o.fases.length,
      diasLaborables: plan.diasLaborables,
    };
  });

  return (
    <ObrasListClient obras={data} clientes={clientes} presupuestos={presupuestos} isAdmin={user.rol === "ADMIN"} />
  );
}
