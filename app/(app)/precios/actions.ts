"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { comprobarPrecioUrl } from "@/lib/priceCheck";

function normalizarUrl(web: string): string | null {
  const v = web.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export type ProveedorInput = { nombre: string; web: string };

export async function crearProveedor(data: ProveedorInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await prisma.proveedor.create({ data: { nombre: data.nombre, web: normalizarUrl(data.web) } });
  revalidatePath("/precios");
}

export async function actualizarProveedor(id: string, data: ProveedorInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await prisma.proveedor.update({ where: { id }, data: { nombre: data.nombre, web: normalizarUrl(data.web) } });
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
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  const { url, ...resto } = data;
  await prisma.producto.create({ data: { ...resto, url: normalizarUrl(url), fecha: new Date() } });
  revalidatePath("/precios");
}

export async function actualizarProducto(id: string, data: ProductoInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  const { url, ...resto } = data;
  await prisma.producto.update({ where: { id }, data: { ...resto, url: normalizarUrl(url), fecha: new Date() } });
  revalidatePath("/precios");
}

export async function borrarProducto(id: string) {
  await requireAdmin();
  await prisma.producto.delete({ where: { id } });
  revalidatePath("/precios");
}

export async function comprobarPrecioProducto(id: string) {
  await requireUser();
  const producto = await prisma.producto.findUniqueOrThrow({ where: { id } });
  if (!producto.url) throw new Error("Este material no tiene una URL guardada.");

  const precio = await comprobarPrecioUrl(producto.url);
  await prisma.producto.update({ where: { id }, data: { precio, fecha: new Date() } });
  revalidatePath("/precios");
  return precio;
}
