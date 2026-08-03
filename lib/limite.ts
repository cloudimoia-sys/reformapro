import { createHash } from "crypto";
import { headers } from "next/headers";
import { prismaUnsafe } from "@/lib/prisma";

/**
 * Límite de intentos, contado en la base de datos.
 *
 * POR QUÉ NO EN MEMORIA: en Vercel cada función serverless tiene su propia
 * memoria y se crean y destruyen constantemente. Un contador local no contaría
 * casi nada, y a un atacante le bastaría con repartir los intentos entre
 * instancias para no tocar ninguno. Con una tabla, el contador es uno solo.
 *
 * QUÉ FRENA CADA COSA:
 *  - login: probar contraseñas a lo bruto. Sin esto, nada impedía intentarlo
 *    millones de veces.
 *  - ia: quemar el cupo de Gemini. Con clave gratuita deja el asistente muerto
 *    para TODAS las empresas de la plataforma; con clave de pago, es dinero.
 *  - registro: crear empresas en masa.
 *
 * Lo que se guarda es un hash, nunca la IP ni el email en claro: sirve para
 * contar y no sirve para identificar a nadie si alguien lee la tabla.
 */

export type TipoLimite = "registro" | "login" | "ia";

/** SHA-256 de la clave más un secreto del servidor. */
export function hashClave(valor: string): string {
  const sal = process.env.NEXTAUTH_SECRET ?? "reformapro";
  return createHash("sha256").update(`${valor}|${sal}`).digest("hex");
}

/**
 * IP de quien llama.
 *
 * En Vercel viene en x-forwarded-for, y el primer valor es el cliente real. No
 * se puede confiar en ella al 100% —una cabecera se falsifica—, pero detrás del
 * proxy de Vercel la reescribe la plataforma, y aun en el peor caso el límite
 * global de más abajo sigue en pie.
 */
export async function ipDeLaPeticion(): Promise<string> {
  // Desde Next 15, headers() es asincrona.
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
}

/**
 * ¿Se ha pasado del límite?
 *
 * `clave` es lo que se limita: una IP, un email, un empresaId. Se pasa ya en
 * claro y aquí se hashea, para que quien llame no tenga que acordarse.
 */
export async function superaLimite(
  tipo: TipoLimite,
  clave: string,
  maximo: number,
  ventanaMinutos: number
): Promise<boolean> {
  const desde = new Date(Date.now() - ventanaMinutos * 60 * 1000);
  const n = await prismaUnsafe.intento.count({
    where: { tipo, ipHash: hashClave(`${tipo}:${clave}`), createdAt: { gte: desde } },
  });
  return n >= maximo;
}

/** Deja constancia de un intento. */
export async function anotarIntento(tipo: TipoLimite, clave: string): Promise<void> {
  await prismaUnsafe.intento.create({ data: { tipo, ipHash: hashClave(`${tipo}:${clave}`) } });
}

/**
 * Comprueba y anota de una vez. Devuelve true si hay que rechazar.
 *
 * Se anota SIEMPRE, también cuando ya está bloqueado: así insistir alarga el
 * bloqueo en vez de dejarlo correr, que es lo que hace que no compense insistir.
 */
export async function consumir(
  tipo: TipoLimite,
  clave: string,
  maximo: number,
  ventanaMinutos: number
): Promise<boolean> {
  const [pasado] = await Promise.all([
    superaLimite(tipo, clave, maximo, ventanaMinutos),
    anotarIntento(tipo, clave),
  ]);
  return pasado;
}

/**
 * Limpia lo viejo.
 *
 * Sin esto la tabla crece para siempre. Se llama de vez en cuando desde las
 * propias comprobaciones —una de cada cincuenta— en lugar de con una tarea
 * programada, que en el plan gratuito de Vercel no hay.
 */
export async function limpiarIntentosViejos(): Promise<void> {
  if (Math.random() > 0.02) return;
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await prismaUnsafe.intento.deleteMany({ where: { createdAt: { lt: hace24h } } });
  } catch {
    // Limpiar es mantenimiento: si falla, no debe tumbar la petición del usuario.
  }
}

/** Límites de las rutas de IA, por empresa. */
export const LIMITE_IA = { maximo: 60, ventanaMinutos: 60 } as const;

/**
 * Puerta común de las rutas de IA.
 *
 * Sesenta llamadas por hora y empresa es muy por encima de lo que hace nadie
 * trabajando —un presupuesto, unas fotos, unas preguntas— y muy por debajo de lo
 * que hace falta para vaciar el cupo diario.
 */
export async function limiteIaSuperado(empresaId: string): Promise<boolean> {
  await limpiarIntentosViejos();
  return consumir("ia", empresaId, LIMITE_IA.maximo, LIMITE_IA.ventanaMinutos);
}

export const ERROR_LIMITE_IA =
  "Has hecho muchas peticiones a la IA en poco rato. Espera unos minutos y vuelve a intentarlo.";
