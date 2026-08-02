import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import FacturasClient from "./FacturasClient";

export const dynamic = "force-dynamic";

export default async function FacturacionPage() {
  const { user, db } = await requireTenant();
  if (user.rol !== "ADMIN") redirect("/panel");

  const [propuestas, empresa] = await Promise.all([
    db.factura.findMany({
      orderBy: { fecha: "desc" },
      include: { cliente: true, presupuesto: { include: { lineas: { orderBy: { orden: "asc" } } } } },
    }),
    db.empresa.findFirst(),
  ]);

  const data = propuestas.map((f) => ({
    id: f.id,
    numero: f.numero,
    fecha: f.fecha.toISOString().slice(0, 10),
    base: f.base,
    iva: f.iva,
    total: f.total,
    estado: f.estado,
    titulo: f.presupuesto?.titulo ?? null,
    // Se manda ya con la forma que pide Facturae, con cadenas vacías en lugar de
    // null: así el aviso de "te falta el código postal" sale de un solo sitio.
    cliente: f.cliente
      ? {
          nombre: f.cliente.nombre,
          nif: f.cliente.nif || "",
          direccion: f.cliente.direccion || "",
          codigoPostal: f.cliente.codigoPostal,
          poblacion: f.cliente.poblacion,
          provincia: f.cliente.provincia,
        }
      : null,
    lineas: (f.presupuesto?.lineas ?? []).map((l) => ({
      capitulo: l.capitulo,
      concepto: l.concepto,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      unidad: l.unidad,
      precio: l.precio,
      descuento: l.descuento,
    })),
  }));

  return (
    <FacturasClient
      propuestas={data}
      emisor={{
        nombre: empresa?.nombre ?? "",
        nif: empresa?.cif ?? "",
        direccion: empresa?.direccion ?? "",
        codigoPostal: empresa?.codigoPostal ?? "",
        poblacion: empresa?.poblacion ?? "",
        provincia: empresa?.provincia ?? "",
      }}
      empresa={{
        nombre: empresa?.nombre ?? "",
        cif: empresa?.cif ?? "",
        direccion: empresa?.direccion ?? "",
        tel: empresa?.tel ?? "",
        email: empresa?.email ?? "",
        logo: empresa?.logo ?? null,
      }}
    />
  );
}
