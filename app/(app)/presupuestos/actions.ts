"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/session";
import { siguienteNumero } from "@/lib/counter";
import { base as calcBase } from "@/lib/presupuesto";

const BLOQUEADO_ESTADOS = ["APROBADO", "FACTURADO"];

async function assertNoBloqueado(id: string) {
  const p = await prisma.presupuesto.findUniqueOrThrow({ where: { id } });
  if (BLOQUEADO_ESTADOS.includes(p.estado)) {
    throw new Error("Este presupuesto ya está aprobado/facturado y no se puede editar.");
  }
  return p;
}

export async function crearPresupuestoBlanco() {
  const user = await requireUser();
  const [numero, primerCliente, empresa] = await Promise.all([
    siguienteNumero("presupuesto"),
    prisma.cliente.findFirst({ orderBy: { nombre: "asc" } }),
    prisma.empresa.findUnique({ where: { id: 1 } }),
  ]);
  const p = await prisma.presupuesto.create({
    data: {
      numero,
      clienteId: primerCliente?.id,
      titulo: "Nueva reforma",
      fecha: new Date(),
      iva: empresa?.ivaDefecto ?? 10,
      estado: "BORRADOR",
      autor: user.name,
    },
  });
  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${p.id}`);
}

export type LineaIA = {
  capitulo: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

export async function crearPresupuestoConIA(lineas: LineaIA[], meta: { tipo: string; m2?: string }) {
  const user = await requireUser();
  const [numero, primerCliente, empresa] = await Promise.all([
    siguienteNumero("presupuesto"),
    prisma.cliente.findFirst({ orderBy: { nombre: "asc" } }),
    prisma.empresa.findUnique({ where: { id: 1 } }),
  ]);
  const titulo = `${meta.tipo}${meta.m2 ? ` (${meta.m2} m²)` : ""}`;
  const p = await prisma.presupuesto.create({
    data: {
      numero,
      clienteId: primerCliente?.id,
      titulo,
      fecha: new Date(),
      iva: empresa?.ivaDefecto ?? 10,
      estado: "BORRADOR",
      autor: user.name,
      lineas: { create: lineas.map((l, i) => ({ ...l, orden: i })) },
    },
  });
  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${p.id}`);
}

export async function borrarPresupuesto(id: string) {
  await requireAdmin();
  await prisma.presupuesto.delete({ where: { id } });
  revalidatePath("/presupuestos");
}

export type PresupuestoPatch = Partial<{
  titulo: string;
  clienteId: string | null;
  fecha: string;
  iva: number;
  notas: string;
}>;

export async function actualizarPresupuesto(id: string, patch: PresupuestoPatch) {
  await requireUser();
  const { notas, ...resto } = patch;
  const huboOtroCambio = Object.keys(resto).length > 0;
  if (huboOtroCambio) await assertNoBloqueado(id);

  await prisma.presupuesto.update({
    where: { id },
    data: {
      ...resto,
      ...(resto.fecha ? { fecha: new Date(resto.fecha) } : {}),
      ...(notas !== undefined ? { notas } : {}),
    },
  });
  revalidatePath(`/presupuestos/${id}`);
}

export async function marcarEnviado(id: string) {
  await requireUser();
  const p = await prisma.presupuesto.findUniqueOrThrow({ where: { id } });
  if (p.estado === "BORRADOR") {
    await prisma.presupuesto.update({ where: { id }, data: { estado: "ENVIADO" } });
    revalidatePath(`/presupuestos/${id}`);
  }
}

export type LineaInput = {
  capitulo: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  descuento: number;
};

function clampDescuento(d: number) {
  return Math.min(100, Math.max(0, d));
}

export async function agregarLinea(presupuestoId: string, data: LineaInput) {
  await requireUser();
  await assertNoBloqueado(presupuestoId);
  const count = await prisma.lineaPresupuesto.count({ where: { presupuestoId } });
  await prisma.lineaPresupuesto.create({
    data: { presupuestoId, ...data, descuento: clampDescuento(data.descuento), orden: count },
  });
  revalidatePath(`/presupuestos/${presupuestoId}`);
}

export async function agregarMaterialDelCatalogo(presupuestoId: string, productoId: string) {
  await requireUser();
  await assertNoBloqueado(presupuestoId);
  const [producto, count] = await Promise.all([
    prisma.producto.findUniqueOrThrow({ where: { id: productoId }, include: { proveedor: true } }),
    prisma.lineaPresupuesto.count({ where: { presupuestoId } }),
  ]);
  await prisma.lineaPresupuesto.create({
    data: {
      presupuestoId,
      capitulo: "Materiales",
      concepto: producto.nombre,
      descripcion: `Material · ${producto.proveedor.nombre}`,
      cantidad: 1,
      unidad: producto.unidad,
      precio: producto.precio,
      orden: count,
    },
  });
  revalidatePath(`/presupuestos/${presupuestoId}`);
}

export async function actualizarLinea(lineaId: string, patch: Partial<LineaInput>) {
  await requireUser();
  const linea = await prisma.lineaPresupuesto.findUniqueOrThrow({ where: { id: lineaId } });
  await assertNoBloqueado(linea.presupuestoId);
  await prisma.lineaPresupuesto.update({
    where: { id: lineaId },
    data: { ...patch, ...(patch.descuento !== undefined ? { descuento: clampDescuento(patch.descuento) } : {}) },
  });
  revalidatePath(`/presupuestos/${linea.presupuestoId}`);
}

export async function borrarLinea(lineaId: string) {
  await requireUser();
  const linea = await prisma.lineaPresupuesto.findUniqueOrThrow({ where: { id: lineaId } });
  await assertNoBloqueado(linea.presupuestoId);
  await prisma.lineaPresupuesto.delete({ where: { id: lineaId } });
  revalidatePath(`/presupuestos/${linea.presupuestoId}`);
}

export async function guardarFirma(presupuestoId: string, dataUrl: string) {
  await requireUser();
  await assertNoBloqueado(presupuestoId);
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || headers().get("x-real-ip") || "";
  await prisma.presupuesto.update({
    where: { id: presupuestoId },
    data: { firma: dataUrl, fechaFirma: new Date(), firmaIp: ip, estado: "APROBADO" },
  });
  revalidatePath(`/presupuestos/${presupuestoId}`);
}

export async function crearFacturaDesdePresupuesto(presupuestoId: string) {
  await requireAdmin();
  const p = await prisma.presupuesto.findUniqueOrThrow({
    where: { id: presupuestoId },
    include: { lineas: true },
  });
  if (p.estado !== "APROBADO") throw new Error("Solo se puede facturar un presupuesto Aprobado.");

  const base = calcBase(p);
  const numero = await siguienteNumero("factura");
  await prisma.$transaction([
    prisma.factura.create({
      data: {
        numero,
        presupuestoId: p.id,
        clienteId: p.clienteId,
        fecha: new Date(),
        base,
        iva: p.iva,
        total: base * (1 + p.iva / 100),
        estado: "PENDIENTE",
      },
    }),
    prisma.presupuesto.update({ where: { id: p.id }, data: { estado: "FACTURADO" } }),
  ]);
  revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/facturas");
  redirect("/facturas");
}
