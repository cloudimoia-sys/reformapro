/**
 * Revisa las mediciones que devuelve la IA y avisa de las que no cuadran.
 *
 * Existe porque una regla en el prompt nunca es garantía. Caso real: pidiendo un
 * baño de 4 m², la IA calculó 15 m² de paredes y luego usó ese 15 como NÚMERO DE
 * UNIDADES del plato de ducha — quince platos de ducha, 1.200 €. El presupuesto
 * salía con pinta de correcto y el disparate estaba en una celda.
 *
 * Aquí no se corrige nada automáticamente: una medición es una decisión del
 * técnico y cambiarla a su espalda sería peor. Solo se señala lo sospechoso para
 * que lo mire antes de mandárselo al cliente.
 */

/** Elementos que en una vivienda van de uno en uno, o casi. */
const ELEMENTOS_UNICOS = [
  "plato de ducha", "bañera", "banera", "mampara", "inodoro", "wc", "lavabo",
  "bide", "bidé", "fregadero", "caldera", "termo", "cuadro electrico",
  "cuadro eléctrico", "puerta de entrada", "encimera",
];

/** Por encima de esto, un elemento único deja de ser creíble en una reforma. */
const MAX_UNIDADES_ELEMENTO = 4;

export type LineaRevisable = {
  concepto: string;
  cantidad: number;
  unidad: string;
  precio: number;
};

/**
 * Devuelve los avisos en lenguaje llano, listos para enseñar.
 *
 * `m2Declarados` es lo que el usuario escribió en el asistente: sirve para pillar
 * el error concreto de arrastrar una superficie a una casilla de unidades.
 */
export function revisarMediciones(lineas: LineaRevisable[], m2Declarados?: number): string[] {
  const avisos: string[] = [];

  for (const l of lineas) {
    const concepto = (l.concepto || "").toLowerCase();
    const esUnidad = l.unidad === "ud";
    const elemento = ELEMENTOS_UNICOS.find((e) => concepto.includes(e));

    if (esUnidad && elemento && l.cantidad > MAX_UNIDADES_ELEMENTO) {
      avisos.push(
        `"${l.concepto}": ${l.cantidad} unidades. Comprueba la cantidad, parece que se ha colado una superficie.`
      );
      continue;
    }

    // El error de arrastrar los m² a una casilla de unidades, aunque el elemento
    // no esté en la lista de arriba.
    if (esUnidad && m2Declarados && l.cantidad === m2Declarados && m2Declarados > 4) {
      avisos.push(
        `"${l.concepto}": ${l.cantidad} unidades coincide con los m² de la obra. Revisa si debería ir en m².`
      );
    }
  }

  return avisos;
}

/**
 * Texto que no debería aparecer en un documento español.
 *
 * Caso real: un informe entregado llevaba "tablones de repart荷重" — dos
 * caracteres chinos en mitad de una partida. El modelo lo cuela de vez en cuando
 * y en un documento que se firma es inaceptable. Se detecta cualquier carácter
 * fuera del alfabeto latino y de la puntuación habitual.
 */
/*
 * OJO AL TOCAR ESTA EXPRESION: solo escapes \u, nunca caracteres literales.
 *
 * La version anterior escribia los extremos de los rangos con el caracter de
 * verdad. Al guardarse el fichero se perdio el primero de todos y la clase se
 * quedo en [^-<letra> ...]: un guion suelto y una letra suelta. Resultado: TODA
 * letra normal pasaba a ser "rara", y cada informe salia con un aviso por
 * apartado y otro por partida. Doce avisos falsos seguidos, sobre un documento
 * que estaba bien.
 *
 * Es la segunda vez que un caracter se pierde al escribir este mismo fichero
 * (la anterior fue un \b que quedo convertido en byte de retroceso). Por eso
 * aqui no hay ni un caracter fuera de ASCII: ni en la expresion ni en las
 * cadenas de prueba de abajo.
 *
 * Se permite: tabulador y saltos, latino basico y extendido hasta U+024F,
 * puntuacion general (guiones largos, comillas tipograficas) y simbolos de
 * moneda. Lo demas -chino, cirilico, emoji- se avisa.
 */
const CARACTERES_RAROS = /[^\u0009-\u000D\u0020-\u024F\u2000-\u206F\u20A0-\u20BF]/;

