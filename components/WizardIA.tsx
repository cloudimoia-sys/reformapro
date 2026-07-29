"use client";

import { useState } from "react";
import type { LineaIA } from "@/app/(app)/presupuestos/actions";

type Form = { tipo: string; m2: string; calidad: string; estancias: string; detalles: string };

/**
 * Agrupado por familias para que se vea de un vistazo que la herramienta no es
 * solo de reformas pequeñas: un constructor tiene que encontrar aquí su trabajo,
 * sea sustituir una vigueta o levantar una nave.
 */
const TIPOS: { grupo: string; opciones: string[] }[] = [
  {
    grupo: "Reformas de vivienda",
    opciones: [
      "Baño completo",
      "Cocina completa",
      "Reforma integral de vivienda",
      "Pintura y acabados",
      "Suelos y alicatados",
      "Cambio de ventanas y carpintería",
      "Adaptación de accesibilidad",
    ],
  },
  {
    grupo: "Estructura y cimentación",
    opciones: [
      "Sustitución de viguetas o bovedillas",
      "Refuerzo o reparación de forjado",
      "Sustitución de vigas o pilares",
      "Recalce o refuerzo de cimentación",
      "Apertura de hueco en muro de carga",
      "Reparación de estructura de madera",
      "Tratamiento de aluminosis o patologías del hormigón",
    ],
  },
  {
    grupo: "Obra nueva y ampliación",
    opciones: [
      "Vivienda unifamiliar de obra nueva",
      "Ampliación o levante de planta",
      "Nave industrial o almacén",
      "Garaje, trastero o caseta",
      "Piscina",
    ],
  },
  {
    grupo: "Envolvente del edificio",
    opciones: [
      "Cubierta o tejado",
      "Impermeabilización",
      "Fachada y aislamiento (SATE)",
      "Rehabilitación energética",
    ],
  },
  {
    grupo: "Instalaciones",
    opciones: [
      "Fontanería y saneamiento",
      "Instalación eléctrica y boletín",
      "Climatización y ventilación",
      "Placas solares",
    ],
  },
  {
    grupo: "Exterior y otros",
    opciones: [
      "Local comercial",
      "Urbanización, pavimentos y muros",
      "Demolición o derribo",
      "Movimiento de tierras",
      "Otra (descríbela en los detalles)",
    ],
  },
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
          Responde a estas preguntas y la IA propondrá las partidas por capítulos de obra —incluidos estructura,
          cimentación, seguridad y salud o gestión de residuos cuando el trabajo lo requiera—, con precios de
          referencia del mercado español. Después podrás editarlo todo antes de generar el documento; contrasta
          siempre los precios con tu zona.
        </p>
        <div className="field">
          <label className="lbl">¿Qué tipo de obra es?</label>
          <select className="inp" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.opciones.map((o) => <option key={o}>{o}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid g2">
          <div className="field">
            <label className="lbl">¿Cuántos m² aproximados?</label>
            <input className="inp" type="number" value={f.m2} onChange={(e) => set("m2", e.target.value)} placeholder="Ej: 8 (o 120 en obra nueva)" />
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
          <label className="lbl">¿Qué zonas o estancias afecta?</label>
          <input
            className="inp"
            value={f.estancias}
            onChange={(e) => set("estancias", e.target.value)}
            placeholder="Ej: baño principal y aseo · forjado de planta primera · cubierta trasera"
          />
        </div>
        <div className="field">
          <label className="lbl">Detalles: ¿qué hay que hacer exactamente?</label>
          <textarea
            className="inp"
            rows={4}
            value={f.detalles}
            onChange={(e) => set("detalles", e.target.value)}
            placeholder="Cuanto más concreto, mejor sale. Ej: sustituir 6 viguetas de hormigón afectadas por aluminosis en el forjado del salón, con apeo previo, bovedillas cerámicas nuevas y capa de compresión; se accede por patio interior, sin sitio para grúa."
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
