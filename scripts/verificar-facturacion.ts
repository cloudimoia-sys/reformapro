/**
 * Comprueba el traspaso a facturación.
 *
 * Dos cosas se prueban aquí, y las dos importan por motivos distintos:
 *
 *  1. Que NADA de lo que sale se presente como una factura. Emitir facturas es
 *     una actividad regulada y la sanción por comercializar software no conforme
 *     recae sobre el fabricante, hasta 150.000 € por año de ventas. Un titular
 *     mal puesto en un PDF no es un detalle de redacción.
 *
 *  2. Que el XML cuadre. Un Facturae con los totales descuadrados o un elemento
 *     fuera de orden lo rechaza el programa de destino entero, sin decir por qué,
 *     y el usuario concluye que la exportación no sirve.
 *
 * Ejecutar con: npx tsx scripts/verificar-facturacion.ts
 */
import { readFileSync } from "node:fs";
import {
  AVISO_SIN_VALIDEZ_FISCAL,
  aCSV,
  faltaParaFacturae,
  filasCSV,
  generarFacturae,
  importeLineaFactura,
  type ParteFactura,
  type PropuestaFactura,
} from "../lib/facturacion";

let fallos = 0;
const mal = (que: string, detalle: string) => {
  fallos++;
  console.log(`  MAL  ${que}: ${detalle}`);
};
const bien = (que: string) => console.log(`  ok   ${que}`);

const EMISOR: ParteFactura = {
  nombre: "Reformas García S.L.",
  nif: "B12345674",
  direccion: "Calle Mayor 4",
  codigoPostal: "28013",
  poblacion: "Madrid",
  provincia: "Madrid",
};

const CLIENTE: ParteFactura = {
  nombre: "Ana López Ruiz",
  nif: "12345678Z",
  direccion: "Avenida del Puerto 22, 3º B",
  codigoPostal: "46023",
  poblacion: "Valencia",
  provincia: "Valencia",
};

const PROPUESTA: PropuestaFactura = {
  numero: "ALB-2026-004",
  fecha: "2026-08-02",
  titulo: 'Reforma de baño "El Pinar" & anexo',
  base: 4000,
  iva: 21,
  total: 4840,
  lineas: [
    { concepto: "Demolición de alicatado", descripcion: "Incluye retirada", cantidad: 20, unidad: "m²", precio: 16, descuento: 0 },
    { concepto: "Solado de gres porcelánico", descripcion: null, cantidad: 20, unidad: "m²", precio: 38, descuento: 10 },
    { concepto: "Sustitución de plato de ducha", descripcion: null, cantidad: 1, unidad: "ud", precio: 330, descuento: 0 },
  ],
};

// ─────────────────── Nada puede presentarse como factura ───────────────────
console.log("\nNada se presenta como factura");

const xml = generarFacturae(PROPUESTA, EMISOR, CLIENTE);
const csv = aCSV(filasCSV([{ ...PROPUESTA, cliente: CLIENTE, estado: "PENDIENTE" }]));

if (!/sin validez fiscal/i.test(AVISO_SIN_VALIDEZ_FISCAL)) {
  mal("aviso", "no dice que el documento no tiene validez fiscal");
} else {
  bien("existe un aviso explícito de que no es una factura");
}
// Y además dice qué SÍ es. "No es una factura" a secas deja al que lo recibe
// sin saber qué hacer con el papel; nombrarlo albarán le dice que lo pase a
// factura como lleva años haciendo.
if (!/albar[áa]n/i.test(AVISO_SIN_VALIDEZ_FISCAL)) {
  mal("aviso", "no explica que es el equivalente a un albarán, que es lo que sabe manejar quien factura");
} else {
  bien("el aviso dice qué es, no solo qué no es: un albarán para quien emite la factura");
}

/*
 * El prefijo de la serie se comprueba sobre el código, no sobre este fixture.
 *
 * Antes se miraba `PROPUESTA.numero`, que es una constante de esta misma prueba:
 * pasaba siempre, dijera lo que dijera `lib/counter.ts`. Se lee el fichero como
 * texto a propósito, para no arrastrar el cliente de base de datos que importa
 * `counter.ts` solo por leer una tabla de tres prefijos.
 */
const fuenteCounter = readFileSync(new URL("../lib/counter.ts", import.meta.url), "utf8");
const prefijoFactura = fuenteCounter.match(/factura:\s*"([A-Z]+)"/)?.[1];
if (!prefijoFactura) mal("numeración", "no encuentro el prefijo de la serie en lib/counter.ts");
else if (prefijoFactura === "FAC") mal("numeración", 'la serie empieza por "FAC", que se lee como serie fiscal de facturas');
else bien(`la serie del traspaso usa el prefijo "${prefijoFactura}", que no se lee como serie de facturas`);

