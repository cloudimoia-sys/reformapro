"use server";

import { revalidatePath } from "next/cache";
import { requireTenant, requireTenantAdmin } from "@/lib/session";
import { comprobarPrecioUrl } from "@/lib/priceCheck";
import { ejecutar, type Resultado } from "@/lib/accion";
import { normalizarUnidad } from "@/lib/unidades";
import type { ContextoTenant } from "@/lib/session";

function normalizarUrl(web: string): string | null {
  const v = web.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export type ProveedorInput = { nombre: string; web: string };

export async function crearProveedor(data: ProveedorInput): Promise<Resultado> {
  return ejecutar("crearProveedor", async () => {
    const { db, empresaId } = await requireTenant();
    if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
    await db.proveedor.create({ data: { empresaId, nombre: data.nombre, web: normalizarUrl(data.web) } });
    revalidatePath("/catalogo");
  });
}

export async function actualizarProveedor(id: string, data: ProveedorInput): Promise<Resultado> {
  return ejecutar("actualizarProveedor", async () => {
    const { db } = await requireTenant();
    if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");
    const r = await db.proveedor.updateMany({
      where: { id },
      data: { nombre: data.nombre, web: normalizarUrl(data.web) },
    });
    if (r.count === 0) throw new Error("Proveedor no encontrado");
    revalidatePath("/catalogo");
  });
}

export type ProductoInput = {
  tipo: "MATERIAL" | "PARTIDA";
  /** Vacío en las partidas propias: la mano de obra no tiene proveedor. */
  provId: string;
  nombre: string;
  descripcion: string;
  capitulo: string;
  unidad: string;
  precio: number;
  url: string;
  /** Referencia de este artículo en el ERP de la empresa, si tiene uno. */
  codigoErp: string;
};

/**
 * Prepara los datos comunes al alta y la edición.
 *
 * El proveedor solo se exige y se comprueba en los materiales. En una partida
 * propia ("cambiar plato de ducha") no hay a quién comprar, así que forzarlo
 * obligaría a inventarse un proveedor falso para poder guardarla.
 */
async function prepararProducto(db: ContextoTenant["db"], data: ProductoInput) {
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");

  const esMaterial = data.tipo !== "PARTIDA";
  let provId: string | null = null;

  if (esMaterial) {
    // provId llega del navegador: hay que comprobar que ese proveedor es de esta
    // empresa. (La clave foránea compuesta también lo impediría, pero así el
    // mensaje de error es comprensible.)
    if (!data.provId) throw new Error("Elige un proveedor para el material");
    const proveedor = await db.proveedor.findFirst({ where: { id: data.provId }, select: { id: true } });
    if (!proveedor) throw new Error("Proveedor no encontrado");
    provId = proveedor.id;
  }

  return {
    tipo: esMaterial ? ("MATERIAL" as const) : ("PARTIDA" as const),
    provId,
    nombre: data.nombre.trim(),
    descripcion: data.descripcion?.trim() || null,
    capitulo: data.capitulo?.trim() || null,
    unidad: normalizarUnidad(data.unidad),
    precio: data.precio,
    // Solo los materiales tienen ficha en la web de un proveedor.
    url: esMaterial ? normalizarUrl(data.url) : null,
    // Vale para los dos tipos: en un ERP también tienen referencia las unidades
    // de obra, no solo los materiales que se compran.
    codigoErp: data.codigoErp?.trim() || null,
    fecha: new Date(),
  };
}

export async function crearProducto(data: ProductoInput): Promise<Resultado> {
  return ejecutar("crearProducto", async () => {
    const { db, empresaId } = await requireTenant();
    const datos = await prepararProducto(db, data);
    await db.producto.create({ data: { ...datos, empresaId } });
    revalidatePath("/catalogo");
  });
}

export async function actualizarProducto(id: string, data: ProductoInput): Promise<Resultado> {
  return ejecutar("actualizarProducto", async () => {
    const { db } = await requireTenant();
    const datos = await prepararProducto(db, data);
    const r = await db.producto.updateMany({ where: { id }, data: datos });
    if (r.count === 0) throw new Error("No encontrado en el catálogo");
    revalidatePath("/catalogo");
  });
}

export async function borrarProducto(id: string): Promise<Resultado> {
  return ejecutar("borrarProducto", async () => {
    const { db } = await requireTenantAdmin();
    const r = await db.producto.deleteMany({ where: { id } });
    if (r.count === 0) throw new Error("No encontrado en el catálogo");
    revalidatePath("/catalogo");
  });
}

export async function comprobarPrecioProducto(id: string): Promise<Resultado<number>> {
  return ejecutar("comprobarPrecioProducto", async () => {
    const { db } = await requireTenant();
    const producto = await db.producto.findFirst({ where: { id }, select: { url: true } });
    if (!producto) throw new Error("Material no encontrado");
    if (!producto.url) throw new Error("Este material no tiene una URL guardada.");

    const precio = await comprobarPrecioUrl(producto.url);
    await db.producto.updateMany({ where: { id }, data: { precio, fecha: new Date() } });
    revalidatePath("/catalogo");
    return precio;
  });
}
