"use server";

import { revalidatePath } from "next/cache";
import { requireDuenoApp } from "@/lib/session";
import { prismaUnsafe } from "@/lib/prisma";
import { ejecutar, type Resultado } from "@/lib/accion";

/**
 * Acciones del dueño de ReformaPro sobre las empresas cliente.
 *
 * Aquí SÍ se usa el cliente sin filtrar, y es la única parte de la aplicación
 * donde eso es lo correcto: el trabajo consiste precisamente en ver y tocar
 * empresas que no son la tuya. La barrera es `requireDuenoApp()`, que compara el
 * correo de la sesión con ADMIN_EMAIL y, si la variable no está puesta, no deja
 * pasar a nadie.
 *
 * Esto es la caja registradora mientras no haya pasarela de pago: alguien paga
 * por transferencia o Bizum y se le activa la cuenta desde aquí, también desde el
 * móvil.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** La empresa ha pagado: escribe sin límite de tiempo. */
export async function activarEmpresa(empresaId: string, plan: "BASICO" | "PRO"): Promise<Resultado> {
  return ejecutar("activarEmpresa", async () => {
    await requireDuenoApp();
    await prismaUnsafe.empresa.update({
      where: { id: empresaId },
      // La fecha de prueba se deja tal cual: no estorba estando ACTIVA, y si algún
      // día se vuelve a poner en prueba conviene saber cuándo fue la original.
      data: { estadoSusc: "ACTIVA", plan },
    });
    revalidatePath("/suscripciones");
  });
}

/** Alargar la prueba: para el que pide unos días más antes de decidir. */
export async function extenderPrueba(empresaId: string, dias: number): Promise<Resultado> {
  return ejecutar("extenderPrueba", async () => {
    await requireDuenoApp();
    const d = Math.max(1, Math.min(90, Math.round(dias)));

    const e = await prismaUnsafe.empresa.findUnique({
      where: { id: empresaId },
      select: { trialFinaliza: true },
    });
    if (!e) throw new Error("Empresa no encontrada");

    /**
     * Se cuenta desde HOY si la prueba ya venció, y desde su fin si aún corre.
     *
     * Sumar siempre sobre la fecha guardada le daría cero días útiles a quien
     * lleva un mes vencido, que es justo a quien se los estás concediendo.
     */
    const base = e.trialFinaliza && e.trialFinaliza > new Date() ? e.trialFinaliza : new Date();

    await prismaUnsafe.empresa.update({
      where: { id: empresaId },
      data: { estadoSusc: "PRUEBA", trialFinaliza: new Date(base.getTime() + d * DIA_MS) },
    });
    revalidatePath("/suscripciones");
  });
}

/** Dejó de pagar: pasa a solo lectura, sin perder nada. */
export async function suspenderEmpresa(empresaId: string): Promise<Resultado> {
  return ejecutar("suspenderEmpresa", async () => {
    await requireDuenoApp();
    await prismaUnsafe.empresa.update({ where: { id: empresaId }, data: { estadoSusc: "SUSPENDIDA" } });
    revalidatePath("/suscripciones");
  });
}