// ─────────────────────────── Datos que faltan ───────────────────────────
console.log("\nSe avisa de lo que falta antes de generar nada");

if (faltaParaFacturae(EMISOR, CLIENTE).length) {
  mal("datos completos", faltaParaFacturae(EMISOR, CLIENTE).join(", "));
} else {
  bien("con todos los datos, no se avisa de nada");
}

const sinCP = faltaParaFacturae({ ...EMISOR, codigoPostal: "" }, CLIENTE);
if (!sinCP.some((f) => /código postal/i.test(f))) mal("falta el CP", "no se detecta");
else bien("sin código postal, se dice exactamente qué falta");

const cpMalo = faltaParaFacturae({ ...EMISOR, codigoPostal: "2801" }, CLIENTE);
if (!cpMalo.length) mal("CP de 4 dígitos", "se da por bueno");
else bien("un código postal de 4 dígitos no cuela");

if (!faltaParaFacturae(EMISOR, null).length) mal("sin cliente", "no se avisa");
else bien("una propuesta sin cliente no se puede exportar y se explica");

// ─────────────────────────── El XML ───────────────────────────
console.log("\nEl XML de Facturae");

if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) mal("cabecera XML", "falta la declaración");
else bien("declaración XML correcta");

if (!xml.includes("<SchemaVersion>3.2.2</SchemaVersion>")) mal("versión", "no declara 3.2.2");
else bien("declara la versión 3.2.2 del esquema");

/**
 * El orden de los elementos no es decorativo: el esquema es una secuencia y uno
 * fuera de sitio invalida el archivo entero.
 */
const ORDEN = [
  "FileHeader",
  "SchemaVersion",
  "Modality",
  "InvoiceIssuerType",
  "Batch",
  "Parties",
  "SellerParty",
  "BuyerParty",
  "Invoices",
  "InvoiceHeader",
  "InvoiceIssueData",
  "TaxesOutputs",
  "InvoiceTotals",
  "Items",
];
let pos = -1;
let ordenOk = true;
for (const etiqueta of ORDEN) {
  const i = xml.indexOf(`<${etiqueta}>`);
  if (i < 0) {
    mal("orden de elementos", `falta <${etiqueta}>`);
    ordenOk = false;
    break;
  }
  if (i < pos) {
    mal("orden de elementos", `<${etiqueta}> aparece antes de lo que debe`);
    ordenOk = false;
    break;
  }
  pos = i;
}
if (ordenOk) bien(`los ${ORDEN.length} bloques van en el orden que exige el esquema`);

// Toda etiqueta abierta tiene que cerrarse.
const abiertas = (xml.match(/<([A-Za-z][\w.]*)>/g) || []).map((t) => t.slice(1, -1));
const cerradas = (xml.match(/<\/([A-Za-z][\w.]*)>/g) || []).map((t) => t.slice(2, -1));
const descuadre = abiertas.filter((t) => abiertas.filter((x) => x === t).length !== cerradas.filter((x) => x === t).length);
if (descuadre.length) mal("etiquetas", `sin cerrar: ${[...new Set(descuadre)].join(", ")}`);
else bien("todas las etiquetas abren y cierran");

/**
 * El título de la obra tiene que llegar al archivo.
 *
 * La primera versión no lo incluía: quien lo importaba veía importes y conceptos
 * pero no de qué obra eran, y con cuatro reformas abiertas eso obliga a
 * preguntar. Va en AdditionalData, que es el sitio que le da el esquema.
 */
if (!xml.includes("<InvoiceAdditionalInformation>")) {
  mal("obra", "el título de la obra no llega al XML");
} else if (!xml.includes("Obra: ")) {
  mal("obra", "AdditionalData está pero sin el título");
} else {
  bien("el título de la obra viaja en AdditionalData");
}

// Los caracteres especiales del título tienen que ir escapados o el XML no parsea.
if (xml.includes('"El Pinar" & anexo')) mal("escapado", "las comillas y el & van sin escapar");
else if (!xml.includes("&amp;") || !xml.includes("&quot;")) mal("escapado", "el & o las comillas no se escapan");
else bien("las comillas y los & del texto van escapados");

