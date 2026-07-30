import { prismaUnsafe } from "@/lib/prisma";

/**
 * Lo mínimo que necesitamos para incrementar: un `counter.upsert`.
 *
 * Se describe así, por forma, en vez de con `Prisma.TransactionClient`, porque el
 * cliente extendido por empresa genera un tipo de transacción distinto e
 * incompatible, y aquí solo importa que sepa hacer el upsert.
 */
type ClienteConCounter = {
  counter: {
    upsert(args: {
      where: { empresaId_tipo_anio: { empresaId: string; tipo: string; anio: number } };
      create: { empresaId: string; tipo: string; anio: number; value: number };
      update: { value: { increment: number } };
    }): Promise<{ value: number }>;
  };
};

/**
 * Genera el siguiente correlativo de una empresa: "PRE-2026-004", "FAC-2026-002".
 *
 * Cada empresa tiene su propia serie (clave `empresaId + tipo + año`), así que dos
 * clientes distintos pueden tener a la vez su PRE-2026-001 sin pisarse.
 *
 * Usa `prismaUnsafe` a propósito: el `upsert` atómico es justo la operación que el
 * cliente por empresa prohíbe, y aquí es segura porque `empresaId` forma parte de
 * la clave primaria y viene de la sesión, nunca del navegador.
 *
 * Pásale `tx` para que el número se reserve DENTRO de la misma transacción que crea
 * el registro: si la creación falla, el incremento se revierte y no queda un hueco
 * en la numeración. En facturas eso no es un detalle, lo exige Hacienda.
 */
const PREFIJOS = { presupuesto: "PRE", factura: "FAC", informe: "INF" } as const;

export async function siguienteNumero(
  empresaId: string,
  tipo: keyof typeof PREFIJOS,
  tx: ClienteConCounter = prismaUnsafe
): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = PREFIJOS[tipo];

  const counter = await tx.counter.upsert({
    where: { empresaId_tipo_anio: { empresaId, tipo, anio } },
    create: { empresaId, tipo, anio, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `${prefijo}-${anio}-${String(counter.value).padStart(3, "0")}`;
}
