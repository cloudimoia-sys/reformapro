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

export type ResultadoRestablecer = { ok: true } | { ok: false; error: string };

/**
 * Devuelve el error en vez de lanzarlo: Next borra el mensaje de las excepciones
 * de una acción en producción, y el visitante vería un error genérico en lugar de
 * "este enlace ya no es válido".
 */
export async function restablecerPassword(token: string, password: string): Promise<ResultadoRestablecer> {
  if (password.length < 10) {
    return { ok: false, error: "La contraseña debe tener al menos 10 caracteres." };
  }

  const fila = await tokenValido(token);
  if (!fila) return { ok: false, error: "Este enlace ya no es válido. Pide uno nuevo." };

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Cambiar la contraseña y quemar el token van juntos: si algo falla, el enlace
    // sigue sirviendo y no se queda una contraseña a medio cambiar.
    await prismaUnsafe.$transaction([
      prismaUnsafe.usuario.update({ where: { id: fila.usuarioId }, data: { passwordHash } }),
      prismaUnsafe.passwordResetToken.update({ where: { id: fila.id }, data: { usadoEn: new Date() } }),
    ]);
  } catch (e) {
    console.error("Error al restablecer la contraseña:", e);
    return { ok: false, error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." };
  }

  return { ok: true };
}
