/**
 * Unidades de medición de obra, agrupadas como las usa un aparejador.
 *
 * Antes era un campo de texto libre y cada uno escribía lo que quería ("m2",
 * "M2", "metros"), así que dos líneas idénticas no se podían comparar ni sumar.
 * Con una lista cerrada el presupuesto sale coherente y en móvil se elige de un
 * toque en vez de teclear.
 *
 * El código es lo que se guarda; la etiqueta es lo que se lee en el desplegable.
 */
export const UNIDADES: { grupo: string; opciones: { codigo: string; etiqueta: string }[] }[] = [
  {
    grupo: "Más usadas",
    opciones: [
      { codigo: "ud", etiqueta: "ud — unidad" },
      { codigo: "m²", etiqueta: "m² — metro cuadrado" },
      { codigo: "ml", etiqueta: "ml — metro lineal" },
      { codigo: "m³", etiqueta: "m³ — metro cúbico" },
      { codigo: "pa", etiqueta: "pa — partida alzada" },
    ],
  },
  {
    grupo: "Longitud y superficie",
    opciones: [
      { codigo: "m", etiqueta: "m — metro" },
      { codigo: "cm", etiqueta: "cm — centímetro" },
      { codigo: "km", etiqueta: "km — kilómetro" },
      { codigo: "ha", etiqueta: "ha — hectárea" },
    ],
  },
  {
    grupo: "Peso y volumen",
    opciones: [
      { codigo: "kg", etiqueta: "kg — kilogramo" },
      { codigo: "t", etiqueta: "t — tonelada" },
      { codigo: "g", etiqueta: "g — gramo" },
      { codigo: "l", etiqueta: "l — litro" },
    ],
  },
  {
    grupo: "Tiempo y mano de obra",
    opciones: [
      { codigo: "h", etiqueta: "h — hora" },
      { codigo: "día", etiqueta: "día — jornada" },
      { codigo: "mes", etiqueta: "mes — mensualidad (alquileres)" },
      { codigo: "sem", etiqueta: "sem — semana" },
    ],
  },
  {
    grupo: "Suministro y envase",
    opciones: [
      { codigo: "saco", etiqueta: "saco" },
      { codigo: "palet", etiqueta: "palet" },
      { codigo: "caja", etiqueta: "caja" },
      { codigo: "rollo", etiqueta: "rollo" },
      { codigo: "bote", etiqueta: "bote" },
      { codigo: "juego", etiqueta: "juego / conjunto" },
      { codigo: "par", etiqueta: "par" },
    ],
  },
  {
    grupo: "Otras",
    opciones: [
      { codigo: "%", etiqueta: "% — porcentaje" },
      { codigo: "viaje", etiqueta: "viaje (transporte, escombros)" },
      { codigo: "contenedor", etiqueta: "contenedor" },
      { codigo: "punto", etiqueta: "punto (instalaciones)" },
    ],
  },
];

/** Todos los códigos en plano, para validar. */
export const CODIGOS_UNIDAD = UNIDADES.flatMap((g) => g.opciones.map((o) => o.codigo));

/**
 * Normaliza lo que venga de fuera (la IA, un catálogo antiguo, un import) a un
 * código de la lista. Sin esto, "m2" y "M²" convivirían con "m²" en el mismo
 * presupuesto.
 */
export function normalizarUnidad(u: string | null | undefined): string {
  const t = (u || "").trim();
  if (!t) return "ud";
  if (CODIGOS_UNIDAD.includes(t)) return t;

  const equivalencias: Record<string, string> = {
    m2: "m²", "m^2": "m²", metros2: "m²", "metro cuadrado": "m²",
    m3: "m³", "m^3": "m³", "metro cubico": "m³", "metro cúbico": "m³",
    u: "ud", uds: "ud", unidad: "ud", unidades: "ud",
    metro: "m", metros: "m", "metro lineal": "ml", mlineal: "ml",
    hora: "h", horas: "h", jornada: "día", dias: "día", días: "día",
    kilo: "kg", kilos: "kg", tonelada: "t", toneladas: "t",
    "partida alzada": "pa", partida: "pa",
  };
  const bajo = t.toLowerCase();
  if (equivalencias[bajo]) return equivalencias[bajo];

  // Se devuelve tal cual como último recurso: es mejor conservar lo que escribió
  // el usuario que sustituirlo por "ud" y falsear la medición.
  return t;
}
