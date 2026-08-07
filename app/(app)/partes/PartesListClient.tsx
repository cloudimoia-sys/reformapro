"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { estadoParteClase, estadoParteLabel } from "@/lib/parteTrabajo";
import { exportExcelPartes } from "@/lib/parteExport";
import { crearParteBlanco, borrarParte } from "./actions";

type Fila = {
  id: string;
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
  fotos: number;
};

export default function PartesListClient({
  partes,
  isAdmin,
}: {
  partes: Fila[];
  clientes: { id: string; nombre: string }[];
  obras: { id: string; nombre: string }[];
  tecnicoPorDefecto: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);

  /**
   * Sin asistente de IA a propósito. En un presupuesto la IA propone partidas
   * porque hay algo que estimar; en un parte de trabajo no hay nada que
   * estimar, solo lo que el técnico ha hecho y el material que ha puesto — y
   * eso solo lo sabe él. La acción crea el parte en blanco y entra directo al
   * editor.
   */
  const nuevoParte = async () => {
    setCreando(true);
    await crearParteBlanco();
    // crearParteBlanco redirige; si llega aquí es que ha fallado sin lanzar
    // (no debería, pero se suelta el botón por si acaso).
    setCreando(false);
  };

  const borrar = async (id: string, numero: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!window.confirm(`¿Eliminar el parte ${numero}? Se borrarán también sus líneas y fotos.`)) return;
    const r = await borrarParte(id);
    if (r && !r.ok) window.alert(r.error);
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Partes de trabajo</h2>
        <div className="spacer" />
        {!!partes.length && (
          <button className="btn sm ghost" onClick={() => exportExcelPartes(partes, `partes-de-trabajo-${new Date().toISOString().slice(0, 10)}.xlsx`)}>
            Exportar todo a Excel
          </button>
        )}
        <button className="btn amber" disabled={creando} onClick={nuevoParte}>
          + Nuevo parte
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Horas, trabajo hecho y material puesto en cada visita. El material lo rellena el técnico: nadie más sabe lo
        que ha usado. Si ya está en tu catálogo, se coge de ahí con su precio.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="t" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Parte</th>
              <th className="hidemob">Cliente</th>
              <th className="hidemob">Obra</th>
              <th className="hidemob">Técnico</th>
              <th className="hidemob">Fecha</th>
              <th>Horas</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partes.map((x) => (
              <tr key={x.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/partes/${x.id}`)}>
                <td>{x.numero}</td>
                <td>
                  {x.titulo}
                  {x.fotos > 0 && <span className="hint"> · {x.fotos} foto{x.fotos > 1 ? "s" : ""}</span>}
                  {x.codigoErp && <span className="hint"> · ERP {x.codigoErp}</span>}
                </td>
                <td className="hidemob">{x.clienteNombre}</td>
                <td className="hidemob">{x.obraNombre}</td>
                <td className="hidemob">{x.tecnico || "—"}</td>
                <td className="hidemob">{x.fecha}</td>
                <td>{x.horas ? `${x.horas} h` : "—"}</td>
                <td className="linetotal">{eur(x.total)}</td>
                <td>
                  <span className={`badge ${estadoParteClase(x.estado)}`}>{estadoParteLabel(x.estado)}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  {isAdmin && (
                    <button className="btn sm red" onClick={(e) => borrar(x.id, x.numero, e)}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!partes.length && (
              <tr>
                <td colSpan={10} className="hint">
                  Sin partes todavía. Crea el primero después de una visita.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
