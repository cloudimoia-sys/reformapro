"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";

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
};

export async function crearProducto(data: ProductoInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await prisma.producto.create({ data: { ...data, fecha: new Date() } });
  revalidatePath("/precios");
}

export async function actualizarProducto(id: string, data: ProductoInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await prisma.producto.update({ where: { id }, data: { ...data, fecha: new Date() } });
  revalidatePath("/precios");
}

export async function borrarProducto(id: string) {
  await requireAdmin();
  await prisma.producto.delete({ where: { id } });
  revalidatePath("/precios");
}
