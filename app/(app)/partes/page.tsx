import { requireTenant } from "@/lib/session";
import PartesListClient from "./PartesListClient";
import { totalesParte } from "@/lib/parteTrabajo";

export default async function PartesPage() {
  const { user, db } = await requireTenant();

  const [partes, clientes, obras] = await Promise.all([
    db.parteTrabajo.findMany({
      orderBy: { fecha: "desc" },
      include: {
        cliente: true,
        obra: { select: { nombre: true } },
        // Solo lo justo para sumar: nada de fotos ni descripciones largas en una
        // pantalla que solo muestra una fila por parte.
        lineas: { select: { tipo: true, cantidad: true, precio: true } },
        _count: { select: { fotos: true } },
      },
    }),
    db.cliente.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.obra.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  const data = partes.map((p) => {
    const t = totalesParte(p.lineas as { tipo: "MANO_OBRA" | "MATERIAL"; cantidad: number; precio: number }[]);
    return {
      id: p.id,
      numero: p.numero,
      titulo: p.titulo,
      codigoErp: p.codigoErp,
      clienteNombre: p.cliente?.nombre || "—",
      obraNombre: p.obra?.nombre || "—",
      tecnico: p.tecnico,
      fecha: p.fecha.toISOString().slice(0, 10),
      estado: p.estado,
      horas: t.horas,
      total: t.total,
      fotos: p._count.fotos,
    };
  });

  return (
    <PartesListClient
      partes={data}
      clientes={clientes}
      obras={obras}
      tecnicoPorDefecto={user.nombre}
      isAdmin={user.rol === "ADMIN"}
    />
  );
}
