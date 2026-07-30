"use client";

import * as XLSX from "xlsx";
import { eur } from "@/lib/format";
import { importePartida, pem, ETIQUETA_TIPO, type ContenidoInforme, type TipoInforme } from "@/lib/informe";
import type { EmpresaDoc, ClienteDoc } from "@/lib/docExport";

export type InformeDoc = {
  numero: string;
  tipo: TipoInforme;
  titulo: string;
  fecha: string;
  inmueble: string;
  refCatastral: string | null;
  solicitante: string | null;
  perito: string | null;
  titulacion: string | null;
  colegiado: string | null;
  contenido: ContenidoInforme;
  fotos: { datos: string; pie: string }[];
};

/** Evita que un pie de foto con < o & rompa el documento generado. */
function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Respeta los saltos de línea del texto redactado, que llega en texto plano. */
function parrafos(texto: string) {
  return esc(texto)
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p style="text-align:justify;margin:0 0 8px">${p}</p>`)
    .join("");
}

function docHTML(inf: InformeDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const { apartados, partidas, dictamen } = inf.contenido;
  const total = pem(partidas);

  /**
   * Índice con números de página.
   *
   * Es un campo TOC de Word de verdad, no una lista escrita a mano: los números
   * de página no se pueden saber al generar el HTML porque dependen de cómo
   * pagine Word. El texto que va dentro es lo que se ve hasta que el usuario
   * actualiza el campo (clic derecho → Actualizar campos, o F9), momento en que
   * Word rellena las páginas reales.
   */
  const indice = `
  <h2 style="font-size:15px;margin:0 0 6px;border-bottom:1px solid #999;padding-bottom:3px;mso-outline-level:1">ÍNDICE</h2>
  <p style="font-size:11px;color:#555;margin:0 0 8px">
    Para los números de página: clic derecho sobre el índice y "Actualizar campos".
  </p>
  <p style="margin:0">
    <span style="mso-element:field-begin"></span> TOC \\o "1-2" \\h \\z \\u <span style="mso-element:field-separator"></span>
  </p>
  ${apartados
    .map((a) => `<p style="margin:0 0 3px">${esc(a.numero)}. ${esc(a.titulo)}</p>`)
    .join("")}
  <p style="margin:0 0 3px">PRESUPUESTO DE REPARACIÓN</p>
  ${dictamen ? `<p style="margin:0 0 3px">DICTAMEN</p>` : ""}
  ${inf.fotos.length ? `<p style="margin:0 0 3px">ANEXO FOTOGRÁFICO</p>` : ""}
  <p style="margin:0"><span style="mso-element:field-end"></span></p>
  <br style="mso-special-character:line-break;page-break-before:always" />`;

  const cuerpo = apartados
    .map((a) => {
      const subs = (a.subapartados || [])
        .map(
          (s, i) => `
      <h3 style="font-size:13px;margin:12px 0 4px;mso-outline-level:2">${esc(a.numero)}.${i + 1}. ${esc(s.titulo)}</h3>
      ${parrafos(s.texto)}`
        )
        .join("");
      return `
    <h2 style="font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px;mso-outline-level:1">${esc(a.numero)}. ${esc(a.titulo)}</h2>
    ${parrafos(a.texto)}${subs}`;
    })
    .join("");

  const filas = partidas.length
    ? partidas
        .map(
          (p) => `
      <tr>
        <td>${esc(p.codigo)}</td>
        <td>${esc(p.descripcion)}</td>
        <td style="text-align:center">${esc(p.unidad)}</td>
        <td style="text-align:right">${p.cantidad}</td>
        <td style="text-align:right">${eur(p.precio)}</td>
        <td style="text-align:right">${eur(importePartida(p))}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6">No se valoran partidas en este informe.</td></tr>`;

  // Las fotos son la prueba del informe: van con su número y su pie, para que el
  // texto pueda citarlas ("Imagen 3") y se puedan localizar.
  const anexoFotos = inf.fotos.length
    ? `
    <h2 style="font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px;mso-outline-level:1">ANEXO FOTOGRÁFICO</h2>
    ${inf.fotos
      .map(
        (f, i) => `
      <div style="margin:0 0 14px">
        <img src="${f.datos}" style="max-width:440px;border:1px solid #ccc" />
        <p style="font-size:11px;color:#444;margin:4px 0 0"><b>Imagen ${i + 1}.</b> ${esc(f.pie)}</p>
      </div>`
      )
      .join("")}`
    : "";

  const firmante = [inf.perito, inf.titulacion, inf.colegiado ? `Colegiado nº ${inf.colegiado}` : ""]
    .filter(Boolean)
    .join(" · ");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(inf.numero)}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#111">
  <table style="width:100%;margin-bottom:14px"><tr>
    <td>${empresa.logo ? `<img src="${empresa.logo}" style="max-height:56px" />` : `<b style="font-size:17px">${esc(empresa.nombre)}</b>`}</td>
    <td style="text-align:right;font-size:11px;color:#444">
      ${esc(empresa.nombre)}${empresa.cif ? ` · ${esc(empresa.cif)}` : ""}<br/>
      ${esc(empresa.direccion)}<br/>${esc(empresa.tel)} · ${esc(empresa.email)}
    </td>
  </tr></table>

  <h1 style="font-size:19px;text-align:center;margin:0 0 4px">${esc(inf.titulo)}</h1>
  <p style="text-align:center;font-size:11px;color:#555;margin:0 0 16px">
    ${esc(ETIQUETA_TIPO[inf.tipo])} · ${esc(inf.numero)} · ${esc(inf.fecha)}
  </p>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
    <tr><td style="border:1px solid #ccc;padding:5px;width:130px"><b>Inmueble</b></td><td style="border:1px solid #ccc;padding:5px">${esc(inf.inmueble)}</td></tr>
    ${inf.refCatastral ? `<tr><td style="border:1px solid #ccc;padding:5px"><b>Ref. catastral</b></td><td style="border:1px solid #ccc;padding:5px">${esc(inf.refCatastral)}</td></tr>` : ""}
    ${inf.solicitante ? `<tr><td style="border:1px solid #ccc;padding:5px"><b>Solicitante</b></td><td style="border:1px solid #ccc;padding:5px">${esc(inf.solicitante)}</td></tr>` : ""}
    ${cliente ? `<tr><td style="border:1px solid #ccc;padding:5px"><b>Cliente</b></td><td style="border:1px solid #ccc;padding:5px">${esc(cliente.nombre)}${cliente.nif ? ` · ${esc(cliente.nif)}` : ""}</td></tr>` : ""}
    ${firmante ? `<tr><td style="border:1px solid #ccc;padding:5px"><b>Técnico</b></td><td style="border:1px solid #ccc;padding:5px">${esc(firmante)}</td></tr>` : ""}
  </table>

  ${indice}

  ${cuerpo}

  <h2 style="font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px;mso-outline-level:1">PRESUPUESTO DE REPARACIÓN</h2>
  <table style="width:100%;border-collapse:collapse;font-size:11px" border="1" cellspacing="0" cellpadding="4">
    <thead><tr style="background:#eee">
      <th>Cód.</th><th>Descripción de la partida</th><th>Ud.</th><th>Cantidad</th><th>Precio</th><th>Importe</th>
    </tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr>
      <td colspan="5" style="text-align:right"><b>TOTAL EJECUCIÓN MATERIAL</b></td>
      <td style="text-align:right"><b>${eur(total)}</b></td>
    </tr></tfoot>
  </table>
  <p style="font-size:10px;color:#555;margin-top:4px">
    Presupuesto de ejecución material. No incluye gastos generales, beneficio industrial ni IVA.
  </p>

  ${dictamen ? `<h2 style="font-size:15px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px;mso-outline-level:1">DICTAMEN</h2>${parrafos(dictamen)}` : ""}

  ${anexoFotos}

  <div style="margin-top:36px">
    <p style="margin:0">En ${esc(empresa.direccion || "________")}, a ${esc(inf.fecha)}.</p>
    <p style="margin:44px 0 0">Fdo.: ${esc(inf.perito || "________________")}</p>
    <p style="margin:0;font-size:11px;color:#444">${esc([inf.titulacion, inf.colegiado ? `Colegiado nº ${inf.colegiado}` : ""].filter(Boolean).join(" · "))}</p>
  </div>
