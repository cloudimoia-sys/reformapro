"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { requireTenantAdmin } from "@/lib/session";

export type UsuarioInput = {
  nombre: string;
  email: string;
  rol: "ADMIN" | "EMPLEADO";
  password?: string;
};

/**
 * El email es único en TODA la plataforma (no por empresa), para que el login no
 * tenga que preguntar de qué empresa eres. Efecto secundario: dar de alta a alguien
 * cuyo email ya usa otra empresa choca contra ese índice. Sin este traductor sería
 * un error 500 incomprensible.
 */
function traducirEmailDuplicado(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error("Ese email ya está registrado en ReformaPro.");
  }
  throw e;
}

export async function crearUsuario(data: UsuarioInput) {
  const { db, empresaId } = await requireTenantAdmin();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  if (!data.email.trim()) throw new Error("El email es obligatorio");
  if (!data.password || data.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  try {
    await db.usuario.create({
      data: {
        empresaId,
        nombre: data.nombre,
        email: data.email.toLowerCase().trim(),
        rol: data.rol,
        passwordHash,
      },
    });
  } catch (e) {
    traducirEmailDuplicado(e);
  }
  revalidatePath("/equipo");
}

export async function actualizarUsuario(id: string, data: UsuarioInput) {
  const { db } = await requireTenantAdmin();
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
  if (data.password && data.password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }

  // updateMany, no update: antes bastaba con poner el id de un usuario de otra
  // empresa para cambiarle la contraseña y entrar en su cuenta. Ahora el filtro de
  // empresa va incluido y ese id simplemente no encuentra nada.
  try {
    const r = await db.usuario.updateMany({
      where: { id },
      data: {
        nombre: data.nombre,
        email: data.email.toLowerCase().trim(),
        rol: data.rol,
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
      },
    });
    if (r.count === 0) throw new Error("Usuario no encontrado");
  } catch (e) {
    traducirEmailDuplicado(e);
  }
  revalidatePath("/equipo");
}

export async function borrarUsuario(id: string) {
  const { db, user } = await requireTenantAdmin();
  if (user.id === id) throw new Error("No puedes borrar tu propio usuario.");

  // Sin admins nadie podría volver a entrar a facturación ni al equipo.
  const admins = await db.usuario.count({ where: { rol: "ADMIN" } });
  const objetivo = await db.usuario.findFirst({ where: { id }, select: { rol: true } });
  if (!objetivo) throw new Error("Usuario no encontrado");
  if (objetivo.rol === "ADMIN" && admins <= 1) {
    throw new Error("No puedes borrar al único administrador de la empresa.");
  }

  const r = await db.usuario.deleteMany({ where: { id } });
  if (r.count === 0) throw new Error("Usuario no encontrado");
  revalidatePath("/equipo");
}
