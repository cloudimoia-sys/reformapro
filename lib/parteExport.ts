"use client";

import * as XLSX from "xlsx";
import { eur } from "@/lib/format";
import { imprimirDocumento } from "@/lib/imprimir";
import { importeLineaParte, totalesParte, ETIQUETA_TIPO_LINEA, type LineaParteCalc } from "@/lib/parteTrabajo";
import type { ClienteDoc, EmpresaDoc } from "@/lib/docExport";

export type LineaParteDoc = LineaParteCalc & {
  concepto: string;
  descripcion: string | null;
  unidad: string;
  /** Referencia del artículo en el ERP, heredada del catálogo. */
  codigoErp?: string | null;
};

export type ParteDoc = {
  numero: string;
  titulo: string;
  codigoErp: string | null;
  direccion: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  tecnico: string;
  descripcion: string;
  observaciones: string;
  firma: string | null;
  fechaFirma: string | null;
  lineas: LineaParteDoc[];
  fotos: { datos: string; pie: string }[];
};

/** Mismo escape que el resto de exportadores: ver el comentario de lib/docExport.ts. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tablaLineas(lineas: LineaParteDoc[], tipo: "MANO_OBRA" | "MATERIAL") {
  const filas = lineas.filter((l) => l.tipo === tipo);
  if (!filas.length) return "";
  const unidadCol = tipo === "MANO_OBRA" ? "Horas" : "Cantidad";
  // La columna de referencia solo sale si alguna línea la tiene: a quien no
  // trabaja con un ERP no se le mete una columna vacía en el documento que
  // entrega al cliente.
  const conCodigo = filas.some((l) => l.codigoErp);
  return `
  <h3 style="font-size:14px;color:#1D4E6B;margin:16px 0 4px">${esc(ETIQUETA_TIPO_LINEA[tipo])}</h3>
  <table><thead><tr><th>Concepto</th><th>Descripción</th>${conCodigo ? "<th>Referencia</th>" : ""}<th style="text-align:right">${unidadCol}</th><th style="text-align:right">Ud.</th><th style="text-align:right">Precio</th><th style="text-align:right">Importe</th></tr></thead>
  <tbody>${filas
    .map(
      (l) =>
        `<tr><td>${esc(l.concepto)}</td><td>${esc(l.descripcion || "")}</td>${conCodigo ? `<td>${esc(l.codigoErp || "")}</td>` : ""}<td style="text-align:right">${esc(l.cantidad)}</td><td style="text-align:right">${esc(l.unidad)}</td><td style="text-align:right">${eur(l.precio)}</td><td style="text-align:right">${eur(importeLineaParte(l))}</td></tr>`
    )
    .join("")}</tbody></table>`;
}

function docHTML(p: ParteDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const t = totalesParte(p.lineas);
  const horario = [p.horaInicio, p.horaFin].filter(Boolean).join(" a ");
  return `<html><head><meta charset="utf-8"><title>${esc(p.numero)}</title><style>
    body{font-family:Arial,sans-serif;color:#1E2833;margin:36px;font-size:13px}
    h1{color:#1D4E6B;border-bottom:4px solid #E8A020;padding-bottom:6px;font-size:22px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th{background:#1D4E6B;color:#fff;padding:7px;text-align:left;font-size:12px}
    td{padding:7px;border-bottom:1px solid #ddd}
    .tot{margin-top:14px;text-align:right;font-size:14px}
    .tot b{font-size:17px;color:#1D4E6B}
    .cab{display:flex;justify-content:space-between;margin-top:10px}
    .firma{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}
    .foto{display:inline-block;margin:0 10px 10px 0;text-align:center}
    .foto img{max-width:260px;border:1px solid #ccc}
    .foto p{font-size:11px;color:#444;margin:4px 0 0;max-width:260px}
  </style></head><body>
  <h1>PARTE DE TRABAJO ${esc(p.numero)}</h1>
  <div class="cab"><div><b>${esc(empresa.nombre)}</b><br>CIF: ${esc(empresa.cif)}<br>${esc(empresa.direccion)}<br>${esc(empresa.tel)} · ${esc(empresa.email)}</div>
  <div style="text-align:right"><b>Cliente:</b> ${cliente ? esc(cliente.nombre) : "—"}<br>${cliente ? esc(cliente.direccion || "") : ""}<br>Fecha: ${esc(p.fecha)}${horario ? ` · ${esc(horario)}` : ""}</div></div>
  <p><b>${esc(p.titulo)}</b>${p.direccion ? `<br>${esc(p.direccion)}` : ""}</p>
  <p style="font-size:12px;color:#555">Técnico: ${esc(p.tecnico || "—")}${p.codigoErp ? ` · Código ERP: ${esc(p.codigoErp)}` : ""}</p>
  ${p.descripcion ? `<p><b>Trabajo realizado:</b><br>${esc(p.descripcion).replace(/\n/g, "<br>")}</p>` : ""}
  ${tablaLineas(p.lineas, "MANO_OBRA")}
  ${tablaLineas(p.lineas, "MATERIAL")}
  <div class="tot">
    ${t.horas ? `Horas: ${t.horas} h · ${eur(t.costeManoObra)}<br>` : ""}
    ${t.costeMaterial ? `Material: ${eur(t.costeMaterial)}<br>` : ""}
    <b>TOTAL: ${eur(t.total)}</b>
  </div>
  ${p.observaciones ? `<p style="margin-top:14px"><b>Observaciones:</b><br>${esc(p.observaciones).replace(/\n/g, "<br>")}</p>` : ""}
  ${
    p.fotos.length
      ? `<h3 style="font-size:14px;color:#1D4E6B;margin:16px 0 4px">Fotos</h3>${p.fotos
          .map((f) => `<div class="foto"><img src="${esc(f.datos)}"/>${f.pie ? `<p>${esc(f.pie)}</p>` : ""}</div>`)
          .join("")}`
      : ""
  }
  <p style="margin-top:16px;font-size:11px;color:#666">Documento interno de control de horas y materiales, sin validez fiscal.</p>
  ${p.firma ? `<div class="firma"><b>Conformidad del cliente</b> el ${esc(p.fechaFirma)}<br><img src="${esc(p.firma)}" style="height:70px"/></div>` : ""}
  </body></html>`;
}

export function exportParteImprimir(p: ParteDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  imprimirDocumento(docHTML(p, cliente, empresa));
}

export function exportParteWord(p: ParteDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const blob = new Blob(["﻿" + docHTML(p, cliente, empresa)], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${p.numero}.doc`;
  a.click();
}

export function exportParteExcel(p: ParteDoc) {
  const t = totalesParte(p.lineas);
  const rows = [
    ["Parte de trabajo", p.numero],
    ["Título", p.titulo],
    ["Nº en el ERP", p.codigoErp || ""],
    ["Dirección", p.direccion],
    ["Fecha", p.fecha],
    ["Técnico", p.tecnico],
    [],
    // La referencia del ERP va SIEMPRE en el Excel, aunque esté vacía: este es
    // el fichero que abre administración para volcar el consumo, y una columna
    // que aparece y desaparece según el parte rompe cualquier plantilla que
    // hayan montado encima.
    ["Tipo", "Concepto", "Descripción", "Ref. ERP", "Cantidad", "Unidad", "Precio", "Importe"],
    ...p.lineas.map((l) => [
      ETIQUETA_TIPO_LINEA[l.tipo],
      l.concepto,
      l.descripcion || "",
      l.codigoErp || "",
      l.cantidad,
      l.unidad,
      l.precio,
      importeLineaParte(l),
    ]),
    [],
    ["", "", "", "", "", "", "Horas", t.horas],
    ["", "", "", "", "", "", "Coste mano de obra", t.costeManoObra],
    ["", "", "", "", "", "", "Coste material", t.costeMaterial],
    ["", "", "", "", "", "", "TOTAL", t.total],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parte de trabajo");
  XLSX.writeFile(wb, `${p.numero}.xlsx`);
}

/**
 * Exporta varios partes a una hoja de Excel, con el número de ERP en su columna.
 *
 * ES EL PUENTE REAL CON EL ERP, no una integración en vivo. Mientras no haya un
 * formato verificado con el que hablar, esto es lo que funciona hoy: un Excel
 * que administración abre, filtra por el código y vuelca donde haga falta. Es
 * la misma solución que ya se adoptó para la facturación.
 *
 * El detalle de material con la referencia de cada artículo está en el Excel de
 * CADA parte (`exportParteExcel`): aquí solo cabe una fila por parte.
 */
export function exportExcelPartes(
  partes: {
    numero: string;
    titulo: string;
    codigoErp: string | null;
    clienteNombre: string;
    obraNombre: string;
    tecnico: string;
    fecha: string;
    estado: string;
    horas: number;
    total: number;
  }[],
  nombre: string
) {
  const filas: (string | number)[][] = [
    ["Nº parte", "Nº en el ERP", "Título", "Cliente", "Obra", "Técnico", "Fecha", "Horas", "Total", "Estado"],
    ...partes.map((p) => [
      p.numero,
      p.codigoErp || "",
      p.titulo,
      p.clienteNombre,
      p.obraNombre,
      p.tecnico,
      p.fecha,
      p.horas,
      p.total,
      p.estado === "FIRMADO" ? "Firmado" : "Borrador",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws["!cols"] = [
    { wch: 13 }, { wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 22 },
    { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 11 }, { wch: 10 },
  ];
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Partes de trabajo");
  XLSX.writeFile(wb, nombre);
}
