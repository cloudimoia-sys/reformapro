/**
 * Aplica los precios del catálogo a las partidas que genera la IA.
 *
 * Por qué en código y no en el prompt: al principio las partidas del catálogo se
 * le pasaban a la IA en el mensaje, y el modelo las metía en TODOS los
 * presupuestos aunque no vinieran a cuento — pedías alicatar un aseo y te colaba
 * "sustitución de plato de ducha" solo porque estaba en el catálogo. Listarle
 * unas partidas y pedirle que las use "si coinciden" es una instrucción que
 * cumple mal: el simple hecho de enumerarlas ya las convierte en sugerencia.
 *
 * Así que se invierte el orden. La IA decide QUÉ trabajos lleva la obra, sin ver
 * el catálogo. Después, aquí, se comprueba cuáles de esos trabajos coinciden con
 * una partida tarifada y se les pone el precio y la redacción del usuario. El
 * catálogo ya no puede añadir trabajo que nadie ha pedido: solo puede cambiarle
 * el precio a un trabajo que la IA ya había decidido incluir.
 */

/** Palabras sin valor para comparar: aparecen en casi cualquier concepto. */
const VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "con", "en", "para", "por", "a",
  "un", "una", "al", "sobre", "su", "sus", "o", "u", "e", "nuevo", "nueva",
  "existente", "incluso", "incluyendo", "obra", "trabajo",
]);

/** Quita tildes y mayúsculas para que "Sustitución" y "sustitucion" casen. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function palabrasClave(texto: string): Set<string> {
  return new Set(
    normalizar(texto)
      .split(/\s+/)
      // Se aceptan palabras de dos letras: descartarlas dejaba fuera "WC", que es
      // como se llama de verdad a esa partida en cualquier catálogo. El ruido lo
      // quita la lista de palabras vacías, no la longitud.
      .filter((p) => p.length >= 2 && !VACIAS.has(p))
  );
}

/**
 * Verbos de obra agrupados por lo que le hacen al elemento.
 *
 * Separar la acción del objeto es lo que hace fiable la comparación. Medido con
 * un caso real: el catálogo dice "Sustitución de plato de ducha" y la IA escribió
 * "Suministro e instalación de plato de ducha" — mismo trabajo, otro verbo, y
 * comparando palabras sueltas no casaba. Pero bajar el listón sin más habría
 * hecho que casara también con "Demolición de alicatado y plato de ducha", que
 * es justo lo contrario y habría cobrado la instalación al demoler.
 */
const ACCIONES: Record<string, string> = {
  // Poner algo nuevo
  sustitucion: "poner", sustituir: "poner", instalacion: "poner", instalar: "poner",
  colocacion: "poner", colocar: "poner", montaje: "poner", montar: "poner",
  suministro: "poner", suministrar: "poner", cambio: "poner", cambiar: "poner",
  renovacion: "poner", sustitucion_completa: "poner", ejecucion: "poner",
  // Quitar lo que había
  demolicion: "quitar", demoler: "quitar", retirada: "quitar", retirar: "quitar",
  desmontaje: "quitar", desmontar: "quitar", picado: "quitar", picar: "quitar",
  levantado: "quitar", levantar: "quitar", derribo: "quitar", arranque: "quitar",
  // Arreglar lo existente
  reparacion: "arreglar", reparar: "arreglar", saneado: "arreglar",
  refuerzo: "arreglar", reforzar: "arreglar", sellado: "arreglar",
};

/** Palabras del concepto que no son verbos: lo que se hace, no cómo. */
function objetos(texto: string): Set<string> {
  const s = new Set<string>();
  for (const p of palabrasClave(texto)) if (!ACCIONES[p]) s.add(p);
  return s;
}

/** Familias de acción presentes en el texto ("poner", "quitar", "arreglar"). */
function familias(texto: string): Set<string> {
  const s = new Set<string>();
  for (const p of palabrasClave(texto)) if (ACCIONES[p]) s.add(ACCIONES[p]);
  return s;
}

