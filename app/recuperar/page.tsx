"use client";

import { useState } from "react";
import Link from "next/link";
import { pedirRestablecer } from "./actions";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    await pedirRestablecer(email);
    setEnviando(false);
    setEnviado(true);
  };

  return (
    <div className="login">
      <div className="logincard">
        <div className="tapebar" />
        <div style={{ padding: 26 }}>
          <div className="logo" style={{ color: "var(--ink)", fontSize: 28 }}>
            Reforma<b>Pro</b>
          </div>

          {enviado ? (
            <>
              <p className="hint" style={{ margin: "10px 0 18px", lineHeight: 1.5 }}>
                Si ese email tiene una cuenta, te hemos enviado un enlace para elegir
                una contraseña nueva. Caduca en una hora.
              </p>
              <p className="hint">Revisa también la carpeta de spam.</p>
              <Link className="btn ghost" href="/login" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
                Volver al inicio de sesión
              </Link>
            </>
          ) : (
            <>
              <p className="hint" style={{ margin: "6px 0 18px" }}>
                Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.
              </p>
              <form onSubmit={enviar}>
                <div className="field">
                  <label className="lbl">Email</label>
                  <input
                    className="inp"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button className="btn" style={{ width: "100%" }} disabled={enviando} type="submit">
                  {enviando ? "Enviando…" : "Enviarme el enlace"}
                </button>
              </form>
              <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
                <Link href="/login">Volver al inicio de sesión</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
