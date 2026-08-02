"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fallo } from "@/lib/accion";
import { crearObra, crearObraDesdePresupuesto, borrarObra } from "./actions";

type Fila = {
  id: string;
  nombre: string;
  direccion: string;
  clienteNombre: string;
  estado: string;
  inicio: string;
  fin: string;
  fases: number;
  diasLaborables: number;
};

const CLASE_ESTADO: Record<string, string> = {
  PLANIFICADA: "b-borrador",
  EN_CURSO: "b-enviado",
  PARADA: "b-pendiente",
  TERMINADA: "b-aprobado",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  PLANIFICADA: "Planificada",
  EN_CURSO: "En curso",
  PARADA: "Parada",
  TERMINADA: "Terminada",
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** "2026-09-14" → "14/09/2026". Un reformista no lee fechas ISO. */
export const enCastellano = (iso: string) => {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export default function ObrasListClient({
  obras,
  clientes,
  presupuestos,
  isAdmin,
}: {
  obras: Fila[];
  clientes: { id: string; nombre: string }[];
  presupuestos: { id: string; numero: string; titulo: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [nueva, setNueva] = useState(false);
  const [desdePresupuesto, setDesdePresupuesto] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(hoyISO());
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    setGuardando(true);
    setError("");
    try {
      const e = desdePresupuesto
        ? fallo(await crearObraDesdePresupuesto(desdePresupuesto, inicio))
        : fallo(await crearObra({ nombre, direccion, clienteId: clienteId || null, inicio }));
      if (e) setError(e);
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la obra.");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id: string, nombre: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!window.confirm(`¿Eliminar la obra "${nombre}" y su planificación?`)) return;
    const r = await borrarObra(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 22 }}>Obras y planificación</h2>
        <div className="spacer" />
        <button className="btn amber" onClick={() => setNueva((v) => !v)}>
          {nueva ? "Cancelar" : "+ Nueva obra"}
        </button>
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>
        Las fechas se calculan sobre <strong>días laborables</strong>, descontando fines de semana y festivos
        nacionales, y respetando las esperas de fraguado y secado. Cada obra publica un calendario al que puedes
        suscribirte desde Google, Apple u Outlook.
      </p>

      {nueva && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <div className="field">
            <label className="lbl">Arrancar desde un presupuesto aprobado</label>
            <select className="inp" value={desdePresupuesto} onChange={(e) => setDesdePresupuesto(e.target.value)}>
              <option value="">No, crear la obra en blanco</option>
              {presupuestos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero} · {p.titulo}
                </option>
              ))}
            </select>
            <p className="hint" style={{ marginTop: 4 }}>
              Crea una fase por capítulo, en orden de ejecución y con las esperas de fraguado puestas. Las duraciones
              son un punto de partida para editar: salen del importe del capítulo, y el importe no sabe si tu cuadrilla
              son dos o son seis.
            </p>
          </div>

          {!desdePresupuesto && (
            <div className="grid g3">
              <div className="field">
                <label className="lbl">Nombre de la obra</label>
                <input className="inp" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Reforma piso Calle Mayor" />
              </div>
              <div className="field">
                <label className="lbl">Dirección</label>
                <input className="inp" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </div>
              <div className="field">
                <label className="lbl">Cliente</label>
                <select className="inp" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Sin cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="field" style={{ maxWidth: 220 }}>
            <label className="lbl">Fecha de inicio</label>
            <input className="inp" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={guardando || (!desdePresupuesto && !nombre.trim())} onClick={crear}>
            {guardando ? "Creando…" : "Crear obra"}
          </button>
        </div>
      )}

      {!obras.length ? (
        <p className="hint">Todavía no hay ninguna obra planificada.</p>
      ) : (
        <table className="t">
          <thead>
            <tr>
              <th>Obra</th>
              <th className="hidemob">Cliente</th>
              <th>Inicio</th>
              <th>Entrega</th>
              <th className="hidemob">Fases</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {obras.map((o) => (
              <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/obras/${o.id}`)}>
                <td>
                  {o.nombre}
                  {o.direccion && <span className="hint"> · {o.direccion}</span>}
                </td>
                <td className="hidemob">{o.clienteNombre}</td>
                <td>{enCastellano(o.inicio)}</td>
                <td>
                  <strong>{enCastellano(o.fin)}</strong>
                </td>
                <td className="hidemob">
                  {o.fases} · {o.diasLaborables} días
                </td>
                <td>
                  <span className={`badge ${CLASE_ESTADO[o.estado] || "b-borrador"}`}>
                    {ETIQUETA_ESTADO[o.estado] || o.estado}
                  </span>
                </td>
                <td>
                  {isAdmin && (
                    <button className="btn sm red" onClick={(ev) => borrar(o.id, o.nombre, ev)}>
                      Borrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
