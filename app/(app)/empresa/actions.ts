"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAdmin } from "@/lib/session";
import { ejecutar, type Resultado } from "@/lib/accion";

export type EmpresaInput = {
  nombre: string;
  cif: string;
  direccion: string;
  tel: string;
  email: string;
  ivaDefecto: number;
  margenDefecto: number;
};

export async function actualizarEmpresa(data: EmpresaInput): Promise<Resultado> {
  return ejecutar("actualizarEmpresa", async () => {
    const { db, empresaId } = await requireTenantAdmin();
    // Antes era un upsert sobre id:1, la fila única. Ahora cada empresa tiene la suya.
    // El id sale de la sesión (y el cliente filtrado lo vuelve a forzar), nunca del
    // navegador, así que aquí un update normal sí es seguro.
    await db.empresa.update({
      where: { id: empresaId },
      data: {
        ...data,
        // Acotado: un margen negativo restaría del total y uno del 500% saldría de
        // un dedo resbalado, no de una decisión.
        margenDefecto: Math.min(60, Math.max(0, Number(data.margenDefecto) || 0)),
      },
    });
    revalidatePath("/empresa");
  });
}

const LOGO_MAX_BYTES = 500 * 1024; // 500 KB en base64, de sobra para un logo pequeño

export async function actualizarLogoEmpresa(logo: string | null): Promise<Resultado> {
  return ejecutar("actualizarLogoEmpresa", async () => {
    const { db, empresaId } = await requireTenantAdmin();
    if (logo) {
      if (!logo.startsWith("data:image/")) throw new Error("El logo debe ser una imagen.");
      if (logo.length > LOGO_MAX_BYTES) throw new Error("El logo es demasiado grande.");
    }
    await db.empresa.update({ where: { id: empresaId }, data: { logo } });
    revalidatePath("/empresa");
    revalidatePath("/facturas");
  });
}
