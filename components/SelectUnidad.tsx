"use client";

import { UNIDADES, CODIGOS_UNIDAD } from "@/lib/unidades";

/**
 * Desplegable de unidades, con un hueco para lo que ya estuviera guardado.
 *
 * Si una línea antigua (o la IA) trae una unidad que no está en la lista, se
 * añade como opción suelta en vez de perderse: un `select` descarta callado un
 * valor que no reconoce, y la línea se quedaría medida en "ud" sin avisar.
 */
export default function SelectUnidad({
  value,
  onChange,
  className = "inp",
  style,
  id,
  disabled,
  compacto = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  disabled?: boolean;
  /**
   * Muestra solo el código ("m²") en vez de la etiqueta completa.
   *
   * Un `select` cerrado enseña el texto de la opción elegida, y en la columna
   * estrecha de la tabla del presupuesto "m² — metro cuadrado" sale recortado a
   * la mitad. En los formularios, donde hay sitio, la etiqueta larga ayuda a
   * elegir bien; los grupos siguen dando contexto en ambos casos.
   */
  compacto?: boolean;
}) {
  const fueraDeLista = value && !CODIGOS_UNIDAD.includes(value);

  return (
    <select
      id={id}
      className={className}
      style={style}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {fueraDeLista && <option value={value}>{value}</option>}
      {UNIDADES.map((g) => (
        <optgroup key={g.grupo} label={g.grupo}>
          {g.opciones.map((o) => (
            <option key={o.codigo} value={o.codigo}>
              {compacto ? o.codigo : o.etiqueta}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