/*
 * Comprobacion al arrancar, con el mismo patron que la asercion de tenantDb.ts.
 *
 * Un fallo ruidoso nada mas arrancar es infinitamente mejor que doce avisos
 * falsos en cada documento, que es lo que pasaba y nadie ataba con esto.
 */
{
  const normal = "Alicatado de 12 m\u00B2 a 45\u00BA, 1.250 \u20AC \u2014 junta abierta y ni\u00F1os";
  const chino = "tablones de repart\u8377\u91CD";
  if ([...normal].some((c) => CARACTERES_RAROS.test(c))) {
    throw new Error("CARACTERES_RAROS marca como raro un texto espanol normal: la expresion esta corrupta.");
  }
  if (![...chino].some((c) => CARACTERES_RAROS.test(c))) {
    throw new Error("CARACTERES_RAROS ha dejado de detectar caracteres chinos.");
  }
}

/**
 * Trabajos que dejan la obra abierta y obligan a reponer algo detrás.
 *
 * Sale de un informe real: proponía "reposición de elementos aligerantes
 * dañados" y el presupuesto solo tenía "saneado de bovedillas y retirada". Se
 * picaba, se retiraba y no se reponía nada — ni bovedillas, ni enfoscado, ni
 * pintura. El cliente se quedaría con el techo abierto y el reformista comiéndose
 * la diferencia.
 */
const ABREN_OBRA: { patron: RegExp; falta: RegExp; aviso: string }[] = [
  {
    patron: /demolici[oó]n|picado|retirada|saneado|levantado|desmontaje/i,
    falta: /repos|reconstru|restitu|nuevo|nueva|sustituci|colocaci|montaje/i,
    aviso:
      "Hay partidas de picado, saneado o retirada pero ninguna de reposición. Lo que se abre hay que volver a cerrarlo: comprueba que no falta reponer lo demolido.",
  },
  {
    patron: /picado|demolici[oó]n de revestimiento|saneado de dintel|roza/i,
    falta: /enfoscado|enlucido|revestimiento|guarnecido|pintura|acabado/i,
    aviso:
      "Se pican revestimientos y no se presupuesta el acabado posterior (enfoscado, enlucido o pintura). Es trabajo seguro que quedaría sin cobrar.",
  },
];

/**
 * Comprueba que a cada demolición le siga su reposición.
 *
 * La reposición se busca línea a línea y solo en las que NO son de demolición.
 * Buscándola en el texto entero daba falsos negativos: "Picado de revestimiento"
 * contiene la palabra "revestimiento" y hacía creer que el acabado ya estaba
 * presupuestado, cuando esa línea es justo la que lo destruye.
 */
export function faltanReposiciones(lineas: { concepto: string; descripcion: string }[]): string[] {
  const textos = lineas.map((l) => `${l.concepto} ${l.descripcion}`);
  return ABREN_OBRA.filter((r) => {
    const seAbre = textos.some((t) => r.patron.test(t));
    const seCierra = textos.some((t) => r.falta.test(t) && !r.patron.test(t));
    return seAbre && !seCierra;
  }).map((r) => r.aviso);
}

/**
 * Elementos que el usuario suele nombrar en la descripción y que, si se piden,
 * tienen que aparecer en el presupuesto: o suministrados, o dicho expresamente
 * que los aporta el cliente.
 *
 * Sale de un presupuesto de cocina real: el usuario escribió "Horno, campana y
 * placa vitrocerámica Balay" y el presupuesto solo llevaba "Instalación de
 * electrodomésticos". Los aparatos —entre 700 y 1.200 €— no estaban por ninguna
 * parte, y el cliente que lee 10.873 € da por hecho que van incluidos.
 */
const ELEMENTOS_PEDIBLES: { patron: RegExp; nombre: string }[] = [
  { patron: /\bhorno\b/i, nombre: "horno" },
  { patron: /\bcampana\b|extractor/i, nombre: "campana extractora" },
  { patron: /vitrocer[aá]mica|\bplaca\b|inducci[oó]n/i, nombre: "placa de cocina" },
  { patron: /\bfregadero\b/i, nombre: "fregadero" },
  { patron: /\bgrifo\b|grifer[ií]a/i, nombre: "grifería" },
  { patron: /lavavajillas/i, nombre: "lavavajillas" },
  { patron: /\bnevera\b|frigor[ií]fico/i, nombre: "frigorífico" },
  { patron: /microondas/i, nombre: "microondas" },
  { patron: /plato de ducha/i, nombre: "plato de ducha" },
  { patron: /mampara/i, nombre: "mampara" },
  { patron: /\binodoro\b|\bwc\b/i, nombre: "inodoro" },
  { patron: /\blavabo\b/i, nombre: "lavabo" },
  { patron: /\bba[ñn]era\b/i, nombre: "bañera" },
  { patron: /\bcaldera\b|termo el[eé]ctrico|aerotermia/i, nombre: "caldera o termo" },
  { patron: /\bradiador/i, nombre: "radiadores" },
  { patron: /papel pintado/i, nombre: "papel pintado" },
  { patron: /mobiliario|muebles? (alto|bajo)|muebles de cocina/i, nombre: "mobiliario" },
];

