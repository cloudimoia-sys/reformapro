import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import ParteEditor from "./ParteEditor";

export default async function ParteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Desde Next 15, los params de una ruta llegan como promesa.
  const { id } = await params;
  const { user, db } = await requireTenant();
  const [parte, clientes, obras, productos, empresa] = await Promise.all([
    // findFirst y no findUnique: así el id de la URL pasa por el filtro de
    // empresa y pedir el parte de otra empresa devuelve 404 en vez de sus datos.
    db.parteTrabajo.findFirst({
      where: { id },
      include: {
        lineas: { orderBy: { orden: "asc" } },
        fotos: { orderBy: { orden: "asc" } },
      },
    }),
    db.cliente.findMany({ orderBy: { nombre: "asc" } }),
    db.obra.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    db.producto.findMany({ orderBy: { nombre: "asc" } }),
    db.empresa.findFirst(),
  ]);

  if (!parte || !empresa) notFound();

  return (
    <ParteEditor
      parte={{
        id: parte.id,
        numero: parte.numero,
        titulo: parte.titulo,
        codigoErp: parte.codigoErp ?? "",
        clienteId: parte.clienteId ?? "",
        obraId: parte.obraId ?? "",
        direccion: parte.direccion,
        fecha: parte.fecha.toISOString().slice(0, 10),
        horaInicio: parte.horaInicio ?? "",
        horaFin: parte.horaFin ?? "",
        tecnico: parte.tecnico,
        descripcion: parte.descripcion,
        observaciones: parte.observaciones,
        estado: parte.estado,
        firma: parte.firma,
        fechaFirma: parte.fechaFirma ? parte.fechaFirma.toISOString().slice(0, 10) : null,
        lineas: parte.lineas.map((l) => ({
          id: l.id,
          tipo: l.tipo as "MANO_OBRA" | "MATERIAL",
          concepto: l.concepto,
          descripcion: l.descripcion ?? "",
          cantidad: l.cantidad,
          unidad: l.unidad,
          precio: l.precio,
        })),
        fotos: parte.fotos.map((f) => ({ id: f.id, datos: f.datos, pie: f.pie })),
      }}
      clientes={clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        direccion: c.direccion ?? "",
        nif: c.nif ?? "",
      }))}
      obras={obras}
      productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, unidad: p.unidad, precio: p.precio, tipo: p.tipo as "MATERIAL" | "PARTIDA" }))}
      empresa={{
        nombre: empresa.nombre,
        cif: empresa.cif,
        direccion: empresa.direccion,
        tel: empresa.tel,
        email: empresa.email,
      }}
      tecnicoPorDefecto={user.nombre}
      isAdmin={user.rol === "ADMIN"}
    />
  );
}
