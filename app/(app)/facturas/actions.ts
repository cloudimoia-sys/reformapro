"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function marcarFacturaPagada(id: string) {
  await requireAdmin();
  await prisma.factura.update({ where: { id }, data: { estado: "PAGADA" } });
  revalidatePath("/facturas");
}