/**
 * Avisa de lo que se pidió por su nombre y no aparece en ninguna partida.
 *
 * Solo mira lo que el usuario nombró: no inventa requisitos. Y no distingue si
 * el elemento debía suministrarse o solo colocarse — eso lo decide el técnico —,
 * pero obliga a que la decisión esté escrita en el presupuesto.
 */
export function faltanElementosPedidos(
  descripcion: string,
  lineas: { concepto: string; descripcion: string }[]
): string[] {
  const pedido = descripcion || "";
  const presupuestado = lineas.map((l) => `${l.concepto} ${l.descripcion}`).join(" ");

  return ELEMENTOS_PEDIBLES.filter((e) => e.patron.test(pedido) && !e.patron.test(presupuestado)).map(
    (e) =>
      `Pediste "${e.nombre}" y no aparece en ninguna partida. Inclúyelo, o deja escrito que lo aporta el cliente: si no, el cliente da por hecho que va en el precio.`
  );
}

/** Devuelve los fragmentos con caracteres impropios, para avisar de ellos. */
export function textoSospechoso(textos: { donde: string; texto: string }[]): string[] {
  const avisos: string[] = [];
  for (const { donde, texto } of textos) {
    if (!texto) continue;
    const raros = [...texto].filter((c) => CARACTERES_RAROS.test(c));
    if (raros.length) {
      avisos.push(
        `${donde}: contiene caracteres que no son de un texto en español (${[...new Set(raros)].join("")}). Corrígelo antes de entregarlo.`
      );
    }
  }
  return avisos;
}

/**
 * Trabajos caros que NO se meten si no se han pedido con todas las letras.
 *
 * Sale de un presupuesto real de baño. Se pidió: solar el suelo, poner paneles
 * decorativos en la pared y cambiar inodoro, lavabo, plato de ducha y mampara.
 * El presupuesto trajo además "renovación de la red de fontanería" por 480 € y
 * un alicatado de paredes de 508 €. Ninguna de las dos cosas se había pedido, y
 * juntas eran casi mil euros de más sobre un total de 3.500.
 *
 * Cambiar los aparatos NO es renovar la instalación: se sustituye la pieza sobre
 * la toma existente. Solo se renueva la red si el cliente lo pide o si al abrir
 * aparece que la instalación no vale — y eso se decide en obra, no al presupuestar.
 */
