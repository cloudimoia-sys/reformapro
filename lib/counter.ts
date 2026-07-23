import { prisma } from "@/lib/prisma";

/**
 * Genera el siguiente número correlativo tipo "PRE-2026-004" / "FAC-2026-002".
 * Usa una fila Counter por (prefijo, año) e incrementa de forma atómica,
 * así que sobrevive a borrados sin repetir ni saltar números.
 */
export async function siguienteNumero(tipo: "presupuesto" | "factura"): Promise<string> {
  const year = new Date().getFullYear();
  const prefijo = tipo === "presupuesto" ? "PRE" : "FAC";
  const id = `${tipo}:${year}`;

  const counter = await prisma.counter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `${prefijo}-${year}-${String(counter.value).padStart(3, "0")}`;
}
