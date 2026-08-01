/**
 * Guía de precios de referencia del mercado español.
 *
 * Existe porque sin un ancla la IA se inventaba el precio en cada generación, y
 * el mismo trabajo salía a un precio distinto cada vez. El caso que lo destapó:
 * dos presupuestos del mismo solado de 4 m², uno CON material a 217,80 € y otro
 * SIN material a 306,90 €. Más caro sin material que con él — delante de un
 * cliente, eso hunde la credibilidad del presupuesto entero.
 *
 * Estos precios son de ejecución material para calidad media: incluyen mano de
 * obra, medios auxiliares y parte proporcional de pequeño material. Son una
 * referencia, no un dogma: las partidas del catálogo del usuario mandan sobre
 * esto, y el usuario puede editar cualquier línea después.
 */

export type PrecioReferencia = {
  concepto: string;
  unidad: string;
  /** Precio de la unidad de obra completa, con material. */
  conMaterial: number;
  /** Solo colocación, cuando el cliente aporta el material. null si no aplica. */
  soloMano: number | null;
};

export const BAREMO: PrecioReferencia[] = [
  // Revestimientos
  { concepto: "Solado de gres porcelánico", unidad: "m²", conMaterial: 38, soloMano: 26 },
  { concepto: "Alicatado de paredes con azulejo o porcelánico", unidad: "m²", conMaterial: 40, soloMano: 28 },
  { concepto: "Tarima flotante laminada", unidad: "m²", conMaterial: 32, soloMano: 16 },
  { concepto: "Rodapié", unidad: "ml", conMaterial: 9, soloMano: 5 },
  { concepto: "Pintura plástica lisa en paramentos", unidad: "m²", conMaterial: 9, soloMano: 7 },
  { concepto: "Enfoscado maestreado de mortero", unidad: "m²", conMaterial: 19, soloMano: 14 },
  { concepto: "Falso techo de placa de yeso laminado", unidad: "m²", conMaterial: 34, soloMano: 24 },

  // Demoliciones y actuaciones previas
  { concepto: "Demolición de alicatado o solado", unidad: "m²", conMaterial: 16, soloMano: null },
  { concepto: "Demolición de tabique", unidad: "m²", conMaterial: 18, soloMano: null },
  { concepto: "Levantado de sanitarios", unidad: "ud", conMaterial: 30, soloMano: null },
  { concepto: "Protección de zonas de paso y mobiliario", unidad: "pa", conMaterial: 60, soloMano: null },

  // Instalaciones completas de vivienda.
  //
  // Corregidas al alza tras una revisión técnica: la app presupuestaba 1.850 € de
  // fontanería y 3.200 € de electricidad para una vivienda de 68 m², cuando lo
  // normal son 3.000-5.000 € y 4.500-7.000 €. Se dan por m² construido para que
  // escalen con la vivienda en vez de salir a tanto alzado, que es justo donde
  // luego aparecen los "modificados".
  { concepto: "Instalación completa de fontanería y saneamiento en vivienda", unidad: "m²", conMaterial: 58, soloMano: 44 },
  { concepto: "Instalación eléctrica completa de vivienda según ITC-BT", unidad: "m²", conMaterial: 78, soloMano: 58 },
  { concepto: "Calefacción y ACS con aerotermia (bomba de calor + emisores)", unidad: "m²", conMaterial: 135, soloMano: 55 },
  { concepto: "Ventilación mecánica de doble flujo (CTE DB-HS3)", unidad: "m²", conMaterial: 34, soloMano: 18 },
  { concepto: "Infraestructura de telecomunicaciones (ICT)", unidad: "pa", conMaterial: 1100, soloMano: 700 },
  { concepto: "Acometidas de agua, electricidad y saneamiento", unidad: "pa", conMaterial: 3500, soloMano: null },
  { concepto: "Estudio geotécnico", unidad: "pa", conMaterial: 1100, soloMano: null },

  // Fontanería y sanitarios
  { concepto: "Punto nuevo de agua (fría y caliente)", unidad: "ud", conMaterial: 110, soloMano: 85 },
  { concepto: "Sustitución de plato de ducha", unidad: "ud", conMaterial: 330, soloMano: 130 },
  { concepto: "Sustitución de inodoro", unidad: "ud", conMaterial: 240, soloMano: 90 },
  { concepto: "Sustitución de lavabo con mueble", unidad: "ud", conMaterial: 330, soloMano: 95 },
  { concepto: "Mampara de ducha", unidad: "ud", conMaterial: 420, soloMano: 110 },
  { concepto: "Renovación de red de fontanería en baño", unidad: "pa", conMaterial: 480, soloMano: 400 },

  // Electricidad
  { concepto: "Punto de luz o enchufe nuevo", unidad: "ud", conMaterial: 65, soloMano: 48 },
  { concepto: "Cuadro eléctrico con ICP y diferenciales", unidad: "ud", conMaterial: 420, soloMano: 190 },

  // Carpintería
  { concepto: "Puerta de paso block", unidad: "ud", conMaterial: 300, soloMano: 110 },
  // Vidrio 4/16/6 bajo emisivo, no 4/16/4: con el simple se queda en el límite de
  // la transmitancia exigida y no pasa en zonas climáticas frías.
  { concepto: "Ventana de aluminio o PVC con RPT y vidrio 4/16/6 bajo emisivo", unidad: "m²", conMaterial: 380, soloMano: 95 },
  { concepto: "Puerta de entrada blindada", unidad: "ud", conMaterial: 1100, soloMano: 180 },
  { concepto: "Persiana de aluminio con aislamiento", unidad: "m²", conMaterial: 110, soloMano: 40 },
  { concepto: "Armario empotrado con interior forrado", unidad: "ml", conMaterial: 480, soloMano: 140 },
  { concepto: "Mobiliario de cocina con encimera", unidad: "ml", conMaterial: 950, soloMano: 220 },

  // Exteriores
  { concepto: "Urbanización exterior: acceso, acera perimetral y cerramiento", unidad: "m²", conMaterial: 65, soloMano: 42 },

  // Albañilería y estructura
  { concepto: "Tabique de ladrillo hueco doble", unidad: "m²", conMaterial: 34, soloMano: 24 },
  // Cerramiento completo (1/2 pie + aislamiento + trasdosado). A 55 EUR/m2 se
  // quedaba muy corto: lo normal son 75-110 EUR/m2.
  { concepto: "Cerramiento de fachada de 1/2 pie con aislamiento y trasdosado", unidad: "m²", conMaterial: 92, soloMano: 62 },
  { concepto: "Revoco monocapa o revestimiento exterior con remates y vierteaguas", unidad: "m²", conMaterial: 32, soloMano: 24 },
  { concepto: "Trasdosado autoportante de placa de yeso con aislamiento", unidad: "m²", conMaterial: 42, soloMano: 30 },
  // Trabajo estructural. Corregido al alza tras revisar un informe real: la app
  // presupuestaba la sustitución de vigueta a 120 €/ml y un dintel nuevo a 180 €,
  // cuando sustituir una vigueta obliga a apear, demoler el entrevigado a ambos
  // lados, cortar y retirar la vieja, colocar la nueva, macizar y esperar
  // fraguado. Es el trabajo más caro y delicado de una rehabilitación, y quedarse
  // corto aquí es donde el reformista pierde dinero de verdad.
  { concepto: "Apeo y apuntalamiento de forjado (montaje, alquiler y desmontaje)", unidad: "m²", conMaterial: 38, soloMano: 30 },
  { concepto: "Sustitución de vigueta de forjado", unidad: "ml", conMaterial: 260, soloMano: 180 },
  { concepto: "Refuerzo de vigueta con perfil metálico inferior", unidad: "ml", conMaterial: 210, soloMano: 130 },
  { concepto: "Reposición de bovedillas y macizado de entrevigado", unidad: "m²", conMaterial: 68, soloMano: 46 },
  { concepto: "Dintel metálico nuevo en hueco de ventana (con apeo y remates)", unidad: "ud", conMaterial: 450, soloMano: 280 },
  { concepto: "Cargadero metálico en apertura de hueco", unidad: "ml", conMaterial: 300, soloMano: 180 },
  { concepto: "Saneado de armadura corroída y pasivado con mortero R4", unidad: "ml", conMaterial: 85, soloMano: 62 },
];

/**
 * Bloque de texto para el prompt.
 *
 * Se le dan las dos columnas para que la diferencia entre presupuestar con
 * material y sin él sea siempre la del material, y no un número nuevo cada vez.
 */
export function bloqueBaremo(sinMateriales: boolean): string {
  const filas = BAREMO.map((p) => {
    const precio = sinMateriales && p.soloMano !== null ? p.soloMano : p.conMaterial;
    return `- ${p.concepto}: ${precio} €/${p.unidad}`;
  }).join("\n");

  return `
PRECIOS DE REFERENCIA${sinMateriales ? " (SOLO MANO DE OBRA, el cliente aporta el material)" : " (unidad de obra completa, con material)"} — mercado español, calidad media:
${filas}

Ajústate a estos precios cuando la partida se parezca a alguna de la lista; súbelos o bájalos como mucho un 20% si la calidad o la dificultad de esta obra lo justifican, y explica en la descripción por qué. Para lo que no esté en la lista, estima con el mismo criterio de mercado.`;
}
