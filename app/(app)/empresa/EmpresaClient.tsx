"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarEmpresa, actualizarLogoEmpresa, type EmpresaInput } from "./actions";

const CAMPOS: [keyof Omit<EmpresaInput, "ivaDefecto">, string][] = [
  ["nombre", "Nombre"],
  ["cif", "CIF"],
  ["direccion", "Dirección"],
  ["tel", "Teléfono"],
  ["email", "Email"],
];

const LOGO_MAX_LADO = 240; // px — el logo se muestra pequeño en la factura, no hace falta más resolución

function redimensionarImagen(file: File, maxLado = LOGO_MAX_LADO): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function EmpresaClient({
  empresa,
  logoInicial,
}: {
  empresa: EmpresaInput;
  logoInicial: string | null;
}) {
  const router = useRouter();
  const [data, setData] = useState(empresa);
  const [guardando, setGuardando] = useState(false);
  const [logo, setLogo] = useState(logoInicial);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState("");
  const [errorDatos, setErrorDatos] = useState("");

  useEffect(() => {
    setData(empresa);
  }, [empresa]);

  useEffect(() => {
    setLogo(logoInicial);
  }, [logoInicial]);

  // Las acciones devuelven el error en vez de lanzarlo: Next borra el mensaje de
  // las excepciones en producción y no se vería nada útil.
  const guardar = async (patch: Partial<EmpresaInput>) => {
    const next = { ...data, ...patch };
    setData(next);
    setGuardando(true);
    const r = await actualizarEmpresa(next);
    setGuardando(false);
    if (!r.ok) return setErrorDatos(r.error);
    setErrorDatos("");
    router.refresh();
  };

  const subirLogo = async (file: File | undefined) => {
    if (!file) return;
    setErrorLogo("");
    if (!file.type.startsWith("image/")) {
      setErrorLogo("Elige un archivo de imagen (PNG, JPG...).");
      return;
    }
    setSubiendoLogo(true);
    let dataUrl: string;
    try {
      dataUrl = await redimensionarImagen(file);
    } catch (e: any) {
      setSubiendoLogo(false);
      return setErrorLogo(e.message || "No se pudo procesar la imagen.");
    }
    const r = await actualizarLogoEmpresa(dataUrl);
    setSubiendoLogo(false);
    if (!r.ok) return setErrorLogo(r.error);
    setLogo(dataUrl);
    router.refresh();
  };

  const quitarLogo = async () => {
    const r = await actualizarLogoEmpresa(null);
    if (!r.ok) return setErrorLogo(r.error);
    setLogo(null);
    router.refresh();
  };

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 22, marginBottom: 10 }}>Datos de mi empresa</h2>
      {CAMPOS.map(([k, l]) => (
        <div className="field" key={k}>
          <label className="lbl">{l}</label>
          <input
            className="inp"
            defaultValue={data[k]}
            onBlur={(e) => e.target.value !== data[k] && guardar({ [k]: e.target.value } as Partial<EmpresaInput>)}
          />
        </div>
      ))}
      <div className="field">
        <label className="lbl">IVA por defecto</label>
        <select className="inp" value={data.ivaDefecto} onChange={(e) => guardar({ ivaDefecto: Number(e.target.value) })}>
          <option value={10}>10 %</option>
          <option value={21}>21 %</option>
        </select>
      </div>

      <div className="field">
        <label className="lbl">Logo (opcional)</label>
        <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
          Solo se muestra en las facturas si lo subes. Si lo dejas vacío, las facturas salen igual que ahora.
        </p>
        {logo && (
          <div className="row" style={{ marginBottom: 8 }}>
            <img src={logo} alt="Logo de la empresa" style={{ maxHeight: 60, maxWidth: 200, border: "1px solid var(--line)", borderRadius: 6, padding: 4 }} />
            <button className="btn sm red" onClick={quitarLogo}>Quitar logo</button>
          </div>
        )}
        <input
          className="inp"
          type="file"
          accept="image/*"
          disabled={subiendoLogo}
          onChange={(e) => subirLogo(e.target.files?.[0])}
        />
        {subiendoLogo && <p className="hint">Subiendo…</p>}
        {errorLogo && <p className="error">{errorLogo}</p>}
      </div>

      {errorDatos && <p className="error">{errorDatos}</p>}
      <p className="hint">{guardando ? "Guardando…" : "Estos datos aparecen en la cabecera de presupuestos y facturas."}</p>
    </div>
  );
}
