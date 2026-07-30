"use client";

import { useState } from "react";
import type { ContenidoInforme, TipoInforme } from "@/lib/informe";
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
  const [inmueble, setInmueble] = useState("");
  const [refCatastral, setRefCatastral] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [perito, setPerito] = useState(peritoPorDefecto);
  const [titulacion, setTitulacion] = useState("");
  const [colegiado, setColegiado] = useState("");
  const [antecedentes, setAntecedentes] = useState("");
  const [danos, setDanos] = useState("");
  const [imagenes, setImagenes] = useState<ImagenLocal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

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

      await onDone(
        {
          tipo,
          titulo: d.titulo,
          inmueble,
          refCatastral,
          solicitante,
          perito,
          titulacion,
          colegiado,
          clienteId: clienteId || null,
        },
        d.contenido as ContenidoInforme,
        imagenes.map((im) => ({ datos: im.datos, pie: im.pie }))
      );
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
        <h2 style={{ fontSize: 24 }}>Nuevo informe con IA</h2>
        <p className="hint">
          La IA redacta el borrador a partir de lo que le cuentes y de las fotos que subas. Revísalo y corrígelo
          después: <strong>el informe lo firma quien lo entrega</strong>, y en un dictamen pericial debe hacerlo un
          técnico competente, que responde de su contenido.
        </p>

        <div className="grid g2">
          <div className="field">
            <label className="lbl">Tipo de informe</label>
            <select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value as TipoInforme)}>
              <option value="PATOLOGIAS">Informe técnico de patologías</option>
              <option value="PERICIAL">Dictamen pericial (judicial)</option>
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
          <label className="lbl">Daños observados: descríbelos con detalle</label>
          <textarea
            className="inp"
            rows={5}
            value={danos}
            onChange={(e) => setDanos(e.target.value)}
            placeholder="Cuanto más concreto, mejor sale. Ej: fisuras a 45º en tabiquería de planta primera, más abiertas hacia la medianera; desnivel apreciable en el solado del salón; puerta de paso que roza; grieta vertical en fachada junto al encuentro con la medianera."
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
