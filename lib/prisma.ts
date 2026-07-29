import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cliente SIN filtrar por empresa. El nombre lleva "Unsafe" a propósito.
 *
 * Casi ningún archivo debe importar esto: si lo usas en una página o en una
 * acción, estarás leyendo o escribiendo datos de TODAS las empresas. Usa
 * `requireTenant()` de lib/session.ts, que te da un cliente ya filtrado.
 *
 * Uso legítimo (y el script scripts/check-tenant-scope.mjs lo comprueba en cada
 * despliegue): login, registro, recuperación de contraseña y la semilla — casos
 * que por definición ocurren antes de saber a qué empresa perteneces.
 */
export const prismaUnsafe = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaUnsafe;
