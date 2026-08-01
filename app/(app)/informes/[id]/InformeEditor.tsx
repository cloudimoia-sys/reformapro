"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eur } from "@/lib/format";
import { importePartida, pem, ETIQUETA_TIPO, type ContenidoInforme, type PartidaInforme } from "@/lib/informe";
import { exportInformeWord, exportInformeExcel, exportInformePDF, type InformeDoc } from "@/lib/informeExport";
import { DOCUMENTOS } from "@/lib/documentos";
import type { EmpresaDoc, ClienteDoc } from "@/lib/docExport";
import { actualizarInforme, actualizarPieFoto, borrarFoto } from "../actions";

type Foto = { id: string; datos: string; pie: string };

export type InformeCompleto = {
  id: string;
  numero: string;
  tipo: import("@/lib/documentos").TipoDocumento;
  titulo: string;
  fecha: string;
  inmueble: string;
  refCatastral: string | null;
  solicitante: string | null;
  perito: string | null;
  titulacion: string | null;
  colegiado: string | null;
  estado: "BORRADOR" | "FINALIZADO";
  contenido: ContenidoInforme;
  fotos: Foto[];
};

const PARTIDA_VACIA: PartidaInforme = { codigo: "", descripcion: "", unidad: "ud", cantidad: 1, precio: 0, opcional: false };

