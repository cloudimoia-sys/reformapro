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
import SelectUnidad from "@/components/SelectUnidad";

type Proveedor = { id: string; nombre: string; web: string | null };
type Producto = ProductoInput & { id: string; fecha: string };

const VACIO: Omit<ProductoInput, "provId" | "tipo"> = {
  nombre: "",
  descripcion: "",
  capitulo: "",
  unidad: "ud",
  precio: 0,
  url: "",
  codigoErp: "",
};

/** Capítulos sugeridos: los mismos que usa la IA, para que todo case. */
const CAPITULOS = [
  "Actuaciones previas", "Demoliciones", "Acondicionamiento del terreno", "Cimentaciones",
  "Estructuras", "Fachadas y particiones", "Cubiertas", "Aislamientos e impermeabilizaciones",
  "Instalaciones", "Carpintería, cerrajería y vidrios", "Revestimientos", "Equipamiento",
  "Urbanización exterior", "Maquinaria y medios auxiliares", "Gestión de residuos",
  "Seguridad y salud", "Control de calidad",
];

export default function CatalogoClient({
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

  const abrirNuevo = (tipo: "MATERIAL" | "PARTIDA") =>
    setModal({ id: null, data: { tipo, provId: tipo === "MATERIAL" ? proveedores[0]?.id || "" : "", ...VACIO } });
  const abrirEditar = (p: Producto) =>
    setModal({
      id: p.id,
      data: {
        tipo: p.tipo,
        provId: p.provId || "",
        nombre: p.nombre,
        descripcion: p.descripcion || "",
        capitulo: p.capitulo || "",
        unidad: p.unidad,
        precio: p.precio,
        url: p.url || "",
        codigoErp: p.codigoErp || "",
      },
    });
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
    if (!window.confirm("¿Eliminar esta entrada del catálogo?")) return;
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

  const materiales = productos.filter((p) => p.tipo !== "PARTIDA");
  const partidas = productos.filter((p) => p.tipo === "PARTIDA");

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
          <h2 style={{ fontSize: 22 }}>Mis partidas</h2>
          <p className="hint">
            Trabajos que ya tienes tarifados: cambiar un plato de ducha, dejar un punto nuevo de agua… Con su
            descripción escrita por ti. <strong>La IA los usa tal cual</strong>, con tu precio, en vez de inventarse
            uno cuando aparecen en un presupuesto.
          </p>
          <div className="spacer" />
          <button className="btn" onClick={() => abrirNuevo("PARTIDA")}>+ Añadir partida</button>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Partida</th>
              <th className="hidemob">Capítulo</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.nombre}
                  {p.descripcion && <div className="hint">{p.descripcion}</div>}
                </td>
                <td className="hidemob">{p.capitulo || "—"}</td>
                <td className="linetotal">{eur(p.precio)} / {p.unidad}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn sm ghost" onClick={() => abrirEditar(p)}>Editar</button>{" "}
                  {isAdmin && <button className="btn sm red" onClick={() => borrar(p.id)}>Borrar</button>}
                </td>
              </tr>
            ))}
            {!partidas.length && (
              <tr>
                <td colSpan={4} className="hint">
                  Sin partidas todavía. Añade las que más repitas y dejarás de revisar su precio en cada presupuesto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontSize: 22 }}>Materiales</h2>
          <p className="hint">
            Actualiza aquí los precios de cada material; la IA los usa como referencia. &quot;Comprobar precio&quot; lee la
            ficha del proveedor, pero las grandes cadenas (Obramat, Leroy Merlin, Bricomart, Bauhaus, Brico Depot)
            no admiten consultas automáticas: en esas hay que abrir la ficha y actualizar el precio a mano.
          </p>
          <div className="spacer" />
          <button className="btn" disabled={!proveedores.length} onClick={() => abrirNuevo("MATERIAL")}>+ Añadir material</button>
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
            {materiales.map((m) => (
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
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>
              {modal.data.tipo === "PARTIDA"
                ? modal.id ? "Editar partida" : "Nueva partida"
                : modal.id ? "Editar material" : "Nuevo material"}
            </h2>

            {modal.data.tipo === "MATERIAL" && (
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
            )}

            <div className="field">
              <label className="lbl">
                {modal.data.tipo === "PARTIDA" ? "Concepto: ¿qué trabajo es?" : "Nombre del material"}
              </label>
              <input
                className="inp"
                placeholder={modal.data.tipo === "PARTIDA" ? "Ej: Sustitución de plato de ducha" : ""}
                value={modal.data.nombre}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, nombre: e.target.value } })}
              />
            </div>

            {modal.data.tipo === "PARTIDA" && (
              <>
                <div className="field">
                  <label className="lbl">Descripción que verá el cliente</label>
                  <textarea
                    className="inp"
                    rows={3}
                    placeholder="Ej: Retirada del plato existente, adaptación de desagüe y solado, colocación de plato nuevo sobre mortero, sellado perimetral y puesta en servicio. Incluye mano de obra y pequeño material; no incluye el plato."
                    value={modal.data.descripcion}
                    onChange={(e) => setModal({ ...modal, data: { ...modal.data, descripcion: e.target.value } })}
                  />
                  <p className="hint" style={{ marginTop: 4 }}>
                    Se copia tal cual al presupuesto. Escríbela una vez y sale igual siempre.
                  </p>
                </div>
                <div className="field">
                  <label className="lbl">Capítulo de obra</label>
                  <select
                    className="inp"
                    value={modal.data.capitulo}
                    onChange={(e) => setModal({ ...modal, data: { ...modal.data, capitulo: e.target.value } })}
                  >
                    <option value="">— Sin capítulo —</option>
                    {CAPITULOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}
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
                <SelectUnidad
                  value={modal.data.unidad}
                  onChange={(u) => setModal({ ...modal, data: { ...modal.data, unidad: u } })}
                />
              </div>
            </div>

            {/*
              Vale para materiales y para partidas propias: si la empresa lleva
              un ERP, ahí tienen referencia las dos cosas. Y es opcional de
              verdad — la mayoría de reformistas no tiene ERP y no debe verse
              obligado a rellenar nada para guardar un material.
            */}
            <div className="field">
              <label className="lbl">Código de ERP (opcional)</label>
              <input
                className="inp"
                placeholder="La referencia de este artículo en tu ERP"
                value={modal.data.codigoErp}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, codigoErp: e.target.value } })}
              />
              <p className="hint" style={{ marginTop: 4 }}>
                Solo si trabajas con un ERP. Cuando este artículo entre en un parte de trabajo, el código va con él,
                y así el consumo de material sale del parte ya identificado con la referencia que tu ERP entiende.
              </p>
            </div>

            {modal.data.tipo === "MATERIAL" && (
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
            )}
            {error && <p className="error">{error}</p>}
            <div className="row">
              <div className="spacer" />
              <button className="btn ghost" onClick={cerrar}>Cancelar</button>
              <button className="btn" disabled={!modal.data.nombre.trim() || guardando} onClick={guardar}>
                {guardando ? "Guardando…" : modal.data.tipo === "PARTIDA" ? "Guardar partida" : "Guardar material"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