const TRABAJO_CARO: { patron: RegExp; loPide: RegExp; aviso: string }[] = [
  {
    patron: /renovaci[oó]n de (la )?red|instalaci[oó]n (completa )?de fontaner|nueva red de fontaner|rozas? (para|de) fontaner/i,
    loPide: /fontaner|tuber|ca[ñn]er|instalaci[oó]n de agua|renovar (la )?red|rozas?|saneamiento|bajante|desag[üu]e/i,
    aviso:
      'Has presupuestado renovar la fontanería y no se pedía: cambiar los aparatos es sustituir la pieza sobre la toma que ya está. Quítalo, o justifica en la descripción por qué hace falta.',
  },
  {
    patron: /instalaci[oó]n el[eé]ctrica|cuadro el[eé]ctrico|nueva red el[eé]ctrica|rozas? (para|de) electricidad/i,
    loPide: /el[eé]ctric|cableado|enchufe|cuadro|punto de luz|iluminaci|rozas?/i,
    aviso:
      "Has presupuestado obra eléctrica y no se pedía. Quítalo, o explica en la descripción por qué es necesaria.",
  },
  {
    patron: /demolici[oó]n de tabique|apertura de hueco|derribo de tabiqu/i,
    loPide: /tabiqu|derrib|tirar (la |el )?(pared|tabique)|abrir (un )?hueco|redistribu|ampliar/i,
    aviso:
      "Has presupuestado tirar tabiques y no se pedía. Es obra que cambia la distribución: no se mete sin pedirla.",
  },
  /**
   * Elementos caros que solo entran si se nombran.
   *
   * Sale de un presupuesto real: se pidió "colocar 6 puertas de madera maciza,
   * SOLO esto" y llegó con 12 m² de ventana de aluminio por 5.040 €, más del
   * doble que las puertas. El marco de una puerta NO es una ventana: en una
   * puerta "block" el premarco, el marco, el tapajuntas y los herrajes ya van
   * dentro de la partida.
   *
   * `loPide` incluye a propósito la obra nueva y la reforma integral: ahí una
   * ventana sí entra sin que haga falta nombrarla.
   */
  {
    patron: /\bventana|acristalamiento|balconera|ventanal/i,
    loPide:
      /ventana|acristal|vidrio|balconera|ventanal|cerramiento|carpinter[ií]a exterior|reforma integral|vivienda completa|obra nueva|toda la (casa|vivienda)/i,
    aviso:
      "Has presupuestado ventanas y no se pedían. Ojo: el marco de una puerta NO es una ventana — en una puerta «block» el marco y los tapajuntas ya van incluidos en su propia partida.",
  },
  {
    patron: /persiana/i,
    loPide: /persiana|ventana|cerramiento|reforma integral|vivienda completa|obra nueva/i,
    aviso: "Has presupuestado persianas y no se pedían.",
  },
  {
    patron: /armario empotrado/i,
    loPide: /armario|vestidor|reforma integral|vivienda completa|obra nueva/i,
    aviso: "Has presupuestado armarios empotrados y no se pedían.",
  },
  {
    patron: /caldera|aerotermia|termo el[eé]ctrico|bomba de calor/i,
    loPide:
      /caldera|aerotermia|termo|agua caliente|acs|calefacci|climatiza|reforma integral|vivienda completa|obra nueva/i,
    aviso: "Has presupuestado un aparato de calefacción o agua caliente y no se pedía.",
  },
  {
    patron: /mobiliario de cocina|muebles de cocina/i,
    loPide: /cocina|mobiliario|mueble|reforma integral|vivienda completa|obra nueva/i,
    aviso: "Has presupuestado mobiliario de cocina y no se pedía.",
  },
];

/**
 * Avisa de trabajo caro que no se había pedido.
 *
 * Se comprueba contra la descripción del usuario, no contra una idea de lo que
 * "suele llevar" una reforma. Un presupuesto que trae de más se descubre delante
 * del cliente, y ahí ya no hay forma de defenderlo.
 */
export function trabajosNoPedidos(
  descripcion: string,
  lineas: { concepto: string; descripcion: string }[]
): string[] {
  const pedido = descripcion || "";
  return TRABAJO_CARO.filter(
    (t) => !t.loPide.test(pedido) && lineas.some((l) => t.patron.test(`${l.concepto} ${l.descripcion}`))
  ).map((t) => t.aviso);
}

/**
 * Una línea que DESTRUYE no cuenta como acabado ni como medición de referencia.
 *
 * Es la misma lección que ya costó un falso negativo en `faltanReposiciones`:
 * "Demolición de alicatado y solado" contiene las palabras "alicatado" y
 * "solado", y si no se excluye, el programa cree que hay un alicatado nuevo y
 * que el suelo mide lo que se ha picado. En una prueba real eso disparó dos
 * avisos falsos sobre un presupuesto que estaba bien.
 *
 * Un aviso que salta cuando no toca es peor que no tenerlo: enseña a ignorarlos.
 */
const ES_DEMOLICION = /demolici[oó]n|derribo|picad|levantad|retirad|desmontaj|desmontad|arranque de/i;

/** Acabados de pared que son ALTERNATIVAS: o uno u otro, no los dos. */
const ACABADOS_PARED = [
  {
    nombre: "alicatado",
    patron: /alicatad/i,
    // Cómo lo pediría el usuario. "Alicatar suelos" NO cuenta: es solar, y así lo
    // llama medio país.
    loPide: /alicat\w*\s+(de\s+|las\s+|la\s+)*pared|azulejo\w*\s+(en|de)\s+(las\s+)?pared|alicatar\s+el\s+ba[ñn]o\s+(entero|completo)/i,
  },
  {
    nombre: "panel decorativo",
    patron: /panel(es)? (decorativ|de pared|revestimiento)|revestimiento de panel/i,
    loPide: /panel/i,
  },
  { nombre: "papel pintado", patron: /papel pintado/i, loPide: /papel pintado/i },
  { nombre: "microcemento", patron: /microcemento/i, loPide: /microcemento/i },
  // La pintura cuenta como acabado de pared PARA MEDIR, aunque no compita con
  // las demás: en un baño es normal alicatar abajo y pintar arriba.
  { nombre: "pintura", patron: /pintura|pintad/i, loPide: /pintar|pintura/i },
];