export default function InformeEditor({
  informe,
  cliente,
  empresa,
}: {
  informe: InformeCompleto;
  cliente: ClienteDoc;
  empresa: EmpresaDoc;
}) {
  const router = useRouter();
  const [inf, setInf] = useState(informe);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Sin esto, tras router.refresh() la pantalla seguiría mostrando el estado
  // anterior aunque el servidor ya hubiera devuelto los datos nuevos.
  useEffect(() => setInf(informe), [informe]);

  const avisar = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) setError(r.error || "No se pudo guardar.");
    else setError("");
    return r.ok;
  };

  const guardar = async (patch: Parameters<typeof actualizarInforme>[1]) => {
    setGuardando(true);
    const r = await actualizarInforme(inf.id, patch);
    setGuardando(false);
    if (avisar(r)) router.refresh();
  };

  const editarContenido = (contenido: ContenidoInforme) => {
    setInf({ ...inf, contenido });
  };

  const editarApartado = (i: number, campo: "titulo" | "texto", valor: string) => {
    const apartados = inf.contenido.apartados.map((a, j) => (j === i ? { ...a, [campo]: valor } : a));
    editarContenido({ ...inf.contenido, apartados });
  };

  const editarSub = (i: number, j: number, campo: "titulo" | "texto", valor: string) => {
    const apartados = inf.contenido.apartados.map((a, k) =>
      k !== i ? a : { ...a, subapartados: (a.subapartados || []).map((s, l) => (l === j ? { ...s, [campo]: valor } : s)) }
    );
    editarContenido({ ...inf.contenido, apartados });
  };

  const editarPartida = (i: number, campo: keyof PartidaInforme, valor: string) => {
    const partidas = inf.contenido.partidas.map((p, j) =>
      j !== i ? p : { ...p, [campo]: campo === "cantidad" || campo === "precio" ? Number(valor) || 0 : valor }
    );
    editarContenido({ ...inf.contenido, partidas });
  };

  const total = pem(inf.contenido.partidas);
  const conPresupuesto = DOCUMENTOS[inf.tipo]?.conPresupuesto ?? true;
  const vacios = inf.contenido.apartados.filter((a) => !a.texto?.trim() && !a.subapartados?.length);

  const doc: InformeDoc = {
    numero: inf.numero,
    tipo: inf.tipo,
    titulo: inf.titulo,
    fecha: inf.fecha,
    inmueble: inf.inmueble,
    refCatastral: inf.refCatastral,
    solicitante: inf.solicitante,
    perito: inf.perito,
    titulacion: inf.titulacion,
    colegiado: inf.colegiado,
    contenido: inf.contenido,
    fotos: inf.fotos.map((f) => ({ datos: f.datos, pie: f.pie })),
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>{inf.numero}</h2>
          <p className="hint" style={{ margin: 0 }}>{ETIQUETA_TIPO[inf.tipo]}</p>
        </div>
        <div className="spacer" />
        <button className="btn sm ghost" onClick={() => exportInformeWord(doc, cliente, empresa)}>Word</button>
        <button className="btn sm ghost" onClick={() => exportInformeExcel(doc)}>Excel</button>
        <button className="btn sm ghost" onClick={() => exportInformePDF(doc, cliente, empresa)}>PDF</button>
        <button
          className="btn sm"
          onClick={() => guardar({ estado: inf.estado === "FINALIZADO" ? "BORRADOR" : "FINALIZADO" })}
        >
          {inf.estado === "FINALIZADO" ? "Volver a borrador" : "Marcar finalizado"}
        </button>
      </div>

      {vacios.length > 0 && (
        <p className="error">
          Sin redactar: {vacios.map((a) => `${a.numero}. ${a.titulo}`).join("; ")}. Complétalo antes de entregar el
          informe.
        </p>
      )}

      <div className="field">
        <label className="lbl">Título del informe</label>
        <input
          className="inp"
          value={inf.titulo}
          onChange={(e) => setInf({ ...inf, titulo: e.target.value })}
          onBlur={(e) => e.target.value !== informe.titulo && guardar({ titulo: e.target.value })}
        />
      </div>

      <div className="grid g2">
        <div className="field">
          <label className="lbl">Inmueble</label>
          <input
            className="inp"
            value={inf.inmueble}
            onChange={(e) => setInf({ ...inf, inmueble: e.target.value })}
            onBlur={(e) => e.target.value !== informe.inmueble && guardar({ inmueble: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="lbl">Técnico que firma</label>
          <input
            className="inp"
            value={inf.perito || ""}
            onChange={(e) => setInf({ ...inf, perito: e.target.value })}
            onBlur={(e) => e.target.value !== (informe.perito || "") && guardar({ perito: e.target.value })}
          />
        </div>
      </div>

      <h3 style={{ fontSize: 17, margin: "18px 0 6px" }}>Apartados</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Revisa cada apartado: lo que aquí quede escrito es lo que firmas. Los cambios se guardan al salir del campo.
      </p>

      {inf.contenido.apartados.map((a, i) => (
        <div key={i} className="field" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <strong style={{ minWidth: 28 }}>{a.numero}.</strong>
            <input
              className="inp"
              value={a.titulo}
              onChange={(e) => editarApartado(i, "titulo", e.target.value)}
              onBlur={() => guardar({ contenido: inf.contenido })}
            />
          </div>
          <textarea
            className="inp"
            rows={Math.min(14, Math.max(3, Math.ceil((a.texto || "").length / 95) + 1))}
            value={a.texto}
            placeholder="Sin redactar. Escríbelo aquí."
            onChange={(e) => editarApartado(i, "texto", e.target.value)}
            onBlur={() => guardar({ contenido: inf.contenido })}
          />
          {(a.subapartados || []).map((s, j) => (
            <div key={j} style={{ marginLeft: 16, marginTop: 8 }}>
              <input
                className="inp"
                value={s.titulo}
                onChange={(e) => editarSub(i, j, "titulo", e.target.value)}
                onBlur={() => guardar({ contenido: inf.contenido })}
              />
              <textarea
                className="inp"
                style={{ marginTop: 4 }}
                rows={Math.min(10, Math.max(2, Math.ceil((s.texto || "").length / 95) + 1))}
                value={s.texto}
                onChange={(e) => editarSub(i, j, "texto", e.target.value)}
                onBlur={() => guardar({ contenido: inf.contenido })}
              />
            </div>
          ))}
        </div>
      ))}

      {conPresupuesto && (<><h3 style={{ fontSize: 17, margin: "18px 0 6px" }}>Presupuesto de reparación</h3>
      <table className="t">
        <thead>
          <tr>
            <th style={{ width: 78 }}>Cód.</th>
            <th>Descripción</th>
            <th style={{ width: 70 }}>Ud.</th>
            <th style={{ width: 90 }}>Cantidad</th>
            <th style={{ width: 110 }}>Precio</th>
            <th style={{ width: 110 }}>Importe</th>
            <th style={{ width: 74 }} title="Mejora recomendable que no hace falta para resolver la patología">Opcional</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {inf.contenido.partidas.map((p, i) => (
            <tr key={i}>
              <td><input className="inp" value={p.codigo} onChange={(e) => editarPartida(i, "codigo", e.target.value)} onBlur={() => guardar({ contenido: inf.contenido })} /></td>
              <td><input className="inp" value={p.descripcion} onChange={(e) => editarPartida(i, "descripcion", e.target.value)} onBlur={() => guardar({ contenido: inf.contenido })} /></td>
              <td><input className="inp" value={p.unidad} onChange={(e) => editarPartida(i, "unidad", e.target.value)} onBlur={() => guardar({ contenido: inf.contenido })} /></td>
              <td><input className="inp" type="number" step="0.01" value={p.cantidad} onChange={(e) => editarPartida(i, "cantidad", e.target.value)} onBlur={() => guardar({ contenido: inf.contenido })} /></td>
              <td><input className="inp" type="number" step="0.01" value={p.precio} onChange={(e) => editarPartida(i, "precio", e.target.value)} onBlur={() => guardar({ contenido: inf.contenido })} /></td>
              <td className="linetotal">{eur(importePartida(p))}</td>
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={!!p.opcional}
                  style={{ width: 18, height: 18 }}
                  onChange={(e) => {
                    // Marcar una partida como opcional la saca del total obligatorio
                    // y la enseña aparte, para no inflar la cifra que decide el cliente.
                    const partidas = inf.contenido.partidas.map((x, j) => (j === i ? { ...x, opcional: e.target.checked } : x));
                    const c = { ...inf.contenido, partidas };
                    editarContenido(c);
                    guardar({ contenido: c });
                  }}
                />
              </td>
              <td style={{ textAlign: "right" }}>
                <button
                  className="btn sm red"
                  onClick={() => {
                    const partidas = inf.contenido.partidas.filter((_, j) => j !== i);
                    const c = { ...inf.contenido, partidas };
                    editarContenido(c);
                    guardar({ contenido: c });
                  }}
                >×</button>
              </td>
            </tr>
          ))}
          {!inf.contenido.partidas.length && (
            <tr><td colSpan={8} className="hint">Sin partidas valoradas.</td></tr>
          )}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn sm ghost"
          onClick={() => {
            const c = { ...inf.contenido, partidas: [...inf.contenido.partidas, { ...PARTIDA_VACIA }] };
            editarContenido(c);
            guardar({ contenido: c });
          }}
        >+ Añadir partida</button>
        <div className="spacer" />
        <strong>Ejecución material: {eur(total)}</strong>
        {inf.contenido.partidas.some((p) => p.opcional) && (
          <span className="hint">
            {" "}· opcionales aparte: {eur(pem(inf.contenido.partidas, true) - total)}
          </span>
        )}
      </div>
      <p className="hint">No incluye gastos generales, beneficio industrial ni IVA.</p></>)}

      <h3 style={{ fontSize: 17, margin: "18px 0 6px" }}>Dictamen</h3>
      <textarea
        className="inp"
        rows={5}
        value={inf.contenido.dictamen}
        onChange={(e) => editarContenido({ ...inf.contenido, dictamen: e.target.value })}
        onBlur={() => guardar({ contenido: inf.contenido })}
      />

      {inf.fotos.length > 0 && (
        <>
          <h3 style={{ fontSize: 17, margin: "18px 0 6px" }}>Anexo fotográfico</h3>
          {inf.fotos.map((f, i) => (
            <div key={f.id} className="row" style={{ marginBottom: 8, alignItems: "flex-start", gap: 8 }}>
              <img src={f.datos} alt="" style={{ width: 110, height: 82, objectFit: "cover", border: "1px solid var(--line)", borderRadius: 6 }} />
              <input
                className="inp"
                style={{ flex: 1 }}
                defaultValue={f.pie}
                placeholder={`Pie de la imagen ${i + 1}`}
                onBlur={async (e) => {
                  if (e.target.value === f.pie) return;
                  const r = await actualizarPieFoto(f.id, e.target.value);
                  if (avisar(r)) router.refresh();
                }}
              />
              <button
                className="btn sm red"
                onClick={async () => {
                  if (!window.confirm("¿Quitar esta foto del informe?")) return;
                  const r = await borrarFoto(f.id);
                  if (avisar(r)) router.refresh();
                }}
              >Quitar</button>
            </div>
          ))}
        </>
      )}

      {error && <p className="error">{error}</p>}
      <p className="hint">{guardando ? "Guardando…" : "Los cambios se guardan solos al salir de cada campo."}</p>
    </div>
  );
}
