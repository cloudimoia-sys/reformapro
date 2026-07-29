"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prismaUnsafe } from "@/lib/prisma";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Un token vale si existe, no se ha usado y no ha caducado. */
async function tokenValido(token: string) {
  const fila = await prismaUnsafe.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, usuarioId: true, usadoEn: true, expiraEn: true },
  });
  if (!fila || fila.usadoEn || fila.expiraEn < new Date()) return null;
  return fila;
}

export async function comprobarToken(token: string) {
  return Boolean(await tokenValido(token));
}

export async function restablecerPassword(token: string, password: string) {
  if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");

  const fila = await tokenValido(token);
  if (!fila) throw new Error("Este enlace ya no es válido. Pide uno nuevo.");

  const passwordHash = await bcrypt.hash(password, 10);

  // Cambiar la contraseña y quemar el token van juntos: si algo falla, el enlace
  // sigue sirviendo y no se queda una contraseña a medio cambiar.
  await prismaUnsafe.$transaction([
    prismaUnsafe.usuario.update({ where: { id: fila.usuarioId }, data: { passwordHash } }),
    prismaUnsafe.passwordResetToken.update({ where: { id: fila.id }, data: { usadoEn: new Date() } }),
  ]);

  return { ok: true };
}
