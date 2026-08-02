"use client";

import { useState } from "react";
import Dictar from "@/components/Dictar";
import type { Contexto } from "@/lib/diagnostico";

/**
 * Diagnóstico de patologías a partir de fotos.
 *
 * La pantalla está montada alrededor de una idea: el resultado honesto de mirar
 * una foto casi nunca es "es esto", sino "es esto o esto otro, y así se sabe
 * cuál". Por eso lo que más peso visual tiene no es el diagnóstico, sino las
 * comprobaciones de la visita y el diferencial entre los dos candidatos.
 *
 * Las preguntas de contexto son cinco y se contestan en diez segundos, pero son
 * las que separan una condensación de una filtración. Se piden ANTES de mandar
 * las fotos porque después el usuario ya no las contestaría.
 */

const MAX_LADO = 1600;
const MAX_IMAGENES = 6;

type Foto = { datos: string; mimeType: string; pie: string; nombre: string };

type Partida = { concepto: string; unidad: string; precio: number };
type Candidato = {
  id: string;
  etiqueta: string;
  familia: string;
  puntos: number;
  motivos: string[];
  urgencia: "baja" | "media" | "alta" | "muy alta";
  porQueUrgencia: string;
  causas: string[];
  comprobaciones: string[];
  actuacion: string[];
  partidas: Partida[];
  normativa: { tema: string; respuesta: string; fuente: string }[];
  derivar: string | null;
};
type Resultado = {
  observaciones: { imagen: number; loQueSeVe: string; candidatos: { id: string; confianza: string }[] }[];
  candidatos: Candidato[];
  descartados: { etiqueta: string; motivos: string[] }[];
  concluyente: boolean;
  diferencial: { con: string; comoDistinguir: string }[];
  urgencia: { nivel: string; porQue: string } | null;
  comprobaciones: string[];
  avisos: string[];
};

const CLASE_URGENCIA: Record<string, string> = {
  baja: "b-borrador",
  media: "b-pendiente",
  alta: "b-facturado",
  "muy alta": "b-rechazado",
};

