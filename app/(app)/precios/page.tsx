import { requireTenant } from "@/lib/session";
import { hoy } from "@/lib/format";
import PreciosClient from "./PreciosClient";

export default async function PreciosPage() {
  const { user, db } = await requireTenant();
  const [proveedores, productos] = await Promise.all([
    db.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    db.producto.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const data = productos.map((p) => ({
    id: p.id,
    provId: p.provId,
    nombre: p.nombre,
    unidad: p.unidad,
    precio: p.precio,
    fecha: p.fecha.toISOString().slice(0, 10) || hoy(),
    url: p.url ?? "",
  }));

  return <PreciosClient proveedores={proveedores} productos={data} isAdmin={user.rol === "ADMIN"} />;
}
