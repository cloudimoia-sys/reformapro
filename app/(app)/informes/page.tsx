import { requireTenant } from "@/lib/session";
import InformesListClient from "./InformesListClient";
import type { TipoInforme } from "@/lib/informe";

export default async function InformesPage() {
  const { user, db } = await requireTenant();

  const [informes, clientes] = await Promise.all([
    db.informe.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        cliente: true,
        // Solo el recuento: traer las fotos aquí cargaría megas de base64 en una
        // pantalla que ni siquiera las muestra.
        _count: { select: { fotos: true } },
      },
    }),
    db.cliente.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  const data = informes.map((i) => ({
    id: i.id,
    numero: i.numero,
    titulo: i.titulo,
    tipo: i.tipo as TipoInforme,
    inmueble: i.inmueble,
    clienteNombre: i.cliente?.nombre || "—",
    fecha: i.fecha.toISOString().slice(0, 10),
    estado: i.estado,
    fotos: i._count.fotos,
  }));

  return (
    <InformesListClient
      informes={data}
      clientes={clientes}
      peritoPorDefecto={user.nombre}
      isAdmin={user.rol === "ADMIN"}
    />
  );
}
