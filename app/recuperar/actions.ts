"use server";

import crypto from "crypto";
import { prismaUnsafe } from "@/lib/prisma";
import { enviarEmail, emailRestablecer } from "@/lib/email";
import { urlBase } from "@/lib/urlBase";

const VALIDEZ_MS = 60 * 60 * 1000; // 1 hora

/** Se guarda el hash, no el token: quien lea la base de datos no puede usar los enlaces pendientes. */
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function pedirRestablecer(email: string) {
  const correo = email.toLowerCase().trim();

  // Sin filtrar por empresa a propósito: aún no hay sesión, y el email es
  // precisamente lo que identifica a qué empresa pertenece la cuenta.
  const usuario = await prismaUnsafe.usuario.findUnique({
    where: { email: correo },
    select: { id: true, nombre: true, email: true },
  });

  // Si el email no existe NO lo decimos: responder distinto permitiría averiguar
  // qué correos tienen cuenta en ReformaPro. La pantalla muestra el mismo mensaje
  // en ambos casos.
  if (usuario) {
    // Invalidamos los enlaces anteriores para que solo el último sirva.
    await prismaUnsafe.passwordResetToken.updateMany({
      where: { usuarioId: usuario.id, usadoEn: null },
      data: { usadoEn: new Date() },
    });

    const token = crypto.randomBytes(32).toString("base64url");
    await prismaUnsafe.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        usuarioId: usuario.id,
        expiraEn: new Date(Date.now() + VALIDEZ_MS),
      },
    });

    // Del host real de la petición, NO de NEXTAUTH_URL: esa variable estuvo
    // apuntando a la URL de rama protegida por Vercel y los enlaces de
    // recuperación no llevaban a ninguna parte, sin que nadie lo notara.
    const base = urlBase();
    const plantilla = emailRestablecer(usuario.nombre, `${base}/restablecer/${token}`);
    try {
      await enviarEmail({ para: usuario.email, ...plantilla });
    } catch (e) {
      // No propagamos: si el proveedor de email falla, decírselo al visitante
      // también revelaría que ese correo existe.
      console.error("No se pudo enviar el email de recuperación:", e);
    }
  }

  return { ok: true };
}
