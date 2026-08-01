"use client";

import * as XLSX from "xlsx";
import { eur } from "@/lib/format";
import {
  importePartida,
  desglosePresupuesto,
  porCapitulos,
  ETIQUETA_TIPO,
  type ContenidoInforme,
  type TipoInforme,
} from "@/lib/informe";
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

/**
 * Etiquetas de informe técnico que van resaltadas al principio de su línea.
 *
 * Sin esto, "Ubicación: ... Patología: ... Causa origen: ..." salía todo seguido
 * en un párrafo corrido y no había forma de leerlo de un vistazo. Un informe se
 * consulta buscando el dato concreto, no se lee de corrido.
 */
const ETIQUETAS =
  /^(Ubicación|Ubicacion|Patología|Patologia|Efectos colaterales|Efectos|Causa origen|Causa|Evolución previsible|Evolución|Evolucion|Riesgo estructural|Riesgo físico|Riesgo concreto|Riesgo|Pérdida de capacidad portante|Justificación|Justificacion|Apeo preventivo|Saneado e inhibición|Saneado|Regeneración base|Alcance|Metodología|Observaciones|Conclusión|NIVEL DE GRAVEDAD)\s*:/i;

/**
 * Convierte el texto plano en párrafos legibles.
 *
 * Una línea del tipo "Etiqueta: contenido" se pinta con la etiqueta en negrita y
 * sangría francesa, para que al hojear el informe se encuentre el dato buscado.
 * El nivel de gravedad, además, va destacado: es lo primero que mira quien lee.
 */
function parrafos(texto: string) {
  return esc(texto)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(ETIQUETAS);
      if (!m) return `<p style="text-align:justify;margin:0 0 8px">${p}</p>`;

      const etiqueta = p.slice(0, m[0].length).replace(/:\s*$/, "");
      const resto = p.slice(m[0].length).trim();
      const gravedad = /NIVEL DE GRAVEDAD/i.test(etiqueta);

      return `<p style="text-align:justify;margin:0 0 5px;padding-left:14px;text-indent:-14px${
        gravedad ? ";font-size:13px" : ""
      }"><b>${etiqueta}:</b> ${gravedad ? `<b>${resto}</b>` : resto}</p>`;
    })
    .join("");
}

/**
 * @param paraWord El campo de índice de Word solo se pone al exportar a Word.
 *   En PDF (que se genera imprimiendo desde el navegador) ese campo no existe y
 *   se imprimía tal cual: el informe entregado salía con `TOC \\o "1-2" \\h \\z \\u`
 *   escrito en medio de la página. Pasó en un informe real.
 */
/**
 * Nombre del capítulo a partir de la primera partida que lo abre.
 *
 * La IA no da un título de capítulo aparte, así que se toma la primera partida y
 * se recorta por la primera coma o paréntesis: "Apuntalamiento de forjado con
 * puntales metálicos y tablones" queda como "Apuntalamiento de forjado".
 */
