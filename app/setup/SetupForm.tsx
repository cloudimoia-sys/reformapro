"use client";

import { useState } from "react";
import { crearPrimerAdmin, type SetupInput } from "./actions";

const VACIO: SetupInput = {
  adminNombre: "",
  adminEmail: "",
  adminPassword: "",
  empresaNombre: "",
  empresaCif: "",
  empresaDireccion: "",
  empresaTel: "",
  empresaEmail: "",
};

export default function SetupForm() {
  const [f, setF] = useState<SetupInput>(VACIO);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof SetupInput, v: string) => setF({ ...f, [k]: v });

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await crearPrimerAdmin(f);
    } catch (err: any) {
      // redirect() de Next lanza una excepción especial para navegar; no es un error real.
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
      setError(err.message || "No se pudo crear la cuenta.");
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="logincard" style={{ width: 440 }}>
        <div className="tapebar" />
        <div style={{ padding: 26 }}>
          <div className="logo" style={{ color: "var(--ink)", fontSize: 28 }}>
            Reforma<b>Pro</b>
          </div>
          <p className="hint" style={{ margin: "6px 0 18px" }}>
            Primer arranque: crea tu cuenta de administrador y los datos básicos de tu empresa. Esta pantalla
            solo aparece una vez; los siguientes usuarios se crean desde "Equipo" dentro de la app.
          </p>
          <form onSubmit={crear}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Tu cuenta</h3>
            <div className="field">
              <label className="lbl">Tu nombre</label>
              <input className="inp" required autoFocus value={f.adminNombre} onChange={(e) => set("adminNombre", e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Email</label>
              <input className="inp" type="email" required value={f.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Contraseña (mínimo 8 caracteres)</label>
              <input className="inp" type="password" required minLength={8} value={f.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} />
            </div>

            <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>Tu empresa</h3>
            <div className="field">
              <label className="lbl">Nombre de la empresa</label>
              <input className="inp" required value={f.empresaNombre} onChange={(e) => set("empresaNombre", e.target.value)} />
            </div>
            <div className="grid g2">
              <div className="field">
                <label className="lbl">CIF</label>
                <input className="inp" value={f.empresaCif} onChange={(e) => set("empresaCif", e.target.value)} />
              </div>
              <div className="field">
                <label className="lbl">Teléfono</label>
                <input className="inp" value={f.empresaTel} onChange={(e) => set("empresaTel", e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label className="lbl">Dirección</label>
              <input className="inp" value={f.empresaDireccion} onChange={(e) => set("empresaDireccion", e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Email de la empresa</label>
              <input className="inp" type="email" value={f.empresaEmail} onChange={(e) => set("empresaEmail", e.target.value)} />
            </div>

            {error && <p className="error">{error}</p>}
            <button className="btn" style={{ width: "100%" }} disabled={loading} type="submit">
              {loading ? "Creando…" : "Crear cuenta y empezar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
