"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { estadoClase, estadoLabel } from "@/lib/presupuesto";
import WizardIA from "@/components/WizardIA";
import { crearPresupuestoBlanco, crearPresupuestoConIA, borrarPresupuesto, type LineaIA } from "./actions";

type Fila = {
  id: string;
  numero: string;
  titulo: string;
  clienteNombre: string;
  fecha: string;
  total: number;
  estado: string;
};

export default function PresupuestosListClient({ presupuestos, isAdmin }: { presupuestos: Fila[]; isAdmin: boolean }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const [creando, setCreando] = useState(false);

  const nuevoEnBlanco = async () => {
    setCreando(true);
    // Al ir bien redirige, así que solo vuelve de aquí cuando algo ha fallado.
    const r = await crearPresupuestoBlanco();
    setCreando(false);
    if (!r.ok) window.alert(r.error);
  };

  // Sin cerrar el asistente aquí: si la creación falla, el propio asistente
  // muestra el motivo. Al terminar bien, la acción redirige al presupuesto nuevo.
  const onDoneIA = async (lineas: LineaIA[], meta: { tipo: string; m2?: string }) => {
    const r = await crearPresupuestoConIA(lineas, meta);
    if (!r.ok) throw new Error(r.error);
  };

  const borrar = async (id: string, numero: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el presupuesto ${numero}? Esta acción no se puede deshacer.`)) return;
    const r = await borrarPresupuesto(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 22 }}>Presupuestos</h2>
        <div className="spacer" />
        <button className="btn amber" onClick={() => setWizard(true)}>+ Nuevo con IA</button>
        <button className="btn ghost" disabled={creando} onClick={nuevoEnBlanco}>
          {creando ? "Creando…" : "+ Nuevo en blanco"}
        </button>
      </div>
      <table className="t">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Obra</th>
            <th className="hidemob">Cliente</th>
            <th className="hidemob">Fecha</th>
            <th>Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {presupuestos.map((x) => (
            <tr key={x.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/presupuestos/${x.id}`)}>
              <td>{x.numero}</td>
              <td>{x.titulo}</td>
              <td className="hidemob">{x.clienteNombre}</td>
              <td className="hidemob">{x.fecha}</td>
              <td className="linetotal">{eur(x.total)}</td>
              <td><span className={`badge ${estadoClase(x.estado)}`}>{estadoLabel(x.estado)}</span></td>
              <td style={{ textAlign: "right" }}>
                {isAdmin && (
                  <button className="btn sm red" onClick={(e) => borrar(x.id, x.numero, e)}>Eliminar</button>
                )}
              </td>
            </tr>
          ))}
          {!presupuestos.length && (
            <tr><td colSpan={7} className="hint">Sin presupuestos todavía.</td></tr>
          )}
        </tbody>
      </table>

      {wizard && <WizardIA onDone={onDoneIA} onCancel={() => setWizard(false)} />}
    </div>
  );
}
