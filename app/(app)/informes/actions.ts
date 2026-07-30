"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant, requireTenantAdmin } from "@/lib/session";
import { ejecutar, type Resultado, type ResultadoConRedirect } from "@/lib/accion";
import { siguienteNumero } from "@/lib/counter";
import type { ContenidoInforme, TipoInforme } from "@/lib/informe";

export type DatosInforme = {
  tipo: TipoInforme;
  titulo: string;
  inmueble: string;
  refCatastral?: string;
  solicitante?: string;
  perito?: string;
  titulacion?: string;
  colegiado?: string;
  clienteId?: string | null;
};

export type FotoNueva = { datos: string; pie: string };

/**
 * Crea el informe con lo que ha generado la IA y ya ha revisado el usuario.
 *
 * Las fotos se crean anidadas y SIN `empresaId`: al apuntar al informe por la
 * pareja (informeId, empresaId), Prisma la hereda del padre y rechaza que se la
 * pasemos. Es el mismo detalle que rompió en su día las líneas de presupuesto.
 */
export async function crearInforme(
  datos: DatosInforme,
  contenido: ContenidoInforme,
  fotos: FotoNueva[]
): Promise<ResultadoConRedirect> {
  return ejecutar("crearInforme", async () => {
    const { db, empresaId, user } = await requireTenant();
    const numero = await siguienteNumero(empresaId, "informe");

    const inf = await db.informe.create({
      data: {
        empresaId,
        numero,
        tipo: datos.tipo,
        titulo: datos.titulo || "Informe técnico",
        inmueble: datos.inmueble || "",
        refCatastral: datos.refCatastral || null,
        solicitante: datos.solicitante || null,
        perito: datos.perito || null,
        titulacion: datos.titulacion || null,
        colegiado: datos.colegiado || null,
        clienteId: datos.clienteId || null,
        contenido: contenido as object,
        autor: user.nombre,
        fotos: {
          create: fotos.map((f, i) => ({ datos: f.datos, pie: f.pie || "", orden: i })),
        },
      },
    });

    revalidatePath("/informes");
    redirect(`/informes/${inf.id}`);
  });
}

export async function actualizarInforme(
  id: string,
  patch: Partial<DatosInforme> & { contenido?: ContenidoInforme; estado?: "BORRADOR" | "FINALIZADO" }
): Promise<Resultado> {
  return ejecutar("actualizarInforme", async () => {
    const { db } = await requireTenant();
    // updateMany, no update: el filtro por empresa solo puede inyectarse en un
    // `where` normal, así que es la vía segura para editar por id.
    const r = await db.informe.updateMany({
      where: { id },
      data: {
        ...(patch.titulo !== undefined ? { titulo: patch.titulo } : {}),
        ...(patch.inmueble !== undefined ? { inmueble: patch.inmueble } : {}),
        ...(patch.refCatastral !== undefined ? { refCatastral: patch.refCatastral || null } : {}),
        ...(patch.solicitante !== undefined ? { solicitante: patch.solicitante || null } : {}),
        ...(patch.perito !== undefined ? { perito: patch.perito || null } : {}),
        ...(patch.titulacion !== undefined ? { titulacion: patch.titulacion || null } : {}),
        ...(patch.colegiado !== undefined ? { colegiado: patch.colegiado || null } : {}),
        ...(patch.clienteId !== undefined ? { clienteId: patch.clienteId || null } : {}),
        ...(patch.estado !== undefined ? { estado: patch.estado } : {}),
        ...(patch.contenido !== undefined ? { contenido: patch.contenido as object } : {}),
      },
    });
    if (!r.count) throw new Error("Informe no encontrado");
    revalidatePath("/informes");
    revalidatePath(`/informes/${id}`);
  });
}

export async function actualizarPieFoto(fotoId: string, pie: string): Promise<Resultado> {
  return ejecutar("actualizarPieFoto", async () => {
    const { db } = await requireTenant();
    const r = await db.informeFoto.updateMany({ where: { id: fotoId }, data: { pie } });
    if (!r.count) throw new Error("Foto no encontrada");
  });
}

export async function borrarFoto(fotoId: string): Promise<Resultado> {
  return ejecutar("borrarFoto", async () => {
    const { db } = await requireTenant();
    const r = await db.informeFoto.deleteMany({ where: { id: fotoId } });
    if (!r.count) throw new Error("Foto no encontrada");
  });
}

export async function borrarInforme(id: string): Promise<Resultado> {
  return ejecutar("borrarInforme", async () => {
    // Solo admin, igual que borrar presupuestos: un informe entregado puede ser
    // la única copia de una inspección que ya no se puede repetir.
    const { db } = await requireTenantAdmin();
    const r = await db.informe.deleteMany({ where: { id } });
    if (!r.count) throw new Error("Informe no encontrado");
    revalidatePath("/informes");
  });
}
