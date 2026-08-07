"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Recuadro de firma, compartido por presupuestos y partes de trabajo.
 *
 * El texto es configurable porque lo que el cliente firma NO es lo mismo en los
 * dos sitios, y decirlo mal en un papel que alguien firma no es un detalle de
 * redacción: en un presupuesto aprueba un precio ANTES de la obra, y en un
 * parte de trabajo da su conformidad a un trabajo YA hecho. Con el texto fijo
 * de presupuesto, un cliente firmaba "para aprobar el presupuesto" debajo de
 * unas horas que ya se habían trabajado.
 */
export default function SignaturePad({
  onSave,
  onCancel,
  explicacion = "El cliente firma aquí con el dedo o el ratón para aprobar el presupuesto.",
  textoConfirmar = "Confirmar aprobación",
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  explicacion?: string;
  textoConfirmar?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    c.width = c.offsetWidth * 2;
    c.height = 320;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1E2833";
  }, []);

  const pos = (e: any) => {
    const r = ref.current!.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: (t.clientX - r.left) * (ref.current!.width / r.width),
      y: (t.clientY - r.top) * (ref.current!.height / r.height),
    };
  };
  const start = (e: any) => {
    drawing.current = true;
    const p = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: any) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = ref.current!.getContext("2d")!;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setEmpty(false);
  };
  const end = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  return (
    <div>
      <p className="hint">{explicacion}</p>
      <canvas
        ref={ref}
        className="sig-canvas"
        style={{ height: 160 }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" onClick={clear}>Borrar firma</button>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={onCancel}>Cancelar</button>
        <button className="btn amber sm" disabled={empty} onClick={() => onSave(ref.current!.toDataURL("image/png"))}>
          {textoConfirmar}
        </button>
      </div>
    </div>
  );
}
