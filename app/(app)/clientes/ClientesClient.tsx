"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearCliente, actualizarCliente, borrarCliente, type ClienteInput } from "./actions";

type Cliente = ClienteInput & { id: string; numPresupuestos: number };

const CAMPOS: [keyof ClienteInput, string][] = [
  ["nombre", "Nombre completo"],
  ["tel", "Teléfono"],
  ["email", "Email"],
  ["direccion", "Dirección de la obra"],
  ["nif", "NIF"],
  ["notas", "Notas"],
];

const VACIO: ClienteInput = { nombre: "", tel: "", email: "", direccion: "", nif: "", notas: "" };

export default function ClientesClient({ clientes, isAdmin }: { clientes: Cliente[]; isAdmin: boolean }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ id: string | null; data: ClienteInput } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const abrirNuevo = () => setModal({ id: null, data: VACIO });
  const abrirEditar = (c: Cliente) => setModal({ id: c.id, data: { ...c } });
  const cerrar = () => { setModal(null); setError(""); };

  const guardar = async () => {
    if (!modal) return;
    setGuardando(true);
    setError("");
    // Las acciones devuelven el error en vez de lanzarlo: Next borra el mensaje de
    // las excepciones en producción y aquí solo se vería un texto genérico.
    const r = modal.id ? await actualizarCliente(modal.id, modal.data) : await crearCliente(modal.data);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    cerrar();
    router.refresh();
  };

  const borrar = async (id: string) => {
    if (!window.confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    const r = await borrarCliente(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 22 }}>Clientes</h2>
        <div className="spacer" />
        <button className="btn" onClick={abrirNuevo}>+ Añadir cliente</button>
      </div>
      <table className="t">
        <thead>
          <tr>
            <th>Nombre</th>
            <th className="hidemob">Teléfono</th>
            <th className="hidemob">Email</th>
            <th>Presupuestos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td>
                <b>{c.nombre}</b>
                <div className="hint">{c.direccion}</div>
              </td>
              <td className="hidemob">{c.tel}</td>
              <td className="hidemob">{c.email}</td>
              <td>{c.numPresupuestos}</td>
              <td style={{ textAlign: "right" }}>
                <button className="btn sm ghost" onClick={() => abrirEditar(c)}>Editar</button>{" "}
                {isAdmin && (
                  <button className="btn sm red" onClick={() => borrar(c.id)}>Borrar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="modalbg">
          <div className="modal">
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>{modal.id ? "Editar cliente" : "Nuevo cliente"}</h2>
            {CAMPOS.map(([k, l]) => (
              <div className="field" key={k}>
                <label className="lbl">{l}</label>
                <input
                  className="inp"
                  value={modal.data[k]}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, [k]: e.target.value } })}
                />
              </div>
            ))}
            {error && <p className="error">{error}</p>}
            <div className="row">
              <div className="spacer" />
              <button className="btn ghost" onClick={cerrar}>Cancelar</button>
              <button className="btn" disabled={!modal.data.nombre.trim() || guardando} onClick={guardar}>
                {guardando ? "Guardando…" : "Guardar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
