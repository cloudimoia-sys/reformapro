"use server";

import { revalidatePath } from "next/cache";
import { requireTenant, requireTenantAdmin } from "@/lib/session";
import { ejecutar, type Resultado } from "@/lib/accion";

export type ClienteInput = {
  nombre: string;
  tel: string;
  email: string;
  direccion: string;
  nif: string;
  notas: string;
};

export async function crearCliente(data: ClienteInput): Promise<Resultado> {
  return ejecutar("crearCliente", async () => {
    const { db, empresaId } = await requireTenant();
    if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
    // empresaId va explícito para satisfacer los tipos de Prisma; el cliente filtrado
    // lo sobrescribe igualmente con el de la sesión, así que no se puede falsear.
    await db.cliente.create({ data: { ...data, empresaId } });
    revalidatePath("/clientes");
  });
}

export async function actualizarCliente(id: string, data: ClienteInput): Promise<Resultado> {
  return ejecutar("actualizarCliente", async () => {
    const { db } = await requireTenant();
    if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
    const r = await db.cliente.updateMany({ where: { id }, data });
    if (r.count === 0) throw new Error("Cliente no encontrado");
    revalidatePath("/clientes");
  });
}

export async function borrarCliente(id: string): Promise<Resultado> {
  return ejecutar("borrarCliente", async () => {
    const { db } = await requireTenantAdmin();

    // Antes se apoyaba en ON DELETE SET NULL. Con las claves foráneas compuestas
    // (id, empresaId) eso ya no vale: SET NULL anularía también empresaId, que es
    // NOT NULL, y el borrado fallaría. Así que desvinculamos explícitamente y luego
    // borramos, todo en una transacción para que no quede a medias.
    await db.$transaction(async (tx) => {
      await tx.presupuesto.updateMany({ where: { clienteId: id }, data: { clienteId: null } });
      await tx.factura.updateMany({ where: { clienteId: id }, data: { clienteId: null } });
      const r = await tx.cliente.deleteMany({ where: { id } });
      if (r.count === 0) throw new Error("Cliente no encontrado");
    });

    revalidatePath("/clientes");
  });
}
