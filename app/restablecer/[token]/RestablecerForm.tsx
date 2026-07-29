"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { restablecerPassword } from "../actions";

export default function RestablecerForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repetir) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await restablecerPassword(token, password);
      router.push("/login?restablecida=1");
    } catch (err: any) {
      setError(err.message || "No se pudo cambiar la contraseña.");
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="logincard">
        <div className="tapebar" />
        <div style={{ padding: 26 }}>
          <div className="logo" style={{ color: "var(--ink)", fontSize: 28 }}>
            Reforma<b>Pro</b>
          </div>
          <p className="hint" style={{ margin: "6px 0 18px" }}>Elige tu nueva contraseña.</p>

          <form onSubmit={enviar}>
            <div className="field">
              <label className="lbl">Nueva contraseña (mínimo 10 caracteres)</label>
              <input
                className="inp"
                type="password"
                required
                minLength={10}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="lbl">Repítela</label>
              <input
                className="inp"
                type="password"
                required
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn" style={{ width: "100%" }} disabled={enviando} type="submit">
              {enviando ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>

          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            <Link href="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