function nombreCapitulo(primeraDescripcion: string) {
  const corte = primeraDescripcion.split(/[,(]/)[0].trim();
  return (corte.length > 12 ? corte : primeraDescripcion).slice(0, 70).toUpperCase();
}

function docHTML(inf: InformeDoc, cliente: ClienteDoc, empresa: EmpresaDoc, paraWord: boolean) {
  const { apartados, partidas, dictamen } = inf.contenido;
  const desglose = desglosePresupuesto(partidas);

  const entradas = [
    ...apartados.map((a) => `${esc(a.numero)}. ${esc(a.titulo)}`),
    "PRESUPUESTO DE REPARACIÓN",
    ...(dictamen ? ["DICTAMEN"] : []),
    ...(inf.fotos.length ? ["ANEXO FOTOGRÁFICO"] : []),
  ];
  const lista = entradas.map((t) => `<p style="margin:0 0 3px">${t}</p>`).join("");

  /**
   * En Word va un campo TOC de verdad, porque los números de página dependen de
   * cómo pagine Word y no se pueden saber al generar el HTML. En PDF va la lista
   * a secas: sin número de página, pero legible y sin códigos a la vista.
   */
  const indice = `
  <h2 style="font-size:15px;margin:0 0 6px;border-bottom:1px solid #999;padding-bottom:3px;mso-outline-level:1">ÍNDICE</h2>
  ${
    paraWord
      ? `<p style="font-size:11px;color:#555;margin:0 0 8px">
    Para los números de página: clic derecho sobre el índice y "Actualizar campos".
  </p>
  <p style="margin:0">
    <span style="mso-element:field-begin"></span> TOC \\o "1-2" \\h \\z \\u <span style="mso-element:field-separator"></span>
  </p>
  ${lista}
  <p style="margin:0"><span style="mso-element:field-end"></span></p>`
      : lista
  }
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

  /**
   * El presupuesto va agrupado por capítulos, con su fila de cabecera y su
   * subtotal, como cualquier presupuesto de obra. Una lista plana de quince
   * partidas seguidas no deja ver de dónde sale el dinero.
   */
  const grupos = porCapitulos(partidas);
  const filas = partidas.length
    ? grupos
        .map((g) => {
          const titulo = g.lineas[0]?.descripcion || "";
          const lineas = g.lineas
            .map(
              (p) => `
      <tr${p.opcional ? ' style="color:#444"' : ""}>
        <td>${esc(p.codigo)}</td>
        <td>${p.opcional ? "<i>Opcional:</i> " : ""}${esc(p.descripcion)}</td>
        <td style="text-align:center">${esc(p.unidad)}</td>
        <td style="text-align:right">${p.cantidad}</td>
        <td style="text-align:right">${eur(p.precio)}</td>
        <td style="text-align:right">${eur(importePartida(p))}</td>
      </tr>`
            )
            .join("");

          return `
      <tr style="background:#f2f2f2">
        <td><b>${esc(g.codigo)}</b></td>
        <td colspan="5"><b>${esc(nombreCapitulo(titulo))}</b></td>
      </tr>${lineas}
      <tr>
        <td></td>
        <td colspan="4" style="text-align:right;font-size:10px">Subtotal capítulo ${esc(g.codigo)}${g.subtotalOpcional ? " (sin opcionales)" : ""}</td>
        <td style="text-align:right;font-size:10px"><b>${eur(g.subtotal)}</b></td>
      </tr>`;
        })
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
      <td colspan="5" style="text-align:right"><b>PRESUPUESTO DE EJECUCIÓN MATERIAL</b></td>
      <td style="text-align:right"><b>${eur(desglose.ejecucionMaterial)}</b></td>
    </tr></tfoot>
  </table>

  <h3 style="font-size:13px;margin:14px 0 4px;mso-outline-level:2">Resumen por capítulos</h3>
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    ${grupos
      .map(
        (g) => `<tr>
      <td style="padding:3px 4px">Capítulo ${esc(g.codigo)} · ${esc(nombreCapitulo(g.lineas[0]?.descripcion || ""))}</td>
      <td style="padding:3px 4px;text-align:right;width:110px">${eur(g.subtotal)}</td>
    </tr>`
      )
      .join("")}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:10px">
    <tr><td style="padding:3px 4px;text-align:right">Gastos generales (${desglose.porcentajeGG} %)</td><td style="padding:3px 4px;text-align:right;width:110px">${eur(desglose.gastosGenerales)}</td></tr>
    <tr><td style="padding:3px 4px;text-align:right">Beneficio industrial (${desglose.porcentajeBI} %)</td><td style="padding:3px 4px;text-align:right">${eur(desglose.beneficio)}</td></tr>
    <tr><td style="padding:3px 4px;text-align:right;border-top:1px solid #999"><b>Presupuesto de ejecución por contrata</b></td><td style="padding:3px 4px;text-align:right;border-top:1px solid #999"><b>${eur(desglose.contrata)}</b></td></tr>
    <tr><td style="padding:3px 4px;text-align:right">IVA (${desglose.iva} %)</td><td style="padding:3px 4px;text-align:right">${eur(desglose.importeIva)}</td></tr>
    <tr><td style="padding:6px 4px;text-align:right;border-top:2px solid #111;font-size:14px"><b>TOTAL PARA EL CLIENTE</b></td><td style="padding:6px 4px;text-align:right;border-top:2px solid #111;font-size:14px"><b>${eur(desglose.total)}</b></td></tr>
  </table>

  ${
    desglose.hayOpcionales
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;color:#444">
    <tr><td style="padding:3px 4px;text-align:right">Partidas opcionales (ejecución material)</td><td style="padding:3px 4px;text-align:right;width:110px">${eur(desglose.opcional)}</td></tr>
    <tr><td style="padding:3px 4px;text-align:right"><b>Total si se incluyen las opcionales</b></td><td style="padding:3px 4px;text-align:right"><b>${eur(desglose.totalConOpcional)}</b></td></tr>
  </table>
  <p style="font-size:10px;color:#555;margin-top:2px">
    Las partidas marcadas como opcionales son mejoras recomendables que no son necesarias para resolver la
    patología descrita. No están incluidas en el total anterior.
  </p>`
      : ""
  }
  <p style="font-size:10px;color:#555;margin-top:4px">
    Valoración orientativa a precios de mercado, sujeta a comprobación una vez abiertas las catas y descubiertos
    los elementos afectados. No constituye oferta contractual.
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
  const blob = new Blob(["﻿" + docHTML(inf, cliente, empresa, true)], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${inf.numero}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportInformePDF(inf: InformeDoc, cliente: ClienteDoc, empresa: EmpresaDoc) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(docHTML(inf, cliente, empresa, false));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

/**
 * Excel en dos hojas: el presupuesto para trabajar con las mediciones, y el texto
 * del informe aparte. Meter ambos en una sola hoja hacía inservibles las fórmulas.
 */
export function exportInformeExcel(inf: InformeDoc) {
  const { partidas, apartados, dictamen } = inf.contenido;
  const desglose = desglosePresupuesto(partidas);

  const filas = [
    ["Informe", inf.numero],
    ["Título", inf.titulo],
    ["Inmueble", inf.inmueble],
    ["Fecha", inf.fecha],
    [],
    ["Cód.", "Descripción de la partida", "Ud.", "Cantidad", "Precio", "Importe"],
    ...partidas.map((p) => [
      p.codigo,
      (p.opcional ? "OPCIONAL · " : "") + p.descripcion,
      p.unidad,
      p.cantidad,
      p.precio,
      importePartida(p),
    ]),
    [],
    ["", "", "", "", "Ejecución material (sin opcionales)", desglose.ejecucionMaterial],
    ["", "", "", "", `Gastos generales (${desglose.porcentajeGG} %)`, desglose.gastosGenerales],
    ["", "", "", "", `Beneficio industrial (${desglose.porcentajeBI} %)`, desglose.beneficio],
    ["", "", "", "", "Ejecución por contrata", desglose.contrata],
    ["", "", "", "", `IVA (${desglose.iva} %)`, desglose.importeIva],
    ["", "", "", "", "TOTAL PARA EL CLIENTE", desglose.total],
    ...(desglose.hayOpcionales
      ? [
          [],
          ["", "", "", "", "Partidas opcionales (ejecución material)", desglose.opcional],
          ["", "", "", "", "TOTAL CON OPCIONALES", desglose.totalConOpcional],
        ]
      : []),
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
