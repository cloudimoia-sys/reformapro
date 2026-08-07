"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import {
  estadoParteClase,
  estadoParteLabel,
  importeLineaParte,
  totalesParte,
  ETIQUETA_TIPO_LINEA,
  type LineaGeneradaParte,
} from "@/lib/parteTrabajo";
import { exportParteImprimir, exportParteWord, exportParteExcel } from "@/lib/parteExport";
import SignaturePad from "@/components/SignaturePad";
import SelectUnidad from "@/components/SelectUnidad";
import Dictar from "@/components/Dictar";
import {
  actualizarParte,
  agregarLinea,
  agregarMaterialDelCatalogo,
  agregarLineasGeneradas,
  actualizarLinea,
  borrarLinea,
  anadirFotos,
  actualizarPieFoto,
  borrarFoto,
  guardarFirmaParte,
  reabrirParte,
  type ParteInput,
  type LineaParteInput,
} from "../actions";

type Cliente = { id: string; nombre: string; direccion: string; nif: string };
type Obra = { id: string; nombre: string };
type Producto = { id: string; nombre: string; unidad: string; precio: number; tipo: "MATERIAL" | "PARTIDA" };
type Linea = {
  id: string;
  tipo: "MANO_OBRA" | "MATERIAL";
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  codigoErp: string;
};
type Foto = { id: string; datos: string; pie: string };
type ParteData = {
  id: string;
  numero: string;
  titulo: string;
  codigoErp: string;
  clienteId: string;
  obraId: string;
  direccion: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tecnico: string;
  descripcion: string;
  observaciones: string;
  estado: string;
  firma: string | null;
  fechaFirma: string | null;
  lineas: Linea[];
  fotos: Foto[];
};
type Empresa = { nombre: string; cif: string; direccion: string; tel: string; email: string };

/**
 * Cuánto se encoge una foto antes de subirla.
 *
 * Igual que en el resto de la aplicación (Diagnóstico, Informes): cada archivo
 * se guarda como texto en la base de datos, así que un móvil moderno de 12 MP
 * sin tocar convertiría un parte con diez fotos en varios megas de fila.
 */
const MAX_LADO = 1600;
const MAX_FOTOS = 12;

