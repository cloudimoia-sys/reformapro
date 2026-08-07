"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireTenant, requireTenantAdmin, type ContextoTenant } from "@/lib/session";
import { ejecutar, type Resultado, type ResultadoConRedirect } from "@/lib/accion";
import { siguienteNumero } from "@/lib/counter";
import { desglosePres } from "@/lib/presupuesto";
import { guardarEnCatalogo, type PartidaAlCatalogo as CatalogoPartidaAlCatalogo } from "@/lib/catalogo";

const BLOQUEADO_ESTADOS = ["APROBADO", "FACTURADO"];

/**
 * Reduce un nombre comercial a un concepto manejable para la tabla del
 * presupuesto: "CEMENTO TUDSELA VEGUIN II A-V 42.5R 25 KG GRIS" → "CEMENTO
 * TUDSELA VEGUIN II".
 *
 * Corta por palabras enteras, nunca a mitad, y respeta las mayúsculas y la
 * notación técnica tal y como las escribió el usuario en su catálogo: tocarlas
 * estropearía referencias como "CEM II/A-V 42,5R". El nombre completo no se
 * pierde, va en la descripción de la línea.
 */
function conceptoCorto(nombre: string, maxPalabras = 4) {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length <= maxPalabras) return nombre.trim();
  return palabras.slice(0, maxPalabras).join(" ");
}

/**
 * Carga el presupuesto comprobando de paso que es de esta empresa (el `db` ya
 * filtra) y que se puede editar. Devuelve la fila para no volver a consultarla.
 */
async function cargarEditable(db: ContextoTenant["db"], id: string) {
  const p = await db.presupuesto.findFirst({ where: { id } });
  if (!p) throw new Error("Presupuesto no encontrado");
  if (BLOQUEADO_ESTADOS.includes(p.estado)) {
    throw new Error("Este presupuesto ya está aprobado/facturado y no se puede editar.");
  }
  return p;
}

export async function crearPresupuestoBlanco(): Promise<ResultadoConRedirect> {
  return ejecutar("crearPresupuestoBlanco", async () => {
    const { db, empresaId, user } = await requireTenant();
    const [numero, primerCliente, empresa] = await Promise.all([
      siguienteNumero(empresaId, "presupuesto"),
      db.cliente.findFirst({ orderBy: { nombre: "asc" } }),
      db.empresa.findFirst(),
    ]);
    const p = await db.presupuesto.create({
      data: {
        empresaId,
        numero,
        clienteId: primerCliente?.id,
        titulo: "Nueva obra",
        fecha: new Date(),
        iva: empresa?.ivaDefecto ?? 10,
        margen: empresa?.margenDefecto ?? 0,
        estado: "BORRADOR",
        autor: user.nombre,
      },
    });
    revalidatePath("/presupuestos");
    redirect(`/presupuestos/${p.id}`);
  });
}

