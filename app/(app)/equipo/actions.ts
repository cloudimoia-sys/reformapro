"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export type UsuarioInput = {
  nombre: string;
  email: string;
  rol: "ADMIN" | "EMPLEADO";
  password?: string;
};

export async function crearUsuario(data: UsuarioInput) {
  await requireAdmin();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  if (!data.email.trim()) throw new Error("El email es obligatorio");
  if (!data.password || data.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.usuario.create({
    data: { nombre: data.nombre, email: data.email.toLowerCase().trim(), rol: data.rol, passwordHash },
  });
  revalidatePath("/equipo");
}

export async function actualizarUsuario(id: string, data: UsuarioInput) {
  await requireAdmin();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  if (data.password && data.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }
  await prisma.usuario.update({
    where: { id },
    data: {
      nombre: data.nombre,
      email: data.email.toLowerCase().trim(),
      rol: data.rol,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
  });
  revalidatePath("/equipo");
}

export async function borrarUsuario(id: string) {
  const admin = await requireAdmin();
  if (admin.id === id) throw new Error("No puedes borrar tu propio usuario.");
  await prisma.usuario.delete({ where: { id } });
  revalidatePath("/equipo");
}
