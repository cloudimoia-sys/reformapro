"use client";

import { useState } from "react";
import type { LineaIA } from "@/app/(app)/presupuestos/actions";

type Form = { tipo: string; m2: string; calidad: string; estancias: string; detalles: string };

/** Una estancia leída del plano. `m2` es null cuando el plano no la trae escrita. */
type EstanciaPlano = { nombre: string; m2: number | null };

type Plano = {
  estancias: EstanciaPlano[];
  superficieUtil: number | null;
  superficieConstruida: number | null;
  plantas: number | null;
  estructura: string | null;
  notas: string | null;
  sinSuperficies: boolean;
};

/**
 * Lado máximo al que se reduce una imagen antes de enviarla.
 *
 * 2000 px mantiene legible la rotulación de un plano (que es lo único que nos
 * interesa) y evita que una foto de móvil de 12 Mpx se pase del límite de tamaño
 * de petición de Vercel.
 */
const PLANO_MAX_LADO = 2000;

/** Los PDF se mandan tal cual: rasterizarlos aquí estropearía el texto vectorial. */
function prepararPlano(file: File): Promise<{ mimeType: string; datos: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === "application/pdf") {
        return resolve({ mimeType: "application/pdf", datos: dataUrl.split(",")[1] });
      }
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        const escala = Math.min(1, PLANO_MAX_LADO / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * escala));
        canvas.height = Math.max(1, Math.round(img.height * escala));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        // Fondo blanco: un PNG con transparencia se vería negro y la IA no leería nada.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ mimeType: "image/jpeg", datos: canvas.toDataURL("image/jpeg", 0.9).split(",")[1] });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

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
  onDone: (lineas: LineaIA[], meta: { tipo: string; m2?: string }) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Form>({ tipo: "Baño completo", m2: "", calidad: "Media", estancias: "", detalles: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plano, setPlano] = useState<Plano | null>(null);
  const [leyendoPlano, setLeyendoPlano] = useState(false);
  const [errorPlano, setErrorPlano] = useState("");
  const set = (k: keyof Form, v: string) => setF({ ...f, [k]: v });

  const subirPlano = async (file: File | undefined) => {
    if (!file) return;
    setErrorPlano("");
    setLeyendoPlano(true);
    try {
      const archivo = await prepararPlano(file);
      const r = await fetch("/api/leer-plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archivo),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo leer el plano.");

      setPlano(d);
      // Se rellenan los campos del formulario con lo leído, pero quedan editables:
      // el usuario tiene la última palabra sobre las cifras que va a presupuestar.
      const total = d.superficieUtil || d.superficieConstruida;
      setF((prev) => ({
        ...prev,
        m2: total ? String(total) : prev.m2,
        estancias: d.estancias.length
          ? d.estancias.map((e: EstanciaPlano) => e.nombre).join(", ")
          : prev.estancias,
      }));
    } catch (e: any) {
      setErrorPlano(e?.message || "No se pudo leer el plano.");
    } finally {
      setLeyendoPlano(false);
    }
  };

  const editarEstancia = (i: number, campo: "nombre" | "m2", valor: string) => {
    if (!plano) return;
    const estancias = plano.estancias.map((e, j) =>
      j !== i ? e : { ...e, [campo]: campo === "m2" ? (valor === "" ? null : Number(valor)) : valor }
    );
    setPlano({ ...plano, estancias });
  };

  const quitarPlano = () => {
    setPlano(null);
    setErrorPlano("");
  };

  /** Suma de lo confirmado: es lo que se manda a presupuestar, no lo que leyó la IA. */
  const totalConfirmado = plano?.estancias.reduce((s, e) => s + (e.m2 || 0), 0) || 0;

  const generar = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/generar-presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          // Solo viajan las estancias con superficie confirmada: una estancia sin
          // m² no aporta nada al cálculo y solo induciría a la IA a inventárselos.
          plano: plano
            ? {
                estancias: plano.estancias.filter((e) => e.m2),
                superficieConstruida: plano.superficieConstruida,
                plantas: plano.plantas,
                estructura: plano.estructura,
                notas: plano.notas,
              }
            : null,
        }),
      });

      if (!r.ok) {
        // El servidor manda un motivo en español; si no llega nada legible es que
        // la petición se cortó por el camino (normalmente, por tardar demasiado).
        const detalle = await r.json().catch(() => null);
        throw new Error(detalle?.error || "La generación tardó demasiado. Vuelve a intentarlo.");
      }

      const data = await r.json();
      const lineas: LineaIA[] = data.lineas;
      if (!lineas?.length) throw new Error("La IA no devolvió ninguna partida. Vuelve a intentarlo.");

      // Se espera a que el presupuesto quede creado ANTES de cerrar el asistente.
      // Antes se cerraba primero y, si la creación fallaba, no se veía ningún
      // error: parecía que el botón no hacía nada.
      await onDone(lineas, { tipo: f.tipo, m2: f.m2 });
    } catch (e: any) {
      // redirect() de Next lanza una excepción especial para navegar; no es un fallo.
      if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
      setError(e?.message || "No se pudo generar el presupuesto. Vuelve a intentarlo o crea las partidas a mano.");
      setLoading(false);
    }
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
          <label className="lbl">Plano de la vivienda (opcional)</label>
          <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
            Sube el plano en PDF, PNG o JPG y se leerán las estancias y sus superficies. Solo se toman los datos
            escritos en el plano: <strong>no se miden sobre el dibujo</strong>, porque estimar a ojo da cifras muy
            equivocadas. Podrás revisar y corregir todo antes de generar.
          </p>
          {!plano && (
            <input
              className="inp"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              disabled={leyendoPlano}
              onChange={(e) => subirPlano(e.target.files?.[0])}
            />
          )}
          {leyendoPlano && <p className="hint">Leyendo el plano…</p>}
          {errorPlano && <p className="error">{errorPlano}</p>}

          {plano && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 15 }}>Comprueba lo leído del plano</strong>
                <div className="spacer" />
                <button className="btn sm ghost" onClick={quitarPlano}>Quitar plano</button>
              </div>

              {plano.sinSuperficies ? (
                <p className="hint">
                  El plano no trae superficies escritas, así que no se ha podido sacar ninguna medida fiable.
                  Escribe tú los m² totales abajo y sigue con normalidad.
                </p>
              ) : (
                <>
                  <p className="hint" style={{ marginTop: 0 }}>
                    Corrige lo que haga falta: estas cifras son las que se usarán para medir las partidas.
                  </p>
                  <table className="t">
                    <thead>
                      <tr><th>Estancia</th><th style={{ width: 120 }}>m²</th></tr>
                    </thead>
                    <tbody>
                      {plano.estancias.map((e, i) => (
                        <tr key={i}>
                          <td>
                            <input className="inp" value={e.nombre} onChange={(ev) => editarEstancia(i, "nombre", ev.target.value)} />
                          </td>
                          <td>
                            <input
                              className="inp"
                              type="number"
                              step="0.01"
                              value={e.m2 ?? ""}
                              placeholder="sin dato"
                              onChange={(ev) => editarEstancia(i, "m2", ev.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                      {!plano.estancias.length && (
                        <tr><td colSpan={2} className="hint">No se rotuló ninguna estancia en el plano.</td></tr>
                      )}
                    </tbody>
                  </table>
                  <p className="hint" style={{ marginBottom: 0 }}>
                    Suma confirmada: <strong>{totalConfirmado.toFixed(2)} m²</strong>
                    {plano.superficieUtil ? ` · útil según el plano: ${plano.superficieUtil} m²` : ""}
                    {plano.superficieConstruida ? ` · construida: ${plano.superficieConstruida} m²` : ""}
                  </p>
                </>
              )}
              {plano.estructura && <p className="hint" style={{ marginBottom: 0 }}>Estructura: {plano.estructura}</p>}
              {plano.notas && <p className="hint" style={{ marginBottom: 0 }}>Notas del plano: {plano.notas}</p>}
            </div>
          )}
        </div>

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
