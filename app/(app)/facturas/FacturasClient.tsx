"use client";

import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { estadoClase, estadoLabel } from "@/lib/presupuesto";
import { exportFacturaPDF, exportFacturaWord, exportFacturaExcel, type FacturaDoc, type ClienteDoc } from "@/lib/docExport";
import { marcarFacturaPagada } from "./actions";

type Empresa = { nombre: string; cif: string; direccion: string; tel: string; email: string; logo: string | null };
type Factura = FacturaDoc & { id: string; estado: string; cliente: ClienteDoc };

export default function FacturasClient({ facturas, empresa }: { facturas: Factura[]; empresa: Empresa }) {
  const router = useRouter();

  // La acción devuelve el error en vez de lanzarlo: Next borra el mensaje de las
  // excepciones en producción y el usuario no vería por qué no se ha marcado.
  const marcarPagada = async (id: string) => {
    const r = await marcarFacturaPagada(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  return (
    <div className="card">
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>Facturas</h2>
      <table className="t">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Cliente</th>
            <th className="hidemob">Fecha</th>
            <th className="hidemob">Base</th>
            <th>Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((f) => (
            <tr key={f.id}>
              <td>{f.numero}</td>
              <td>{f.cliente?.nombre || "—"}</td>
              <td className="hidemob">{f.fecha}</td>
              <td className="hidemob">{eur(f.base)}</td>
              <td className="linetotal">{eur(f.total)}</td>
              <td><span className={`badge ${estadoClase(f.estado)}`}>{estadoLabel(f.estado)}</span></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn sm ghost" onClick={() => exportFacturaWord(f, f.cliente, empresa)}>Word</button>{" "}
                <button className="btn sm ghost" onClick={() => exportFacturaExcel(f)}>Excel</button>{" "}
                <button className="btn sm ghost" onClick={() => exportFacturaPDF(f, f.cliente, empresa)}>PDF</button>{" "}
                {f.estado === "PENDIENTE" && (
                  <button className="btn sm" onClick={() => marcarPagada(f.id)}>Marcar pagada</button>
                )}
              </td>
            </tr>
          ))}
          {!facturas.length && (
            <tr><td colSpan={7} className="hint">Sin facturas. Se crean desde un presupuesto aprobado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