function prepararFoto(file: File): Promise<{ datos: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`"${file.name}" no es una imagen válida.`));
      img.onload = () => {
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ datos: canvas.toDataURL("image/jpeg", 0.85), mimeType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Diagnostico() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [ctx, setCtx] = useState<Contexto>({ exterior: null });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);

  const set = <K extends keyof Contexto>(campo: K, valor: Contexto[K]) =>
    setCtx((p) => ({ ...p, [campo]: valor }));

  const anadir = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const hueco = MAX_IMAGENES - fotos.length;
    if (hueco <= 0) return setError(`Máximo ${MAX_IMAGENES} fotografías.`);
    const nuevas: Foto[] = [];
    for (const file of Array.from(files).slice(0, hueco)) {
      if (file.type === "application/pdf") {
        setError("Para diagnosticar hace falta una fotografía de la lesión, no un plano.");
        continue;
      }
      try {
        const { datos, mimeType } = await prepararFoto(file);
        nuevas.push({ datos, mimeType, pie: "", nombre: file.name });
      } catch (e: any) {
        setError(e?.message || "No se pudo procesar una de las fotos.");
      }
    }
    setFotos((prev) => [...prev, ...nuevas]);
  };

  const analizar = async () => {
    if (!fotos.length) return setError("Sube al menos una fotografía de la lesión.");
    setCargando(true);
    setError("");
    setRes(null);
    setCopiado(false);
    try {
      const r = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // El data URL lleva delante "data:image/jpeg;base64,", que la API no espera.
          imagenes: fotos.map((f) => ({ mimeType: f.mimeType, datos: f.datos.split(",")[1], pie: f.pie })),
          contexto: ctx,
          descripcion,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo analizar.");
      setRes(d);
    } catch (e: any) {
      setError(e?.message || "No se pudo analizar.");
    } finally {
      setCargando(false);
    }
  };

  /**
   * Texto listo para pegar en el campo de daños del informe.
   *
   * Se compone aquí, en el navegador y a partir de los datos ya validados, para
   * que diga exactamente lo mismo que se ve en pantalla.
   */
  const textoParaInforme = (r: Resultado) => {
    const partes: string[] = [];
    for (const o of r.observaciones) {
      if (o.loQueSeVe) partes.push(`Imagen ${o.imagen}: ${o.loQueSeVe}`);
    }
    if (r.candidatos.length) {
      partes.push(
        "",
        r.concluyente
          ? `Diagnóstico: ${r.candidatos[0].etiqueta}.`
          : `Diagnóstico provisional, pendiente de comprobación en visita: ${r.candidatos
              .slice(0, 3)
              .map((c) => c.etiqueta)
              .join(" o ")}.`
      );
      const c = r.candidatos[0];
      if (c.causas.length) partes.push(`Causas posibles: ${c.causas.join("; ")}.`);
      if (c.actuacion.length) partes.push(`Actuación propuesta: ${c.actuacion.join("; ")}.`);
    }
    if (r.comprobaciones.length) {
      partes.push("", "Comprobaciones pendientes en la visita:", ...r.comprobaciones.map((c) => `- ${c}`));
    }
    return partes.join("\n");
  };

  const copiar = async (r: Resultado) => {
    try {
      await navigator.clipboard.writeText(textoParaInforme(r));
      setCopiado(true);
    } catch {
      setError("El navegador no ha dejado copiar. Selecciona el texto a mano.");
    }
  };

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Diagnóstico de patologías</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Sube fotos de la lesión y contesta cinco preguntas. La IA solo describe lo que ve y lo clasifica contra un
          catálogo cerrado; <strong>la causa, la urgencia y la reparación salen del catálogo de la aplicación</strong>, no
          del modelo. Si la foto no basta para cerrar el diagnóstico, se dice y se indica qué comprobar en la visita.
        </p>

        <div className="field">
          <label className="lbl">Fotografías de la lesión (hasta {MAX_IMAGENES})</label>
          <input
            className="inp"
            type="file"
            accept="image/*"
            multiple
            disabled={cargando || fotos.length >= MAX_IMAGENES}
            onChange={(e) => {
              anadir(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="hint" style={{ marginTop: 4 }}>
            Haz una general para situar la lesión y una de cerca. Si hay grieta, que se vea su dirección completa.
          </p>
        </div>

        {!!fotos.length && (
          <div className="grid g3" style={{ marginBottom: 12 }}>
            {fotos.map((f, i) => (
              <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.datos} alt={f.nombre} style={{ width: "100%", borderRadius: 6, display: "block" }} />
                <input
                  className="inp"
                  style={{ marginTop: 6 }}
                  placeholder="Dónde está (opcional)"
                  value={f.pie}
                  onChange={(e) =>
                    setFotos((prev) => prev.map((x, j) => (j === i ? { ...x, pie: e.target.value } : x)))
                  }
                />
                <button
                  className="btn sm ghost"
                  style={{ marginTop: 6 }}
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid g3">
          <div className="field">
            <label className="lbl">¿Cuándo aparece o empeora?</label>
            <select className="inp" value={ctx.cuando || ""} onChange={(e) => set("cuando", e.target.value as any)}>
              <option value="">No lo sé</option>
              <option value="invierno">En invierno o con frío</option>
              <option value="lluvia">Después de llover</option>
              <option value="siempre">Igual todo el año</option>
              <option value="empeorando">Va creciendo sin parar</option>
            </select>
            <p className="hint" style={{ marginTop: 4 }}>
              Es la pregunta que más separa una condensación de una filtración.
            </p>
          </div>

          <div className="field">
            <label className="lbl">Planta</label>
            <select className="inp" value={ctx.planta || ""} onChange={(e) => set("planta", e.target.value as any)}>
              <option value="">No lo sé</option>
              <option value="sotano">Sótano o semisótano</option>
              <option value="baja">Planta baja</option>
              <option value="intermedia">Planta intermedia</option>
              <option value="ultima">Última planta</option>
            </select>
          </div>

          <div className="field">
            <label className="lbl">¿Qué hay justo encima?</label>
            <select className="inp" value={ctx.encima || ""} onChange={(e) => set("encima", e.target.value as any)}>
              <option value="">No lo sé</option>
              <option value="cubierta">Cubierta o terraza</option>
              <option value="bano-cocina">Un baño o una cocina</option>
              <option value="vivienda">Otra vivienda</option>
              <option value="nada">Nada relevante</option>
            </select>
          </div>

          <div className="field">
            <label className="lbl">¿El paramento da al exterior?</label>
            <select
              className="inp"
              value={ctx.exterior === null || ctx.exterior === undefined ? "" : ctx.exterior ? "si" : "no"}
              onChange={(e) => set("exterior", e.target.value === "" ? null : e.target.value === "si")}
            >
              <option value="">No lo sé</option>
              <option value="si">Sí, es muro de fachada</option>
              <option value="no">No, es interior</option>
            </select>
          </div>

          <div className="field">
            <label className="lbl">Estancia</label>
            <input
              className="inp"
              placeholder="Baño, dormitorio, garaje…"
              value={ctx.estancia || ""}
              onChange={(e) => set("estancia", e.target.value)}
            />
          </div>

          <div className="field">
            <label className="lbl">Antigüedad del edificio (años)</label>
            <input
              className="inp"
              type="number"
              min={0}
              placeholder="Aproximada"
              value={ctx.antiguedad ?? ""}
              onChange={(e) => set("antiguedad", e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="lbl">¿Ventila la estancia?</label>
            <select className="inp" value={ctx.ventilacion || ""} onChange={(e) => set("ventilacion", e.target.value as any)}>
              <option value="">No lo sé</option>
              <option value="si">Sí, y la extracción funciona</option>
              <option value="no">No, o no funciona</option>
            </select>
          </div>

          <div className="field">
            <label className="lbl">¿Obra o excavación reciente cerca?</label>
            <select
              className="inp"
              value={ctx.obraCerca ? "si" : "no"}
              onChange={(e) => set("obraCerca", e.target.value === "si")}
            >
              <option value="no">No</option>
              <option value="si">Sí, en la parcela contigua o en la calle</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="lbl">Qué cuenta la propiedad (opcional)</label>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <textarea
              className="inp"
              style={{ flex: 1, minWidth: 220 }}
              rows={3}
              placeholder="Desde cuándo pasa, si ha ido a más, si se reparó antes…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <Dictar disabled={cargando} onTexto={(t) => setDescripcion((p) => (p ? `${p} ${t}` : t))} />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="row">
          <button className="btn" disabled={cargando || !fotos.length} onClick={analizar}>
            {cargando ? "Analizando…" : "Analizar las fotos"}
          </button>
          {!!res && (
            <button className="btn ghost" onClick={() => copiar(res)}>
              {copiado ? "Copiado" : "Copiar para el informe"}
            </button>
          )}
        </div>
      </div>

      {res && (
        <>
          {!!res.avisos.length && (
            <div className="card">
              {res.avisos.map((a, i) => (
                <p key={i} className="hint" style={{ margin: i ? "6px 0 0" : 0 }}>
                  {a}
                </p>
              ))}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Lo que se ve en las fotos</h3>
            {res.observaciones.map((o) => (
              <p key={o.imagen} style={{ margin: "0 0 8px" }}>
                <strong>Imagen {o.imagen}.</strong> {o.loQueSeVe || "No se aprecia nada valorable."}
              </p>
            ))}
          </div>

          {!!res.candidatos.length && (
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{res.concluyente ? "Diagnóstico" : "Diagnóstico provisional"}</h3>
                {res.urgencia && (
                  <span className={`badge ${CLASE_URGENCIA[res.urgencia.nivel] || "b-borrador"}`}>
                    Urgencia {res.urgencia.nivel}
                  </span>
                )}
              </div>

              {!res.concluyente && (
                <p className="hint" style={{ marginTop: 0 }}>
                  Con una fotografía no se puede cerrar este diagnóstico: hay más de una patología compatible con lo que
                  se ve. Abajo tienes qué comprobar en la visita para decidir cuál es.
                </p>
              )}
              {res.urgencia && <p style={{ marginTop: 0 }}>{res.urgencia.porQue}</p>}

              {res.candidatos.map((c, i) => (
                <details key={c.id} open={i === 0} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    {c.etiqueta} <span className="hint">· {c.familia}</span>
                  </summary>

                  {!!c.motivos.length && (
                    <ul className="hint" style={{ margin: "8px 0", paddingLeft: 18 }}>
                      {c.motivos.map((m, j) => (
                        <li key={j}>{m}</li>
                      ))}
                    </ul>
                  )}

                  <p style={{ marginBottom: 4 }}>
                    <strong>Causas habituales</strong>
                  </p>
                  <ul style={{ marginTop: 0, paddingLeft: 18 }}>
                    {c.causas.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ul>

                  <p style={{ marginBottom: 4 }}>
                    <strong>Actuación</strong>
                  </p>
                  <ol style={{ marginTop: 0, paddingLeft: 18 }}>
                    {c.actuacion.map((x, j) => (
                      <li key={j}>{x}</li>
                    ))}
                  </ol>

                  {!!c.partidas.length && (
                    <>
                      <p style={{ marginBottom: 4 }}>
                        <strong>Partidas orientativas</strong>
                      </p>
                      <table className="t">
                        <tbody>
                          {c.partidas.map((p) => (
                            <tr key={p.concepto}>
                              <td>{p.concepto}</td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {p.precio} €/{p.unidad}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="hint" style={{ marginTop: 4 }}>
                        Sin cantidades a propósito: la medición sale de la visita, no de la foto.
                      </p>
                    </>
                  )}

                  {!!c.normativa.length && (
                    <div style={{ marginTop: 8 }}>
                      {c.normativa.map((n, j) => (
                        <p key={j} className="hint" style={{ margin: "0 0 4px" }}>
                          📖 <strong>{n.tema}.</strong> {n.respuesta} <em>{n.fuente}</em>
                        </p>
                      ))}
                    </div>
                  )}

                  {c.derivar && (
                    <p style={{ marginTop: 8, padding: 10, background: "#FCF0D8", borderRadius: 6 }}>
                      <strong>Cuándo llamar a un técnico.</strong> {c.derivar}
                    </p>
                  )}
                </details>
              ))}
            </div>
          )}

          {!!res.diferencial.length && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Cómo distinguirlo de lo que se le parece</h3>
              {res.diferencial.map((d, i) => (
                <p key={i} style={{ margin: "0 0 8px" }}>
                  <strong>Frente a {d.con}:</strong> {d.comoDistinguir}
                </p>
              ))}
            </div>
          )}

          {!!res.comprobaciones.length && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Qué comprobar en la visita</h3>
              <ol style={{ paddingLeft: 18 }}>
                {res.comprobaciones.map((c, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {c}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!!res.descartados.length && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Descartadas por el contexto</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                Se parecían en la foto, pero los datos de la visita las descartan. Si algún dato no era correcto,
                cámbialo arriba y vuelve a analizar.
              </p>
              {res.descartados.map((d, i) => (
                <p key={i} style={{ margin: "0 0 6px" }}>
                  <strong>{d.etiqueta}.</strong> <span className="hint">{d.motivos.join(" ")}</span>
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