export type LineaIA = {
  capitulo: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

/**
 * Devuelve el error en vez de lanzarlo: Next borra el mensaje de las excepciones
 * de una acción en producción, y el asistente mostraría un texto genérico que no
 * dice nada. Al éxito redirige, así que solo retorna cuando algo ha ido mal.
 */
export async function crearPresupuestoConIA(
  lineas: LineaIA[],
  meta: { tipo: string; m2?: string }
): Promise<ResultadoConRedirect> {
  return ejecutar("crearPresupuestoConIA", async () => {
    const { db, empresaId, user } = await requireTenant();
    const [numero, primerCliente, empresa] = await Promise.all([
      siguienteNumero(empresaId, "presupuesto"),
      db.cliente.findFirst({ orderBy: { nombre: "asc" } }),
      db.empresa.findFirst(),
    ]);
    const titulo = `${meta.tipo}${meta.m2 ? ` (${meta.m2} m²)` : ""}`;
    const p = await db.presupuesto.create({
      data: {
        empresaId,
        numero,
        clienteId: primerCliente?.id,
        titulo,
        fecha: new Date(),
        iva: empresa?.ivaDefecto ?? 10,
        margen: empresa?.margenDefecto ?? 0,
        estado: "BORRADOR",
        autor: user.nombre,
        // Las líneas NO llevan empresaId: como apuntan al presupuesto por la pareja
        // (presupuestoId, empresaId), Prisma la hereda del padre y rechaza que se la
        // pasemos ("Unknown argument empresaId"). La clave foránea compuesta ya
        // garantiza que la línea queda en la misma empresa que su presupuesto.
        lineas: { create: lineas.map((l, i) => ({ ...l, orden: i })) },
      },
    });
    revalidatePath("/presupuestos");
    redirect(`/presupuestos/${p.id}`);
  });
}

export async function borrarPresupuesto(id: string): Promise<Resultado> {
  return ejecutar("borrarPresupuesto", async () => {
    const { db } = await requireTenantAdmin();
    // Las facturas apuntan al presupuesto con NO ACTION, así que hay que
    // desvincularlas antes de borrar (antes lo hacía el SET NULL de la base).
    await db.$transaction(async (tx) => {
      await tx.factura.updateMany({ where: { presupuestoId: id }, data: { presupuestoId: null } });
      const r = await tx.presupuesto.deleteMany({ where: { id } });
      if (r.count === 0) throw new Error("Presupuesto no encontrado");
    });
    revalidatePath("/presupuestos");
  });
}

export type PresupuestoPatch = Partial<{
  titulo: string;
  clienteId: string | null;
  fecha: string;
  iva: number;
  margen: number;
  notas: string;
}>;

export async function actualizarPresupuesto(id: string, patch: PresupuestoPatch): Promise<Resultado> {
  return ejecutar("actualizarPresupuesto", async () => {
    const { db } = await requireTenant();
    const { notas, ...resto } = patch;
    const huboOtroCambio = Object.keys(resto).length > 0;
    if (huboOtroCambio) await cargarEditable(db, id);

    // El clienteId viene del navegador: comprobamos que es un cliente nuestro antes
    // de asignarlo. La clave foránea compuesta lo rechazaría igualmente, pero así el
    // mensaje es claro en vez de un error de base de datos.
    if (resto.clienteId) {
      const cliente = await db.cliente.findFirst({ where: { id: resto.clienteId }, select: { id: true } });
      if (!cliente) throw new Error("Cliente no encontrado");
    }

    const r = await db.presupuesto.updateMany({
      where: { id },
      data: {
        ...resto,
        ...(resto.fecha ? { fecha: new Date(resto.fecha) } : {}),
        ...(notas !== undefined ? { notas } : {}),
      },
    });
    if (r.count === 0) throw new Error("Presupuesto no encontrado");
    revalidatePath(`/presupuestos/${id}`);
  });
}

export async function marcarEnviado(id: string): Promise<Resultado> {
  return ejecutar("marcarEnviado", async () => {
    const { db } = await requireTenant();
    const r = await db.presupuesto.updateMany({
      where: { id, estado: "BORRADOR" },
      data: { estado: "ENVIADO" },
    });
    // count 0 puede significar "no es tuyo" o "ya no era borrador": ninguno es un
    // error para el usuario, que solo está enviando el presupuesto por email.
    if (r.count > 0) revalidatePath(`/presupuestos/${id}`);
  });
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

export async function agregarLinea(presupuestoId: string, data: LineaInput): Promise<Resultado> {
  return ejecutar("agregarLinea", async () => {
    const { db, empresaId } = await requireTenant();
    await cargarEditable(db, presupuestoId);
    const count = await db.lineaPresupuesto.count({ where: { presupuestoId } });
    await db.lineaPresupuesto.create({
      data: { empresaId, presupuestoId, ...data, descuento: clampDescuento(data.descuento), orden: count },
    });
    revalidatePath(`/presupuestos/${presupuestoId}`);
  });
}

export async function agregarMaterialDelCatalogo(presupuestoId: string, productoId: string): Promise<Resultado> {
  return ejecutar("agregarMaterialDelCatalogo", async () => {
    const { db, empresaId } = await requireTenant();
    await cargarEditable(db, presupuestoId);

    // Los DOS ids llegan del navegador. Este caso no lo cubre la clave foránea
    // compuesta, porque la línea copia el nombre y el precio en vez de apuntar al
    // producto: sin esta comprobación, una empresa podría leer los precios
    // negociados de otra pasando el id de su material.
    const [producto, count] = await Promise.all([
      db.producto.findFirst({ where: { id: productoId }, include: { proveedor: true } }),
      db.lineaPresupuesto.count({ where: { presupuestoId } }),
    ]);
    if (!producto) throw new Error("No encontrado en el catálogo");

    /**
     * Una partida propia ya viene redactada por el reformista: su concepto y su
     * descripción se copian tal cual, sin tocar nada. Un material, en cambio, se
     * convierte en línea: concepto corto y el nombre comercial completo con el
     * proveedor en la descripción, que es donde el cliente busca el detalle.
     */
    const esPartida = producto.tipo === "PARTIDA";
    const linea = esPartida
      ? {
          capitulo: producto.capitulo || "Varios",
          concepto: producto.nombre,
          descripcion: producto.descripcion || "",
        }
      : {
          capitulo: "Materiales",
          concepto: conceptoCorto(producto.nombre),
          descripcion:
            `Suministro de ${producto.nombre}.` +
            (producto.proveedor ? ` Proveedor: ${producto.proveedor.nombre}.` : ""),
        };

    await db.lineaPresupuesto.create({
      data: {
        empresaId,
        presupuestoId,
        ...linea,
        cantidad: 1,
        unidad: producto.unidad,
        precio: producto.precio,
        orden: count,
      },
    });
    revalidatePath(`/presupuestos/${presupuestoId}`);
  });
}

export async function actualizarLinea(lineaId: string, patch: Partial<LineaInput>): Promise<Resultado> {
  return ejecutar("actualizarLinea", async () => {
    const { db } = await requireTenant();
    const linea = await db.lineaPresupuesto.findFirst({ where: { id: lineaId } });
    if (!linea) throw new Error("Línea no encontrada");
    await cargarEditable(db, linea.presupuestoId);

    await db.lineaPresupuesto.updateMany({
      where: { id: lineaId },
      data: { ...patch, ...(patch.descuento !== undefined ? { descuento: clampDescuento(patch.descuento) } : {}) },
    });
    revalidatePath(`/presupuestos/${linea.presupuestoId}`);
  });
}

export async function borrarLinea(lineaId: string): Promise<Resultado> {
  return ejecutar("borrarLinea", async () => {
    const { db } = await requireTenant();
    const linea = await db.lineaPresupuesto.findFirst({ where: { id: lineaId } });
    if (!linea) throw new Error("Línea no encontrada");
    await cargarEditable(db, linea.presupuestoId);

    await db.lineaPresupuesto.deleteMany({ where: { id: lineaId } });
    revalidatePath(`/presupuestos/${linea.presupuestoId}`);
  });
}

export async function guardarFirma(presupuestoId: string, dataUrl: string): Promise<Resultado> {
  return ejecutar("guardarFirma", async () => {
    const { db } = await requireTenant();
    await cargarEditable(db, presupuestoId);
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || (await headers()).get("x-real-ip") || "";
    await db.presupuesto.updateMany({
      where: { id: presupuestoId },
      data: { firma: dataUrl, fechaFirma: new Date(), firmaIp: ip, estado: "APROBADO" },
    });
    revalidatePath(`/presupuestos/${presupuestoId}`);
  });
}

export async function crearFacturaDesdePresupuesto(presupuestoId: string): Promise<ResultadoConRedirect> {
  return ejecutar("crearFacturaDesdePresupuesto", async () => {
    const { db, empresaId } = await requireTenantAdmin();
    const p = await db.presupuesto.findFirst({
      where: { id: presupuestoId },
      include: { lineas: true },
    });
    if (!p) throw new Error("Presupuesto no encontrado");
    if (p.estado !== "APROBADO") throw new Error("Solo se puede facturar un presupuesto Aprobado.");

    /**
     * La base de la factura incluye el margen del presupuesto.
     *
     * Si no, el cliente firma un total y luego le llega una factura por menos: la
     * base imponible de la factura tiene que ser lo que se acordó antes de IVA,
     * gastos generales y beneficio incluidos.
     */
    const d = desglosePres(p);
    const base = d.subtotal;

    // El número se reserva DENTRO de la transacción: si algo falla, el contador se
    // revierte y no queda un hueco en la numeración de facturas (lo exige Hacienda).
    await db.$transaction(async (tx) => {
      const numero = await siguienteNumero(empresaId, "factura", tx);
      await tx.factura.create({
        data: {
          empresaId,
          numero,
          presupuestoId: p.id,
          clienteId: p.clienteId,
          fecha: new Date(),
          base,
          iva: p.iva,
          total: d.total,
          estado: "PENDIENTE",
        },
      });
      await tx.presupuesto.updateMany({ where: { id: p.id }, data: { estado: "FACTURADO" } });
    });

    revalidatePath(`/presupuestos/${presupuestoId}`);
    revalidatePath("/facturas");
    redirect("/facturas");
  });
}

/** Solo el precio: en un presupuesto, lo que se guarda siempre es una
 *  unidad de obra propia, nunca un material suelto. */
export type PartidaAlCatalogo = Omit<CatalogoPartidaAlCatalogo, "tipo">;

/**
 * Guarda en el catálogo una partida corregida a mano en un presupuesto.
 *
 * ES EL BUCLE QUE HACE QUE LA APLICACIÓN MEJORE SOLA, y la idea es del usuario:
 * generas un presupuesto, corriges el precio que no te encaja, lo guardas de un
 * clic y la próxima vez ese trabajo sale con TU precio en lugar de con uno
 * estimado. Cuantas más veces lo haces, menos queda por inventar.
 *
 * La lógica de guardado vive en `lib/catalogo.ts`, compartida con los partes
 * de trabajo: aquí solo se fija el tipo en "PARTIDA", que es lo único que un
 * presupuesto guarda en el catálogo — nunca un material suelto.
 */
export async function guardarPartidaEnCatalogo(datos: PartidaAlCatalogo): Promise<Resultado<"creada" | "actualizada">> {
  return ejecutar("guardarPartidaEnCatalogo", async () => {
    const { db, empresaId } = await requireTenant();
    const resultado = await guardarEnCatalogo(db, empresaId, { ...datos, tipo: "PARTIDA" });
    revalidatePath("/catalogo");
    return resultado;
  });
}
