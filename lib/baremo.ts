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
  /**
   * El panel decorativo va PEGADO sobre el paramento: ni rejuntado, ni cortes a
   * inglete, ni maestras. Su mano de obra tiene que quedar claramente por debajo
   * de la del alicatado o el presupuesto no se sostiene delante de un cliente.
   *
   * Faltaba, y por eso el asistente se lo inventaba: en un baño real salió a
   * 45 €/m², por encima del alicatado, que es justo lo que no puede pasar.
   */
  { concepto: "Panel decorativo de pared (SPC, PVC o composite), pegado", unidad: "m²", conMaterial: 36, soloMano: 14 },
  { concepto: "Panel de gran formato para plato de ducha y frente", unidad: "m²", conMaterial: 52, soloMano: 18 },
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
  // Separado por gama: la horquilla del mobiliario de cocina es enorme y usar un
  // precio único descuadra el presupuesto entero. En una cocina, los muebles son
  // el 60-70% del total, así que equivocarse aquí se nota más que en nada.
  // Medido en un presupuesto real: 6 ml a 1.100 €/ml daban 6.600 € sobre 8.986 €
  // totales, con un mobiliario de gama básica de gran superficie.
  // 420 €/ml se quedaba corto: los muebles de gran superficie ya cuestan 200-350
  // €/ml, y el montaje (aplomar y nivelar bajos, colgar altos, cortar encimera,
  // hueco de fregadero y placa, sellar y conectar) son otros 150-250 €/ml. A 420
  // no quedaba margen para la mano de obra.
  { concepto: "Mobiliario de cocina de gran superficie (Obramat, Ikea, Leroy), altos y bajos con encimera, montado", unidad: "ml", conMaterial: 580, soloMano: 190 },
  // El montaje suele tener un mínimo: una cocina de 3 ml no se monta en un rato.
  // soloMano en null: esta partida YA es solo mano de obra, no tiene material que
  // descontar. Ponerle el mismo precio en las dos columnas rompía la regla de que
  // sin material siempre sale más barato.
  { concepto: "Montaje de cocina: mínimo de intervención (hasta 3 ml)", unidad: "pa", conMaterial: 550, soloMano: null },
  { concepto: "Mobiliario de cocina a medida de gama media-alta con encimera de compacto o porcelánico", unidad: "ml", conMaterial: 950, soloMano: 240 },
  { concepto: "Encimera de granito, compacto o porcelánico (solo encimera)", unidad: "ml", conMaterial: 290, soloMano: 90 },

  // Electrodomésticos y aparatos: si el usuario los nombra hay que valorarlos, o
  // decir expresamente que los aporta él.
  { concepto: "Horno empotrable de marca (Balay, Bosch y similares)", unidad: "ud", conMaterial: 420, soloMano: 55 },
  { concepto: "Placa vitrocerámica o de inducción", unidad: "ud", conMaterial: 390, soloMano: 55 },
  { concepto: "Campana extractora con salida a conducto", unidad: "ud", conMaterial: 320, soloMano: 90 },
  { concepto: "Fregadero con grifería monomando", unidad: "ud", conMaterial: 340, soloMano: 110 },
  { concepto: "Sistema de extracción de humos con conducto y sombrerete", unidad: "ud", conMaterial: 480, soloMano: 250 },
  { concepto: "Papel pintado colocado", unidad: "m²", conMaterial: 28, soloMano: 16 },
  { concepto: "Enlucido de pasta niveladora y pintura antihumedad", unidad: "m²", conMaterial: 16, soloMano: 12 },

  // Exteriores
  { concepto: "Urbanización exterior: acceso, acera perimetral y cerramiento", unidad: "m²", conMaterial: 65, soloMano: 42 },

  // Albañilería y estructura
  { concepto: "Tabique de ladrillo hueco doble", unidad: "m²", conMaterial: 34, soloMano: 24 },
  // Cerramiento completo (1/2 pie + aislamiento + trasdosado). A 55 EUR/m2 se
  // quedaba muy corto: lo normal son 75-110 EUR/m2.
  { concepto: "Cerramiento de fachada de 1/2 pie con aislamiento y trasdosado", unidad: "m²", conMaterial: 92, soloMano: 62 },
  { concepto: "Revoco monocapa o revestimiento exterior con remates y vierteaguas", unidad: "m²", conMaterial: 32, soloMano: 24 },
  { concepto: "Trasdosado autoportante de placa de yeso con aislamiento", unidad: "m²", conMaterial: 42, soloMano: 30 },

  /*
   * Aislamiento térmico y acústico.
   *
   * Hasta ahora solo existía dentro del cerramiento y del trasdosado, así que un
   * presupuesto de solo aislamiento no tenía de dónde sacar el precio y salía a
   * ojo. Los tres sistemas están separados porque el precio no se parece: por el
   * exterior hay que montar andamio, por el interior se pierde superficie útil, y
   * el insuflado en cámara es el más barato porque no hay obra.
   */
  { concepto: "Aislamiento térmico por el exterior (SATE), con andamio y acabado", unidad: "m²", conMaterial: 88, soloMano: 38 },
  { concepto: "Aislamiento térmico interior con trasdosado de lana mineral", unidad: "m²", conMaterial: 46, soloMano: 26 },
  { concepto: "Aislamiento insuflado en cámara de aire existente", unidad: "m²", conMaterial: 22, soloMano: 12 },
  { concepto: "Aislamiento acústico de pared con lana mineral y doble placa", unidad: "m²", conMaterial: 54, soloMano: 30 },
  { concepto: "Aislamiento acústico de techo con falso techo desolidarizado", unidad: "m²", conMaterial: 62, soloMano: 34 },
  { concepto: "Aislamiento de suelo flotante con lámina anti-impacto", unidad: "m²", conMaterial: 28, soloMano: 14 },
  { concepto: "Aislamiento térmico de cubierta por el interior", unidad: "m²", conMaterial: 38, soloMano: 20 },
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
