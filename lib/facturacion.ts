/**
 * Traspaso a facturación.
 *
 * POR QUÉ ESTA APLICACIÓN NO EMITE FACTURAS
 * ------------------------------------------
 * Emitir facturas en España es una actividad regulada. El Reglamento de
 * requisitos de los sistemas de facturación (Verifactu) obliga a que el software
 * genere registros encadenados e inalterables, incluya el QR y, si el fabricante
 * lo comercializa sin cumplirlo, la sanción es para el FABRICANTE: hasta 150.000 €
 * por año de ventas del producto. No es un desarrollo que se termina, es un
 * compromiso regulatorio permanente.
 *
 * Así que ReformaPro no factura. Prepara los datos y se los pasa al programa que
 * sí es un sistema de facturación —el que ya tiene el cliente, o el de su
 * gestoría—, y ese emite, numera y responde ante Hacienda.
 *
 * Lo que queda aquí es lo que ese programa NO sabe hacer: presupuestar obra,
 * medir, aplicar márgenes y llevar la ejecución. Es un reparto honesto y además
 * el que quieren los clientes, que ya tienen su programa de gestión con albaranes
 * y todo lo demás.
 *
 * Nada de lo que se genera aquí es una factura ni lo aparenta.
 */

export const AVISO_SIN_VALIDEZ_FISCAL =
  "Documento sin validez fiscal. No es una factura: es la propuesta con los datos para emitirla desde tu programa de facturación.";

export type LineaFactura = {
  concepto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
  precio: number;
  descuento: number;
};

export type ParteFactura = {
  nombre: string;
  nif: string;
  direccion: string;
  codigoPostal: string;
  poblacion: string;
  provincia: string;
};

export type PropuestaFactura = {
  numero: string;
  fecha: string;
  titulo: string | null;
  base: number;
  iva: number;
  total: number;
  lineas: LineaFactura[];
};

