import type { LineaPresupuesto } from "@prisma/client";

type LineaCalc = Pick<LineaPresupuesto, "cantidad" | "precio" | "descuento">;

export function importeLinea(l: LineaCalc) {
  return l.cantidad * l.precio * (1 - (l.descuento || 0) / 100);
}

export function base(p: { lineas: LineaCalc[] }) {
  return p.lineas.reduce((s, l) => s + importeLinea(l), 0);
}

/**
 * Desglose completo del presupuesto.
 *
 * El margen son los gastos generales y el beneficio industrial, y va como línea
 * propia entre la base y el IVA. Nace de una duda del usuario al ver un montaje
 * de cocina: los precios de la guía son de mercado y ya incluyen coste de
 * ejecución, pero no dicen nada de la estructura ni del beneficio de SU empresa,
 * que es lo que diferencia a un reformista de otro.
 *
 * Por defecto es 0, así que los presupuestos existentes no cambian de importe
 * mientras nadie lo configure.
 */
export function desglosePres(p: { iva: number; margen?: number; lineas: LineaCalc[] }) {
  const baseImponible = base(p);
  const porcentajeMargen = Number(p.margen) || 0;
  const importeMargen = baseImponible * (porcentajeMargen / 100);
  const subtotal = baseImponible + importeMargen;
  const importeIva = subtotal * (p.iva / 100);
  return {
    base: baseImponible,
    porcentajeMargen,
    importeMargen,
    subtotal,
    iva: p.iva,
    importeIva,
    total: subtotal + importeIva,
  };
}

export function totalPres(p: { iva: number; margen?: number; lineas: LineaCalc[] }) {
  return desglosePres(p).total;
}

export function estadoClase(estado: string) {
  return `b-${estado.toLowerCase()}`;
}

export function estadoLabel(estado: string) {
  return estado.charAt(0) + estado.slice(1).toLowerCase();
}
