"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { estadoClase, estadoLabel } from "@/lib/presupuesto";
import {
  exportFacturaPDF,
  exportFacturaWord,
  exportFacturaExcel,
  exportFacturae,
  exportCSVFacturacion,
  type ClienteDoc,
  type EmpresaDoc,
  type LineaDoc,
} from "@/lib/docExport";
import type { ParteFactura } from "@/lib/facturacion";
import { marcarFacturaPagada } from "./actions";

type Propuesta = {
  id: string;
  numero: string;
  fecha: string;
  titulo: string | null;
  base: number;
  iva: number;
  total: number;
  estado: string;
  cliente: ParteFactura | null;
  lineas: LineaDoc[];
};

/**
 * Traspaso a facturación.
 *
 * ReformaPro NO emite facturas: emitirlas es una actividad regulada (Verifactu) y
 * la sanción por comercializar software no conforme recae sobre el fabricante.
 * Lo que hay aquí son PROPUESTAS con los datos listos para que las emita el
 * programa de facturación que el cliente ya tiene.
 *
 * La pantalla lo dice, y el PDF lleva el aviso impreso: si solo estuviera escrito
 * aquí, alguien acabaría entregándole el PDF a un cliente creyendo que es la
 * factura.
 */
export default function FacturasClient({
  propuestas,
  emisor,
  empresa,
}: {
  propuestas: Propuesta[];
  emisor: ParteFactura;
  empresa: EmpresaDoc;
}) {
  const router = useRouter();
  const [faltan, setFaltan] = useState<string[]>([]);

  // La acción devuelve el error en vez de lanzarlo: Next borra el mensaje de las
  // excepciones en producción y el usuario no vería por qué no se ha marcado.
  const marcarCobrada = async (id: string) => {
    const r = await marcarFacturaPagada(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  const comoDoc = (p: Propuesta) => ({
    numero: p.numero,
    fecha: p.fecha,
    titulo: p.titulo,
    base: p.base,
    iva: p.iva,
    total: p.total,
    lineas: p.lineas,
  });

  const comoClienteDoc = (p: Propuesta): ClienteDoc =>
    p.cliente ? { nombre: p.cliente.nombre, direccion: p.cliente.direccion, nif: p.cliente.nif } : null;

  const descargarFacturae = (p: Propuesta) => setFaltan(exportFacturae(comoDoc(p), emisor, p.cliente));

  const descargarTodo = () => {
    if (!propuestas.length) return;
    exportCSVFacturacion(
      propuestas.map((p) => ({ ...comoDoc(p), cliente: p.cliente, estado: p.estado })),
      `facturacion-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const pendiente = propuestas.filter((p) => p.estado !== "PAGADA").reduce((s, p) => s + p.total, 0);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Facturación</h2>
        <div className="spacer" />
        {!!propuestas.length && (
          <button className="btn amber" onClick={descargarTodo}>
            Exportar todo a CSV
          </button>
        )}
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        Aquí no se emiten facturas: <strong>se preparan</strong>. Emitirlas es una actividad regulada y la hace tu
        programa de facturación o tu gestoría, que son quienes numeran, guardan el registro y responden ante Hacienda.
        ReformaPro pone el trabajo medido y valorado, y te lo exporta para que lo importen sin teclear nada.
      </p>

      {!!faltan.length && (
        <div
          style={{
            background: "#FCF0D8",
            border: "1px solid #EBD9A8",
            color: "#7A5A10",
            borderRadius: 8,
            padding: "10px 14px",
            margin: "0 0 12px",
          }}
        >
          <strong>Para exportar a Facturae faltan estos datos:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {faltan.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>
            Los de tu empresa se rellenan en <a href="/empresa">Mi empresa</a>; los del cliente, en su ficha. El CSV y
            el PDF funcionan igualmente sin ellos.
          </p>
        </div>
      )}

      {!!propuestas.length && (
        <p className="hint" style={{ marginTop: 0 }}>
          Pendiente de cobro: <strong>{eur(pendiente)}</strong>
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="t" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cliente</th>
              <th className="hidemob">Fecha</th>
              <th className="hidemob">Base</th>
              <th>Total</th>
              <th>Cobro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {propuestas.map((p) => (
              <tr key={p.id}>
                <td>{p.numero}</td>
                <td>{p.cliente?.nombre || "—"}</td>
                <td className="hidemob">{p.fecha}</td>
                <td className="hidemob">{eur(p.base)}</td>
                <td className="linetotal">{eur(p.total)}</td>
                <td>
                  <span className={`badge ${estadoClase(p.estado)}`}>{estadoLabel(p.estado)}</span>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn sm" onClick={() => descargarFacturae(p)} title="XML estándar para importar">
                    Facturae
                  </button>{" "}
                  <button className="btn sm ghost" onClick={() => exportFacturaExcel(comoDoc(p))}>
                    Excel
                  </button>{" "}
                  <button
                    className="btn sm ghost"
                    onClick={() => exportFacturaPDF(comoDoc(p), comoClienteDoc(p), empresa)}
                  >
                    PDF
                  </button>{" "}
                  <button
                    className="btn sm ghost"
                    onClick={() => exportFacturaWord(comoDoc(p), comoClienteDoc(p), empresa)}
                  >
                    Word
                  </button>{" "}
                  {p.estado !== "PAGADA" && (
                    <button className="btn sm" onClick={() => marcarCobrada(p.id)}>
                      Marcar cobrada
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!propuestas.length && (
              <tr>
                <td colSpan={7} className="hint">
                  Nada pendiente de facturar. Las propuestas se crean desde un presupuesto aprobado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="hint" style={{ marginTop: 10 }}>
        <strong>Facturae</strong> es el formato XML estándar en España y lo importan casi todos los programas de
        gestión. Va sin firma electrónica a propósito: la firma la pone quien emite la factura, con su certificado.{" "}
        <strong>CSV</strong> es más burdo y funciona más veces — si tu programa se atraganta con el XML, tira de ese.
      </p>
    </div>
  );
}
