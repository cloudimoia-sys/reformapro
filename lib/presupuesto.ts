import type { LineaPresupuesto } from "@prisma/client";

type LineaCalc = Pick<LineaPresupuesto, "cantidad" | "precio" | "descuento">;

export function importeLinea(l: LineaCalc) {
  return l.cantidad * l.precio * (1 - (l.descuento || 0) / 100);
}

export function base(p: { lineas: LineaCalc[] }) {
  return p.lineas.reduce((s, l) => s + importeLinea(l), 0);
}

export function totalPres(p: { iva: number; lineas: LineaCalc[] }) {
  return base(p) * (1 + p.iva / 100);
}

export function estadoClase(estado: string) {
  return `b-${estado.toLowerCase()}`;
}

export function estadoLabel(estado: string) {
  return estado.charAt(0) + estado.slice(1).toLowerCase();
}
