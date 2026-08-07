"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireTenant, requireTenantAdmin, type ContextoTenant } from "@/lib/session";
import { ejecutar, type Resultado, type ResultadoConRedirect } from "@/lib/accion";
import { siguienteNumero } from "@/lib/counter";

const BLOQUEADO_ESTADOS = ["FIRMADO"];

/**
 * Carga el parte comprobando de paso que es de esta empresa (el `db` ya
 * filtra) y que se puede editar. Un parte firmado por el cliente no se toca:
 * si hay que corregirlo, primero se reabre a propósito, con `reabrirParte`.
 */
async function cargarEditable(db: ContextoTenant["db"], id: string) {
  const p = await db.parteTrabajo.findFirst({ where: { id } });
  if (!p) throw new Error("Parte de trabajo no encontrado");
  if (BLOQUEADO_ESTADOS.includes(p.estado)) {
    throw new Error("Este parte ya está firmado por el cliente. Reábrelo antes de corregirlo.");
  }
  return p;
}

export async function crearParteBlanco(): Promise<ResultadoConRedirect> {
  return ejecutar("crearParteBlanco", async () => {
    const { db, empresaId, user } = await requireTenant();
    const [numero, primerCliente] = await Promise.all([
      siguienteNumero(empresaId, "parte"),
      db.cliente.findFirst({ orderBy: { nombre: "asc" } }),
    ]);
    const p = await db.parteTrabajo.create({
      data: {
        empresaId,
        numero,
        clienteId: primerCliente?.id,
        titulo: "Nuevo parte de trabajo",
        fecha: new Date(),
        tecnico: user.nombre,
        autor: user.nombre,
      },
    });
    revalidatePath("/partes");
    redirect(`/partes/${p.id}`);
  });
}

export type ParteInput = {
  titulo: string;
  clienteId: string | null;
  obraId: string | null;
  direccion: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tecnico: string;
  codigoErp: string;
  descripcion: string;
  observaciones: string;
};

export async function actualizarParte(id: string, data: ParteInput): Promise<Resultado> {
  return ejecutar("actualizarParte", async () => {
    const { db } = await requireTenant();
    if (!data.titulo.trim()) throw new Error("El título es obligatorio");
    await cargarEditable(db, id);

    // Igual que en presupuestos: un clienteId que llega del navegador se
    // comprueba antes de guardar, para que el mensaje sea claro en vez de un
    // error de base de datos si apunta a un cliente que no existe (o es de otra
    // empresa, cosa que el `db` filtrado ya impide encontrar).
    if (data.clienteId) {
      const cliente = await db.cliente.findFirst({ where: { id: data.clienteId }, select: { id: true } });
      if (!cliente) throw new Error("Cliente no encontrado");
    }
    if (data.obraId) {
      const obra = await db.obra.findFirst({ where: { id: data.obraId }, select: { id: true } });
      if (!obra) throw new Error("Obra no encontrada");
    }

    const r = await db.parteTrabajo.updateMany({
      where: { id },
      data: {
        titulo: data.titulo,
        clienteId: data.clienteId || null,
        obraId: data.obraId || null,
        direccion: data.direccion,
        fecha: new Date(data.fecha),
        horaInicio: data.horaInicio || null,
        horaFin: data.horaFin || null,
        tecnico: data.tecnico,
        codigoErp: data.codigoErp || null,
        descripcion: data.descripcion,
        observaciones: data.observaciones,
      },
    });
    if (r.count === 0) throw new Error("Parte de trabajo no encontrado");
    revalidatePath(`/partes/${id}`);
  });
}

export type LineaParteInput = {
  tipo: "MANO_OBRA" | "MATERIAL";
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  /** Referencia del artículo en el ERP. Se hereda del catálogo, y se puede
   *  escribir a mano en una línea que no salga de él. */
  codigoErp?: string | null;
};

export async function agregarLinea(parteId: string, data: LineaParteInput): Promise<Resultado> {
  return ejecutar("agregarLinea", async () => {
    const { db, empresaId } = await requireTenant();
    await cargarEditable(db, parteId);
    const count = await db.lineaParteTrabajo.count({ where: { parteId } });
    await db.lineaParteTrabajo.create({
      data: { empresaId, parteId, ...data, orden: count },
    });
    revalidatePath(`/partes/${parteId}`);
  });
}

/**
 * Añade una línea de material a partir de una partida o material del catálogo
 * propio, igual que `agregarMaterialDelCatalogo` en presupuestos.
 *
 * Los DOS ids llegan del navegador. No basta con que el material exista: tiene
 * que ser de ESTA empresa, o una podría leer los precios negociados de otra
 * pasándole el id de su material. `db.producto.findFirst` ya lo impide, porque
 * el cliente filtrado no puede encontrar el de otra empresa aunque se lo pidan
 * por id — pero se comprueba el resultado igualmente, no se asume.
 */
