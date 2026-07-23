"use client";

import { useState } from "react";
import type { LineaIA } from "@/app/(app)/presupuestos/actions";

type Form = { tipo: string; m2: string; calidad: string; estancias: string; detalles: string };

const TIPOS = [
  "Baño completo",
  "Cocina completa",
  "Reforma integral de vivienda",
  "Pintura y acabados",
  "Suelos y alicatados",
  "Local comercial",
  "Fachada / exterior",
  "Otra",
];

export default function WizardIA({
  onDone,
  onCancel,
}: {
  onDone: (lineas: LineaIA[], meta: { tipo: string; m2?: string }) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Form>({ tipo: "Baño completo", m2: "", calidad: "Media", estancias: "", detalles: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof Form, v: string) => setF({ ...f, [k]: v });

  const generar = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/generar-presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!r.ok) throw new Error("fallo de red");
      const data = await r.json();
      const lineas: LineaIA[] = data.lineas;
      if (!lineas?.length) throw new Error("sin partidas");
      onDone(lineas, { tipo: f.tipo, m2: f.m2 });
    } catch {
      setError("No se pudo generar el presupuesto. Vuelve a intentarlo o crea las partidas a mano.");
    }
    setLoading(false);
  };

  return (
    <div className="modalbg">
      <div className="modal">
        <div className="tapebar" style={{ margin: "-22px -22px 16px" }} />
        <h2 style={{ fontSize: 24 }}>Asistente IA de presupuestos</h2>
        <p className="hint">
          Responde a estas preguntas básicas y la IA propondrá las partidas por capítulos de obra, con precios de
          referencia del mercado español. Después podrás editarlo todo antes de generar el documento — contrasta
          siempre los precios con tu zona.
        </p>
        <div className="field">
          <label className="lbl">¿Qué tipo de reforma es?</label>
          <select className="inp" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="grid g2">
          <div className="field">
            <label className="lbl">¿Cuántos m² aproximados?</label>
            <input className="inp" type="number" value={f.m2} onChange={(e) => set("m2", e.target.value)} placeholder="Ej: 8" />
          </div>
          <div className="field">
            <label className="lbl">¿Qué calidad de materiales?</label>
            <select className="inp" value={f.calidad} onChange={(e) => set("calidad", e.target.value)}>
              <option>Básica</option>
              <option>Media</option>
              <option>Alta</option>
              <option>Premium</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label className="lbl">¿Qué estancias afecta?</label>
          <input className="inp" value={f.estancias} onChange={(e) => set("estancias", e.target.value)} placeholder="Ej: baño principal y aseo" />
        </div>
        <div className="field">
          <label className="lbl">Detalles: ¿qué quiere el cliente exactamente?</label>
          <textarea
            className="inp"
            rows={3}
            value={f.detalles}
            onChange={(e) => set("detalles", e.target.value)}
            placeholder="Ej: cambiar bañera por plato de ducha, alicatado nuevo, mampara de cristal, mueble suspendido..."
          />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <div className="spacer" />
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn amber" onClick={generar} disabled={loading}>
            {loading ? "Generando partidas…" : "Generar con IA"}
          </button>
        </div>
      </div>
    </div>
  );
}
