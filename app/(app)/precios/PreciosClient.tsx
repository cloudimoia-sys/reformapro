"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  crearProveedor,
  actualizarProveedor,
  crearProducto,
  actualizarProducto,
  borrarProducto,
  comprobarPrecioProducto,
  type ProductoInput,
  type ProveedorInput,
} from "./actions";
import { eur } from "@/lib/format";

type Proveedor = { id: string; nombre: string; web: string | null };
type Producto = ProductoInput & { id: string; fecha: string };

// m³ para hormigones, excavaciones y rellenos; t para acero y escombro; día para
// alquiler de maquinaria; pa para partidas alzadas difíciles de medir.
const UNIDADES = ["ud", "m²", "m³", "ml", "kg", "t", "L", "h", "día", "pa"];
const VACIO_PRODUCTO: Omit<ProductoInput, "provId"> = { nombre: "", unidad: "ud", precio: 0, url: "" };

export default function PreciosClient({
  proveedores,
  productos,
  isAdmin,
}: {
  proveedores: Proveedor[];
  productos: Producto[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [modalProv, setModalProv] = useState<{ id: string | null; data: ProveedorInput } | null>(null);
  const [modal, setModal] = useState<{ id: string | null; data: ProductoInput } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [comprobando, setComprobando] = useState<string | null>(null);
  const [erroresComprobacion, setErroresComprobacion] = useState<Record<string, string>>({});

  const abrirNuevoProveedor = () => setModalProv({ id: null, data: { nombre: "", web: "" } });
  const abrirEditarProveedor = (pr: Proveedor) => setModalProv({ id: pr.id, data: { nombre: pr.nombre, web: pr.web || "" } });
  const cerrarProveedor = () => { setModalProv(null); setError(""); };

  // Las acciones devuelven el error en vez de lanzarlo: Next borra el mensaje de
  // las excepciones en producción y aquí solo se vería un texto genérico.
  const guardarProveedor = async () => {
    if (!modalProv) return;
    setGuardando(true);
    setError("");
    const r = modalProv.id
      ? await actualizarProveedor(modalProv.id, modalProv.data)
      : await crearProveedor(modalProv.data);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    cerrarProveedor();
    router.refresh();
  };

  const abrirNuevo = () =>
    setModal({ id: null, data: { provId: proveedores[0]?.id || "", ...VACIO_PRODUCTO } });
  const abrirEditar = (p: Producto) =>
    setModal({ id: p.id, data: { provId: p.provId, nombre: p.nombre, unidad: p.unidad, precio: p.precio, url: p.url } });
  const cerrar = () => { setModal(null); setError(""); };

  const guardar = async () => {
    if (!modal) return;
    setGuardando(true);
    setError("");
    const r = modal.id ? await actualizarProducto(modal.id, modal.data) : await crearProducto(modal.data);
    setGuardando(false);
    if (!r.ok) return setError(r.error);
    cerrar();
    router.refresh();
  };

  const borrar = async (id: string) => {
    if (!window.confirm("¿Eliminar este material?")) return;
    const r = await borrarProducto(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  const comprobarPrecio = async (id: string) => {
    setComprobando(id);
    setErroresComprobacion((prev) => ({ ...prev, [id]: "" }));
    const r = await comprobarPrecioProducto(id);
    setComprobando(null);
    if (!r.ok) {
      setErroresComprobacion((prev) => ({ ...prev, [id]: r.error }));
      return;
    }
    router.refresh();
  };

  const nombreProveedor = (id: string) => proveedores.find((p) => p.id === id)?.nombre || "—";

  return (
    <>
      <div className="card">
        <div className="row">
          <h2 style={{ fontSize: 22 }}>Proveedores</h2>
          {proveedores.map((pr) => (
            <span key={pr.id} className="badge b-enviado" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {pr.web ? (
                <a href={pr.web} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
                  {pr.nombre} ↗
                </a>
              ) : (
                pr.nombre
              )}
              <button
                onClick={() => abrirEditarProveedor(pr)}
                title="Editar proveedor"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontSize: 12 }}
              >
                ✎
              </button>
            </span>
          ))}
          <div className="spacer" />
          <button className="btn ghost sm" onClick={abrirNuevoProveedor}>+ Añadir proveedor</button>
        </div>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 22 }}>Catálogo de precios</h2>
          <p className="hint">
            Actualiza aquí los precios de cada material; la IA los usa como referencia. &quot;Comprobar precio&quot; lee la
            ficha del proveedor, pero las grandes cadenas (Obramat, Leroy Merlin, Bricomart, Bauhaus, Brico Depot)
            no admiten consultas automáticas: en esas hay que abrir la ficha y actualizar el precio a mano.
          </p>
          <div className="spacer" />
          <button className="btn" disabled={!proveedores.length} onClick={abrirNuevo}>+ Añadir material</button>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Material</th>
              <th>Proveedor</th>
              <th>Precio</th>
              <th className="hidemob">Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td>
                <td>{nombreProveedor(m.provId)}</td>
                <td className="linetotal">{eur(m.precio)} / {m.unidad}</td>
                <td className="hidemob hint">{m.fecha}</td>
                <td style={{ textAlign: "right" }}>
                  {m.url && (
                    <button className="btn sm ghost" disabled={comprobando === m.id} onClick={() => comprobarPrecio(m.id)}>
                      {comprobando === m.id ? "Comprobando…" : "Comprobar precio"}
                    </button>
                  )}{" "}
                  <button className="btn sm ghost" onClick={() => abrirEditar(m)}>Editar</button>{" "}
                  {isAdmin && <button className="btn sm red" onClick={() => borrar(m.id)}>Borrar</button>}
                  {erroresComprobacion[m.id] && (
                    <div className="error" style={{ marginTop: 4, textAlign: "right" }}>
                      {erroresComprobacion[m.id]}
                      {/* Las grandes cadenas bloquean la consulta automática, así que
                          el camino corto es abrir su ficha y editar el precio aquí. */}
                      {m.url && (
                        <>
                          {" "}
                          <a href={m.url} target="_blank" rel="noopener noreferrer">Abrir ficha ↗</a>
                          {" · "}
                          <a href="#" onClick={(e) => { e.preventDefault(); abrirEditar(m); }}>Editar precio</a>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalProv && (
        <div className="modalbg">
          <div className="modal">
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>{modalProv.id ? "Editar proveedor" : "Nuevo proveedor"}</h2>
            <div className="field">
              <label className="lbl">Nombre</label>
              <input
                className="inp"
                value={modalProv.data.nombre}
                onChange={(e) => setModalProv({ ...modalProv, data: { ...modalProv.data, nombre: e.target.value } })}
              />
            </div>
            <div className="field">
              <label className="lbl">Página web (para consultar precios)</label>
              <input
                className="inp"
                placeholder="ej: www.leroymerlin.es"
                value={modalProv.data.web}
                onChange={(e) => setModalProv({ ...modalProv, data: { ...modalProv.data, web: e.target.value } })}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row">
              <div className="spacer" />
              <button className="btn ghost" onClick={cerrarProveedor}>Cancelar</button>
              <button className="btn" disabled={!modalProv.data.nombre.trim() || guardando} onClick={guardarProveedor}>
                {guardando ? "Guardando…" : "Guardar proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modalbg">
          <div className="modal">
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>{modal.id ? "Editar material" : "Nuevo material"}</h2>
            <div className="field">
              <label className="lbl">Proveedor</label>
              <select
                className="inp"
                value={modal.data.provId}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, provId: e.target.value } })}
              >
                {proveedores.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Nombre del material</label>
              <input
                className="inp"
                value={modal.data.nombre}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, nombre: e.target.value } })}
              />
            </div>
            <div className="grid g2">
              <div className="field">
                <label className="lbl">Precio (€)</label>
                <input
                  className="inp"
                  type="number"
                  step="0.01"
                  value={modal.data.precio}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, precio: Number(e.target.value) } })}
                />
              </div>
              <div className="field">
                <label className="lbl">Unidad</label>
                <select
                  className="inp"
                  value={modal.data.unidad}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, unidad: e.target.value } })}
                >
                  {UNIDADES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="lbl">URL de la ficha del producto (opcional)</label>
              <input
                className="inp"
                placeholder="ej: www.tuproveedor.es/producto/..."
                value={modal.data.url}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, url: e.target.value } })}
              />
              <p className="hint" style={{ marginTop: 4 }}>
                Si la guardas, aparece un botón "Comprobar precio" para actualizarlo bajo demanda. Algunas tiendas
                grandes (Leroy Merlin, Obramat) bloquean esta comprobación automática con protección anti-bots —
                en esos casos tendrás que mirar el precio a mano y actualizarlo aquí.
              </p>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row">
              <div className="spacer" />
              <button className="btn ghost" onClick={cerrar}>Cancelar</button>
              <button className="btn" disabled={!modal.data.nombre.trim() || guardando} onClick={guardar}>
                {guardando ? "Guardando…" : "Guardar material"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