export async function agregarMaterialDelCatalogo(parteId: string, productoId: string): Promise<Resultado> {
  return ejecutar("agregarMaterialDelCatalogo", async () => {
    const { db, empresaId } = await requireTenant();
    await cargarEditable(db, parteId);

    const [producto, count] = await Promise.all([
      db.producto.findFirst({ where: { id: productoId } }),
      db.lineaParteTrabajo.count({ where: { parteId } }),
    ]);
    if (!producto) throw new Error("No encontrado en el catálogo");

    await db.lineaParteTrabajo.create({
      data: {
        empresaId,
        parteId,
        tipo: "MATERIAL",
        concepto: producto.nombre,
        descripcion: producto.descripcion || "",
        cantidad: 1,
        unidad: producto.unidad,
        precio: producto.precio,
        // El código de ERP viaja con el material. Es el punto de todo esto: el
        // consumo sale del parte ya identificado con la referencia que el ERP
        // entiende, sin que nadie la teclee.
        //
        // Se COPIA, no se apunta al producto, por lo mismo que el precio: un
        // parte registra lo que pasó ese día, y si mañana se corrige la ficha
        // del catálogo, el parte firmado tiene que seguir diciendo lo que se
        // puso.
        codigoErp: producto.codigoErp,
        orden: count,
      },
    });
    revalidatePath(`/partes/${parteId}`);
  });
}

export async function actualizarLinea(lineaId: string, data: Partial<LineaParteInput>): Promise<Resultado> {
  return ejecutar("actualizarLinea", async () => {
    const { db } = await requireTenant();
    const linea = await db.lineaParteTrabajo.findFirst({ where: { id: lineaId } });
    if (!linea) throw new Error("Línea no encontrada");
    await cargarEditable(db, linea.parteId);
    await db.lineaParteTrabajo.updateMany({ where: { id: lineaId }, data });
    revalidatePath(`/partes/${linea.parteId}`);
  });
}

export async function borrarLinea(lineaId: string): Promise<Resultado> {
  return ejecutar("borrarLinea", async () => {
    const { db } = await requireTenant();
    const linea = await db.lineaParteTrabajo.findFirst({ where: { id: lineaId } });
    if (!linea) throw new Error("Línea no encontrada");
    await cargarEditable(db, linea.parteId);
    await db.lineaParteTrabajo.deleteMany({ where: { id: lineaId } });
    revalidatePath(`/partes/${linea.parteId}`);
  });
}

export type FotoNueva = { datos: string; pie: string };

export async function anadirFotos(parteId: string, fotos: FotoNueva[]): Promise<Resultado> {
  return ejecutar("anadirFotos", async () => {
    const { db, empresaId } = await requireTenant();
    await cargarEditable(db, parteId);
    const count = await db.fotoParteTrabajo.count({ where: { parteId } });
    // createMany, no create anidado: son varias fotos de golpe, y así se evita
    // una escritura por foto.
    await db.fotoParteTrabajo.createMany({
      data: fotos.map((f, i) => ({ empresaId, parteId, datos: f.datos, pie: f.pie || "", orden: count + i })),
    });
    revalidatePath(`/partes/${parteId}`);
  });
}

export async function actualizarPieFoto(fotoId: string, pie: string): Promise<Resultado> {
  return ejecutar("actualizarPieFoto", async () => {
    const { db } = await requireTenant();
    const foto = await db.fotoParteTrabajo.findFirst({ where: { id: fotoId } });
    if (!foto) throw new Error("Foto no encontrada");
    await cargarEditable(db, foto.parteId);
    await db.fotoParteTrabajo.updateMany({ where: { id: fotoId }, data: { pie } });
    revalidatePath(`/partes/${foto.parteId}`);
  });
}

export async function borrarFoto(fotoId: string): Promise<Resultado> {
  return ejecutar("borrarFoto", async () => {
    const { db } = await requireTenant();
    const foto = await db.fotoParteTrabajo.findFirst({ where: { id: fotoId } });
    if (!foto) throw new Error("Foto no encontrada");
    await cargarEditable(db, foto.parteId);
    await db.fotoParteTrabajo.deleteMany({ where: { id: fotoId } });
    revalidatePath(`/partes/${foto.parteId}`);
  });
}

export async function guardarFirmaParte(parteId: string, dataUrl: string): Promise<Resultado> {
  return ejecutar("guardarFirmaParte", async () => {
    const { db } = await requireTenant();
    await cargarEditable(db, parteId);
    const cabeceras = await headers();
    const ip = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() || cabeceras.get("x-real-ip") || "";
    await db.parteTrabajo.updateMany({
      where: { id: parteId },
      data: { firma: dataUrl, fechaFirma: new Date(), firmaIp: ip, estado: "FIRMADO" },
    });
    revalidatePath(`/partes/${parteId}`);
  });
}

/**
 * Reabre un parte firmado para poder corregirlo. Es admin-only a propósito:
 * cualquier técnico puede rellenar y firmar un parte, pero deshacer una firma
 * que el cliente ya dio es una decisión de la empresa, no de quien esté ese
 * día en la obra.
 */
export async function reabrirParte(id: string): Promise<Resultado> {
  return ejecutar("reabrirParte", async () => {
    const { db } = await requireTenantAdmin();
    const r = await db.parteTrabajo.updateMany({ where: { id }, data: { estado: "BORRADOR" } });
    if (r.count === 0) throw new Error("Parte de trabajo no encontrado");
    revalidatePath(`/partes/${id}`);
  });
}

export async function borrarParte(id: string): Promise<ResultadoConRedirect> {
  return ejecutar("borrarParte", async () => {
    const { db } = await requireTenantAdmin();
    const r = await db.parteTrabajo.deleteMany({ where: { id } });
    if (r.count === 0) throw new Error("Parte de trabajo no encontrado");
    revalidatePath("/partes");
    redirect("/partes");
  });
}
