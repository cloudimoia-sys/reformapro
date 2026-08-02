"use client";

import * as XLSX from "xlsx";
import { eur } from "@/lib/format";
import { importeLinea, desglosePres } from "@/lib/presupuesto";
import {
  AVISO_SIN_VALIDEZ_FISCAL,
  aCSV,
  faltaParaFacturae,
  filasCSV,
  generarFacturae,
  type ParteFactura,
  type PropuestaFactura,
} from "@/lib/facturacion";

export type LineaDoc = {
  capitulo: string | null;
  concepto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
  precio: number;
  descuento: number;
};

export type PresupuestoDoc = {
  numero: string;
  titulo: string;
  fecha: string;
  iva: number;
  margen?: number;
  notas: string | null;
  firma: string | null;
  fechaFirma: string | null;
  lineas: LineaDoc[];
};

export type ClienteDoc = { nombre: string; direccion: string | null; nif: string | null } | null;
export type EmpresaDoc = {
  nombre: string;
  cif: string;
  direccion: string;
  tel: string;
  email: string;
  logo?: string | null;
};

function celdaDescuento(l: LineaDoc, conDescuentos: boolean) {
  return conDescuentos ? `<td style="text-align:right">${l.descuento ? `${l.descuento}%` : ""}</td>` : "";
}

function docHTML(pres: PresupuestoDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const d = desglosePres(pres);
  const conDescuentos = pres.lineas.some((l) => l.descuento > 0);
  const caps: string[] = [];
  pres.lineas.forEach((l) => {
    const c = l.capitulo || "Partidas";
    if (!caps.includes(c)) caps.push(c);
  });
  const colspan = conDescuentos ? 6 : 5;
  const filas = caps
    .map((cap) => {
      const ls = pres.lineas.filter((l) => (l.capitulo || "Partidas") === cap);
      const sub = ls.reduce((s, l) => s + importeLinea(l), 0);
      return (
        `<tr><td colspan="${colspan}" style="background:#EDF2F5;font-weight:bold;color:#1D4E6B;text-transform:uppercase;font-size:12px">${cap}</td></tr>` +
        ls
          .map(
            (l) =>
              `<tr><td>${l.concepto}</td><td>${l.descripcion || ""}</td><td style="text-align:right">${l.cantidad} ${l.unidad}</td><td style="text-align:right">${eur(l.precio)}</td>${celdaDescuento(l, conDescuentos)}<td style="text-align:right">${eur(importeLinea(l))}</td></tr>`
          )
          .join("") +
        `<tr><td colspan="${colspan - 1}" style="text-align:right;font-size:11px;color:#666">Subtotal ${cap}</td><td style="text-align:right;font-weight:bold">${eur(sub)}</td></tr>`
      );
    })
    .join("");
  const base = pres.lineas.reduce((s, l) => s + importeLinea(l), 0);
  const iva = (base * pres.iva) / 100;
  return `<html><head><meta charset="utf-8"><title>${pres.numero}</title><style>
    body{font-family:Arial,sans-serif;color:#1E2833;margin:36px;font-size:13px}
    h1{color:#1D4E6B;border-bottom:4px solid #E8A020;padding-bottom:6px;font-size:22px}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    th{background:#1D4E6B;color:#fff;padding:7px;text-align:left;font-size:12px}
    td{padding:7px;border-bottom:1px solid #ddd}
    .tot{margin-top:14px;text-align:right;font-size:14px}
    .tot b{font-size:17px;color:#1D4E6B}
    .cab{display:flex;justify-content:space-between;margin-top:10px}
    .firma{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}
  </style></head><body>
  <h1>PRESUPUESTO ${pres.numero}</h1>
  <div class="cab"><div><b>${empresa.nombre}</b><br>CIF: ${empresa.cif}<br>${empresa.direccion}<br>${empresa.tel} · ${empresa.email}</div>
  <div style="text-align:right"><b>Cliente:</b> ${cliente ? cliente.nombre : "—"}<br>${cliente ? cliente.direccion || "" : ""}<br>NIF: ${cliente ? cliente.nif || "" : ""}<br>Fecha: ${pres.fecha}</div></div>
  <p><b>Obra:</b> ${pres.titulo}</p>
  <table><thead><tr><th>Concepto</th><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th>${conDescuentos ? '<th style="text-align:right">Dto.</th>' : ""}<th style="text-align:right">Importe</th></tr></thead>
  <tbody>${filas}</tbody></table>
  <div class="tot">Base imponible: ${eur(d.base)}${
    d.porcentajeMargen > 0
      ? `<br>Gastos generales y beneficio industrial (${d.porcentajeMargen} %): ${eur(d.importeMargen)}<br>Suma: ${eur(d.subtotal)}`
      : ""
  }<br>IVA (${pres.iva} %): ${eur(d.importeIva)}<br><b>TOTAL: ${eur(d.total)}</b></div>
  <p style="margin-top:16px;font-size:11px;color:#666">Presupuesto válido durante 30 días. ${pres.notas || ""}</p>
  ${pres.firma ? `<div class="firma"><b>Aprobado por el cliente</b> el ${pres.fechaFirma}<br><img src="${pres.firma}" style="height:70px"/></div>` : ""}
  </body></html>`;
}

