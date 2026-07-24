import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { hoy } from "@/lib/format";
import PreciosClient from "./PreciosClient";

export default async function PreciosPage() {
  const user = await requireUser();
  const [proveedores, productos] = await Promise.all([
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({ orderBy: { nombre: "asc" } }),
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