/** Los que se disputan el paramento. La pintura convive con todos. */
const COMPITEN = new Set(["alicatado", "panel decorativo", "papel pintado", "microcemento"]);

/** Lo que delata que una partida va al SUELO, no a la pared. */
const ES_SUELO = /suelo|solad|pavimento|\bpiso\b|tarima|rodapi[eé]/i;

/**
 * Zonas concretas. Un panel "para la ducha" o un frente de lavabo revisten un
 * trozo, no la estancia, y medirlos con el criterio de una pared entera dispara
 * un aviso falso.
 */
const ES_ZONA_CONCRETA = /ducha|plato|frente|encimera|zona de|banera|ba[ñn]era|hasta media altura|z[oó]calo/i;

/**
 * ¿Esta línea ES un acabado de pared?
 *
 * SE MIRA EL CONCEPTO, NO LA DESCRIPCIÓN, y esa es la corrección importante.
 * Buscando la palabra en toda la línea saltaban avisos falsos sobre presupuestos
 * correctos: "Alicatado de suelos" —que es como medio país llama a solar— se
 * contaba como alicatado de pared, y "Pintura en paramentos no alicatados"
 * también, porque contiene la palabra.
 *
 * El concepto es el nombre de la unidad de obra: dice lo que la partida ES. La
 * descripción cuenta matices, y ahí aparecen nombradas otras cosas.
 */
function acabadoDePared(l: { concepto: string; descripcion?: string }) {
  const concepto = l.concepto || "";
  if (ES_DEMOLICION.test(concepto) || ES_SUELO.test(concepto)) return null;
  return ACABADOS_PARED.find((a) => a.patron.test(concepto)) ?? null;
}

/**
 * Dos acabados distintos sobre la misma pared no tienen sentido.
 *
 * En el presupuesto real convivían un alicatado de 12 m² y 10 m² de panel
 * decorativo. O se alicata, o se panela: el panel se pega encima del paramento y
 * hace innecesario el alicatado. Cobrar los dos es cobrar dos veces la pared.
 */
/**
 * Superficie de paramento que cabe esperar, a partir del suelo que se pone.
 *
 * El perímetro de una estancia cuadrada de A m² es 4·raíz(A); por 2,5 m de
 * altura salen 10·raíz(A) m². Devuelve 0 si no hay solado con el que comparar:
 * sin referencia, ninguna de las comprobaciones de abajo opina.
 */
function paredEsperada(lineas: { concepto: string; cantidad: number; unidad: string }[]): number {
  const suelo = lineas
    .filter(
      (l) =>
        /^m2|^m²/i.test((l.unidad || "").trim()) &&
        !ES_DEMOLICION.test(l.concepto) &&
        /solad|pavimento|tarima|suelo/i.test(l.concepto)
    )
    .reduce((s, l) => Math.max(s, l.cantidad), 0);
  return suelo >= 2 ? 10 * Math.sqrt(suelo) : 0;
}

/** Lo que reviste un trozo (la ducha, un frente) y no la estancia entera. */
function esZonaConcreta(l: { concepto: string; descripcion: string }) {
  return ES_ZONA_CONCRETA.test(`${l.concepto} ${l.descripcion}`);
}

/**
 * Un acabado de pared que el usuario NO pidió.
 *
 * ES LA COMPROBACIÓN QUE FALTABA, y la que de verdad responde a "¿de dónde saca
 * eso?". En un baño real se pidió alicatar los SUELOS, pintar las paredes y
 * panelar la ducha, y el presupuesto trajo además un alicatado de paredes de
 * 630 €. La pared ya tenía su acabado asignado —pintura— y aun así apareció otro.
 *
 * La regla es directa: el acabado que el usuario asigna a la pared es el que va.
 * Cualquier otro acabado de pared que aparezca sin haberse pedido, se avisa.
 */
