"use client";

import { useState } from "react";
import type { ContenidoInforme, TipoInforme } from "@/lib/informe";
import { DOCUMENTOS, documentosPorGrupo } from "@/lib/documentos";
import {
  ETIQUETA_SISTEMA,
  ETIQUETA_TIPO_VIVIENDA,
  ETIQUETA_VENTANA,
  zonaClimatica,
  type DatosEnergeticos,
} from "@/lib/energia";
import Dictar from "@/components/Dictar";
import type { DatosInforme, FotoNueva } from "@/app/(app)/informes/actions";

/**
 * Lado máximo de las imágenes.
 *
 * 1600 px deja ver una fisura con detalle y mantiene el archivo en torno a
 * 200 KB. Importa porque las fotos se guardan en la base de datos (el plan
 * gratuito no incluye almacenamiento de archivos) y porque el cuerpo de una
 * petición en Vercel se corta sobre los 4,5 MB.
 */
const MAX_LADO = 1600;
const MAX_IMAGENES = 8;

type ImagenLocal = { datos: string; mimeType: string; pie: string; esPlano: boolean; nombre: string };

function prepararImagen(file: File): Promise<{ datos: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === "application/pdf") {
        return resolve({ datos: dataUrl, mimeType: "application/pdf" });
      }
      const img = new Image();
      img.onerror = () => reject(new Error(`"${file.name}" no es una imagen válida.`));
      img.onload = () => {
        const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ datos: canvas.toDataURL("image/jpeg", 0.82), mimeType: "image/jpeg" });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function AsistenteInforme({
  clientes,
  peritoPorDefecto,
  onDone,
  onCancel,
}: {
  clientes: { id: string; nombre: string }[];
  peritoPorDefecto: string;
  onDone: (datos: DatosInforme, contenido: ContenidoInforme, fotos: FotoNueva[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [tipo, setTipo] = useState<TipoInforme>("PATOLOGIAS");
  const def = DOCUMENTOS[tipo];
  const [inmueble, setInmueble] = useState("");
  const [refCatastral, setRefCatastral] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [perito, setPerito] = useState(peritoPorDefecto);
  const [titulacion, setTitulacion] = useState("");
  const [colegiado, setColegiado] = useState("");
  const [antecedentes, setAntecedentes] = useState("");

  /**
   * Datos de la evaluación energética.
   *
   * Van en un formulario y no en el texto libre porque de aquí sale un CÁLCULO,
   * no una redacción: la época de construcción, la zona climática y el sistema
   * de calefacción deciden el rango de letra y qué mejoras se proponen. Si se
   * dejaran a que la IA los dedujera del relato, dos informes de la misma
   * vivienda darían resultados distintos.
   */
  const [energia, setEnergia] = useState<DatosEnergeticos>({
    provincia: "",
    altitud: undefined,
    anio: 1975,
    superficie: 90,
    tipo: "PISO_INTERMEDIO",
    ventanas: "SIMPLE_METAL",
    fachadaAislada: false,
    cubiertaAislada: false,
    sistemaCalefaccion: "CALDERA_GAS",
    sistemaAcs: "CALDERA_GAS",
    renovables: false,
  });
  const esEnergetica = tipo === "EVALUACION_ENERGETICA";
  const ponEnergia = <K extends keyof DatosEnergeticos>(k: K, v: DatosEnergeticos[K]) =>
    setEnergia((prev) => ({ ...prev, [k]: v }));
  const [danos, setDanos] = useState("");
  const [imagenes, setImagenes] = useState<ImagenLocal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [revisar, setRevisar] = useState<string[]>([]);
  /** Informe generado a la espera de que el usuario decida, tras un aviso. */
  const [pendiente, setPendiente] = useState<{ datos: DatosInforme; contenido: ContenidoInforme } | null>(null);

  const anadirImagenes = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const hueco = MAX_IMAGENES - imagenes.length;
    if (hueco <= 0) return setError(`Máximo ${MAX_IMAGENES} imágenes para el análisis.`);
    const nuevas: ImagenLocal[] = [];
    for (const file of Array.from(files).slice(0, hueco)) {
      try {
        const { datos, mimeType } = await prepararImagen(file);
        nuevas.push({
          datos,
          mimeType,
          pie: "",
          // Se marca como plano por el nombre, y el usuario lo corrige con la
          // casilla: al modelo le cambia mucho saber si mira una foto o un plano.
          esPlano: /plano|planta|alzado|seccion|sección/i.test(file.name) || file.type === "application/pdf",
          nombre: file.name,
        });
      } catch (e: any) {
        setError(e?.message || "No se pudo procesar una de las imágenes.");
      }
    }
    setImagenes((prev) => [...prev, ...nuevas]);
  };

  const editarImagen = (i: number, campo: "pie" | "esPlano", valor: string | boolean) =>
    setImagenes((prev) => prev.map((im, j) => (j === i ? { ...im, [campo]: valor } : im)));

  const quitarImagen = (i: number) => setImagenes((prev) => prev.filter((_, j) => j !== i));

  const generar = async () => {
    if (!danos.trim()) return setError("Describe los daños observados: es lo que da contenido al informe.");
    setCargando(true);
    setError("");
    setAviso("");
    setRevisar([]);
    setPendiente(null);
    try {
      const r = await fetch("/api/generar-informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          inmueble,
          solicitante,
          perito,
          titulacion,
          colegiado,
          antecedentes,
          danos,
          // Solo viaja cuando es el documento que lo usa: mandarlo siempre
          // metería en el prompt de un acta de visita datos que no pintan nada.
          energia: esEnergetica ? energia : null,
          imagenes: imagenes.map((im) => ({
            // El data URL lleva delante "data:image/jpeg;base64,": la API espera
            // solo la parte codificada.
            datos: im.datos.split(",")[1],
            mimeType: im.mimeType,
            pie: im.pie,
            esPlano: im.esPlano,
          })),
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo generar el informe.");

      if (d.vacios?.length) {
        setAviso(`La IA dejó sin redactar: ${d.vacios.join("; ")}. Complétalo en el editor antes de entregarlo.`);
      }

      const datos: DatosInforme = {
        tipo,
        titulo: d.titulo,
        inmueble,
        refCatastral,
        solicitante,
        perito,
        titulacion,
        colegiado,
        clienteId: clienteId || null,
      };

      // Avisos de calidad (texto en otro idioma, partidas obligatorias que
      // faltan, informe grave sin fotos). Se PARA aquí: si se creara el informe y
      // se redirigiera al editor, el aviso se perdería de vista y el documento
      // saldría con el fallo, que es justo lo que pasó con un informe real.
      if (d.avisos?.length) {
        setRevisar(d.avisos);
        setPendiente({ datos, contenido: d.contenido as ContenidoInforme });
        setCargando(false);
        return;
      }

      await onDone(datos, d.contenido as ContenidoInforme, imagenes.map((im) => ({ datos: im.datos, pie: im.pie })));
    } catch (e: any) {
      if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
      setError(e?.message || "No se pudo generar el informe.");
      setCargando(false);
    }
  };

  return (
    <div className="modalbg">
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="tapebar" style={{ margin: "-22px -22px 16px" }} />
        <h2 style={{ fontSize: 24 }}>Nuevo documento con IA</h2>
        <p className="hint">
          La IA redacta el borrador a partir de lo que le cuentes y de las fotos que subas. Revísalo y corrígelo
          después: <strong>el documento lo firma quien lo entrega</strong> y responde de su contenido.
        </p>
        {def.advertencia && (
          <p className="hint" style={{ color: "var(--amber-d, #92400e)" }}><strong>{def.advertencia}</strong></p>
        )}

        <div className="grid g2">
          <div className="field">
            <label className="lbl">Tipo de informe</label>
            <select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value as TipoInforme)}>
              {documentosPorGrupo().map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.docs.map(({ tipo: t, def: d }) => (
                    <option key={t} value={t}>{d.etiqueta}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Cliente (opcional)</label>
            <select className="inp" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="lbl">Inmueble: dirección completa</label>
          <input className="inp" value={inmueble} onChange={(e) => setInmueble(e.target.value)} placeholder="C/ Ejemplo 12, 3º B, Antequera (Málaga)" />
        </div>

        <div className="grid g2">
          <div className="field">
            <label className="lbl">Referencia catastral (opcional)</label>
            <input className="inp" value={refCatastral} onChange={(e) => setRefCatastral(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Solicitante (opcional)</label>
            <input className="inp" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Comunidad de propietarios, aseguradora, juzgado…" />
          </div>
        </div>

        {esEnergetica && (
          <div
            className="card"
            style={{ background: "#F7F9F8", padding: 14, marginBottom: 14 }}
          >
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>Datos de la vivienda</h3>
            <p className="hint" style={{ marginTop: 0 }}>
              Con esto el programa calcula la zona climática, el rango de calificación y qué mejoras merecen la pena.
              No lo redacta la IA: se calcula, para que la misma vivienda dé siempre el mismo resultado.
            </p>

            <div className="grid g3">
              <div className="field">
                <label className="lbl">Provincia</label>
                <input
                  className="inp"
                  value={energia.provincia}
                  onChange={(e) => ponEnergia("provincia", e.target.value)}
                  placeholder="Málaga"
                />
              </div>
              <div className="field">
                <label className="lbl">Altitud (m, opcional)</label>
                <input
                  className="inp"
                  type="number"
                  value={energia.altitud ?? ""}
                  onChange={(e) => ponEnergia("altitud", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="575"
                />
              </div>
              <div className="field">
                <label className="lbl">Zona climática</label>
                {/* Se enseña en cuanto escribe la provincia: si sale "—" es que
                    no la ha reconocido, y así se entera antes de generar. */}
                <input className="inp" value={zonaClimatica(energia.provincia, energia.altitud) || "—"} readOnly />
              </div>
            </div>

            <div className="grid g3">
              <div className="field">
                <label className="lbl">Año de construcción</label>
                <input
                  className="inp"
                  type="number"
                  value={energia.anio}
                  onChange={(e) => ponEnergia("anio", Number(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label className="lbl">Superficie útil (m²)</label>
                <input
                  className="inp"
                  type="number"
                  value={energia.superficie}
                  onChange={(e) => ponEnergia("superficie", Number(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label className="lbl">Tipología</label>
                <select
                  className="inp"
                  value={energia.tipo}
                  onChange={(e) => ponEnergia("tipo", e.target.value as DatosEnergeticos["tipo"])}
                >
                  {Object.entries(ETIQUETA_TIPO_VIVIENDA).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="lbl">Ventanas</label>
              <select
                className="inp"
                value={energia.ventanas}
                onChange={(e) => ponEnergia("ventanas", e.target.value as DatosEnergeticos["ventanas"])}
              >
                {Object.entries(ETIQUETA_VENTANA).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="grid g2">
              <div className="field">
                <label className="lbl">Calefacción</label>
                <select
                  className="inp"
                  value={energia.sistemaCalefaccion}
                  onChange={(e) => ponEnergia("sistemaCalefaccion", e.target.value as DatosEnergeticos["sistemaCalefaccion"])}
                >
                  {Object.entries(ETIQUETA_SISTEMA).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="lbl">Agua caliente sanitaria</label>
                <select
                  className="inp"
                  value={energia.sistemaAcs}
                  onChange={(e) => ponEnergia("sistemaAcs", e.target.value as DatosEnergeticos["sistemaAcs"])}
                >
                  {Object.entries(ETIQUETA_SISTEMA).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row" style={{ gap: 18 }}>
              <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={energia.fachadaAislada}
                  onChange={(e) => ponEnergia("fachadaAislada", e.target.checked)}
                />
                Fachada ya aislada
              </label>
              <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={energia.cubiertaAislada}
                  onChange={(e) => ponEnergia("cubiertaAislada", e.target.checked)}
                />
                Cubierta ya aislada
              </label>
              <label className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={energia.renovables}
                  onChange={(e) => ponEnergia("renovables", e.target.checked)}
                />
                Tiene placas solares
              </label>
            </div>
          </div>
        )}

        <div className="grid g3">
          <div className="field">
            <label className="lbl">Técnico que firma</label>
            <input className="inp" value={perito} onChange={(e) => setPerito(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl">Titulación</label>
            <input className="inp" value={titulacion} onChange={(e) => setTitulacion(e.target.value)} placeholder="Arquitecto Técnico" />
          </div>
          <div className="field">
            <label className="lbl">Nº colegiado</label>
            <input className="inp" value={colegiado} onChange={(e) => setColegiado(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label className="lbl">Antecedentes (opcional)</label>
          <textarea className="inp" rows={2} value={antecedentes} onChange={(e) => setAntecedentes(e.target.value)} placeholder="Ej: obra de nueva planta en la parcela colindante, con vaciado y muro pantalla, iniciada hace 8 meses." />
        </div>

        <div className="field">
          <div className="row" style={{ marginBottom: 4 }}>
            <label className="lbl" style={{ margin: 0 }}>{def.pregunta}</label>
            <div className="spacer" />
            {/* Dictar aquí y no en los campos cortos: este es el que se rellena en
                obra, con el móvil en la mano y diez líneas por escribir. */}
            <Dictar
              disabled={cargando}
              onTexto={(t) => setDanos((prev) => (prev ? `${prev} ${t}` : t))}
            />
          </div>
          <textarea
            className="inp"
            rows={5}
            value={danos}
            onChange={(e) => setDanos(e.target.value)}
            placeholder={`Cuanto más concreto, mejor sale. Ej: ${def.ejemplo}`}
          />
        </div>

        <div className="field">
          <label className="lbl">Fotos y planos (opcional, hasta {MAX_IMAGENES})</label>
          <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
            La IA las analiza y las cita en el texto. Pon un pie a cada una diciendo qué se ve y dónde: es lo que
            convierte una foto en prueba. Se adjuntan al informe en un anexo fotográfico.
          </p>
          <input
            className="inp"
            type="file"
            accept="image/*,application/pdf"
            multiple
            disabled={cargando || imagenes.length >= MAX_IMAGENES}
            onChange={(e) => { anadirImagenes(e.target.files); e.target.value = ""; }}
          />
          {imagenes.map((im, i) => (
            <div key={i} className="row" style={{ marginTop: 8, alignItems: "flex-start", gap: 8 }}>
              {im.mimeType === "application/pdf" ? (
                <div style={{ width: 74, height: 56, border: "1px solid var(--line)", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 11 }}>PDF</div>
              ) : (
                <img src={im.datos} alt="" style={{ width: 74, height: 56, objectFit: "cover", border: "1px solid var(--line)", borderRadius: 6 }} />
              )}
              <div style={{ flex: 1 }}>
                <input className="inp" value={im.pie} placeholder={`Pie de la imagen ${i + 1} — qué se ve y dónde`} onChange={(e) => editarImagen(i, "pie", e.target.value)} />
                <label className="hint" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input type="checkbox" checked={im.esPlano} onChange={(e) => editarImagen(i, "esPlano", e.target.checked)} />
                  Es un plano, no una foto
                </label>
              </div>
              <button className="btn sm red" onClick={() => quitarImagen(i)}>Quitar</button>
            </div>
          ))}
        </div>

        {revisar.length > 0 && (
          <div style={{ border: "1px solid var(--amber)", background: "#FFFBF0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Revisa esto antes de entregar el informe</strong>
            <ul style={{ margin: "6px 0 0 18px", fontSize: 13 }}>
              {revisar.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn sm"
                disabled={cargando}
                onClick={async () => {
                  if (!pendiente) return;
                  setCargando(true);
                  try {
                    await onDone(pendiente.datos, pendiente.contenido, imagenes.map((im) => ({ datos: im.datos, pie: im.pie })));
                  } catch (e: any) {
                    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
                    setError(e?.message || "No se pudo crear el informe.");
                    setCargando(false);
                  }
                }}
              >
                Continuar y corregirlo en el editor
              </button>
              <button className="btn sm ghost" disabled={cargando} onClick={generar}>
                Volver a generar
              </button>
            </div>
          </div>
        )}
        {aviso && <p className="hint" style={{ color: "var(--amber, #b45309)" }}>{aviso}</p>}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <div className="spacer" />
          <button className="btn ghost" onClick={onCancel} disabled={cargando}>Cancelar</button>
          <button className="btn amber" onClick={generar} disabled={cargando}>
            {cargando ? "Redactando informe…" : "Generar informe"}
          </button>
        </div>
      </div>
    </div>
  );
}
