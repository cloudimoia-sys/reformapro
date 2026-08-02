"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { estadoClase, estadoLabel, importeLinea, desglosePres } from "@/lib/presupuesto";
import { fallo } from "@/lib/accion";
import { exportPDF, exportWord, exportExcel } from "@/lib/docExport";
import SignaturePad from "@/components/SignaturePad";
import SelectUnidad from "@/components/SelectUnidad";
import {
  actualizarPresupuesto,
  agregarLinea,
  agregarMaterialDelCatalogo,
  actualizarLinea,
  borrarLinea,
  guardarFirma,
  marcarEnviado,
  crearFacturaDesdePresupuesto,
} from "../actions";

type Cliente = { id: string; nombre: string; direccion: string; nif: string; email: string };
type Producto = { id: string; nombre: string; unidad: string; precio: number; tipo: "MATERIAL" | "PARTIDA" };
type Linea = {
  id: string;
  capitulo: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  descuento: number;
};
type PresupuestoData = {
  id: string;
  numero: string;
  titulo: string;
  clienteId: string;
  fecha: string;
  iva: number;
  margen: number;
  estado: string;
  notas: string;
  firma: string | null;
  fechaFirma: string | null;
  lineas: Linea[];
};
type Empresa = { nombre: string; cif: string; direccion: string; tel: string; email: string };