export function acabadoDeParedNoPedido(
  pedido: string,
  lineas: { concepto: string; descripcion: string; cantidad: number; unidad: string }[]
): string[] {
  const texto = pedido || "";
  // Sin saber qué se pidió para la pared, esto no puede juzgar nada.
  const algunoPedido = ACABADOS_PARED.some((a) => a.loPide.test(texto));
  if (!algunoPedido) return [];

  const avisos: string[] = [];
  const vistos = new Set<string>();

  for (const l of lineas) {
    if (esZonaConcreta(l)) continue; // un panel para la ducha no reviste la pared
    const acabado = acabadoDePared(l);
    if (!acabado || vistos.has(acabado.nombre)) continue;
    if (acabado.loPide.test(texto)) continue; // sí se pidió
    vistos.add(acabado.nombre);
    avisos.push(
      `Has presupuestado "${l.concepto}" y no se pidió: para la pared se pidió ${ACABADOS_PARED.filter(
        (a) => a.loPide.test(texto)
      )
        .map((a) => a.nombre)
        .join(" y ")}. Quítalo, o explica en la descripción qué zona lo lleva.`
    );
  }
  return avisos;
}

/**
 * Dos acabados que se disputan el mismo paramento.
 *
 * Solo cuenta cuando los DOS cubren la pared en general y con superficie de
 * pared: un panel para la ducha convive con la pintura del resto, y avisar de
 * eso era un falso positivo que ya se corrigió una vez.
 */
export function acabadosIncompatibles(
  lineas: { concepto: string; descripcion: string; cantidad?: number; unidad?: string }[]
): string[] {
  const conMedida = lineas.map((l) => ({
    ...l,
    cantidad: l.cantidad ?? 0,
    unidad: l.unidad ?? "m²",
  }));
  const esperado = paredEsperada(conMedida);

  const generales = conMedida.filter((l) => {
    if (esZonaConcreta(l)) return false;
    const a = acabadoDePared(l);
    if (!a || !COMPITEN.has(a.nombre)) return false;
    // Si hay solado de referencia, se exige que cubra media pared: así un remate
    // pequeño no se confunde con un revestimiento de toda la estancia.
    return esperado === 0 || l.cantidad >= esperado * 0.5;
  });

  const presentes = [...new Set(generales.map((l) => acabadoDePared(l)!.nombre))];
  if (presentes.length < 2) return [];
  return [
    `Hay dos acabados de pared distintos cubriendo el mismo paramento (${presentes.join(
      " y "
    )}). Son alternativas: deja uno, o aclara en la descripción qué zona lleva cada cosa.`,
  ];
}

/**
 * Un acabado de pared medido demasiado corto.
 *
 * Dos casos reales, los dos del mismo baño de 7,1 m²:
 *  - El panel a 10 m² cuando la pared ronda los 27.
 *  - La pintura a 8 m², que es justo el TECHO: se pidió pintar las paredes y se
 *    midió solo el techo. 8 m² sobre 7,1 de suelo canta.
 *
 * Solo opina si el usuario asignó ese acabado a la pared. Sin saber si el
 * encargo era la pared entera o un trozo, no puede juzgar una medición.
 */
export function paredesCortas(
  lineas: { concepto: string; descripcion: string; cantidad: number; unidad: string }[],
  pedido = ""
): string[] {
  const esperado = paredEsperada(lineas);
  if (!esperado) return [];

  return lineas
    .filter((l) => {
      if (!/^m2|^m²/i.test((l.unidad || "").trim())) return false;
      if (esZonaConcreta(l)) return false;
      const a = acabadoDePared(l);
      // Solo lo que el usuario mandó poner en la pared.
      return !!a && a.loPide.test(pedido || "") && l.cantidad < esperado * 0.6;
    })
    .map(
      (l) =>
        `"${l.concepto}" va a ${l.cantidad} m² y las paredes de esta estancia rondan los ${Math.round(
          esperado
        )} m² (el suelo mide ${Math.round((esperado / 10) ** 2 * 10) / 10}). Con esa cifra estarías midiendo poco más que el techo: comprueba la medición.`
    );
}

/**
 * Partidas sin descripción.
 *
 * La descripción es lo que lee el cliente para saber qué le están haciendo. Una
 * partida de 240 € que solo dice "Sustitución de inodoro" no aclara si el
 * inodoro va incluido, si se reaprovecha el existente ni qué pasa con la toma.
 * Ahí es donde nacen las discusiones al terminar la obra.
 */
export function descripcionesVacias(lineas: { concepto: string; descripcion: string }[]): string[] {
  const sin = lineas.filter((l) => !(l.descripcion || "").trim());
  if (!sin.length) return [];
  return [
    `${sin.length === 1 ? "Una partida no tiene" : `${sin.length} partidas no tienen`} descripción (${sin
      .slice(0, 3)
      .map((l) => `"${l.concepto}"`)
      .join(", ")}${sin.length > 3 ? "…" : ""}). Es lo que lee el cliente para saber qué se le hace y qué va incluido.`,
  ];
}
