"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    router.push("/panel");
    router.refresh();
  };

  return (
    <div className="login">
      <div className="logincard">
        <div className="tapebar" />
        <div style={{ padding: 26 }}>
          <div className="logo" style={{ color: "var(--ink)", fontSize: 28 }}>
            Reforma<b>Pro</b>
          </div>
          <p className="hint" style={{ margin: "6px 0 18px" }}>
            Accede con tu email y contraseña.
          </p>
          {searchParams.get("creada") === "1" && (
            <p className="hint" style={{ color: "var(--ok)", marginTop: -10, marginBottom: 16 }}>
              Cuenta creada. Ya puedes acceder.
            </p>
          )}
          {searchParams.get("restablecida") === "1" && (
            <p className="hint" style={{ color: "var(--ok)", marginTop: -10, marginBottom: 16 }}>
              Contraseña actualizada. Entra con la nueva.
            </p>
          )}
          <form onSubmit={entrar}>
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
            <div className="field">
              <label className="lbl">Contraseña</label>
              <input
                className="inp"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn" style={{ width: "100%" }} disabled={loading} type="submit">
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
          <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>
            <Link href="/recuperar">He olvidado mi contraseña</Link>
            {" · "}
            <Link href="/registro">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
