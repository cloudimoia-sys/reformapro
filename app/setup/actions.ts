"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type SetupInput = {
  adminNombre: string;
  adminEmail: string;
  adminPassword: string;
  empresaNombre: string;
  empresaCif: string;
  empresaDireccion: string;
  empresaTel: string;
  empresaEmail: string;
};

export async function crearPrimerAdmin(data: SetupInput) {
  // Solo puede usarse una vez: si ya hay algún usuario, esta pantalla no es válida.
  const hayUsuarios = (await prisma.usuario.count()) > 0;
  if (hayUsuarios) throw new Error("Ya existe una cuenta. Ve a la pantalla de acceso.");

  if (!data.adminNombre.trim()) throw new Error("Tu nombre es obligatorio");
  if (!data.adminEmail.trim()) throw new Error("El email es obligatorio");
  if (data.adminPassword.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
  if (!data.empresaNombre.trim()) throw new Error("El nombre de la empresa es obligatorio");

  const passwordHash = await bcrypt.hash(data.adminPassword, 10);

  await prisma.$transaction([
    prisma.usuario.create({
      data: {
        nombre: data.adminNombre,
        email: data.adminEmail.toLowerCase().trim(),
        passwordHash,
        rol: "ADMIN",
      },
    }),
    prisma.empresa.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        nombre: data.empresaNombre,
        cif: data.empresaCif,
        direccion: data.empresaDireccion,
        tel: data.empresaTel,
        email: data.empresaEmail,
        ivaDefecto: 10,
      },
      update: {},
    }),
  ]);

  redirect("/login?creada=1");
}
