"use client";

import { useState } from "react";
import Link from "next/link";
import { registrarEmpresa, type RegistroInput } from "./actions";

const VACIO: RegistroInput = {
  nombre: "",
  email: "",
  password: "",
  empresaNombre: "",
  codigo: "",
  web: "",
};

export default function RegistroForm({ pideCodigo }: { pideCodigo: boolean }) {
  const [f, setF] = useState<RegistroInput>(VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof RegistroInput, v: string) => setF({ ...f, [k]: v });

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await registrarEmpresa(f);
    } catch (err: any) {
      // redirect() de Next lanza una excepción especial para navegar; no es un error.
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
      setError(err.message || "No se pudo completar el registro.");
      setEnviando(false);
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
            Crea tu cuenta y la de tu empresa. Empiezas con 14 días de prueba, sin tarjeta.
          </p>

          <form onSubmit={enviar}>
            {/* Campo trampa: oculto para personas, tentador para bots. */}
            <input
              type="text"
              name="web"
              tabIndex={-1}
              autoComplete="off"
              value={f.web}
              onChange={(e) => set("web", e.target.value)}
              style={{ position: "absolute", left: "-9999px" }}
              aria-hidden="true"
            />

            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Tu cuenta</h3>
            <div className="field">
              <label className="lbl">Tu nombre</label>
              <input className="inp" required autoFocus value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Email</label>
              <input className="inp" type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="field">
              <label className="lbl">Contraseña (mínimo 10 caracteres)</label>
              <input
                className="inp"
                type="password"
                required
                minLength={10}
                value={f.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </div>

            <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>Tu empresa</h3>
            <div className="field">
              <label className="lbl">Nombre de la empresa</label>
              <input
                className="inp"
                required
                value={f.empresaNombre}
                onChange={(e) => set("empresaNombre", e.target.value)}
              />
              <p className="hint" style={{ marginTop: 4 }}>
                El CIF, la dirección y el teléfono los rellenas después en «Mi empresa».
              </p>
            </div>

            {pideCodigo && (
              <div className="field">
                <label className="lbl">Código de invitación</label>
                <input className="inp" required value={f.codigo} onChange={(e) => set("codigo", e.target.value)} />
              </div>
            )}

            {error && <p className="error">{error}</p>}

            <button className="btn" style={{ width: "100%" }} disabled={enviando} type="submit">
              {enviando ? "Creando…" : "Crear cuenta"}
            </button>
          </form>

          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
