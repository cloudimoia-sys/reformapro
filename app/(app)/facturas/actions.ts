"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAdmin } from "@/lib/session";
import { ejecutar, type Resultado } from "@/lib/accion";

export async function marcarFacturaPagada(id: string): Promise<Resultado> {
  return ejecutar("marcarFacturaPagada", async () => {
    const { db } = await requireTenantAdmin();
    // updateMany (no update) para que el filtro de empresa se aplique: así el id que
    // llega del navegador solo puede tocar facturas propias. count 0 = no es tuya.
    const r = await db.factura.updateMany({ where: { id }, data: { estado: "PAGADA" } });
    if (r.count === 0) throw new Error("Factura no encontrada");
    revalidatePath("/facturas");
  });
}
