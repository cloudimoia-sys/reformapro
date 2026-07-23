"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearUsuario, actualizarUsuario, borrarUsuario, type UsuarioInput } from "./actions";

type Usuario = { id: string; nombre: string; email: string; rol: "ADMIN" | "EMPLEADO" };

const VACIO: UsuarioInput = { nombre: "", email: "", rol: "EMPLEADO", password: "" };

export default function EquipoClient({ usuarios, miId }: { usuarios: Usuario[]; miId: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ id: string | null; data: UsuarioInput } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const abrirNuevo = () => setModal({ id: null, data: { ...VACIO } });
  const abrirEditar = (u: Usuario) => setModal({ id: u.id, data: { nombre: u.nombre, email: u.email, rol: u.rol, password: "" } });
  const cerrar = () => { setModal(null); setError(""); };

  const guardar = async () => {
    if (!modal) return;
    setGuardando(true);
    setError("");
    try {
      if (modal.id) await actualizarUsuario(modal.id, modal.data);
      else await crearUsuario(modal.data);
      cerrar();
      router.refresh();
    } catch (e: any) {
      setError(e.message || "No se pudo guardar el usuario.");
    }
    setGuardando(false);
  };

  const borrar = async (id: string) => {
    if (!window.confirm("¿Eliminar este usuario?")) return;
    try {
      await borrarUsuario(id);
      router.refresh();
    } catch (e: any) {
      window.alert(e.message || "No se pudo borrar.");
    }
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 22 }}>Equipo y permisos</h2>
        <div className="spacer" />
        <button className="btn" onClick={abrirNuevo}>+ Añadir usuario</button>
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>
        Los empleados pueden gestionar clientes, precios y presupuestos, pero no ven facturación ni contabilidad y no
        pueden borrar datos.
      </p>
      <table className="t">
        <thead>
          <tr><th>Nombre</th><th className="hidemob">Email</th><th>Rol</th><th></th></tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td className="hidemob">{u.email}</td>
              <td><span className={`badge ${u.rol === "ADMIN" ? "b-facturado" : "b-enviado"}`}>{u.rol === "ADMIN" ? "admin" : "empleado"}</span></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn sm ghost" onClick={() => abrirEditar(u)}>Editar</button>{" "}
                {u.id !== miId && <button className="btn sm red" onClick={() => borrar(u.id)}>Borrar</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="modalbg">
          <div className="modal">
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>{modal.id ? "Editar usuario" : "Nuevo usuario"}</h2>
            <div className="field">
              <label className="lbl">Nombre</label>
              <input className="inp" value={modal.data.nombre} onChange={(e) => setModal({ ...modal, data: { ...modal.data, nombre: e.target.value } })} />
            </div>
            <div className="field">
              <label className="lbl">Email</label>
              <input className="inp" type="email" value={modal.data.email} onChange={(e) => setModal({ ...modal, data: { ...modal.data, email: e.target.value } })} />
            </div>
            <div className="field">
              <label className="lbl">Rol</label>
              <select className="inp" value={modal.data.rol} onChange={(e) => setModal({ ...modal, data: { ...modal.data, rol: e.target.value as "ADMIN" | "EMPLEADO" } })}>
                <option value="ADMIN">Administrador (todo)</option>
                <option value="EMPLEADO">Empleado (sin facturación ni borrado)</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">{modal.id ? "Nueva contraseña (dejar en blanco para no cambiarla)" : "Contraseña"}</label>
              <input className="inp" type="password" value={modal.data.password} onChange={(e) => setModal({ ...modal, data: { ...modal.data, password: e.target.value } })} />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row">
              <div className="spacer" />
              <button className="btn ghost" onClick={cerrar}>Cancelar</button>
              <button className="btn" disabled={!modal.data.nombre.trim() || guardando} onClick={guardar}>
                {guardando ? "Guardando…" : "Guardar usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