// Cuadre de totales: base + cuota = total, y la suma de líneas = base.
const num = (etiqueta: string) => Number(xml.match(new RegExp(`<${etiqueta}>([\\d.]+)</${etiqueta}>`))?.[1] ?? NaN);
const totalDeclarado = num("InvoiceTotal");
const baseDeclarada = num("TotalGrossAmountBeforeTaxes");
const cuotaDeclarada = num("TotalTaxOutputs");
if (Math.abs(baseDeclarada + cuotaDeclarada - totalDeclarado) > 0.01) {
  mal("cuadre", `${baseDeclarada} + ${cuotaDeclarada} != ${totalDeclarado}`);
} else {
  bien(`los totales cuadran: ${baseDeclarada} + ${cuotaDeclarada} = ${totalDeclarado}`);
}

const sumaLineas = PROPUESTA.lineas.reduce((s, l) => s + importeLineaFactura(l), 0);
const enElXml = (xml.match(/<GrossAmount>([\d.]+)<\/GrossAmount>/g) || [])
  .map((t) => Number(t.replace(/\D+([\d.]+)\D+/, "$1")))
  .reduce((s, n) => s + n, 0);
if (Math.abs(sumaLineas - enElXml) > 0.02) mal("líneas", `suman ${enElXml} y deberían sumar ${sumaLineas.toFixed(2)}`);
else bien(`las ${PROPUESTA.lineas.length} líneas suman lo mismo dentro y fuera del XML`);

// El descuento de la segunda línea tiene que estar aplicado.
if (!xml.includes("<GrossAmount>684.00</GrossAmount>")) {
  mal("descuento", "la línea con 10% de descuento no lo refleja (20 × 38 − 10% = 684,00)");
} else {
  bien("el descuento del 10% se aplica en la línea");
}

// Persona física y jurídica se codifican distinto y con hijos distintos.
if (!xml.includes("<PersonTypeCode>J</PersonTypeCode>") || !xml.includes("<CorporateName>")) {
  mal("emisor", "la S.L. no se codifica como persona jurídica");
} else {
  bien("la S.L. sale como persona jurídica con CorporateName");
}
if (!xml.includes("<PersonTypeCode>F</PersonTypeCode>") || !xml.includes("<FirstSurname>")) {
  mal("receptor", "el particular no se codifica como persona física");
} else {
  bien("el particular sale como persona física con nombre y apellidos");
}
if (!xml.includes("<TaxIdentificationNumber>ESB12345674</TaxIdentificationNumber>")) {
  mal("NIF", "no lleva el prefijo ES que pide Facturae");
} else {
  bien("los NIF llevan el prefijo ES");
}

// Sin líneas, se emite una sola por el total: es el caso del presupuesto sin partidas.
const sinLineas = generarFacturae({ ...PROPUESTA, lineas: [] }, EMISOR, CLIENTE);
if ((sinLineas.match(/<InvoiceLine>/g) || []).length !== 1) {
  mal("sin partidas", "no genera la línea única por el total");
} else {
  bien("una propuesta sin partidas genera una línea única por el total");
}

// ─────────────────────────── El CSV ───────────────────────────
console.log("\nEl CSV de traspaso");

const filas = csv.split("\r\n");
if (filas.length !== PROPUESTA.lineas.length + 1) {
  mal("filas", `${filas.length} filas para ${PROPUESTA.lineas.length} líneas más cabecera`);
} else {
  bien(`una fila por línea más la cabecera (${filas.length})`);
}
// Punto y coma: con coma, Excel en español mete todo en una columna y parece roto.
if (!filas[0].includes(";") || filas[0].includes('","')) {
  mal("separador", "no usa punto y coma");
} else {
  bien("separa por punto y coma, que es lo que espera Excel en español");
}
if (!/Codigo postal/.test(filas[0]) || !/NIF cliente/.test(filas[0])) {
  mal("columnas", "faltan datos que el programa de gestión necesita");
} else {
  bien("lleva NIF y dirección completa del cliente");
}
// Las comillas dentro del texto se duplican, o el CSV se parte.
if (!csv.includes('""El Pinar""')) mal("comillas", "no se escapan duplicándolas");
else bien("las comillas del texto se escapan duplicándolas");

console.log(
  fallos
    ? `\nFACTURACIÓN INCORRECTA — ${fallos} ${fallos === 1 ? "fallo" : "fallos"}`
    : "\nFACTURACIÓN CORRECTA — nada se presenta como factura, el XML cuadra y el CSV se abre bien"
);
process.exit(fallos ? 1 : 0);