/**
 * Mide cuánto del OBJETO de la partida aparece en el concepto generado.
 *
 * Se divide entre las palabras del CATÁLOGO, no entre la unión: lo que importa
 * es que el trabajo tarifado esté contenido en el generado. Así "plato de ducha"
 * casa aunque el generado añada "en aseo de planta baja".
 */
export function similitud(conceptoCatalogo: string, conceptoGenerado: string): number {
  const cat = objetos(conceptoCatalogo);
  if (!cat.size) return 0;
  const gen = objetos(conceptoGenerado);
  let comunes = 0;
  for (const p of cat) if (gen.has(p)) comunes++;
  return comunes / cat.size;
}

/**
 * Comprueba que ambos conceptos hagan lo mismo con el elemento.
 *
 * Si uno pone y el otro quita, no son el mismo trabajo por mucho que hablen del
 * mismo objeto. Cuando alguno no lleva verbo reconocible se da por buena la
 * coincidencia: el objeto ya es bastante señal y el usuario revisa el resultado.
 */
function accionCompatible(conceptoCatalogo: string, conceptoGenerado: string): boolean {
  const a = familias(conceptoCatalogo);
  const b = familias(conceptoGenerado);
  if (!a.size || !b.size) return true;
  for (const f of a) if (b.has(f)) return true;
  return false;
}

/**
 * Umbral sobre el objeto del trabajo.
 *
 * 0,8 exige que casi todo el elemento tarifado esté nombrado en la partida
 * generada. Alto a propósito: equivocarse aquí significa cobrarle al cliente el
 * precio de otro trabajo, que es peor que no aplicar la tarifa propia y que el
 * usuario la ponga a mano.
 */
const UMBRAL = 0.8;
/**
 * Palabras del objeto que deben coincidir.
 *
 * Normalmente dos, para que la coincidencia no sea casual. Pero muchas partidas
 * reales se nombran con una sola palabra de contenido ("Cambio de WC", "Pintura
 * de techo"), y exigir dos las dejaba fuera para siempre. En ese caso basta con
 * una, que además tiene que estar entera: con un solo objeto, el umbral de 0,8
 * obliga a que aparezca completa.
 */
function minimoPalabras(objetosCatalogo: number) {
  return Math.min(2, Math.max(1, objetosCatalogo));
}

export type PartidaCatalogo = {
  nombre: string;
  descripcion: string | null;
  capitulo: string | null;
  unidad: string;
  precio: number;
};

export type LineaGenerada = {
  capitulo: string;
  concepto: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

/**
 * Sustituye el precio y la redacción de las líneas que coinciden con una partida
 * propia. Devuelve también qué partidas se aplicaron, para poder decírselo al
 * usuario y que sepa por qué unos precios son suyos y otros estimados.
 */
export function aplicarCatalogo(
  lineas: LineaGenerada[],
  partidas: PartidaCatalogo[]
): { lineas: LineaGenerada[]; aplicadas: string[] } {
  if (!partidas.length) return { lineas, aplicadas: [] };

  const aplicadas: string[] = [];

  const resultado = lineas.map((linea) => {
    let mejor: PartidaCatalogo | null = null;
    let mejorPuntuacion = 0;

    for (const p of partidas) {
      const totalObjetos = objetos(p.nombre).size;
      const s = similitud(p.nombre, linea.concepto);
      const palabrasComunes = Math.round(s * totalObjetos);
      if (
        s >= UMBRAL &&
        palabrasComunes >= minimoPalabras(totalObjetos) &&
        accionCompatible(p.nombre, linea.concepto) &&
        s > mejorPuntuacion
      ) {
        mejor = p;
        mejorPuntuacion = s;
      }
    }

    if (!mejor) return linea;

    if (!aplicadas.includes(mejor.nombre)) aplicadas.push(mejor.nombre);

    // La cantidad la mantiene la IA: es lo único que depende de esta obra
    // concreta. Todo lo demás lo manda el catálogo.
    return {
      ...linea,
      capitulo: mejor.capitulo || linea.capitulo,
      concepto: mejor.nombre,
      descripcion: mejor.descripcion || linea.descripcion,
      unidad: mejor.unidad,
      precio: mejor.precio,
    };
  });

  return { lineas: resultado, aplicadas };
}
