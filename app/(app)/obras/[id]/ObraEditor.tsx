"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Planificacion } from "@/lib/planificacion";
import {
  actualizarObra,
  anadirFase,
  actualizarFase,
  borrarFase,
  regenerarTokenCalendario,
  type EstadoObra,
} from "../actions";
import { enCastellano } from "../ObrasListClient";

type Obra = {
  id: string;
  nombre: string;
  direccion: string;
  clienteId: string | null;
  clienteNombre: string;
  presupuestoNumero: string;
  presupuestoId: string;
  inicio: string;
  estado: string;
  festivosPropios: string;
  sabadosSeTrabaja: boolean;
  notas: string;
};

type Fase = {
  id: string;
  nombre: string;
  oficio: string;
  dias: number;
  esperaDias: number;
  dependeDe: string;
  hito: boolean;
  notas: string;
};

const ESTADOS: [EstadoObra, string][] = [
  ["PLANIFICADA", "Planificada"],
  ["EN_CURSO", "En curso"],
  ["PARADA", "Parada"],
  ["TERMINADA", "Terminada"],
];

const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

export default function ObraEditor({
  obra,
  fases,
  plan,
  clientes,
  urlCalendario,
}: {
  obra: Obra;
  fases: Fase[];
  plan: Planificacion;
  clientes: { id: string; nombre: string }[];
  urlCalendario: string;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [nuevaFase, setNuevaFase] = useState("");

  const guardar = (fn: () => Promise<{ ok: boolean; error?: string } | undefined>) =>
    empezar(async () => {
      setError("");
      const r = await fn();
      if (r && !r.ok) setError(r.error || "No se pudo guardar.");
      router.refresh();
    });

  const planificadas = plan.fases;
  const total = Math.max(1, plan.diasNaturales);
  const inicioMs = new Date(`${plan.inicio}T00:00:00Z`).getTime();
  const desplazamiento = (iso: string) =>
    Math.round((new Date(`${iso}T00:00:00Z`).getTime() - inicioMs) / 86400000);

  return (
    <>
      {/* ── Cabecera y datos de la obra ─────────────────────────────── */}
      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 22, margin: 0 }}>{obra.nombre}</h2>
          <div className="spacer" />
          <button className="btn sm ghost" onClick={() => router.push("/obras")}>
            ← Todas las obras
          </button>
        </div>
        {obra.presupuestoNumero && (
          <p className="hint" style={{ marginTop: 0 }}>
            Planificada a partir del presupuesto{" "}
            <a href={`/presupuestos/${obra.presupuestoId}`}>{obra.presupuestoNumero}</a>.
          </p>
        )}

        <div className="grid g3">
          <div className="field">
            <label className="lbl">Nombre</label>
            <input
              className="inp"
              defaultValue={obra.nombre}
              onBlur={(e) =>
                e.target.value !== obra.nombre && guardar(() => actualizarObra(obra.id, { nombre: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label className="lbl">Dirección</label>
            <input
              className="inp"
              defaultValue={obra.direccion}
              onBlur={(e) =>
                e.target.value !== obra.direccion &&
                guardar(() => actualizarObra(obra.id, { direccion: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label className="lbl">Cliente</label>
            <select
              className="inp"
              defaultValue={obra.clienteId || ""}
              onChange={(e) => guardar(() => actualizarObra(obra.id, { clienteId: e.target.value || null }))}
            >
              <option value="">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Inicio de la obra</label>
            <input
              className="inp"
              type="date"
              defaultValue={obra.inicio}
              onChange={(e) => guardar(() => actualizarObra(obra.id, { inicio: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="lbl">Estado</label>
            <select
              className="inp"
              defaultValue={obra.estado}
              onChange={(e) => guardar(() => actualizarObra(obra.id, { estado: e.target.value as EstadoObra }))}
            >
              {ESTADOS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl">¿Se trabaja los sábados?</label>
            <select
              className="inp"
              defaultValue={obra.sabadosSeTrabaja ? "si" : "no"}
              onChange={(e) => guardar(() => actualizarObra(obra.id, { sabadosSeTrabaja: e.target.value === "si" }))}
            >
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="lbl">Festivos propios y cierres</label>
          <input
            className="inp"
            placeholder="2026-08-15, 2026-09-08"
            defaultValue={obra.festivosPropios}
            onBlur={(e) =>
              e.target.value !== obra.festivosPropios &&
              guardar(() => actualizarObra(obra.id, { festivosPropios: e.target.value }))
            }
          />
          <p className="hint" style={{ marginTop: 4 }}>
            En formato AAAA-MM-DD separados por coma. Los <strong>festivos nacionales ya están puestos</strong>,
            incluida la Semana Santa. Aquí van los <strong>autonómicos y locales</strong>, que cambian con cada
            comunidad y cada municipio, y las semanas que cierres. Sin ellos la fecha de entrega sale optimista.
          </p>
        </div>
      </div>

      {/* ── Resumen de plazos ───────────────────────────────────────── */}
      <div className="card">
        <div className="grid g3">
          <div className="kpi">
            <span>Inicio</span>
            <b>{enCastellano(plan.inicio)}</b>
          </div>
          <div className="kpi">
            <span>Entrega prevista</span>
            <b>{enCastellano(plan.fin)}</b>
          </div>
          <div className="kpi">
            <span>Duración</span>
            <b>{dias(plan.diasLaborables)} de trabajo</b>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Son {plan.diasNaturales} días naturales de principio a fin: es la cifra que percibe el cliente, y siempre es
          mayor que los días trabajados.
        </p>

        {!!plan.avisos.length && (
          <div style={{ marginTop: 10, padding: 10, background: "#FCF0D8", borderRadius: 6 }}>
            {plan.avisos.map((a, i) => (
              <p key={i} style={{ margin: i ? "6px 0 0" : 0 }}>
                {a}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ── Diagrama de fases ───────────────────────────────────────── */}
      {!!planificadas.length && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Cómo cae en el calendario</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            En ámbar, el <strong>camino crítico</strong>: las fases que, si se retrasan un día, retrasan la entrega un
            día. Las demás tienen holgura.
          </p>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              {planificadas.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 170, fontSize: 13, flexShrink: 0 }} title={f.nombre}>
                    {f.nombre.length > 26 ? `${f.nombre.slice(0, 25)}…` : f.nombre}
                  </div>
                  <div style={{ flex: 1, background: "#EEF3F7", borderRadius: 4, height: 22, position: "relative" }}>
                    <div
                      title={`${enCastellano(f.inicio)} → ${enCastellano(f.fin)}`}
                      style={{
                        position: "absolute",
                        left: `${(desplazamiento(f.inicio) / total) * 100}%`,
                        width: `${Math.max(1.5, (f.diasNaturales / total) * 100)}%`,
                        top: 3,
                        height: 16,
                        borderRadius: 3,
                        background: f.critica ? "var(--amber)" : "#9FB3C0",
                      }}
                    />
                    {f.esperaDias > 0 && (
                      <div
                        title={`${dias(f.esperaDias)} de espera`}
                        style={{
                          position: "absolute",
                          left: `${((desplazamiento(f.fin) + 1) / total) * 100}%`,
                          width: `${Math.max(1, (f.esperaDias / total) * 100)}%`,
                          top: 3,
                          height: 16,
                          borderRadius: 3,
                          background:
                            "repeating-linear-gradient(45deg,#D8DEE2,#D8DEE2 4px,#EEF3F7 4px,#EEF3F7 8px)",
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Fases ───────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fases</h3>
        {error && <p className="error">{error}</p>}

        {!planificadas.length ? (
          <p className="hint">Añade la primera fase abajo.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="t" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th className="hidemob">Oficio</th>
                  <th>Días</th>
                  <th className="hidemob">Espera</th>
                  <th>Empieza después de</th>
                  <th>Del</th>
                  <th>Al</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {planificadas.map((f) => (
                  <tr key={f.id} style={f.critica ? { background: "#FFFCF3" } : undefined}>
                    <td>
                      <input
                        className="inp"
                        defaultValue={f.nombre}
                        onBlur={(e) =>
                          e.target.value !== f.nombre &&
                          guardar(() => actualizarFase(f.id, { nombre: e.target.value }))
                        }
                      />
                      {f.notas && (
                        <p className="hint" style={{ margin: "4px 0 0" }}>
                          {f.notas}
                        </p>
                      )}
                    </td>
                    <td className="hidemob">
                      <input
                        className="inp"
                        defaultValue={f.oficio || ""}
                        onBlur={(e) =>
                          e.target.value !== f.oficio && guardar(() => actualizarFase(f.id, { oficio: e.target.value }))
                        }
                      />
                    </td>
                    <td style={{ width: 80 }}>
                      <input
                        className="inp"
                        type="number"
                        min={1}
                        defaultValue={f.dias}
                        onBlur={(e) =>
                          Number(e.target.value) !== f.dias &&
                          guardar(() => actualizarFase(f.id, { dias: Number(e.target.value) }))
                        }
                      />
                    </td>
                    <td className="hidemob" style={{ width: 80 }}>
                      <input
                        className="inp"
                        type="number"
                        min={0}
                        defaultValue={f.esperaDias || 0}
                        onBlur={(e) =>
                          Number(e.target.value) !== (f.esperaDias || 0) &&
                          guardar(() => actualizarFase(f.id, { esperaDias: Number(e.target.value) }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="inp"
                        defaultValue={f.dependeDe || ""}
                        onChange={(e) => guardar(() => actualizarFase(f.id, { dependeDe: e.target.value }))}
                      >
                        <option value="">Empieza con la obra</option>
                        {fases
                          .filter((o) => o.id !== f.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nombre}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{enCastellano(f.inicio)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <strong>{enCastellano(f.fin)}</strong>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <label className="hint" style={{ display: "block", marginBottom: 4 }}>
                        <input
                          type="checkbox"
                          defaultChecked={f.hito}
                          onChange={(e) => guardar(() => actualizarFase(f.id, { hito: e.target.checked }))}
                        />{" "}
                        Hito
                      </label>
                      <button
                        className="btn sm red"
                        onClick={() => {
                          if (!window.confirm(`¿Quitar la fase "${f.nombre}"?`)) return;
                          guardar(() => borrarFase(f.id));
                        }}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="inp"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Nombre de la fase nueva"
            value={nuevaFase}
            onChange={(e) => setNuevaFase(e.target.value)}
          />
          <button
            className="btn"
            disabled={!nuevaFase.trim()}
            onClick={() => {
              const nombre = nuevaFase.trim();
              setNuevaFase("");
              // Encadenada a la última: es lo normal en obra, y si va en paralelo
              // se cambia con el desplegable en un clic.
              guardar(() =>
                anadirFase(obra.id, { nombre, dias: 3, dependeDe: fases[fases.length - 1]?.id || "" })
              );
            }}
          >
            + Añadir fase
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          Los <strong>días son de trabajo</strong> y la <strong>espera es de calendario</strong>: el hormigón fragua
          también en domingo. Marca como hito lo que haya que comprobar antes de seguir.
        </p>
      </div>

      {/* ── Calendario ──────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Llevártelo al calendario</h3>

        <p style={{ marginTop: 0 }}>
          <strong>Suscripción.</strong> Pega este enlace en Google Calendar (Otros calendarios → Añadir desde URL), en
          Apple Calendar o en Outlook. Se actualiza solo cuando cambies la planificación, pero{" "}
          <strong>Google refresca cuando le parece y puede tardar horas</strong>: sirve para tener la obra a la vista,
          no para enterarte de un cambio de mañana.
        </p>
        <div className="row">
          <input className="inp" style={{ flex: 1, minWidth: 220 }} readOnly value={urlCalendario} />
          <button
            className="btn sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(urlCalendario);
                setCopiado(true);
              } catch {
                setError("El navegador no ha dejado copiar. Selecciona el enlace a mano.");
              }
            }}
          >
            {copiado ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          Cualquiera que tenga este enlace ve el calendario de la obra sin contraseña: fases y fechas, nada de cliente
          ni de importes. Mándalo solo a quien deba verlo.
        </p>

        <p style={{ marginTop: 14 }}>
          <strong>Descarga.</strong> Entra al instante y en el sitio, pero es una foto fija: si luego mueves el inicio
          de la obra, esos eventos se quedan como están.
        </p>
        <div className="row">
          <a className="btn ghost" href={urlCalendario} download={`${obra.nombre}.ics`}>
            Descargar .ics
          </a>
          <button
            className="btn sm ghost"
            onClick={() => {
              if (!window.confirm("Se generará un enlace nuevo y el anterior dejará de funcionar. ¿Seguir?")) return;
              setCopiado(false);
              guardar(() => regenerarTokenCalendario(obra.id));
            }}
          >
            Generar enlace nuevo
          </button>
        </div>
      </div>
    </>
  );
}