const dosDecimales = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Escapa lo que va dentro de un elemento XML. */
function esc(t: string): string {
  return String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function importeLineaFactura(l: LineaFactura): number {
  const bruto = l.cantidad * l.precio;
  return bruto - (bruto * (l.descuento || 0)) / 100;
}

/**
 * Qué falta para poder exportar a Facturae.
 *
 * Se comprueba ANTES de generar nada. Un XML al que le falta el código postal no
 * es "un XML un poco incompleto": el programa de destino lo rechaza entero, y el
 * usuario no tiene forma de saber por qué. Es preferible decirle exactamente qué
 * campo rellenar.
 */
export function faltaParaFacturae(emisor: ParteFactura, receptor: ParteFactura | null): string[] {
  const faltan: string[] = [];
  const revisar = (p: ParteFactura | null, quien: string) => {
    if (!p) return faltan.push(`${quien}: no hay datos`);
    if (!p.nombre?.trim()) faltan.push(`${quien}: nombre`);
    if (!p.nif?.trim()) faltan.push(`${quien}: NIF o CIF`);
    if (!p.direccion?.trim()) faltan.push(`${quien}: dirección`);
    if (!/^\d{5}$/.test((p.codigoPostal || "").trim())) faltan.push(`${quien}: código postal (5 dígitos)`);
    if (!p.poblacion?.trim()) faltan.push(`${quien}: población`);
    if (!p.provincia?.trim()) faltan.push(`${quien}: provincia`);
  };
  revisar(emisor, "Tu empresa");
  revisar(receptor, "El cliente");
  return faltan;
}

/**
 * Persona física o jurídica, deducido del NIF.
 *
 * Las letras iniciales A, B, C, D, E, F, G, H, J, N, P, Q, R, S, U, V y W son de
 * entidades; el resto (número inicial, o K, L, M, X, Y, Z) son personas físicas.
 * Es una deducción, no un dato: si el programa de destino se queja, se corrige
 * allí en un clic.
 */
function tipoDePersona(nif: string): "J" | "F" {
  return /^[ABCDEFGHJNPQRSUVW]/i.test(nif.trim()) ? "J" : "F";
}

/** Facturae quiere el identificador con el prefijo de país. */
function nifConPais(nif: string): string {
  const limpio = nif.replace(/[\s-]/g, "").toUpperCase();
  return /^ES/.test(limpio) ? limpio : `ES${limpio}`;
}

function bloqueParte(p: ParteFactura, etiqueta: "SellerParty" | "BuyerParty"): string {
  const tipo = tipoDePersona(p.nif);
  // Facturae separa entidad (LegalEntity) de persona física (Individual), y los
  // hijos no son los mismos: una lleva CorporateName y la otra nombre y apellidos.
  const identidad =
    tipo === "J"
      ? `<CorporateName>${esc(p.nombre)}</CorporateName>`
      : (() => {
          const partes = p.nombre.trim().split(/\s+/);
          const nombre = partes.shift() || p.nombre;
          return `<Name>${esc(nombre)}</Name><FirstSurname>${esc(partes.join(" ") || nombre)}</FirstSurname>`;
        })();

  return `<${etiqueta}>
      <TaxIdentification>
        <PersonTypeCode>${tipo}</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${esc(nifConPais(p.nif))}</TaxIdentificationNumber>
      </TaxIdentification>
      <${tipo === "J" ? "LegalEntity" : "Individual"}>
        ${identidad}
        <AddressInSpain>
          <Address>${esc(p.direccion)}</Address>
          <PostCode>${esc(p.codigoPostal.trim())}</PostCode>
          <Town>${esc(p.poblacion)}</Town>
          <Province>${esc(p.provincia)}</Province>
          <CountryCode>ESP</CountryCode>
        </AddressInSpain>
      </${tipo === "J" ? "LegalEntity" : "Individual"}>
    </${etiqueta}>`;
}

/**
 * Genera el XML en formato Facturae 3.2.2.
 *
 * VA SIN FIRMAR, y eso importa: para presentarlo a una administración pública
 * (FACe) tiene que ir firmado con certificado mediante XAdES, y eso lo hace el
 * programa de facturación del cliente, que es quien tiene el certificado y quien
 * responde de la emisión. Para importar los datos en ese programa, sin firma vale.
 *
 * El orden de los elementos NO es decorativo: el esquema de Facturae es una
 * secuencia y un elemento fuera de sitio invalida el archivo entero.
 *
 * El título de la obra va en `AdditionalData`, al final. Sin él, quien recibe el
 * archivo ve importes y conceptos pero no sabe de qué obra son, y en una empresa
 * con cuatro reformas abiertas eso obliga a preguntar.
 */
export function generarFacturae(
  propuesta: PropuestaFactura,
  emisor: ParteFactura,
  receptor: ParteFactura
): string {
  const base = Number(propuesta.base) || 0;
  const cuota = (Number(propuesta.total) || 0) - base;

  const lineas = propuesta.lineas.length
    ? propuesta.lineas
    : // Sin desglose se emite una sola línea por el total, que es lo que ocurre
      // cuando la propuesta viene de un presupuesto sin partidas.
      [
        {
          concepto: propuesta.titulo || "Servicios de reforma",
          descripcion: null,
          cantidad: 1,
          unidad: "pa",
          precio: base,
          descuento: 0,
        },
      ];

  const items = lineas
    .map((l) => {
      const importe = importeLineaFactura(l);
      const cuotaLinea = (importe * propuesta.iva) / 100;
      const descripcion = [l.concepto, l.descripcion].filter(Boolean).join(". ");
      return `      <InvoiceLine>
        <ItemDescription>${esc(descripcion.slice(0, 2500))}</ItemDescription>
        <Quantity>${dosDecimales(l.cantidad)}</Quantity>
        <UnitOfMeasure>01</UnitOfMeasure>
        <UnitPriceWithoutTax>${dosDecimales(l.precio)}</UnitPriceWithoutTax>
        <TotalCost>${dosDecimales(l.cantidad * l.precio)}</TotalCost>
        <GrossAmount>${dosDecimales(importe)}</GrossAmount>
        <TaxesOutputs>
          <Tax>
            <TaxTypeCode>01</TaxTypeCode>
            <TaxRate>${dosDecimales(propuesta.iva)}</TaxRate>
            <TaxableBase><TotalAmount>${dosDecimales(importe)}</TotalAmount></TaxableBase>
            <TaxAmount><TotalAmount>${dosDecimales(cuotaLinea)}</TotalAmount></TaxAmount>
          </Tax>
        </TaxesOutputs>
      </InvoiceLine>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml">
  <FileHeader>
    <SchemaVersion>3.2.2</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${esc(nifConPais(emisor.nif))}${esc(propuesta.numero)}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount><TotalAmount>${dosDecimales(propuesta.total)}</TotalAmount></TotalInvoicesAmount>
      <TotalOutstandingAmount><TotalAmount>${dosDecimales(propuesta.total)}</TotalAmount></TotalOutstandingAmount>
      <TotalExecutableAmount><TotalAmount>${dosDecimales(propuesta.total)}</TotalAmount></TotalExecutableAmount>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
    </Batch>
  </FileHeader>
  <Parties>
    ${bloqueParte(emisor, "SellerParty")}
    ${bloqueParte(receptor, "BuyerParty")}
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>${esc(propuesta.numero)}</InvoiceNumber>
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${esc(propuesta.fecha.slice(0, 10))}</IssueDate>
        <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
        <TaxCurrencyCode>EUR</TaxCurrencyCode>
        <LanguageName>es</LanguageName>
      </InvoiceIssueData>
      <TaxesOutputs>
        <Tax>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${dosDecimales(propuesta.iva)}</TaxRate>
          <TaxableBase><TotalAmount>${dosDecimales(base)}</TotalAmount></TaxableBase>
          <TaxAmount><TotalAmount>${dosDecimales(cuota)}</TotalAmount></TaxAmount>
        </Tax>
      </TaxesOutputs>
      <InvoiceTotals>
        <TotalGrossAmount>${dosDecimales(base)}</TotalGrossAmount>
        <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
        <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
        <TotalGrossAmountBeforeTaxes>${dosDecimales(base)}</TotalGrossAmountBeforeTaxes>
        <TotalTaxOutputs>${dosDecimales(cuota)}</TotalTaxOutputs>
        <TotalTaxesWithheld>0.00</TotalTaxesWithheld>
        <InvoiceTotal>${dosDecimales(propuesta.total)}</InvoiceTotal>
        <TotalOutstandingAmount>${dosDecimales(propuesta.total)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${dosDecimales(propuesta.total)}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>
${items}
      </Items>${
        propuesta.titulo
          ? `
      <AdditionalData>
        <InvoiceAdditionalInformation>${esc(`Obra: ${propuesta.titulo}`)}</InvoiceAdditionalInformation>
      </AdditionalData>`
          : ""
      }
    </Invoice>
  </Invoices>
</fe:Facturae>
`;
}

/**
 * Filas para el CSV de traspaso.
 *
 * Existe porque, en la práctica, la mayoría de los programas españoles de gestión
 * importan antes un CSV bien hecho que un Facturae. Es menos elegante y funciona
 * más veces, así que se ofrecen los dos.
 *
 * Una fila por LÍNEA, no por propuesta: así el programa de destino puede montar
 * el detalle, y quien solo quiera los totales agrupa por número.
 */
export function filasCSV(
  propuestas: (PropuestaFactura & { cliente: ParteFactura | null; estado: string })[]
): string[][] {
  const cabecera = [
    "Numero",
    "Fecha",
    "Obra",
    "Cliente",
    "NIF cliente",
    "Direccion",
    "Codigo postal",
    "Poblacion",
    "Provincia",
    "Concepto",
    "Descripcion",
    "Cantidad",
    "Unidad",
    "Precio unitario",
    "Descuento %",
    "Importe linea",
    "Base imponible",
    "IVA %",
    "Cuota IVA",
    "Total",
    "Cobrada",
  ];

  const filas: string[][] = [cabecera];
  for (const p of propuestas) {
    const lineas = p.lineas.length
      ? p.lineas
      : [
          {
            concepto: p.titulo || "Servicios de reforma",
            descripcion: null,
            cantidad: 1,
            unidad: "pa",
            precio: p.base,
            descuento: 0,
          },
        ];
    for (const l of lineas) {
      filas.push([
        p.numero,
        p.fecha.slice(0, 10),
        p.titulo || "",
        p.cliente?.nombre || "",
        p.cliente?.nif || "",
        p.cliente?.direccion || "",
        p.cliente?.codigoPostal || "",
        p.cliente?.poblacion || "",
        p.cliente?.provincia || "",
        l.concepto,
        l.descripcion || "",
        String(l.cantidad),
        l.unidad,
        dosDecimales(l.precio),
        String(l.descuento || 0),
        dosDecimales(importeLineaFactura(l)),
        dosDecimales(p.base),
        String(p.iva),
        dosDecimales(p.total - p.base),
        dosDecimales(p.total),
        p.estado === "PAGADA" ? "Si" : "No",
      ]);
    }
  }
  return filas;
}

/**
 * Convierte a texto CSV.
 *
 * Separador de PUNTO Y COMA y no coma: en España el separador decimal es la coma,
 * y Excel en configuración española espera punto y coma. Con coma, el archivo se
 * abre con todo metido en una sola columna y parece que la exportación no
 * funciona.
 */
export function aCSV(filas: string[][]): string {
  return filas
    .map((f) => f.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
}
