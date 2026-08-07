"use client";

import { useEffect, useRef, useState } from "react";
import Dictar from "@/components/Dictar";

type Fuente = { tema: string; fuente: string; tipo: "normativa" | "practica"; revisado: boolean };
type Calculo = {
  titulo: string;
  detalle: { concepto: string; valor: string }[];
  resultado: string;
  supuestos: string;
};
type Mensaje = {
  rol: "usuario" | "copiloto";
  texto: string;
  fuentes?: Fuente[];
  calculo?: Calculo | null;
  avisos?: string[];
  sinDatos?: boolean;
};

const EJEMPLOS = [
  "¿Qué pendiente necesita el desagüe del lavabo?",
  "¿A qué altura va la grifería del lavabo?",
  "¿Cuánto tarda en fraguar el cemento cola rápido?",
  "¿Cuántos sacos de cemento para 8 m² de solado?",
  "¿Qué sección de cable lleva el circuito de la cocina?",
  "¿A qué altura se ponen los enchufes?",
  "¿Qué altura tiene que tener la barandilla?",
  "¿Qué caudal de ventilación necesita un baño?",
];

/**
 * Chat del copiloto técnico.
 *
 * Enseña siempre de dónde sale cada dato: la fuente normativa debajo de la
 * respuesta y el desglose del cálculo desplegado. No es adorno — es lo que
 * permite comprobar la respuesta en treinta segundos en vez de fiarse.
 */
export default function Copiloto({ presupuestoId }: { presupuestoId?: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const final = useRef<HTMLDivElement>(null);

  useEffect(() => {
    final.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  const enviar = async (texto?: string) => {
    const q = (texto ?? pregunta).trim();
    if (!q || cargando) return;
    setPregunta("");
    setError("");
    setMensajes((prev) => [...prev, { rol: "usuario", texto: q }]);
    setCargando(true);
    try {
      const r = await fetch("/api/copiloto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, historial: mensajes.slice(-6), presupuestoId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo responder.");
      setMensajes((prev) => [
        ...prev,
        {
          rol: "copiloto",
          texto: d.respuesta,
          fuentes: d.fuentes,
          calculo: d.calculo,
          avisos: d.avisos,
          sinDatos: d.sinDatos,
        },
      ]);
    } catch (e: any) {
      setError(e?.message || "No se pudo responder.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Copiloto técnico</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Responde sobre normativa española, práctica de obra y cantidades de material. <strong>Solo con datos cargados y
        con su fuente citada</strong>: lo que no tiene, lo dice en vez de inventárselo. Distingue siempre lo que es
        norma de obligado cumplimiento (📖) de lo que es costumbre del oficio (🔧), que orienta pero no obliga. Los
        cálculos los hace la aplicación, no la IA.
        {presupuestoId && " Conoce las partidas del presupuesto que tienes abierto."}
      </p>

      {!mensajes.length && (
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          {EJEMPLOS.map((e) => (
            <button key={e} className="btn sm ghost" onClick={() => enviar(e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      <div style={{ maxHeight: "52vh", overflowY: "auto", marginBottom: 12 }}>
        {mensajes.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 12,
              padding: m.rol === "usuario" ? "8px 12px" : "12px",
              background: m.rol === "usuario" ? "#EEF3F7" : "#fff",
              border: m.rol === "usuario" ? "none" : "1px solid var(--line)",
              borderRadius: 8,
              marginLeft: m.rol === "usuario" ? "12%" : 0,
            }}
          >
            {m.rol === "usuario" ? (
              <span>{m.texto}</span>
            ) : (
              <>
                {m.texto.split(/\n+/).map((p, j) => (
                  <p key={j} style={{ margin: "0 0 6px" }}>{p}</p>
                ))}

                {m.calculo && (
                  <div style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 10, marginTop: 8 }}>
                    <strong style={{ fontSize: 14 }}>{m.calculo.titulo}</strong>
                    <table className="t" style={{ margin: "6px 0" }}>
                      <tbody>
                        {m.calculo.detalle.map((d, k) => (
                          <tr key={k}>
                            <td style={{ padding: "2px 4px" }}>{d.concepto}</td>
                            <td style={{ padding: "2px 4px", textAlign: "right" }}>{d.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="linetotal" style={{ fontSize: 16 }}>{m.calculo.resultado}</div>
                    <p className="hint" style={{ margin: "4px 0 0" }}>{m.calculo.supuestos}</p>
                  </div>
                )}

                {/*
                  Norma y costumbre se pintan distinto a propósito. Con un solo
                  icono para las dos, un reformista con prisa lee "📖 …" y da por
                  hecho que todo lo de arriba se lo exige alguien.
                */}
                {!!m.fuentes?.length && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--mut)" }}>
                    {m.fuentes.map((f, k) => (
                      <div key={k}>
                        {f.tipo === "normativa" ? "📖 Normativa: " : "🔧 Práctica del oficio: "}
                        {f.fuente}
                        {f.tipo === "normativa" &&
                          !f.revisado &&
                          " · pendiente de contrastar con el texto oficial"}
                      </div>
                    ))}
                  </div>
                )}

                {m.avisos?.map((a, k) => (
                  <p key={k} className="hint" style={{ marginTop: 6 }}>
                    {a}
                  </p>
                ))}
                {m.sinDatos && !m.fuentes?.length && (
                  <p className="hint" style={{ marginTop: 6, color: "var(--amber-d, #92400e)" }}>
                    Esta respuesta no se apoya en ningún dato cargado.
                  </p>
                )}
              </>
            )}
          </div>
        ))}
        {cargando && <p className="hint">Consultando…</p>}
        <div ref={final} />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <input
          className="inp"
          style={{ flex: 1, minWidth: 180 }}
          value={pregunta}
          placeholder="Pregunta sobre normativa, materiales o el presupuesto…"
          disabled={cargando}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
        />
        <Dictar disabled={cargando} onTexto={(t) => setPregunta((p) => (p ? `${p} ${t}` : t))} />
        <button className="btn" disabled={cargando || !pregunta.trim()} onClick={() => enviar()}>
          Preguntar
        </button>
      </div>
    </div>
  );
}
