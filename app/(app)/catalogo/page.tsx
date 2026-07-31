import { requireTenant } from "@/lib/session";
import { hoy } from "@/lib/format";
import CatalogoClient from "./CatalogoClient";

export default async function CatalogoPage() {
  const { user, db } = await requireTenant();
  const [proveedores, productos] = await Promise.all([
    db.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    db.producto.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const data = productos.map((p) => ({
    id: p.id,
    tipo: p.tipo as "MATERIAL" | "PARTIDA",
    provId: p.provId ?? "",
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    capitulo: p.capitulo ?? "",
    unidad: p.unidad,
    precio: p.precio,
    fecha: p.fecha.toISOString().slice(0, 10) || hoy(),
    url: p.url ?? "",
  }));

  return <CatalogoClient proveedores={proveedores} productos={data} isAdmin={user.rol === "ADMIN"} />;
}