</body></html>`;
}

export function exportInformeWord(inf: InformeDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const blob = new Blob(["﻿" + docHTML(inf, cliente, empresa)], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${inf.numero}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportInformePDF(inf: InformeDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(docHTML(inf, cliente, empresa));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

/**
 * Excel en dos hojas: el presupuesto para trabajar con las mediciones, y el texto
 * del informe aparte. Meter ambos en una sola hoja hacía inservibles las fórmulas.
 */
export function exportInformeExcel(inf: InformeDoc) {
  const { partidas, apartados, dictamen } = inf.contenido;
  const total = pem(partidas);

  const filas = [
    ["Informe", inf.numero],
    ["Título", inf.titulo],
    ["Inmueble", inf.inmueble],
    ["Fecha", inf.fecha],
    [],
    ["Cód.", "Descripción de la partida", "Ud.", "Cantidad", "Precio", "Importe"],
    ...partidas.map((p) => [p.codigo, p.descripcion, p.unidad, p.cantidad, p.precio, importePartida(p)]),
    [],
    ["", "", "", "", "TOTAL EJECUCIÓN MATERIAL", total],
  ];
  const hojaPres = XLSX.utils.aoa_to_sheet(filas);
  hojaPres["!cols"] = [{ wch: 10 }, { wch: 64 }, { wch: 7 }, { wch: 11 }, { wch: 12 }, { wch: 14 }];

  const texto: string[][] = [["Apartado", "Contenido"]];
  apartados.forEach((a) => {
    texto.push([`${a.numero}. ${a.titulo}`, a.texto]);
    (a.subapartados || []).forEach((s, i) => texto.push([`${a.numero}.${i + 1}. ${s.titulo}`, s.texto]));
  });
  if (dictamen) texto.push(["DICTAMEN", dictamen]);
  const hojaTexto = XLSX.utils.aoa_to_sheet(texto);
  hojaTexto["!cols"] = [{ wch: 46 }, { wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaPres, "Presupuesto");
  XLSX.utils.book_append_sheet(wb, hojaTexto, "Informe");
  XLSX.writeFile(wb, `${inf.numero}.xlsx`);
}