function prepararFoto(file: File): Promise<{ datos: string }> {
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
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ datos: canvas.toDataURL("image/jpeg", 0.82) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const LINEA_VACIA = (tipo: "MANO_OBRA" | "MATERIAL"): LineaParteInput => ({
  tipo,
  concepto: "",
  descripcion: "",
  cantidad: 1,
  unidad: tipo === "MANO_OBRA" ? "h" : "ud",
  precio: 0,
  codigoErp: null,
});

export default function ParteEditor({
  parte,
  clientes,
  obras,
  productos,
  empresa,
  tecnicoPorDefecto,
  isAdmin,
}: {
  parte: ParteData;
  clientes: Cliente[];
  obras: Obra[];
  productos: Producto[];
  empresa: Empresa;
  tecnicoPorDefecto: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState(parte);
  const [firmando, setFirmando] = useState(false);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [error, setError] = useState("");

  /**
   * Propuesta de la IA a partir de lo dictado en "Trabajo realizado", A LA
   * ESPERA de que el técnico la revise. No se guarda nada en el parte hasta
   * que él pulsa "Añadir estas líneas": así una generación que sale mal (o
   * que decide corregir en el propio cuadro antes de aceptar) no ensucia el
   * parte con líneas a medio hacer.
   */
  const [generandoIA, setGenerandoIA] = useState(false);
  const [previaIA, setPreviaIA] = useState<{
    lineas: (LineaGeneradaParte & { key: string })[];
    revisar: string[];
    aplicadas: string[];
  } | null>(null);
  const [errorIA, setErrorIA] = useState("");
  /** "Trabajo realizado" es un textarea sin controlar (solo guarda al salir del
   *  campo, `onBlur`). Si el técnico pulsa "Generar con IA" recién escrito y sin
   *  haber cambiado de campo, `p.descripcion` todavía tendría el texto viejo:
   *  se lee el valor de verdad de aquí, no del estado. */
  const descripcionRef = useRef<HTMLTextAreaElement>(null);

  // El Server Component padre vuelve a renderizar (con datos frescos de Prisma)
  // cada vez que una Server Action llama a revalidatePath/router.refresh(); sin
  // este efecto la interfaz se quedaría con los datos del primer render aunque
  // la base de datos ya tenga los cambios.
  useEffect(() => setP(parte), [parte]);

  const bloqueado = p.estado === "FIRMADO";
  const totales = totalesParte(p.lineas);
  const clienteActual = clientes.find((c) => c.id === p.clienteId) || null;

  const avisar = (r: { ok: boolean; error?: string }) => {
    if (r.ok) return true;
    setError(r.error || "No se pudo guardar el cambio.");
    router.refresh();
    return false;
  };

  /**
   * `patch` usa cadena vacía para "sin elegir", igual que el resto del estado
   * local — así los `<input>` no controlados se llevan bien con lo que hay en
   * pantalla. El `null` que exige la acción de servidor se calcula aquí, en la
   * frontera, sin colarse en `p`.
   */
  const commit = async (patch: Partial<Omit<ParteData, "id" | "numero" | "estado" | "firma" | "fechaFirma" | "lineas" | "fotos">>) => {
    setP((prev) => ({ ...prev, ...patch }));
    const actual = { ...p, ...patch };
    const completo: ParteInput = {
      titulo: actual.titulo,
      clienteId: actual.clienteId || null,
      obraId: actual.obraId || null,
      direccion: actual.direccion,
      fecha: actual.fecha,
      horaInicio: actual.horaInicio,
      horaFin: actual.horaFin,
      tecnico: actual.tecnico,
      codigoErp: actual.codigoErp,
      descripcion: actual.descripcion,
      observaciones: actual.observaciones,
    };
    avisar(await actualizarParte(p.id, completo));
  };

  const setLineaLocal = (id: string, patch: Partial<Linea>) => {
    setP((prev) => ({ ...prev, lineas: prev.lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  };

  const commitLinea = async (id: string, patch: Partial<LineaParteInput>) => {
    avisar(await actualizarLinea(id, patch));
  };

  const anadirLinea = async (tipo: "MANO_OBRA" | "MATERIAL") => {
    const r = await agregarLinea(p.id, LINEA_VACIA(tipo));
    if (!avisar(r)) return;
    router.refresh();
  };

  const anadirMaterial = async (productoId: string) => {
    if (!productoId) return;
    const r = await agregarMaterialDelCatalogo(p.id, productoId);
    if (!avisar(r)) return;
    router.refresh();
  };

  const quitarLinea = async (id: string) => {
    setP((prev) => ({ ...prev, lineas: prev.lineas.filter((l) => l.id !== id) }));
    const r = await borrarLinea(id);
    if (!avisar(r)) return;
    router.refresh();
  };

  const subirFotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const hueco = MAX_FOTOS - p.fotos.length;
    if (hueco <= 0) return setError(`Máximo ${MAX_FOTOS} fotos por parte.`);
    setSubiendoFotos(true);
    try {
      const nuevas = await Promise.all(
        Array.from(files)
          .slice(0, hueco)
          .map(async (f) => ({ datos: (await prepararFoto(f)).datos, pie: "" }))
      );
      const r = await anadirFotos(p.id, nuevas);
      if (!avisar(r)) return;
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "No se pudo procesar alguna de las fotos.");
    } finally {
      setSubiendoFotos(false);
    }
  };

  const quitarFoto = async (id: string) => {
    setP((prev) => ({ ...prev, fotos: prev.fotos.filter((f) => f.id !== id) }));
    const r = await borrarFoto(id);
    if (!avisar(r)) return;
    router.refresh();
  };

  /**
   * Estructura con IA lo que ya está escrito en "Trabajo realizado".
   *
   * No manda nada nuevo a dictar: usa el mismo texto que el técnico ya ha
   * puesto ahí, porque es el mismo relato y no tiene sentido pedírselo dos
   * veces. El resultado NO se guarda todavía — se enseña en un cuadro aparte
   * para que lo revise antes de que entre en el parte.
   */
  const generarConIA = async () => {
    const texto = (descripcionRef.current?.value ?? p.descripcion).trim();
    if (!texto) return;
    setGenerandoIA(true);
    setErrorIA("");
    setPreviaIA(null);
    // Si el técnico ha escrito algo nuevo y todavía no ha salido del campo, se
    // guarda ahora: lo que se estructura y lo que queda escrito en el parte
    // tienen que ser siempre el mismo texto.
    if (texto !== p.descripcion) commit({ descripcion: texto });
    try {
      const r = await fetch("/api/generar-parte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: texto }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo estructurar el texto.");
      const lineas: LineaGeneradaParte[] = d.lineas || [];
      if (!lineas.length) throw new Error("La IA no ha encontrado ninguna línea en el texto.");
      setPreviaIA({
        lineas: lineas.map((l, i) => ({ ...l, key: `${Date.now()}-${i}` })),
        revisar: d.revisar || [],
        aplicadas: d.aplicadas || [],
      });
    } catch (e: any) {
      setErrorIA(e?.message || "No se pudo estructurar el texto.");
    } finally {
      setGenerandoIA(false);
    }
  };

  /** Corrige un valor de la propuesta ANTES de aceptarla — típicamente, la
   *  cantidad que la IA ha dejado a 0 porque el técnico no la dijo. */
  const editarPreviaIA = (key: string, patch: Partial<LineaGeneradaParte>) => {
    setPreviaIA((prev) =>
      prev ? { ...prev, lineas: prev.lineas.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : prev
    );
  };

  const quitarDePreviaIA = (key: string) => {
    setPreviaIA((prev) => (prev ? { ...prev, lineas: prev.lineas.filter((l) => l.key !== key) } : prev));
  };

  /** Vuelca la propuesta ya revisada en el parte, de una vez. */
  const confirmarPreviaIA = async () => {
    if (!previaIA?.lineas.length) return;
    const nuevas: LineaParteInput[] = previaIA.lineas.map((l) => ({
      tipo: l.tipo,
      concepto: l.concepto,
      descripcion: "",
      cantidad: l.cantidad,
      unidad: l.unidad,
      precio: l.precio,
    }));
    setGenerandoIA(true);
    const r = await agregarLineasGeneradas(p.id, nuevas);
    setGenerandoIA(false);
    if (!avisar(r)) return;
    setPreviaIA(null);
    router.refresh();
  };

  const docData = () => ({
    numero: p.numero,
    titulo: p.titulo,
    codigoErp: p.codigoErp || null,
    direccion: p.direccion,
    fecha: p.fecha,
    horaInicio: p.horaInicio || null,
    horaFin: p.horaFin || null,
    tecnico: p.tecnico,
    descripcion: p.descripcion,
    observaciones: p.observaciones,
    firma: p.firma,
    fechaFirma: p.fechaFirma,
    lineas: p.lineas,
    fotos: p.fotos,
  });
  const clienteDoc = clienteActual ? { nombre: clienteActual.nombre, direccion: clienteActual.direccion, nif: clienteActual.nif } : null;

  const filaLinea = (l: Linea) => (
    <tr key={l.id}>
      <td style={{ minWidth: 160 }}>
        <input
          className="inp"
          defaultValue={l.concepto}
          disabled={bloqueado}
          placeholder={l.tipo === "MANO_OBRA" ? "Ej: Montaje de sanitarios" : "Ej: Tubo de cobre 22 mm"}
          onBlur={(e) => { setLineaLocal(l.id, { concepto: e.target.value }); commitLinea(l.id, { concepto: e.target.value }); }}
        />
      </td>
      <td className="hidemob" style={{ minWidth: 180 }}>
        <input
          className="inp"
          defaultValue={l.descripcion}
          disabled={bloqueado}
          onBlur={(e) => { setLineaLocal(l.id, { descripcion: e.target.value }); commitLinea(l.id, { descripcion: e.target.value }); }}
        />
      </td>
      {/* Solo en material: la mano de obra propia no es un artículo del ERP.
          Viene relleno si se eligió del catálogo, y se puede escribir a mano
          en una línea suelta. */}
      {l.tipo === "MATERIAL" && (
        <td className="hidemob" style={{ width: 110 }}>
          <input
            className="inp"
            defaultValue={l.codigoErp}
            disabled={bloqueado}
            placeholder="—"
            title="Referencia de este artículo en tu ERP"
            onBlur={(e) => { setLineaLocal(l.id, { codigoErp: e.target.value }); commitLinea(l.id, { codigoErp: e.target.value }); }}
          />
        </td>
      )}
      <td style={{ width: 80 }}>
        <input
          className="inp"
          type="number"
          step="0.5"
          defaultValue={l.cantidad}
          disabled={bloqueado}
          onBlur={(e) => { const v = Number(e.target.value); setLineaLocal(l.id, { cantidad: v }); commitLinea(l.id, { cantidad: v }); }}
        />
      </td>
      <td style={{ width: 86 }}>
        <SelectUnidad
          compacto
          disabled={bloqueado}
          value={l.unidad}
          onChange={(u) => { setLineaLocal(l.id, { unidad: u }); commitLinea(l.id, { unidad: u }); }}
        />
      </td>
      <td style={{ width: 95 }}>
        <input
          className="inp"
          type="number"
          step="0.01"
          defaultValue={l.precio}
          disabled={bloqueado}
          onBlur={(e) => { const v = Number(e.target.value); setLineaLocal(l.id, { precio: v }); commitLinea(l.id, { precio: v }); }}
        />
      </td>
      <td className="linetotal">{eur(importeLineaParte(l))}</td>
      <td>{!bloqueado && <button className="btn sm red" onClick={() => quitarLinea(l.id)}>×</button>}</td>
    </tr>
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => router.push("/partes")}>← Volver</button>
        <h2 style={{ fontSize: 22 }}>{p.numero}</h2>
        <span className={`badge ${estadoParteClase(p.estado)}`}>{estadoParteLabel(p.estado)}</span>
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => exportParteWord(docData(), clienteDoc, empresa)}>Word</button>
        <button className="btn sm ghost" onClick={() => exportParteExcel(docData())}>Excel</button>
        <button className="btn sm ghost" onClick={() => exportParteImprimir(docData(), clienteDoc, empresa)}>PDF</button>
        {!p.firma && <button className="btn sm amber" onClick={() => setFirmando(true)}>Firma del cliente</button>}
        {bloqueado && isAdmin && (
          <button
            className="btn sm ghost"
            onClick={async () => {
              const r = await reabrirParte(p.id);
              if (!avisar(r)) return;
              router.refresh();
            }}
          >
            Reabrir para corregir
          </button>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--red)", background: "#FDF3F2", marginBottom: 12 }}>
          <div className="row">
            <p className="error" style={{ margin: 0, flex: 1 }}>{error}</p>
            <button className="btn ghost sm" onClick={() => setError("")}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="grid g2">
          <div className="field">
            <label className="lbl">Título / motivo de la visita</label>
            <input className="inp" defaultValue={p.titulo} disabled={bloqueado} onBlur={(e) => commit({ titulo: e.target.value })} />
          </div>
          <div className="field">
            <label className="lbl">Cliente</label>
            <select className="inp" value={p.clienteId} disabled={bloqueado} onChange={(e) => commit({ clienteId: e.target.value })}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Obra (opcional)</label>
            <select className="inp" value={p.obraId} disabled={bloqueado} onChange={(e) => commit({ obraId: e.target.value })}>
              <option value="">— Sin obra planificada —</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Dirección de la intervención</label>
            <input className="inp" defaultValue={p.direccion} disabled={bloqueado} onBlur={(e) => commit({ direccion: e.target.value })} />
          </div>
          <div className="field">
            <label className="lbl">Fecha</label>
            <input className="inp" type="date" value={p.fecha} disabled={bloqueado} onChange={(e) => commit({ fecha: e.target.value })} />
          </div>
          <div className="field">
            <label className="lbl">Técnico</label>
            <input
              className="inp"
              defaultValue={p.tecnico || tecnicoPorDefecto}
              disabled={bloqueado}
              onBlur={(e) => commit({ tecnico: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="lbl">De</label>
            <input className="inp" type="time" value={p.horaInicio} disabled={bloqueado} onChange={(e) => commit({ horaInicio: e.target.value })} />
          </div>
          <div className="field">
            <label className="lbl">A</label>
            <input className="inp" type="time" value={p.horaFin} disabled={bloqueado} onChange={(e) => commit({ horaFin: e.target.value })} />
          </div>
          <div className="field">
            <label className="lbl">Nº de este parte en tu ERP (opcional)</label>
            <input
              className="inp"
              defaultValue={p.codigoErp}
              disabled={bloqueado}
              placeholder="Solo si trabajas con un ERP"
              onBlur={(e) => commit({ codigoErp: e.target.value })}
            />
            <p className="hint" style={{ marginTop: 4 }}>
              Identifica el parte entero. Las referencias de cada material van en su línea, y salen solas del catálogo.
            </p>
          </div>
        </div>

        <div className="field">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label className="lbl">Trabajo realizado</label>
            {!bloqueado && <Dictar onTexto={(t) => commit({ descripcion: `${p.descripcion}${p.descripcion ? " " : ""}${t}` })} />}
          </div>
          <textarea
            ref={descripcionRef}
            className="inp"
            rows={3}
            defaultValue={p.descripcion}
            disabled={bloqueado}
            placeholder='Dicta con tus propias cifras: "He tardado 2 horas en cambiar la grifería de la ducha. He usado un grifo monomando Roca y dos metros de tubo de cobre."'
            onBlur={(e) => commit({ descripcion: e.target.value })}
          />
          {!bloqueado && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm ghost" disabled={generandoIA} onClick={generarConIA}>
                {generandoIA && !previaIA ? "Estructurando…" : "Generar líneas con IA a partir de esto"}
              </button>
              <p className="hint" style={{ margin: 0 }}>
                La IA solo ordena lo que dictes aquí: las horas o cantidades que no digas se quedan en blanco para
                que las rellenes tú. No inventa material ni tareas que no hayas nombrado.
              </p>
            </div>
          )}
          {errorIA && <p className="error" style={{ marginTop: 6 }}>{errorIA}</p>}
        </div>

        {previaIA && (
          <div
            style={{ border: "1px solid var(--amber)", background: "#FFFBF0", borderRadius: 8, padding: 12, marginBottom: 14 }}
          >
            <strong style={{ fontSize: 14 }}>Revisa esto antes de añadirlo al parte</strong>
            {previaIA.aplicadas.length > 0 && (
              <p className="hint" style={{ margin: "4px 0 0" }}>
                Se han aplicado tus precios del catálogo en: {previaIA.aplicadas.join(", ")}.
              </p>
            )}
            {previaIA.revisar.length > 0 && (
              <ul style={{ margin: "6px 0 0 18px", fontSize: 13 }}>
                {previaIA.revisar.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            <table className="t" style={{ marginTop: 10, background: "#fff" }}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>{"Horas / cant."}</th>
                  <th>Ud.</th>
                  <th>Precio</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {previaIA.lineas.map((l) => (
                  <tr key={l.key} style={!l.cantidad ? { background: "#FCF0D8" } : undefined}>
                    <td>{ETIQUETA_TIPO_LINEA[l.tipo]}</td>
                    <td>
                      <input
                        className="inp"
                        value={l.concepto}
                        onChange={(e) => editarPreviaIA(l.key, { concepto: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 90 }}>
                      <input
                        className="inp"
                        type="number"
                        step="0.5"
                        value={l.cantidad}
                        onChange={(e) => editarPreviaIA(l.key, { cantidad: Number(e.target.value) })}
                      />
                    </td>
                    <td style={{ width: 70 }}>
                      <input
                        className="inp"
                        value={l.unidad}
                        onChange={(e) => editarPreviaIA(l.key, { unidad: e.target.value })}
                      />
                    </td>
                    <td style={{ width: 90 }}>
                      <input
                        className="inp"
                        type="number"
                        step="0.01"
                        value={l.precio}
                        onChange={(e) => editarPreviaIA(l.key, { precio: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <button className="btn sm red" onClick={() => quitarDePreviaIA(l.key)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" disabled={generandoIA || !previaIA.lineas.length} onClick={confirmarPreviaIA}>
                {generandoIA ? "Añadiendo…" : "Añadir estas líneas al parte"}
              </button>
              <button className="btn sm ghost" disabled={generandoIA} onClick={() => setPreviaIA(null)}>
                Descartar
              </button>
              <button className="btn sm ghost" disabled={generandoIA} onClick={generarConIA}>
                Volver a generar
              </button>
            </div>
          </div>
        )}

        <div className="field">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label className="lbl">Observaciones (opcional)</label>
            {!bloqueado && <Dictar onTexto={(t) => commit({ observaciones: `${p.observaciones}${p.observaciones ? " " : ""}${t}` })} />}
          </div>
          <textarea
            className="inp"
            rows={2}
            defaultValue={p.observaciones}
            disabled={bloqueado}
            placeholder="Incidencias, pendientes para la próxima visita, avisos al cliente…"
            onBlur={(e) => commit({ observaciones: e.target.value })}
          />
        </div>
      </div>

      {(["MANO_OBRA", "MATERIAL"] as const).map((tipo) => {
        const lineas = p.lineas.filter((l) => l.tipo === tipo);
        return (
          <div className="card" key={tipo}>
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>{ETIQUETA_TIPO_LINEA[tipo]}</h3>
            {tipo === "MATERIAL" && (
              <p className="hint" style={{ marginTop: 0 }}>
                El material lo decide y lo mide el técnico: nadie más sabe lo que ha puesto en la obra. Si ya está en
                tu catálogo, elígelo abajo y viene con su precio; si no, añade una línea en blanco.
              </p>
            )}
            <table className="t">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className="hidemob">Descripción</th>
                  {tipo === "MATERIAL" && <th className="hidemob">Cód. ERP</th>}
                  <th>{tipo === "MANO_OBRA" ? "Horas" : "Cant."}</th>
                  <th>Ud.</th>
                  <th>Precio</th>
                  <th>Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{lineas.map(filaLinea)}</tbody>
            </table>
            {!lineas.length && <p className="hint">Sin líneas todavía.</p>}
            {!bloqueado && (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn ghost sm" onClick={() => anadirLinea(tipo)}>+ Línea en blanco</button>
                {tipo === "MATERIAL" && productos.length > 0 && (
                  <select className="inp" style={{ maxWidth: 320 }} value="" onChange={(e) => anadirMaterial(e.target.value)}>
                    <option value="">+ Añadir del catálogo…</option>
                    {productos.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre} ({eur(m.precio)}/{m.unidad})</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        <div style={{ textAlign: "right", fontSize: 15 }}>
          {totales.horas > 0 && (
            <div>Horas: <b>{totales.horas} h</b> · Mano de obra: <b>{eur(totales.costeManoObra)}</b></div>
          )}
          {totales.costeMaterial > 0 && <div>Material: <b>{eur(totales.costeMaterial)}</b></div>}
          <div style={{ fontSize: 20, marginTop: 4 }}>TOTAL: <b>{eur(totales.total)}</b></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 17, marginBottom: 8 }}>Fotos (opcional, hasta {MAX_FOTOS})</h3>
        {!bloqueado && (
          <input
            className="inp"
            type="file"
            accept="image/*"
            multiple
            disabled={subiendoFotos || p.fotos.length >= MAX_FOTOS}
            onChange={(e) => { subirFotos(e.target.files); e.target.value = ""; }}
          />
        )}
        <div className="grid g4" style={{ marginTop: 10 }}>
          {p.fotos.map((f) => (
            <div key={f.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
              <img src={f.datos} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 6 }} />
              <input
                className="inp"
                style={{ marginTop: 6, fontSize: 12 }}
                defaultValue={f.pie}
                disabled={bloqueado}
                placeholder="Pie de foto"
                onBlur={async (e) => {
                  const pie = e.target.value;
                  setP((prev) => ({ ...prev, fotos: prev.fotos.map((x) => (x.id === f.id ? { ...x, pie } : x)) }));
                  avisar(await actualizarPieFoto(f.id, pie));
                }}
              />
              {!bloqueado && (
                <button className="btn sm red" style={{ marginTop: 6, width: "100%" }} onClick={() => quitarFoto(f.id)}>
                  Quitar
                </button>
              )}
            </div>
          ))}
        </div>

        {p.firma && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 14 }}>
            <span className="badge b-aprobado">Conformidad del cliente el {p.fechaFirma}</span>
            <br />
            <img src={p.firma} alt="Firma del cliente" style={{ height: 70, marginTop: 6 }} />
          </div>
        )}
      </div>

      {firmando && (
        <div className="modalbg">
          <div className="modal">
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Conformidad del cliente — parte {p.numero}</h2>
            <p className="hint">Total: <b>{eur(totales.total)}</b></p>
            <SignaturePad
              explicacion="El cliente firma aquí para dar su conformidad al trabajo realizado y a las horas y el material anotados."
              textoConfirmar="Confirmar conformidad"
              onCancel={() => setFirmando(false)}
              onSave={async (dataUrl) => {
                const r = await guardarFirmaParte(p.id, dataUrl);
                setFirmando(false);
                if (!r.ok) return setError(r.error);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
