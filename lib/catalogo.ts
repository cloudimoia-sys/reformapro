import type { TenantDb } from "@/lib/tenantDb";
import { normalizarUnidad } from "@/lib/unidades";

export type PartidaAlCatalogo = {
  concepto: string;
  descripcion: string;
  capitulo: string;
  unidad: string;
  precio: number;
  /** MATERIAL o PARTIDA (mano de obra o unidad de obra propia). */
  tipo: "MATERIAL" | "PARTIDA";
};

/**
 * Guarda en el catálogo una línea corregida a mano, en un presupuesto o en un
 * parte de trabajo.
 *
 * ES EL BUCLE QUE HACE QUE LA APLICACIÓN MEJORE SOLA, y la idea es del
 * usuario: generas algo con ayuda de la IA, corriges el precio que no te
 * encaja, lo guardas de un clic y la próxima vez ese trabajo o ese material
 * sale con TU precio en lugar de con uno estimado. Cuantas más veces se hace,
 * menos queda por estimar.
 *
 * Vivía solo en presupuestos, con el tipo "PARTIDA" fijo en el código —tenía
 * sentido porque ahí solo se guardaban unidades de obra propias—. Al llegar
 * los partes de trabajo hacía falta lo mismo también para MATERIAL, así que
 * se saca aquí, a `lib/`, para que las dos pantallas llamen a la misma lógica
 * en vez de mantenerla dos veces.
 *
 * Si la partida ya existe con ese nombre Y ESE TIPO se ACTUALIZA el precio en
 * vez de duplicarla: un catálogo con tres "Sustitución de inodoro" a precios
 * distintos es peor que no tenerlo, porque la coincidencia elige una al azar.
 * Se busca dentro del mismo tipo porque un material y una partida con el
 * mismo nombre son cosas distintas — "Grifo monomando" como material que se
 * compra no es lo mismo que "Grifo monomando" como unidad de obra con todo
 * incluido, y no deben pisarse.
 */
export async function guardarEnCatalogo(
  db: TenantDb,
  empresaId: string,
  datos: PartidaAlCatalogo
): Promise<"creada" | "actualizada"> {
  const nombre = (datos.concepto || "").trim();
  if (!nombre) throw new Error("La partida necesita un concepto para guardarla.");
  const precio = Number(datos.precio);
  if (!Number.isFinite(precio) || precio <= 0) throw new Error("Pon un precio antes de guardarla.");

  const comun = {
    descripcion: datos.descripcion?.trim() || null,
    capitulo: datos.capitulo?.trim() || null,
    unidad: normalizarUnidad(datos.unidad),
    precio,
    fecha: new Date(),
  };

  // Se busca por nombre exacto sin distinguir mayúsculas: es como lo escribiría
  // el usuario dos veces.
  const existente = await db.producto.findFirst({
    where: { tipo: datos.tipo, nombre: { equals: nombre, mode: "insensitive" } },
    select: { id: true },
  });

  if (existente) {
    await db.producto.updateMany({ where: { id: existente.id }, data: comun });
    return "actualizada";
  }

  await db.producto.create({
    data: { ...comun, empresaId, tipo: datos.tipo, nombre, provId: null, url: null },
  });
  return "creada";
}
