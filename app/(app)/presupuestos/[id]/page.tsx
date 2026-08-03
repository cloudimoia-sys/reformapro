import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import PresupuestoEditor from "./PresupuestoEditor";

export default async function PresupuestoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Desde Next 15, los params de una ruta llegan como promesa.
  const { id } = await params;
  const { user, db } = await requireTenant();
  const [presupuesto, clientes, productos, empresa] = await Promise.all([
    // findFirst y no findUnique: así el id de la URL pasa por el filtro de empresa
    // y pedir el presupuesto de otro cliente devuelve 404 en vez de sus datos.
    db.presupuesto.findFirst({
      where: { id: id },
      include: { lineas: { orderBy: { orden: "asc" } } },
    }),
    db.cliente.findMany({ orderBy: { nombre: "asc" } }),
    db.producto.findMany({ orderBy: { nombre: "asc" } }),
    db.empresa.findFirst(),
  ]);

  if (!presupuesto || !empresa) notFound();

  return (
    <PresupuestoEditor
      presupuesto={{
        id: presupuesto.id,
        numero: presupuesto.numero,
        titulo: presupuesto.titulo,
        clienteId: presupuesto.clienteId ?? "",
        fecha: presupuesto.fecha.toISOString().slice(0, 10),
        iva: presupuesto.iva,
        margen: presupuesto.margen,
        estado: presupuesto.estado,
        notas: presupuesto.notas ?? "",
        firma: presupuesto.firma,
        fechaFirma: presupuesto.fechaFirma ? presupuesto.fechaFirma.toISOString().slice(0, 10) : null,
        lineas: presupuesto.lineas.map((l) => ({
          id: l.id,
          capitulo: l.capitulo ?? "",
          concepto: l.concepto,
          descripcion: l.descripcion ?? "",
          cantidad: l.cantidad,
          unidad: l.unidad,
          precio: l.precio,
          descuento: l.descuento,
        })),
      }}
      clientes={clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        direccion: c.direccion ?? "",
        nif: c.nif ?? "",
        email: c.email ?? "",
      }))}
      productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, unidad: p.unidad, precio: p.precio, tipo: p.tipo as "MATERIAL" | "PARTIDA" }))}
      empresa={{
        nombre: empresa.nombre,
        cif: empresa.cif,
        direccion: empresa.direccion,
        tel: empresa.tel,
        email: empresa.email,
      }}
      isAdmin={user.rol === "ADMIN"}
    />
  );
}
