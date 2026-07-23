"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { estadoClase, estadoLabel, importeLinea } from "@/lib/presupuesto";
import { exportPDF, exportWord, exportExcel } from "@/lib/docExport";
import SignaturePad from "@/components/SignaturePad";
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
type Producto = { id: string; nombre: string; unidad: string; precio: number };
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
  const clienteActual = clientes.find((c) => c.id === p.clienteId) || null;

  const commit = async (patch: Partial<Pick<PresupuestoData, "titulo" | "clienteId" | "fecha" | "iva" | "notas">>) => {
    setP((prev) => ({ ...prev, ...patch }));
    await actualizarPresupuesto(p.id, patch);
  };

  const setLineaLocal = (id: string, patch: Partial<Linea>) => {
    setP((prev) => ({ ...prev, lineas: prev.lineas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  };

  const commitLinea = async (id: string, patch: Partial<Linea>) => {
    await actualizarLinea(id, patch);
  };

  const anadirPartida = async () => {
    await agregarLinea(p.id, { capitulo: "", concepto: "", descripcion: "", cantidad: 1, unidad: "ud", precio: 0, descuento: 0 });
    router.refresh();
  };

  const anadirMaterial = async (productoId: string) => {
    if (!productoId) return;
    await agregarMaterialDelCatalogo(p.id, productoId);
    router.refresh();
  };

  const quitarLinea = async (id: string) => {
    setP((prev) => ({ ...prev, lineas: prev.lineas.filter((l) => l.id !== id) }));
    await borrarLinea(id);
    router.refresh();
  };

  const enviarEmail = async () => {
    await marcarEnviado(p.id);
    if (p.estado === "BORRADOR") setP((prev) => ({ ...prev, estado: "ENVIADO" }));
    const cuerpo = `Estimado/a ${clienteActual ? clienteActual.nombre : "cliente"}:%0D%0A%0D%0ALe adjuntamos el presupuesto ${p.numero} - ${p.titulo}.%0D%0ATotal: ${eur(base * (1 + p.iva / 100))} (IVA incluido).%0D%0A%0D%0APuede aprobarlo firmando en nuestra aplicación o respondiendo a este correo.%0D%0A%0D%0AUn saludo,%0D%0A${empresa.nombre}`;
    window.open(`mailto:${clienteActual?.email || ""}?subject=Presupuesto ${p.numero} - ${empresa.nombre}&body=${cuerpo}`);
  };

  const docData = () => ({
    numero: p.numero,
    titulo: p.titulo,
    fecha: p.fecha,
    iva: p.iva,
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
          <button className="btn sm" onClick={() => crearFacturaDesdePresupuesto(p.id)}>Crear factura</button>
        )}
      </div>

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
        </div>

        <table className="t">
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
                <td style={{ width: 70 }}>
                  <input
                    className="inp"
                    defaultValue={l.unidad}
                    disabled={bloqueado}
                    onBlur={(e) => { setLineaLocal(l.id, { unidad: e.target.value }); commitLinea(l.id, { unidad: e.target.value }); }}
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

        {!bloqueado && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={anadirPartida}>+ Añadir partida</button>
            <select className="inp" style={{ width: 280 }} value="" onChange={(e) => anadirMaterial(e.target.value)}>
              <option value="">+ Añadir material del catálogo…</option>
              {productos.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({eur(m.precio)})</option>)}
            </select>
          </div>
        )}

        <div style={{ textAlign: "right", marginTop: 16, fontSize: 15 }}>
          Base imponible: <b>{eur(base)}</b> &nbsp;·&nbsp; IVA ({p.iva} %): <b>{eur((base * p.iva) / 100)}</b>
          <div className="linetotal" style={{ fontSize: 26, color: "var(--blue)" }}>
            TOTAL: {eur(base * (1 + p.iva / 100))}
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
                await guardarFirma(p.id, dataUrl);
                setFirmando(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
