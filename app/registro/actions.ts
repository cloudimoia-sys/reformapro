"use server";

import { headers } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prismaUnsafe } from "@/lib/prisma";

export type RegistroInput = {
  nombre: string;
  email: string;
  password: string;
  empresaNombre: string;
  codigo: string;
  /** Campo trampa: invisible para las personas, irresistible para los bots. */
  web?: string;
};

const DIAS_PRUEBA = 14;
const MAX_POR_IP_HORA = 3;
const MAX_GLOBAL_HORA = 20;

/** Hash de la IP para poder contar altas sin guardar la IP en claro (RGPD). */
function hashIp(ip: string) {
  const sal = process.env.NEXTAUTH_SECRET ?? "reformapro";
  return crypto.createHash("sha256").update(ip + sal).digest("hex");
}

function ipDeLaPeticion() {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
}

async function comprobarLimite() {
  const desde = new Date(Date.now() - 60 * 60 * 1000);
  const ipHash = hashIp(ipDeLaPeticion());

  // El contador vive en la base de datos y no en memoria: en Vercel cada función
  // serverless tiene su propia memoria, así que un contador local no contaría nada.
  const [deEstaIp, enTotal] = await Promise.all([
    prismaUnsafe.registroIntento.count({ where: { ipHash, createdAt: { gte: desde } } }),
    prismaUnsafe.registroIntento.count({ where: { createdAt: { gte: desde } } }),
  ]);

  if (deEstaIp >= MAX_POR_IP_HORA || enTotal >= MAX_GLOBAL_HORA) {
    throw new Error("Demasiados intentos de registro. Prueba dentro de un rato.");
  }
  await prismaUnsafe.registroIntento.create({ data: { ipHash } });
}

export type ResultadoRegistro = { ok: true } | { ok: false; error: string };

/**
 * Devuelve el error en lugar de lanzarlo.
 *
 * Next.js borra el mensaje de las excepciones de una acción cuando corre en
 * producción, para no filtrar detalles internos al navegador. Si lanzáramos,
 * quien se registra vería un "An error occurred in the Server Components render"
 * en vez de "ese email ya está registrado", que es justo lo que necesita saber.
 */
export async function registrarEmpresa(data: RegistroInput): Promise<ResultadoRegistro> {
  // Trampa anti-bots: un navegador real nunca rellena un campo oculto.
  if (data.web) return { ok: false, error: "No se pudo completar el registro." };

  // Puerta de invitación opcional: mientras REGISTRO_CODIGO esté puesta en el
  // servidor, solo entra quien tenga el código. Se abre a todo el mundo borrando
  // la variable de entorno, sin tocar código.
  const codigoEsperado = process.env.REGISTRO_CODIGO;
  if (codigoEsperado && data.codigo.trim() !== codigoEsperado) {
    return { ok: false, error: "El código de invitación no es válido." };
  }

  const nombre = data.nombre.trim();
  const empresaNombre = data.empresaNombre.trim();
  const email = data.email.toLowerCase().trim();

  if (!nombre) return { ok: false, error: "Tu nombre es obligatorio." };
  if (!empresaNombre) return { ok: false, error: "El nombre de la empresa es obligatorio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "El email no parece válido." };
  if (data.password.length < 10) {
    return { ok: false, error: "La contraseña debe tener al menos 10 caracteres." };
  }

  try {
    await comprobarLimite();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // bcrypt fuera de la transacción: son ~100 ms de CPU pura, y mantener abierta
  // una transacción mientras tanto ocupa una conexión del pool sin necesidad.
  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    await prismaUnsafe.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nombre: empresaNombre,
          email,
          plan: "PRUEBA",
          estadoSusc: "PRUEBA",
          trialFinaliza: new Date(Date.now() + DIAS_PRUEBA * 24 * 60 * 60 * 1000),
        },
      });
      await tx.usuario.create({
        data: { empresaId: empresa.id, nombre, email, passwordHash, rol: "ADMIN" },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe una cuenta con ese email. Inicia sesión." };
    }
    // Un fallo inesperado sí se registra en el servidor, pero al visitante solo le
    // damos algo accionable.
    console.error("Error inesperado al registrar empresa:", e);
    return { ok: false, error: "No se pudo crear la cuenta. Inténtalo de nuevo en un momento." };
  }

  return { ok: true };
}