export default function PresupuestoEditor({
  presupuesto,
  clientes,
  productos,
  empresa,
  isAdmin,
}: {
  presupuesto: PresupuestoData;
  clientes: Cliente[];
  productos: Producto[];
  empresa: Empresa;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState(presupuesto);
  const [firmando, setFirmando] = useState(false);

  // El Server Component padre vuelve a renderizar (con datos frescos de Prisma) cada vez
  // que una Server Action llama a revalidatePath/router.refresh(). useState solo toma el
  // valor inicial en el montaje, así que sin este efecto la interfaz se queda con los
  // datos del primer render aunque la base de datos ya tenga los cambios.
  useEffect(() => {
    setP(presupuesto);
  }, [presupuesto]);
  const bloqueado = p.estado === "APROBADO" || p.estado === "FACTURADO";
  const base = p.lineas.reduce((s, l) => s + importeLinea(l), 0);
  const d = desglosePres(p);
  const clienteActual = clientes.find((c) => c.id === p.clienteId) || null;

  /**
   * Las acciones devuelven el error en vez de lanzarlo (Next borra el mensaje de
   * las excepciones en producción). Se muestra arriba del editor y, si el cambio
   * no llegó a guardarse, se recargan los datos del servidor para que lo que ves
   * en pantalla no se quede desincronizado con lo que hay en la base.
   */
  const [error, setError] = useState("");

  const avisar = (r: { ok: boolean; error?: string }) => {
    if (r.ok) return true;
    setError(r.error || "No se pudo guardar el cambio.");
    router.refresh();
    return false;
  };

  const commit = async (patch: Partial<Pick<PresupuestoData, "titulo" | "clienteId" | "fecha" | "iva" | "margen" | "notas">>) => {
    setP((prev) => ({ ...prev, ...patch }));
    avisar(await actualizarPresupuesto(p.id, patch));
  };

  const setLineaLocal = (id: string, patch: Partial<Linea>) => {
    setP((prev) => ({ ...prev, lineas: prev.lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  };

  const commitLinea = async (id: string, patch: Partial<Linea>) => {
    avisar(await actualizarLinea(id, patch));
  };

  const anadirPartida = async () => {
    const r = await agregarLinea(p.id, { capitulo: "", concepto: "", descripcion: "", cantidad: 1, unidad: "ud", precio: 0, descuento: 0 });
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

  const enviarEmail = async () => {
    // A propósito sin comprobar el resultado: marcar como "Enviado" es un extra, y
    // si falla no debe impedir que se abra el correo, que es lo que el usuario pidió.
    await marcarEnviado(p.id);
    if (p.estado === "BORRADOR") setP((prev) => ({ ...prev, estado: "ENVIADO" }));
    const cuerpo = `Estimado/a ${clienteActual ? clienteActual.nombre : "cliente"}:%0D%0A%0D%0ALe adjuntamos el presupuesto ${p.numero} - ${p.titulo}.%0D%0ATotal: ${eur(d.total)} (IVA incluido).%0D%0A%0D%0APuede aprobarlo firmando en nuestra aplicación o respondiendo a este correo.%0D%0A%0D%0AUn saludo,%0D%0A${empresa.nombre}`;
    window.open(`mailto:${clienteActual?.email || ""}?subject=Presupuesto ${p.numero} - ${empresa.nombre}&body=${cuerpo}`);
  };

  const docData = () => ({
    numero: p.numero,
    titulo: p.titulo,
    fecha: p.fecha,
    iva: p.iva,
    margen: p.margen,
    notas: p.notas,
    firma: p.firma,
    fechaFirma: p.fechaFirma,
    lineas: p.lineas,
  });

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => router.push("/presupuestos")}>← Volver</button>
        <h2 style={{ fontSize: 22 }}>{p.numero}</h2>
        <span className={`badge ${estadoClase(p.estado)}`}>{estadoLabel(p.estado)}</span>
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => exportWord(docData(), clienteActual, empresa)}>Word</button>
        <button className="btn sm ghost" onClick={() => exportExcel(docData())}>Excel</button>
        <button className="btn sm ghost" onClick={() => exportPDF(docData(), clienteActual, empresa)}>PDF</button>
        <button className="btn sm" onClick={enviarEmail}>Enviar por email</button>
        {!p.firma && <button className="btn sm amber" onClick={() => setFirmando(true)}>Firma del cliente</button>}
        {p.estado === "APROBADO" && isAdmin && (
          <button
            className="btn sm"
            onClick={async () => {
              // fallo() contempla que al redirigir a /facturas la promesa se
              // resuelva con undefined, que es el caso de éxito.
              const e = fallo(await crearFacturaDesdePresupuesto(p.id));
              if (e) setError(e);
            }}
          >
            Pasar a facturación
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
            <label className="lbl">Título de la obra</label>
            <input
              className="inp"
              defaultValue={p.titulo}
              disabled={bloqueado}
              onBlur={(e) => commit({ titulo: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="lbl">Cliente</label>
            <select
              className="inp"
              value={p.clienteId}
              disabled={bloqueado}
              onChange={(e) => commit({ clienteId: e.target.value })}
            >
              <option value="">— Selecciona —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="lbl">Fecha</label>
            <input
              className="inp"
              type="date"
              value={p.fecha}
              disabled={bloqueado}
              onChange={(e) => commit({ fecha: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="lbl">IVA aplicable</label>
            <select
              className="inp"
              value={p.iva}
              disabled={bloqueado}
              onChange={(e) => commit({ iva: Number(e.target.value) })}
            >
              <option value={10}>10 % (reforma de vivienda)</option>
              <option value={21}>21 % (general)</option>
              <option value={0}>0 %</option>
            </select>
          </div>
          <div className="field">
            <label className="lbl">Gastos generales y beneficio (%)</label>
            <input
              className="inp"
              type="number"
              min={0}
              max={60}
              step="1"
              defaultValue={p.margen}
              disabled={bloqueado}
              onBlur={(e) => Number(e.target.value) !== p.margen && commit({ margen: Number(e.target.value) })}
            />
            <p className="hint" style={{ marginTop: 4 }}>
              Sale como línea aparte antes del IVA. El valor inicial es el de Mi empresa; súbelo o bájalo en esta obra
              si lo necesitas.
            </p>
          </div>
        </div>

        <table className="t solo-escritorio">
          <thead>
            <tr>
              <th className="hidemob">Capítulo</th>
              <th>Concepto</th>
              <th className="hidemob">Descripción</th>
              <th>Cant.</th>
              <th>Ud.</th>
              <th>Precio</th>
              <th className="hidemob">Desc. %</th>
              <th>Importe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {p.lineas.map((l) => (
              <tr key={l.id}>
                <td className="hidemob" style={{ minWidth: 110 }}>
                  <input
                    className="inp"
                    defaultValue={l.capitulo}
                    disabled={bloqueado}
                    onBlur={(e) => { setLineaLocal(l.id, { capitulo: e.target.value }); commitLinea(l.id, { capitulo: e.target.value }); }}
                    placeholder="Capítulo"
                  />
                </td>
                <td style={{ minWidth: 140 }}>
                  <input
                    className="inp"
                    defaultValue={l.concepto}
                    disabled={bloqueado}
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
                <td style={{ width: 70 }}>
                  <input
                    className="inp"
                    type="number"
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
                <td className="hidemob" style={{ width: 80 }}>
                  <input
                    className="inp"
                    type="number"
                    step="1"
                    min={0}
                    max={100}
                    defaultValue={l.descuento}
                    disabled={bloqueado}
                    onBlur={(e) => { const v = Number(e.target.value); setLineaLocal(l.id, { descuento: v }); commitLinea(l.id, { descuento: v }); }}
                  />
                </td>
                <td className="linetotal">{eur(importeLinea(l))}</td>
                <td>{!bloqueado && <button className="btn sm red" onClick={() => quitarLinea(l.id)}>×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* En móvil, cada línea es una ficha: la tabla de nueve columnas no cabía
            y la unidad quedaba en un hueco de 70 px imposible de tocar. */}
        <div className="solo-movil">
          {p.lineas.map((l, i) => (
            <div key={l.id} className="linea-movil">
              <div className="cab">
                <span className="num">{i + 1}</span>
                <input
                  className="inp"
                  defaultValue={l.concepto}
                  disabled={bloqueado}
                  placeholder="Concepto"
                  onBlur={(e) => { setLineaLocal(l.id, { concepto: e.target.value }); commitLinea(l.id, { concepto: e.target.value }); }}
                />
              </div>

              <input
                className="inp"
                defaultValue={l.capitulo}
                disabled={bloqueado}
                placeholder="Capítulo"
                onBlur={(e) => { setLineaLocal(l.id, { capitulo: e.target.value }); commitLinea(l.id, { capitulo: e.target.value }); }}
              />

              <textarea
                className="inp"
                style={{ marginTop: 8 }}
                rows={2}
                defaultValue={l.descripcion}
                disabled={bloqueado}
                placeholder="Descripción"
                onBlur={(e) => { setLineaLocal(l.id, { descripcion: e.target.value }); commitLinea(l.id, { descripcion: e.target.value }); }}
              />

              <div className="tres">
                <div>
                  <label className="lbl">Cant.</label>
                  <input
                    className="inp"
                    type="number"
                    inputMode="decimal"
                    defaultValue={l.cantidad}
                    disabled={bloqueado}
                    onBlur={(e) => { const v = Number(e.target.value); setLineaLocal(l.id, { cantidad: v }); commitLinea(l.id, { cantidad: v }); }}
                  />
                </div>
                <div>
                  <label className="lbl">Unidad</label>
                  <SelectUnidad
                    compacto
                    disabled={bloqueado}
                    value={l.unidad}
                    onChange={(u) => { setLineaLocal(l.id, { unidad: u }); commitLinea(l.id, { unidad: u }); }}
                  />
                </div>
                <div>
                  <label className="lbl">Precio €</label>
                  <input
                    className="inp"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    defaultValue={l.precio}
                    disabled={bloqueado}
                    onBlur={(e) => { const v = Number(e.target.value); setLineaLocal(l.id, { precio: v }); commitLinea(l.id, { precio: v }); }}
                  />
                </div>
              </div>

              <div className="tres" style={{ gridTemplateColumns: "1fr 2fr" }}>
                <div>
                  <label className="lbl">Dto. %</label>
                  <input
                    className="inp"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    defaultValue={l.descuento}
                    disabled={bloqueado}
                    onBlur={(e) => { const v = Number(e.target.value); setLineaLocal(l.id, { descuento: v }); commitLinea(l.id, { descuento: v }); }}
                  />
                </div>
              </div>

              <div className="pie">
                <strong className="linetotal">{eur(importeLinea(l))}</strong>
                {!bloqueado && (
                  <button className="btn sm red" onClick={() => quitarLinea(l.id)}>Quitar línea</button>
                )}
              </div>
            </div>
          ))}
          {!p.lineas.length && <p className="hint">Sin partidas todavía.</p>}
        </div>

        {!bloqueado && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={anadirPartida}>+ Línea en blanco</button>
            {/* Separadas por tipo: una partida propia trae su descripción ya
                redactada, un material solo el suministro. */}
            <select className="inp" style={{ maxWidth: 320 }} value="" onChange={(e) => anadirMaterial(e.target.value)}>
              <option value="">+ Añadir del catálogo…</option>
              {productos.some((m) => m.tipo === "PARTIDA") && (
                <optgroup label="Mis partidas">
                  {productos.filter((m) => m.tipo === "PARTIDA").map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre} ({eur(m.precio)}/{m.unidad})</option>
                  ))}
                </optgroup>
              )}
              {productos.some((m) => m.tipo !== "PARTIDA") && (
                <optgroup label="Materiales">
                  {productos.filter((m) => m.tipo !== "PARTIDA").map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre} ({eur(m.precio)}/{m.unidad})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        <div style={{ textAlign: "right", marginTop: 16, fontSize: 15 }}>
          Base imponible: <b>{eur(d.base)}</b>
          {d.porcentajeMargen > 0 && (
            <> &nbsp;·&nbsp; Gastos generales y beneficio ({d.porcentajeMargen} %): <b>{eur(d.importeMargen)}</b></>
          )}
          &nbsp;·&nbsp; IVA ({p.iva} %): <b>{eur(d.importeIva)}</b>
          <div className="linetotal" style={{ fontSize: 26, color: "var(--blue)" }}>
            TOTAL: {eur(d.total)}
          </div>
        </div>

        <div className="field" style={{ marginTop: 8 }}>
          <label className="lbl">Notas / condiciones</label>
          <textarea
            className="inp"
            rows={2}
            defaultValue={p.notas}
            onBlur={(e) => commit({ notas: e.target.value })}
          />
        </div>

        {p.firma && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <span className="badge b-aprobado">Aprobado y firmado el {p.fechaFirma}</span>
            <br />
            <img src={p.firma} alt="Firma del cliente" style={{ height: 70, marginTop: 6 }} />
          </div>
        )}
      </div>

      {firmando && (
        <div className="modalbg">
          <div className="modal">
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Aprobación del presupuesto {p.numero}</h2>
            <p className="hint">Total: <b>{eur(base * (1 + p.iva / 100))}</b> (IVA incluido)</p>
            <SignaturePad
              onCancel={() => setFirmando(false)}
              onSave={async (dataUrl) => {
                const r = await guardarFirma(p.id, dataUrl);
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
