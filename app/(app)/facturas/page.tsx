import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import FacturasClient from "./FacturasClient";

export default async function FacturasPage() {
  const { user, db } = await requireTenant();
  if (user.rol !== "ADMIN") redirect("/panel");

  const [facturas, empresa] = await Promise.all([
    db.factura.findMany({
      orderBy: { fecha: "desc" },
      include: { cliente: true, presupuesto: { include: { lineas: { orderBy: { orden: "asc" } } } } },
    }),
    db.empresa.findFirst(),
  ]);

  const data = facturas.map((f) => ({
    id: f.id,
    numero: f.numero,
    fecha: f.fecha.toISOString().slice(0, 10),
    base: f.base,
    iva: f.iva,
    total: f.total,
    estado: f.estado,
    titulo: f.presupuesto?.titulo ?? null,
    cliente: f.cliente
      ? { nombre: f.cliente.nombre, direccion: f.cliente.direccion, nif: f.cliente.nif }
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
      facturas={data}
      empresa={
        empresa
          ? { nombre: empresa.nombre, cif: empresa.cif, direccion: empresa.direccion, tel: empresa.tel, email: empresa.email, logo: empresa.logo }
          : { nombre: "", cif: "", direccion: "", tel: "", email: "", logo: null }
      }
    />
  );
}
