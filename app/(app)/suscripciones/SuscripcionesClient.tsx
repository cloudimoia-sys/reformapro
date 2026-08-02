"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activarEmpresa, extenderPrueba, suspenderEmpresa } from "./actions";

type Fila = {
  id: string;
  nombre: string;
  email: string;
  plan: string;
  estado: string;
  diasRestantes: number | null;
  soloLectura: boolean;
  alta: string;
  usuarios: number;
  trabajo: number;
};

const CLASE: Record<string, string> = {
  ACTIVA: "b-aprobado",
  PRUEBA: "b-enviado",
  SUSPENDIDA: "b-rechazado",
  CANCELADA: "b-borrador",
};

export default function SuscripcionesClient({ empresas }: { empresas: Fila[] }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [error, setError] = useState("");

  const hacer = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    empezar(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) setError(r.error || "No se pudo aplicar el cambio.");
      router.refresh();
    });

  const activas = empresas.filter((e) => e.estado === "ACTIVA").length;
  const enPrueba = empresas.filter((e) => e.estado === "PRUEBA" && !e.soloLectura).length;
  const vencidas = empresas.filter((e) => e.soloLectura).length;

  return (
    <div className="card">
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Suscripciones</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Mientras no haya pasarela de pago, esta es la caja: cuando alguien pague, actívalo aquí. Al vencer la prueba la
        cuenta pasa a <strong>solo lectura</strong> — el cliente conserva y puede descargar todo su trabajo, pero no
        crea nada nuevo.
      </p>

      <div className="grid g3" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <span>Pagando</span>
          <b>{activas}</b>
        </div>
        <div className="kpi">
          <span>En prueba</span>
          <b>{enPrueba}</b>
        </div>
        <div className="kpi">
          <span>Vencidas</span>
          <b>{vencidas}</b>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div style={{ overflowX: "auto" }}>
        <table className="t" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th className="hidemob">Alta</th>
              <th>Estado</th>
              <th className="hidemob">Uso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.nombre}
                  <br />
                  <span className="hint">{e.email}</span>
                </td>
                <td className="hidemob">{e.alta}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className={`badge ${CLASE[e.estado] || "b-borrador"}`}>
                    {e.estado === "ACTIVA" ? e.plan : e.estado === "PRUEBA" ? "Prueba" : e.estado}
                  </span>
                  {e.estado === "PRUEBA" && (
                    <div className="hint">
                      {e.diasRestantes === null
                        ? "sin caducidad"
                        : e.diasRestantes > 0
                        ? `quedan ${e.diasRestantes} d`
                        : "vencida"}
                    </div>
                  )}
                </td>
                <td className="hidemob">
                  {e.usuarios} usuario{e.usuarios === 1 ? "" : "s"}
                  <br />
                  {/* Es el dato que dice si la prueba va en serio o no la ha abierto. */}
                  <span className="hint">{e.trabajo} documentos</span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {e.estado !== "ACTIVA" && (
                      <>
                        <button className="btn sm" onClick={() => hacer(() => activarEmpresa(e.id, "BASICO"))}>
                          Activar Básico
                        </button>
                        <button className="btn sm amber" onClick={() => hacer(() => activarEmpresa(e.id, "PRO"))}>
                          Activar Pro
                        </button>
                      </>
                    )}
                    <button className="btn sm ghost" onClick={() => hacer(() => extenderPrueba(e.id, 14))}>
                      +14 días
                    </button>
                    {e.estado === "ACTIVA" && (
                      <button
                        className="btn sm red"
                        onClick={() => {
                          if (!window.confirm(`¿Suspender "${e.nombre}"? Pasará a solo lectura sin perder nada.`)) return;
                          hacer(() => suspenderEmpresa(e.id));
                        }}
                      >
                        Suspender
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
