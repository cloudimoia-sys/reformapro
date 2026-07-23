import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import PresupuestoEditor from "./PresupuestoEditor";

export default async function PresupuestoDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const [presupuesto, clientes, productos, empresa] = await Promise.all([
    prisma.presupuesto.findUnique({
      where: { id: params.id },
      include: { lineas: { orderBy: { orden: "asc" } } },
    }),
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({ orderBy: { nombre: "asc" } }),
    prisma.empresa.findUnique({ where: { id: 1 } }),
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
      productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, unidad: p.unidad, precio: p.precio }))}
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