export function exportPDF(pres: PresupuestoDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(docHTML(pres, cliente, empresa));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function exportWord(pres: PresupuestoDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const blob = new Blob(["﻿" + docHTML(pres, cliente, empresa)], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${pres.numero}.doc`;
  a.click();
}

export function exportExcel(pres: PresupuestoDoc) {
  const base = pres.lineas.reduce((s, l) => s + importeLinea(l), 0);
  const rows = [
    ["Presupuesto", pres.numero],
    ["Obra", pres.titulo],
    ["Fecha", pres.fecha],
    [],
    ["Capítulo", "Concepto", "Descripción", "Cantidad", "Unidad", "Precio unitario", "Descuento %", "Importe"],
    ...pres.lineas.map((l) => [l.capitulo || "", l.concepto, l.descripcion || "", l.cantidad, l.unidad, l.precio, l.descuento || 0, importeLinea(l)]),
    [],
    ["", "", "", "", "", "", "Base imponible", base],
    ["", "", "", "", "", "", `IVA ${pres.iva}%`, (base * pres.iva) / 100],
    ["", "", "", "", "", "", "TOTAL", base * (1 + pres.iva / 100)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 44 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
  XLSX.writeFile(wb, `${pres.numero}.xlsx`);
}

export type FacturaDoc = {
  numero: string;
  fecha: string;
  titulo: string | null;
  base: number;
  iva: number;
  total: number;
  lineas: LineaDoc[];
};

function docHTMLFactura(fac: FacturaDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const conDescuentos = fac.lineas.some((l) => l.descuento > 0);
  const filas = fac.lineas.length
    ? fac.lineas
        .map(
          (l) =>
            `<tr><td>${l.concepto}</td><td>${l.descripcion || ""}</td><td style="text-align:right">${l.cantidad} ${l.unidad}</td><td style="text-align:right">${eur(l.precio)}</td>${celdaDescuento(l, conDescuentos)}<td style="text-align:right">${eur(importeLinea(l))}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="${conDescuentos ? 5 : 4}">${fac.titulo || "Servicios de reforma"}</td><td style="text-align:right">${eur(fac.base)}</td></tr>`;
  return `<html><head><meta charset="utf-8"><title>${fac.numero}</title><style>
    body{font-family:Arial,sans-serif;color:#1E2833;margin:36px;font-size:13px}
    h1{color:#1D4E6B;border-bottom:4px solid #E8A020;padding-bottom:6px;font-size:22px}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    th{background:#1D4E6B;color:#fff;padding:7px;text-align:left;font-size:12px}
    td{padding:7px;border-bottom:1px solid #ddd}
    .tot{margin-top:14px;text-align:right;font-size:14px}
    .tot b{font-size:17px;color:#1D4E6B}
    .cab{display:flex;justify-content:space-between;margin-top:10px}
    /* El aviso va arriba, antes de los importes, y se imprime: si solo saliera al
       pie, alguien acabaría entregándoselo a un cliente como si fuera la factura. */
    .aviso{background:#FCF0D8;border:1px solid #EBD9A8;color:#7A5A10;border-radius:6px;padding:8px 10px;font-size:12px;margin:8px 0}
  </style></head><body>
  <h1>PROPUESTA DE FACTURA ${fac.numero}</h1>
  <div class="aviso">${AVISO_SIN_VALIDEZ_FISCAL}</div>
  ${empresa.logo ? `<img src="${empresa.logo}" alt="" style="max-height:60px;max-width:200px;margin-bottom:8px" />` : ""}
  <div class="cab"><div><b>${empresa.nombre}</b><br>CIF: ${empresa.cif}<br>${empresa.direccion}<br>${empresa.tel} · ${empresa.email}</div>
  <div style="text-align:right"><b>Cliente:</b> ${cliente ? cliente.nombre : "—"}<br>${cliente ? cliente.direccion || "" : ""}<br>NIF: ${cliente ? cliente.nif || "" : ""}<br>Fecha: ${fac.fecha}</div></div>
  ${fac.titulo ? `<p><b>Obra:</b> ${fac.titulo}</p>` : ""}
  <table><thead><tr><th>Concepto</th><th>Descripción</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th>${conDescuentos ? '<th style="text-align:right">Dto.</th>' : ""}<th style="text-align:right">Importe</th></tr></thead>
  <tbody>${filas}</tbody></table>
  <div class="tot">Base imponible: ${eur(fac.base)}<br>IVA (${fac.iva} %): ${eur(fac.total - fac.base)}<br><b>TOTAL: ${eur(fac.total)}</b></div>
  </body></html>`;
}

export function exportFacturaPDF(fac: FacturaDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(docHTMLFactura(fac, cliente, empresa));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function exportFacturaWord(fac: FacturaDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const blob = new Blob(["﻿" + docHTMLFactura(fac, cliente, empresa)], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fac.numero}.doc`;
  a.click();
}

export function exportFacturaExcel(fac: FacturaDoc) {
  const rows = [
    ["Propuesta de factura", fac.numero],
    ["Aviso", AVISO_SIN_VALIDEZ_FISCAL],
    ["Obra", fac.titulo || ""],
    ["Fecha", fac.fecha],
    [],
    ["Concepto", "Descripción", "Cantidad", "Unidad", "Precio unitario", "Descuento %", "Importe"],
    ...(fac.lineas.length
      ? fac.lineas.map((l) => [l.concepto, l.descripcion || "", l.cantidad, l.unidad, l.precio, l.descuento || 0, importeLinea(l)])
      : [[fac.titulo || "Servicios de reforma", "", 1, "pa", fac.base, 0, fac.base]]),
    [],
    ["", "", "", "", "", "Base imponible", fac.base],
    ["", "", "", "", "", `IVA ${fac.iva}%`, fac.total - fac.base],
    ["", "", "", "", "", "TOTAL", fac.total],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 44 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Propuesta");
  XLSX.writeFile(wb, `${fac.numero}.xlsx`);
}

/** Descarga un texto como archivo, sin pasar por el servidor. */
function descargar(contenido: string, nombre: string, tipo: string) {
  // El BOM hace que Excel abra el CSV en UTF-8; sin él, las tildes salen rotas y
  // el usuario cree que la exportación está mal hecha.
  const bom = tipo.startsWith("text/csv") ? "﻿" : "";
  const blob = new Blob([bom + contenido], { type: tipo });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Exporta una propuesta en formato Facturae, para importarla en el programa de
 * facturación. Devuelve la lista de datos que faltan, o vacío si ha ido bien.
 */
export function exportFacturae(
  propuesta: PropuestaFactura,
  emisor: ParteFactura,
  receptor: ParteFactura | null
): string[] {
  const faltan = faltaParaFacturae(emisor, receptor);
  if (faltan.length) return faltan;
  descargar(generarFacturae(propuesta, emisor, receptor!), `${propuesta.numero}.xsig.xml`, "application/xml");
  return [];
}

/** Exporta varias propuestas a un CSV que el programa de gestión pueda importar. */
export function exportCSVFacturacion(
  propuestas: (PropuestaFactura & { cliente: ParteFactura | null; estado: string })[],
  nombre: string
) {
  descargar(aCSV(filasCSV(propuestas)), nombre, "text/csv;charset=utf-8");
}
