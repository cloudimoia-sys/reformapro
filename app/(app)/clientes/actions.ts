"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";

export type ClienteInput = {
  nombre: string;
  tel: string;
  email: string;
  direccion: string;
  nif: string;
  notas: string;
};

export async function crearCliente(data: ClienteInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await prisma.cliente.create({ data });
  revalidatePath("/clientes");
}

export async function actualizarCliente(id: string, data: ClienteInput) {
  await requireUser();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  await prisma.cliente.update({ where: { id }, data });
  revalidatePath("/clientes");
}

export async function borrarCliente(id: string) {
  await requireAdmin();
  await prisma.cliente.delete({ where: { id } });
  revalidatePath("/clientes");
}
