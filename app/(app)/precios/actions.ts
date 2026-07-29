"use server";

import { revalidatePath } from "next/cache";
import { requireTenant, requireTenantAdmin } from "@/lib/session";
import { comprobarPrecioUrl } from "@/lib/priceCheck";

function normalizarUrl(web: string): string | null {
  const v = web.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export type ProveedorInput = { nombre: string; web: string };

export async function crearProveedor(data: ProveedorInput) {
  const { db, empresaId } = await requireTenant();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await db.proveedor.create({ data: { empresaId, nombre: data.nombre, web: normalizarUrl(data.web) } });
  revalidatePath("/precios");
}

export async function actualizarProveedor(id: string, data: ProveedorInput) {
  const { db } = await requireTenant();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  const r = await db.proveedor.updateMany({
    where: { id },
    data: { nombre: data.nombre, web: normalizarUrl(data.web) },
  });
  if (r.count === 0) throw new Error("Proveedor no encontrado");
  revalidatePath("/precios");
}

export type ProductoInput = {
  provId: string;
  nombre: string;
  unidad: string;
  precio: number;
  url: string;
};

export async function crearProducto(data: ProductoInput) {
  const { db, empresaId } = await requireTenant();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");

  // provId llega del navegador: hay que comprobar que ese proveedor es de esta
  // empresa antes de colgarle un material. (La clave foránea compuesta también lo
  // impediría, pero así el mensaje de error es comprensible.)
  const proveedor = await db.proveedor.findFirst({ where: { id: data.provId }, select: { id: true } });
  if (!proveedor) throw new Error("Proveedor no encontrado");

  const { url, ...resto } = data;
  await db.producto.create({ data: { ...resto, empresaId, url: normalizarUrl(url), fecha: new Date() } });
  revalidatePath("/precios");
}

export async function actualizarProducto(id: string, data: ProductoInput) {
  const { db } = await requireTenant();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");

  const proveedor = await db.proveedor.findFirst({ where: { id: data.provId }, select: { id: true } });
  if (!proveedor) throw new Error("Proveedor no encontrado");

  const { url, ...resto } = data;
  const r = await db.producto.updateMany({
    where: { id },
    data: { ...resto, url: normalizarUrl(url), fecha: new Date() },
  });
  if (r.count === 0) throw new Error("Material no encontrado");
  revalidatePath("/precios");
}

export async function borrarProducto(id: string) {
  const { db } = await requireTenantAdmin();
  const r = await db.producto.deleteMany({ where: { id } });
  if (r.count === 0) throw new Error("Material no encontrado");
  revalidatePath("/precios");
}

export async function comprobarPrecioProducto(id: string) {
  const { db } = await requireTenant();
  const producto = await db.producto.findFirst({ where: { id }, select: { url: true } });
  if (!producto) throw new Error("Material no encontrado");
  if (!producto.url) throw new Error("Este material no tiene una URL guardada.");

  const precio = await comprobarPrecioUrl(producto.url);
  await db.producto.updateMany({ where: { id }, data: { precio, fecha: new Date() } });
  revalidatePath("/precios");
  return precio;
}
