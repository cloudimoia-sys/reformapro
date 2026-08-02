/**
 * Catálogo cerrado de patologías de edificación.
 *
 * POR QUÉ EXISTE COMO FICHERO Y NO COMO CONOCIMIENTO DEL MODELO
 * -------------------------------------------------------------
 * Una foto no diagnostica. Una mancha oscura en la esquina de un dormitorio es
 * exactamente igual en la pantalla tanto si es condensación como si es una
 * filtración de fachada, y la reparación de una no tiene nada que ver con la de
 * la otra: en la primera se ventila y se aísla, en la segunda se impermeabiliza
 * por fuera. Si el reformista pica y trasdosa una pared que lo que tenía era una
 * fisura en la fachada, la humedad vuelve en seis meses y la paga él.
 *
 * Por eso la IA aquí hace UNA sola cosa: mirar la foto y decir a cuáles de estas
 * fichas se parece lo que ve. Todo lo que se hace con esa clasificación —lo que
 * hay que comprobar en obra, la urgencia, la reparación y su precio— sale de este
 * fichero, que es revisable, versionado y no cambia de una ejecución a otra.
 *
 * Y la pieza que más valor tiene no es el diagnóstico: es `confundibleCon`. El
 * resultado útil de mirar una foto casi nunca es "es esto", sino "es esto o esto
 * otro, y para saber cuál, en la visita mide esta temperatura o abre esta cata".
 * Eso es lo que un técnico con oficio le diría al reformista por teléfono.
 *
 * MANTENIMIENTO: las señales visuales están escritas para ser leídas por el
 * modelo. Si añades una ficha, escribe `senales` como lo que se VE en una
 * fotografía, no como lo que la patología ES.
 */

import type { EntradaNormativa } from "./normativa";
import { NORMATIVA } from "./normativa";
import { BAREMO } from "./baremo";

export type Urgencia = "baja" | "media" | "alta" | "muy alta";

export type Patologia = {
  id: string;
  etiqueta: string;
  familia: string;
  /** Lo que se aprecia en una fotografía. Es lo único que se le da al modelo. */
  senales: string[];
  /** Con qué se confunde y qué lo separa. La parte más útil del diagnóstico. */
  confundibleCon: { id: string; comoDistinguir: string }[];
  causas: string[];
  /** Lo que hay que hacer EN LA VISITA para confirmar o descartar. */
  comprobaciones: string[];
  urgencia: Urgencia;
  porQueUrgencia: string;
  /** Reparación, en el orden en que se ejecuta. */
  actuacion: string[];
  /** Conceptos del baremo que suele llevar la reparación (deben existir en BAREMO). */
  partidas: string[];
  /** Ids de lib/normativa.ts relacionados. */
  normativa?: string[];
  /** Cuándo esto deja de ser cosa del reformista. */
  derivar?: string;
};

export const PATOLOGIAS: Patologia[] = [
  // ─────────────────────────── Humedades ───────────────────────────
  {
    id: "humedad-capilaridad",
    etiqueta: "Humedad por capilaridad",
    familia: "Humedades",
    senales: [
      "mancha continua en la parte baja del muro, con el borde superior más o menos horizontal, entre 30 cm y 1,5 m del suelo",
      "polvo blanco, cristales o costra salina sobre el paramento",
      "pintura levantada, pulverulenta o abombada en la franja baja",
      "rodapié despegado, hinchado o podrido",
      "revestimiento disgregado que se deshace al rascarlo",
    ],
    confundibleCon: [
      {
        id: "humedad-condensacion",
        comoDistinguir:
          "La capilaridad ocupa la franja baja del muro y trae sales; la condensación aparece arriba, en esquinas, techos y detrás de los muebles, y no deja sales.",
      },
      {
        id: "humedad-fuga-fontaneria",
        comoDistinguir:
          "La capilaridad afecta a todo el muro por igual y es constante todo el año; una fuga hace una mancha localizada que crece y que suele tener un aparato o un paso de tubería encima.",
      },
      {
        id: "eflorescencias",
        comoDistinguir:
          "Las eflorescencias son la consecuencia visible, no la causa: si además el muro está frío y húmedo al tacto en la franja baja, hay capilaridad detrás.",
      },
    ],
    causas: [
      "muro en contacto con el terreno sin barrera antihumedad, lo normal en edificios anteriores a los años 70",
      "barrera existente rota o puenteada por un solado o un enfoscado posterior",
      "nivel freático alto o terreno que no drena",
    ],
    comprobaciones: [
      "medir con higrómetro a distintas alturas del muro: en capilaridad la humedad decrece de abajo a arriba",
      "comprobar si hay cámara ventilada o si el muro apoya directamente sobre el terreno",
      "mirar la cara exterior del mismo muro: suele tener la misma franja",
      "descartar antes una fuga: cerrar la llave general y leer el contador durante una hora",
    ],
    urgencia: "media",
    porQueUrgencia:
      "No es un riesgo inmediato, pero no se detiene sola y va degradando el revestimiento, el rodapié y la carpintería que toca.",
    actuacion: [
      "sanear el revestimiento afectado hasta 50 cm por encima de la última mancha",
      "cortar el ascenso: barrera química por inyección o drenaje perimetral, según lo que permita el muro",
      "esperar el secado del muro antes de revestir (semanas, no días)",
      "revestir con mortero de saneamiento transpirable y pintura permeable al vapor",
    ],
    partidas: [
      "Enlucido de pasta niveladora y pintura antihumedad",
      "Enfoscado maestreado de mortero",
      "Rodapié",
    ],
  },
  {
    id: "humedad-condensacion",
    etiqueta: "Condensación superficial",
    familia: "Humedades",
    senales: [
      "manchas oscuras o moteado negro en esquinas, encuentros de techo con pared y cajas de persiana",
      "manchas detrás de armarios, sofás o cabeceros, donde no circula el aire",
      "gotas o vaho en el vidrio y agua acumulada en el marco de la ventana",
      "mancha con forma de banda que dibuja la posición de un pilar o un canto de forjado",
      "moho superficial que se limpia y vuelve a salir en el mismo sitio",
    ],
    confundibleCon: [
      {
        id: "humedad-filtracion-fachada",
        comoDistinguir:
          "La condensación empeora en invierno y con la casa cerrada, y no depende de la lluvia; la filtración aparece o se agrava justo después de llover.",
      },
      {
        id: "humedad-capilaridad",
        comoDistinguir:
          "La condensación va por arriba y por los puntos fríos; la capilaridad va por la franja baja y trae sales.",
      },
      {
        id: "moho",
        comoDistinguir:
          "El moho es el síntoma; la condensación es la causa. Limpiar el moho sin corregir la condensación solo lo retrasa unas semanas.",
      },
    ],
    causas: [
      "puente térmico: pilar, canto de forjado, dintel o caja de persiana sin aislar",
      "ventilación insuficiente frente a la humedad que se genera dentro (ducha, cocina, secar ropa, personas)",
      "carpintería estanca sin aireadores instalada en una vivienda antigua que ventilaba por infiltración",
      "calefacción intermitente que deja los paramentos por debajo de la temperatura de rocío",
    ],
    comprobaciones: [
      "preguntar si aparece en invierno y desaparece en verano: es casi definitivo",
      "medir con termómetro de infrarrojos la temperatura de la mancha y compararla con el centro del mismo paramento; si está varios grados por debajo, hay puente térmico",
      "medir humedad relativa interior: por encima del 65% mantenido, condensa en cualquier punto frío",
      "comprobar si el baño y la cocina tienen extracción y si funciona (una hoja de papel pegada a la rejilla)",
    ],
    urgencia: "media",
    porQueUrgencia:
      "No compromete la estructura, pero es un problema de salubridad: el moho asociado afecta a quien vive dentro, y reaparece hasta que se corrige la causa.",
    actuacion: [
      "eliminar el moho con producto fungicida antes de nada",
      "corregir el puente térmico: trasdosado aislante en el paño frío o aislamiento de la caja de persiana",
      "garantizar la ventilación: aireadores en carpintería y extracción que funcione en baño y cocina",
      "revestir con pintura antimoho y, si es zona muy fría, terminar con placa aislante",
    ],
    partidas: [
      "Trasdosado autoportante de placa de yeso con aislamiento",
      "Enlucido de pasta niveladora y pintura antihumedad",
      "Ventilación mecánica de doble flujo (CTE DB-HS3)",
    ],
    normativa: ["hs3-caudales", "he-transmitancia"],
  },
  {
    id: "humedad-filtracion-fachada",
    etiqueta: "Filtración por fachada o cerramiento",
    familia: "Humedades",
    senales: [
      "mancha en la cara interior de un muro exterior, más intensa hacia el centro y difuminada en los bordes",
      "cerco de humedad alrededor de una ventana, sobre todo en la jamba o bajo el vierteaguas",
      "regueros verticales oscuros en la fachada, bajo un alféizar o una junta",
      "revoco exterior fisurado, hueco al golpearlo o desprendido",
      "sellado de la carpintería agrietado, despegado o ausente",
    ],
    confundibleCon: [
      {
        id: "humedad-condensacion",
        comoDistinguir:
          "Pregunta si la mancha aparece o crece con la lluvia: si sí, es filtración; si aparece con el frío y la casa cerrada, es condensación.",
      },
      {
        id: "humedad-filtracion-cubierta",
        comoDistinguir:
          "La filtración de cubierta empieza en el techo y baja; la de fachada empieza en el paramento vertical y no moja el techo.",
      },
    ],
    causas: [
      "fisuras en el revestimiento exterior o en la fábrica",
      "sellado perimetral de carpintería degradado o mal ejecutado",
      "vierteaguas sin pendiente, sin goterón o mal rematado contra la jamba",
      "juntas de fábrica abiertas o barrera de agua interrumpida en la cámara",
    ],
    comprobaciones: [
      "asociar la aparición de la mancha a lluvia con viento de una orientación concreta",
      "regar la fachada por zonas con manguera durante 15-20 minutos y ver por dónde entra",
      "golpear el revoco con el mango del martillo: donde suena a hueco está despegado",
      "revisar el goterón del vierteaguas: si el agua vuelve hacia el muro, entra por ahí",
    ],
    urgencia: "media",
    porQueUrgencia:
      "El agua que entra por fachada degrada el aislamiento, oxida lo que encuentra y termina alcanzando cabezas de vigueta si el paño está sobre un forjado.",
    actuacion: [
      "localizar el punto de entrada antes de reparar nada por dentro",
      "sanear y reponer el revestimiento exterior en la zona afectada",
      "rehacer el sellado perimetral de carpintería con masilla elástica sobre fondo de junta",
      "corregir o sustituir el vierteaguas con pendiente y goterón",
      "reparar por dentro solo cuando el paramento haya secado",
    ],
    partidas: [
      "Revoco monocapa o revestimiento exterior con remates y vierteaguas",
      "Enlucido de pasta niveladora y pintura antihumedad",
      "Pintura plástica lisa en paramentos",
    ],
  },
  {
    id: "humedad-filtracion-cubierta",
    etiqueta: "Filtración por cubierta",
    familia: "Humedades",
    senales: [
      "mancha en el techo, con anillos concéntricos y el borde más oscuro",
      "gotera activa, cerco de humedad alrededor de un punto de luz o goteo en el falso techo",
      "placa de yeso del falso techo pandeada, reblandecida o desprendida",
      "mancha bajo un encuentro de cubierta: chimenea, claraboya, canalón o petos",
    ],
    confundibleCon: [
      {
        id: "humedad-fuga-fontaneria",
        comoDistinguir:
          "Si hay vivienda encima, casi siempre es fuga y no cubierta. La cubierta solo entra en juego si el paramento afectado está bajo cubierta directa.",
      },
      {
        id: "humedad-condensacion",
        comoDistinguir:
          "La filtración deja anillos y bordes marcados y aparece tras la lluvia; la condensación es uniforme, difusa y estacional.",
      },
    ],
    causas: [
      "tejas rotas, desplazadas o con solapes insuficientes",
      "impermeabilización agotada o rasgada en cubierta plana",
      "sumidero o canalón obstruido que hace que el agua remonte",
      "encuentros mal resueltos: petos, chimeneas, claraboyas, babero de chapa deteriorado",
    ],
    comprobaciones: [
      "subir a la cubierta y mirar directamente sobre la vertical de la mancha",
      "comprobar sumideros y canalones: la obstrucción es la causa más frecuente y la más barata de resolver",
      "en cubierta plana, prueba de estanquidad tapando el sumidero e inundando",
      "revisar si la mancha crece siempre después de llover o también en seco (entonces es fuga)",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "El agua sobre un forjado alcanza las cabezas de vigueta y la armadura, y ahí el daño pasa de ser una mancha a ser estructural.",
    actuacion: [
      "medida provisional inmediata: lona o sellado de urgencia para cortar la entrada",
      "reparar el origen en cubierta (piezas, impermeabilización, encuentros o desagües)",
      "comprobar el estado del forjado y del entrevigado mojado antes de cerrar",
      "sanear el techo afectado, reponer el falso techo y pintar",
    ],
    partidas: [
      "Falso techo de placa de yeso laminado",
      "Pintura plástica lisa en paramentos",
      "Protección de zonas de paso y mobiliario",
    ],
  },
  {
    id: "humedad-fuga-fontaneria",
    etiqueta: "Fuga de instalación (accidental)",
    familia: "Humedades",
    senales: [
      "mancha localizada y de contorno definido que crece de forma continua",
      "mancha en el techo justo bajo un baño, una cocina o el paso de una bajante",
      "humedad en el arranque de un tabique con instalación empotrada",
      "solado abombado o rodapié levantado en una zona concreta sin más motivo",
      "goteo constante que no depende de la lluvia",
    ],
    confundibleCon: [
      {
        id: "humedad-filtracion-cubierta",
        comoDistinguir:
          "La fuga moja igual llueva o no; la cubierta solo con lluvia. Es la pregunta que primero hay que hacer.",
      },
      {
        id: "humedad-capilaridad",
        comoDistinguir:
          "La fuga está localizada y crece; la capilaridad ocupa todo el muro por igual y lleva años estable.",
      },
    ],
    causas: [
      "tubería de fontanería o de calefacción picada o con la unión abierta",
      "desagüe o sifón mal sellado, o bote sifónico con la junta pasada",
      "impermeabilización del plato de ducha o de la bañera rota en el encuentro con el paramento",
      "bajante comunitaria fisurada",
    ],
    comprobaciones: [
      "cerrar la llave general con todo cerrado y leer el contador: si corre, hay fuga en presión",
      "usar la ducha y los desagües de arriba por separado para ver cuál la reproduce (fuga en desagüe)",
      "termografía o geófono cuando no se quiera picar a ciegas",
      "revisar el sellado del encuentro de la ducha con el alicatado: es el origen más habitual y el más barato",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "Es la única humedad que aporta agua de forma continua: en poco tiempo daña al vecino de abajo y ahí deja de ser un problema de una sola vivienda.",
    actuacion: [
      "cortar el suministro de la zona afectada",
      "localizar el punto exacto antes de picar",
      "sustituir el tramo dañado y probar en presión antes de cerrar",
      "rehacer alicatado o solado y sellar de nuevo el encuentro",
      "secar forzado del paramento y reposición de acabados",
    ],
    partidas: [
      "Renovación de red de fontanería en baño",
      "Demolición de alicatado o solado",
      "Alicatado de paredes con azulejo o porcelánico",
      "Pintura plástica lisa en paramentos",
    ],
    normativa: ["hs5-diametro-aparatos"],
  },
  {
    id: "eflorescencias",
    etiqueta: "Eflorescencias y sales",
    familia: "Humedades",
    senales: [
      "polvo o cristales blancos sobre ladrillo, mortero o pintura",
      "costra blanquecina que reaparece tras limpiarla",
      "pintura que se levanta empujada desde abajo por un depósito blanco",
    ],
    confundibleCon: [
      {
        id: "humedad-capilaridad",
        comoDistinguir:
          "Las sales son la huella de que hay agua moviéndose por el muro. Si están en la franja baja, casi siempre hay capilaridad detrás y hay que tratar esa, no la sal.",
      },
      {
        id: "moho",
        comoDistinguir:
          "La sal es blanca, cristalina y seca al tacto; el moho es negro, verde o gris y no cristaliza.",
      },
    ],
    causas: [
      "agua que atraviesa el material y arrastra sales solubles hasta la superficie",
      "sales del propio terreno o de morteros con áridos salinos",
    ],
    comprobaciones: [
      "raspar y esperar: si vuelve, la fuente de agua sigue activa",
      "buscar la humedad que las transporta antes de tratar la superficie",
    ],
    urgencia: "baja",
    porQueUrgencia:
      "No dañan por sí mismas, pero destrozan cualquier revestimiento que se ponga encima mientras la humedad siga entrando.",
    actuacion: [
      "identificar y cortar el aporte de agua: sin eso, cualquier reparación se pierde",
      "cepillado en seco de la sal (nunca lavar con agua: se disuelve y penetra)",
      "esperar al secado y revestir con mortero de saneamiento",
    ],
    partidas: ["Enlucido de pasta niveladora y pintura antihumedad", "Enfoscado maestreado de mortero"],
  },

  // ─────────────────────────── Biológico ───────────────────────────
  {
    id: "moho",
    etiqueta: "Moho y hongos superficiales",
    familia: "Agentes biológicos",
    senales: [
      "moteado negro, verde o gris agrupado en manchas irregulares",
      "moho en la junta del alicatado, en el silicona de la ducha o en el encuentro de techo y pared",
      "aspecto aterciopelado o velloso, distinto de la suciedad lisa",
      "moho detrás de un mueble arrimado a un muro exterior",
    ],
    confundibleCon: [
      {
        id: "humedad-condensacion",
        comoDistinguir:
          "En interior de vivienda el moho es casi siempre consecuencia de condensación. Buscar la causa antes de limpiar es lo que evita que vuelva.",
      },
      {
        id: "eflorescencias",
        comoDistinguir: "El moho es oscuro y blando; la eflorescencia es blanca y cristalina.",
      },
    ],
    causas: [
      "humedad relativa alta mantenida sobre una superficie fría",
      "falta de ventilación en baños, cocinas y dormitorios cerrados",
      "cualquier humedad de fondo sin resolver",
    ],
    comprobaciones: [
      "medir humedad relativa y temperatura superficial en la zona con moho",
      "comprobar la extracción del baño y de la cocina",
      "descartar filtración o fuga si el moho está en un solo punto y sin patrón de puente térmico",
    ],
    urgencia: "media",
    porQueUrgencia:
      "Es un asunto de salubridad y de habitabilidad: afecta a las vías respiratorias de quien vive dentro, sobre todo a niños y personas mayores.",
    actuacion: [
      "limpiar con fungicida específico protegiéndose con mascarilla y guantes",
      "corregir la causa (ventilación, puente térmico o humedad de fondo)",
      "revestir con pintura antimoho",
    ],
    partidas: ["Enlucido de pasta niveladora y pintura antihumedad", "Pintura plástica lisa en paramentos"],
    normativa: ["hs3-caudales"],
  },
  {
    id: "xilofagos",
    etiqueta: "Ataque de xilófagos en madera",
    familia: "Agentes biológicos",
    senales: [
      "orificios pequeños y redondos en la madera, con serrín fino debajo",
      "galerías visibles al romper o presionar la pieza",
      "madera que cede al punzón o suena a hueco",
      "cordones de tierra en muro o carrera de madera (indicio de termitas)",
      "alas caídas junto a ventanas o rodapiés en primavera",
    ],
    confundibleCon: [
      {
        id: "pudricion-madera",
        comoDistinguir:
          "El insecto deja orificios y serrín; la pudrición oscurece y ablanda la madera sin perforarla, y siempre lleva humedad asociada.",
      },
    ],
    causas: [
      "madera sin tratar, con humedad, en contacto con muro o terreno",
      "termita subterránea procedente del terreno",
      "carcoma o anóbidos en carpintería y viguería antigua",
    ],
    comprobaciones: [
      "punzonar la pieza en varios puntos para medir la sección sana que queda",
      "distinguir termita (cordones de tierra, no deja serrín) de carcoma (serrín fino y orificios)",
      "revisar apoyos y cabezas de vigueta en muro, que es donde primero se pierde la sección",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "Si la madera atacada es estructural, la pérdida de sección es progresiva y silenciosa, y no se ve hasta que la pieza flecta.",
    actuacion: [
      "identificar la especie: el tratamiento de termita no tiene nada que ver con el de carcoma",
      "tratamiento curativo por empresa registrada (la termita exige cebos o barrera perimetral)",
      "sustituir o reforzar las piezas con sección comprometida",
      "eliminar la humedad que lo ha propiciado",
    ],
    partidas: ["Sustitución de vigueta de forjado", "Apeo y apuntalamiento de forjado (montaje, alquiler y desmontaje)"],
    derivar:
      "Si hay madera estructural afectada, la sección resistente que queda la valora un técnico. Y el tratamiento de termitas solo lo puede aplicar una empresa inscrita en el registro oficial de biocidas.",
  },
  {
    id: "pudricion-madera",
    etiqueta: "Pudrición de madera por humedad",
    familia: "Agentes biológicos",
    senales: [
      "madera oscurecida, blanda y fibrosa, que se deshace al rascar",
      "pudrición en la cabeza de la vigueta empotrada en el muro",
      "cubos de madera agrietada en dados, típico de la pudrición parda",
      "hongo blanco algodonoso sobre la pieza",
    ],
    confundibleCon: [
      {
        id: "xilofagos",
        comoDistinguir: "La pudrición no deja orificios ni serrín: ablanda y descompone la pieza entera.",
      },
    ],
    causas: [
      "humedad mantenida por encima del 20% en la madera",
      "cabeza de vigueta empotrada en muro que filtra",
      "falta de ventilación del apoyo o del entrevigado",
    ],
    comprobaciones: [
      "punzonar la cabeza de la vigueta en el apoyo del muro, que es donde se pudre primero",
      "medir la humedad de la madera",
      "localizar de dónde viene el agua: sin cortarla, la pieza nueva se pudre igual",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "La pudrición ataca justo el apoyo, que es donde la vigueta trabaja a cortante. Una cabeza podrida puede fallar sin aviso previo.",
    actuacion: [
      "apear la zona si hay pérdida de sección apreciable",
      "cortar el aporte de agua",
      "sustituir la pieza o rehacer el apoyo con prótesis, según el alcance",
      "ventilar el apoyo para que no se repita",
    ],
    partidas: [
      "Apeo y apuntalamiento de forjado (montaje, alquiler y desmontaje)",
      "Sustitución de vigueta de forjado",
      "Reposición de bovedillas y macizado de entrevigado",
    ],
    derivar: "La pérdida de sección en una pieza estructural la valora un técnico antes de decidir si se refuerza o se sustituye.",
  },

  // ───────────────────── Fisuras, grietas y estructura ─────────────────────
  {
    id: "fisura-retraccion",
    etiqueta: "Fisura de retracción del revestimiento",
    familia: "Fisuras y grietas",
    senales: [
      "fisuras finas, ramificadas y sin dirección dominante, en forma de mapa o piel de cocodrilo",
      "fisuras muy superficiales que no llegan a abrir el material de debajo",
      "aparecen en toda la superficie de un paño enlucido o enfoscado reciente",
      "no hay desplazamiento entre los dos labios de la fisura",
    ],
    confundibleCon: [
      {
        id: "grieta-asiento",
        comoDistinguir:
          "La retracción es fina, ramificada y sin dirección; el asiento va inclinado a unos 45°, se abre más por un extremo y suele repetirse en varias plantas alineadas.",
      },
      {
        id: "fisura-dilatacion",
        comoDistinguir:
          "La dilatación es una fisura larga, recta y horizontal en un punto concreto; la retracción cubre todo el paño con una red de fisuras finas.",
      },
    ],
    causas: [
      "secado rápido del mortero o del yeso (sol, corriente, calor)",
      "exceso de agua o de finos en la amasada",
      "espesor excesivo aplicado en una sola capa",
    ],
    comprobaciones: [
      "medir el ancho: por debajo de 0,2 mm y sin resalte entre labios, es superficial",
      "comprobar si la fisura afecta solo al revestimiento o continúa en la fábrica de detrás",
      "colocar testigo si hay duda de si está viva o parada",
    ],
    urgencia: "baja",
    porQueUrgencia: "Es un defecto de acabado. No afecta a la capacidad portante ni progresa una vez seco el material.",
    actuacion: [
      "abrir en V, imprimar y reparar con masilla elástica",
      "en paños muy fisurados, malla de refuerzo y nuevo enlucido",
      "pintar el paño completo para que la reparación no se note",
    ],
    partidas: ["Enlucido de pasta niveladora y pintura antihumedad", "Pintura plástica lisa en paramentos"],
  },
  {
    id: "grieta-asiento",
    etiqueta: "Grieta por asiento diferencial",
    familia: "Fisuras y grietas",
    senales: [
      "grieta inclinada en torno a 45°, más abierta por un extremo que por el otro",
      "grietas en varias plantas alineadas en la misma vertical",
      "grieta que arranca en la esquina de un hueco de puerta o ventana y sube en diagonal",
      "puertas y ventanas que rozan o dejan de cerrar",
      "solado descuadrado o rodapié separado del suelo",
      "grieta que atraviesa el ladrillo, no solo la junta",
    ],
    confundibleCon: [
      {
        id: "fisura-retraccion",
        comoDistinguir:
          "El asiento tiene dirección clara y ancho creciente; la retracción es una red fina sin dirección y no descuadra carpinterías.",
      },
      {
        id: "grieta-junta-medianera",
        comoDistinguir:
          "La junta constructiva es vertical, recta y coincide exactamente con el encuentro entre dos cuerpos del edificio; el asiento va inclinado y corta elementos.",
      },
    ],
    causas: [
      "excavación, vaciado o construcción en la parcela colindante",
      "cimentación insuficiente o apoyada en terrenos distintos",
      "fuga de saneamiento enterrada que lava el terreno",
      "terreno expansivo con cambios de humedad, o arbolado próximo",
    ],
    comprobaciones: [
      "colocar testigos fechados y medirlos cada dos semanas: es lo que dice si el movimiento sigue vivo",
      "nivelar el solado y buscar el punto bajo, que apunta a la zona que asienta",
      "preguntar por obras recientes en la parcela contigua o en la calle",
      "descartar fuga enterrada de saneamiento",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "Puede ser un asiento ya estabilizado o un movimiento activo, y desde la foto no hay forma de saberlo. Mientras no se demuestre parado, se trata como activo.",
    actuacion: [
      "instrumentar antes de reparar: sellar una grieta viva solo oculta el problema y hace perder la prueba",
      "si hay movimiento activo, estudio geotécnico y recalce o consolidación del terreno",
      "una vez estabilizada, coser la fábrica con grapas o llaves y reparar el paño",
      "reponer revestimientos y ajustar carpinterías",
    ],
    partidas: ["Estudio geotécnico", "Tabique de ladrillo hueco doble", "Enfoscado maestreado de mortero"],
    derivar:
      "Esto lo tiene que ver un arquitecto o un arquitecto técnico en visita. Si hay obra reciente al lado, además conviene documentarlo con fecha desde el primer día: es la prueba de la reclamación.",
  },
  {
    id: "grieta-junta-medianera",
    etiqueta: "Apertura de junta constructiva o encuentro con medianera",
    familia: "Fisuras y grietas",
    senales: [
      "grieta vertical recta y continua justo en el encuentro entre dos cuerpos de edificio",
      "separación limpia que sigue el plano de la junta sin cortar ladrillos",
      "misma grieta repetida en todas las plantas, siempre en la misma vertical",
    ],
    confundibleCon: [
      {
        id: "grieta-asiento",
        comoDistinguir:
          "La junta es vertical y limpia; el asiento va inclinado y rompe las piezas que encuentra. Si la grieta corta ladrillos, no es una junta trabajando.",
      },
    ],
    causas: [
      "junta de dilatación que se ha quedado sin sellado",
      "movimientos diferenciales normales entre dos edificios independientes",
      "sellado original degradado por el sol y el agua",
    ],
    comprobaciones: [
      "comprobar si la grieta corta piezas o solo sigue el plano de la junta",
      "medir con testigo si el movimiento es estacional (abre en invierno, cierra en verano) o progresivo",
      "revisar si por ahí entra agua",
    ],
    urgencia: "baja",
    porQueUrgencia:
      "Una junta trabajando es lo esperable y no compromete nada; el problema es el agua que entra por ella si se queda sin sellar.",
    actuacion: [
      "limpiar la junta y colocar fondo de junta",
      "sellar con masilla elástica de movimiento acompañado, nunca con mortero rígido",
      "en fachada, rematar con perfil de tapajuntas si el ancho lo pide",
    ],
    partidas: ["Revoco monocapa o revestimiento exterior con remates y vierteaguas"],
  },
  {
    id: "fisura-dilatacion",
    etiqueta: "Fisura por dilatación térmica",
    familia: "Fisuras y grietas",
    senales: [
      "fisura horizontal recta bajo el forjado o en el encuentro de tabique con techo",
      "fisura en la última planta, más marcada que en las inferiores",
      "fisura horizontal continua en fachada bajo la cornisa o el alero",
      "empeora en verano y se cierra parcialmente en invierno",
    ],
    confundibleCon: [
      {
        id: "grieta-asiento",
        comoDistinguir:
          "La dilatación es horizontal y aparece sobre todo en la planta última; el asiento es inclinado y se propaga en vertical por varias plantas.",
      },
      {
        id: "fisura-retraccion",
        comoDistinguir: "La dilatación es una línea larga y definida; la retracción es una red de fisuras finas.",
      },
    ],
    causas: [
      "cubierta sin aislar que dilata mucho y arrastra el forjado de la última planta",
      "falta de junta de dilatación en un edificio largo",
      "tabique trabado rígidamente contra el forjado superior, sin junta elástica",
    ],
    comprobaciones: [
      "comprobar si la fisura es peor en la última planta y en la orientación soleada",
      "preguntar por la variación estacional",
      "comprobar si el tabique llega a tope contra el forjado sin junta",
    ],
    urgencia: "baja",
    porQueUrgencia:
      "El movimiento térmico es reversible y no compromete la estructura, pero rompe el acabado una y otra vez si se repara rígido.",
    actuacion: [
      "aislar la cubierta, que es lo que reduce el movimiento de origen",
      "reparar con junta elástica en el encuentro, no con yeso rígido",
      "en fachada, sellar con masilla elástica y no con mortero",
    ],
    partidas: ["Enlucido de pasta niveladora y pintura antihumedad", "Pintura plástica lisa en paramentos"],
  },
  {
    id: "corrosion-armaduras",
    etiqueta: "Corrosión de armaduras en hormigón",
    familia: "Estructura",
    senales: [
      "hormigón desprendido dejando la barra de acero a la vista",
      "manchas de óxido y regueros marrones sobre el paramento de hormigón",
      "fisura recta que sigue exactamente la línea de una armadura",
      "abombamiento del recubrimiento con el hormigón hueco al golpearlo",
      "barra visible con pérdida de sección o delaminada",
    ],
    confundibleCon: [
      {
        id: "oxidacion-vigueta-metalica",
        comoDistinguir:
          "Si lo que oxida es un perfil metálico o una vigueta de hierro, el problema es el mismo pero la reparación es distinta: chorreado y protección del perfil, no pasivado de armadura.",
      },
      {
        id: "fisura-retraccion",
        comoDistinguir: "La corrosión sigue la línea de la barra y va con óxido y desprendimiento; la retracción no oxida.",
      },
    ],
    causas: [
      "recubrimiento insuficiente que deja llegar el agua y el aire al acero",
      "carbonatación del hormigón por su edad",
      "cloruros en ambiente marino o en el propio hormigón",
      "filtración mantenida sobre el elemento",
    ],
    comprobaciones: [
      "medir el recubrimiento real y compararlo con el mínimo exigible",
      "golpear el entorno para delimitar toda la superficie hueca, que siempre es mayor que la que se ve",
      "estimar la pérdida de sección de la barra",
      "cortar la humedad que lo alimenta antes de reparar",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "El óxido ocupa hasta diez veces más que el acero sano: revienta el hormigón desde dentro y el proceso se acelera solo. Además hay riesgo de desprendimiento sobre zona de paso.",
    actuacion: [
      "acordonar la zona si hay riesgo de desprendimiento sobre personas",
      "picar el hormigón hasta dejar la barra libre por todo su contorno y hasta hormigón sano",
      "cepillar el acero al grado exigido y aplicar pasivante",
      "reconstruir con mortero de reparación tipo R4",
      "proteger la superficie con revestimiento anticarbonatación",
    ],
    partidas: ["Saneado de armadura corroída y pasivado con mortero R4", "Apeo y apuntalamiento de forjado (montaje, alquiler y desmontaje)"],
    normativa: ["ehe-recubrimiento"],
    derivar:
      "Si la barra ha perdido sección apreciable o el elemento es un pilar o una viga, el alcance lo tiene que valorar un técnico: puede hacer falta refuerzo, no solo reparación.",
  },
  {
    id: "oxidacion-vigueta-metalica",
    etiqueta: "Oxidación de vigueta o perfil metálico",
    familia: "Estructura",
    senales: [
      "perfil metálico visible con óxido en láminas o escamas",
      "hinchazón del yeso o del entrevigado siguiendo la línea de la vigueta",
      "manchas de óxido que calan el techo desde el forjado",
      "bovedillas fisuradas en paralelo a la vigueta",
    ],
    confundibleCon: [
      {
        id: "corrosion-armaduras",
        comoDistinguir: "Aquí lo que se oxida es un perfil de acero laminado, no una barra dentro del hormigón. La reparación es chorreado y protección.",
      },
      {
        id: "flecha-forjado",
        comoDistinguir: "La oxidación mancha e hincha; la flecha se ve como pandeo del plano del techo. Pueden ir juntas.",
      },
    ],
    causas: [
      "humedad mantenida sobre el forjado (baño, cubierta o fachada que filtra)",
      "ausencia de protección del perfil, habitual en forjados de mediados del siglo XX",
      "condensación en el apoyo empotrado en el muro",
    ],
    comprobaciones: [
      "descubrir la vigueta en un punto y medir el espesor de ala y alma que queda sano",
      "revisar los apoyos en muro, que es donde más oxida y menos se ve",
      "localizar y cortar la humedad de origen",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "La pérdida de sección de un perfil que trabaja a flexión reduce directamente su capacidad, y el proceso no se detiene mientras siga entrando agua.",
    actuacion: [
      "apear si la pérdida de sección es apreciable",
      "cortar la humedad de origen",
      "descubrir, cepillar hasta metal sano y aplicar imprimación anticorrosiva",
      "reforzar o sustituir la vigueta según lo que quede de sección",
      "reponer entrevigado y acabados",
    ],
    partidas: [
      "Apeo y apuntalamiento de forjado (montaje, alquiler y desmontaje)",
      "Refuerzo de vigueta con perfil metálico inferior",
      "Sustitución de vigueta de forjado",
      "Reposición de bovedillas y macizado de entrevigado",
    ],
    derivar: "La capacidad que le queda a la vigueta la calcula un técnico. No es una decisión que se tome a ojo en la visita.",
  },
  {
    id: "flecha-forjado",
    etiqueta: "Flecha excesiva en forjado o viga",
    familia: "Estructura",
    senales: [
      "techo visiblemente pandeado hacia abajo en el centro del vano",
      "fisura horizontal en la parte alta de los tabiques bajo la zona pandeada",
      "puertas que rozan por arriba en el centro de la estancia y no en los extremos",
      "solado de la planta superior hundido o desnivelado en el centro",
      "rodapié separado del suelo hacia el centro del vano",
    ],
    confundibleCon: [
      {
        id: "grieta-asiento",
        comoDistinguir:
          "La flecha da un descenso en el centro del vano, con las paredes de apoyo firmes; el asiento hunde una zona completa incluidos los apoyos. Nivelar el suelo lo distingue.",
      },
      {
        id: "fisura-dilatacion",
        comoDistinguir: "La flecha va con deformación medible del plano; la dilatación abre la fisura sin pandeo.",
      },
    ],
    causas: [
      "sobrecarga no prevista (tabique nuevo, solado sobre solado, depósito, mobiliario pesado)",
      "pérdida de sección por corrosión o pudrición",
      "vano excesivo o forjado infradimensionado de origen",
      "fluencia del hormigón a largo plazo",
    ],
    comprobaciones: [
      "medir la flecha real con regla o nivel láser sobre el vano, y comparar con L/300 y L/500",
      "colocar testigo y volver a medir semanas después: lo que importa es si sigue creciendo",
      "buscar cargas añadidas después de la construcción",
    ],
    urgencia: "muy alta",
    porQueUrgencia:
      "Una flecha que sigue creciendo es un aviso previo al fallo. Desde una fotografía no se puede saber si está parada, así que se trata como activa hasta que se demuestre lo contrario.",
    actuacion: [
      "apuntalar de inmediato si la deformación es evidente o hay fisuración asociada",
      "retirar las sobrecargas que se puedan quitar",
      "estudio estructural que determine la capacidad que queda",
      "refuerzo o sustitución según el resultado del cálculo",
    ],
    partidas: [
      "Apeo y apuntalamiento de forjado (montaje, alquiler y desmontaje)",
      "Refuerzo de vigueta con perfil metálico inferior",
      "Sustitución de vigueta de forjado",
    ],
    derivar:
      "Esto no se presupuesta desde una foto. Apear y avisar a un técnico el mismo día. Si hay riesgo para las personas, desalojar la zona.",
  },
  {
    id: "dintel-degradado",
    etiqueta: "Dintel o cargadero degradado",
    familia: "Estructura",
    senales: [
      "fisura horizontal sobre el hueco de una ventana o una puerta",
      "fisuras que arrancan de las dos esquinas superiores del hueco",
      "descuelgue visible de la fábrica sobre el hueco",
      "perfil de dintel oxidado y a la vista",
    ],
    confundibleCon: [
      {
        id: "grieta-asiento",
        comoDistinguir:
          "El fallo de dintel se concentra en el hueco y su entorno inmediato; el asiento afecta a todo el paño y a varias plantas.",
      },
    ],
    causas: [
      "dintel de madera podrido o perfil metálico oxidado",
      "cargadero insuficiente para la carga que recibe",
      "apoyo del dintel degradado en la jamba",
    ],
    comprobaciones: [
      "descubrir el dintel y comprobar de qué material es y en qué estado",
      "medir la longitud de apoyo en las jambas",
      "poner testigo sobre la fisura antes de intervenir",
    ],
    urgencia: "alta",
    porQueUrgencia: "El dintel sostiene la fábrica sobre el hueco: su fallo es un desprendimiento sobre una zona de paso.",
    actuacion: [
      "apear el hueco antes de tocar nada",
      "retirar el dintel degradado",
      "colocar cargadero nuevo con apoyo suficiente a cada lado",
      "macizar, rematar y reponer acabados",
    ],
    partidas: ["Dintel metálico nuevo en hueco de ventana (con apeo y remates)", "Cargadero metálico en apertura de hueco"],
    derivar: "El dimensionado del cargadero nuevo lo firma un técnico cuando el hueco recibe carga de forjado.",
  },

  // ─────────────────────── Revestimientos y acabados ───────────────────────
  {
    id: "abombamiento-ceramico",
    etiqueta: "Despegue o abombamiento de alicatado o solado",
    familia: "Revestimientos",
    senales: [
      "baldosas levantadas formando cresta o caballete en una línea",
      "piezas sueltas que suenan a hueco al golpearlas",
      "junta cerrada y machacada, con las piezas comprimidas entre sí",
      "baldosas fisuradas siguiendo la misma alineación",
    ],
    confundibleCon: [
      {
        id: "humedad-fuga-fontaneria",
        comoDistinguir:
          "Si además hay humedad bajo el pavimento o rodapié hinchado, la causa es agua y no dilatación: hay que buscar la fuga antes de volver a solar.",
      },
      {
        id: "grieta-asiento",
        comoDistinguir:
          "El asiento descuadra huecos y descuelga el plano; el abombamiento levanta el pavimento pero el resto del edificio está en orden.",
      },
    ],
    causas: [
      "falta de junta perimetral: el pavimento dilata y no tiene a dónde crecer",
      "ausencia de juntas de partición en superficies grandes",
      "adhesivo mal extendido o soporte sin curar",
      "humedad bajo el pavimento",
    ],
    comprobaciones: [
      "levantar el rodapié y mirar si hay junta perimetral: es la causa más frecuente con diferencia",
      "golpear toda la superficie para delimitar la zona hueca, que suele ser mayor que la levantada",
      "comprobar humedad bajo las piezas retiradas",
    ],
    urgencia: "media",
    porQueUrgencia:
      "No es un riesgo estructural, pero una vez que empieza sigue avanzando, y las piezas levantadas son un tropiezo.",
    actuacion: [
      "retirar la zona despegada hasta encontrar material bien adherido",
      "ejecutar junta perimetral de al menos 5 mm contra todos los paramentos",
      "reponer con adhesivo adecuado y respetar las juntas de partición",
      "rematar el rodapié sin volver a rigidizar el perímetro",
    ],
    partidas: [
      "Demolición de alicatado o solado",
      "Solado de gres porcelánico",
      "Alicatado de paredes con azulejo o porcelánico",
      "Rodapié",
    ],
    normativa: ["juntas-dilatacion-solado"],
  },
  {
    id: "desconchado-pintura",
    etiqueta: "Desconchado o ampollas en pintura",
    familia: "Revestimientos",
    senales: [
      "pintura levantada en placas o escamas que dejan ver el soporte",
      "ampollas o burbujas en el paramento pintado",
      "pintura pulverulenta que mancha al pasar la mano",
      "capas superpuestas que se separan entre sí",
    ],
    confundibleCon: [
      {
        id: "humedad-capilaridad",
        comoDistinguir:
          "Si el desconchado está en la franja baja y hay sales, no es un problema de pintura: es capilaridad y hay que tratar esa.",
      },
      {
        id: "humedad-condensacion",
        comoDistinguir: "Si está arriba, en puntos fríos y con moteado oscuro, la causa es condensación.",
      },
    ],
    causas: [
      "humedad en el soporte al pintar o después",
      "falta de imprimación sobre soporte pulverulento o muy absorbente",
      "pintura plástica impermeable aplicada sobre un muro que necesita transpirar",
      "capas incompatibles entre sí",
    ],
    comprobaciones: [
      "medir la humedad del soporte antes de decidir nada",
      "hacer prueba de adherencia con cinta en varias zonas",
      "descartar que haya una humedad de fondo: repintar sobre ella es tirar el trabajo",
    ],
    urgencia: "baja",
    porQueUrgencia:
      "Es un defecto de acabado. Lo único que importa es no repintar sin resolver antes la humedad que hay debajo, si la hay.",
    actuacion: [
      "rascar hasta soporte firme",
      "resolver la humedad si la hay, y esperar a que seque",
      "imprimar con fijador y aplicar pintura compatible y transpirable",
    ],
    partidas: ["Pintura plástica lisa en paramentos", "Enlucido de pasta niveladora y pintura antihumedad"],
  },
  {
    id: "desprendimiento-revoco",
    etiqueta: "Desprendimiento de revoco o plaqueta de fachada",
    familia: "Revestimientos",
    senales: [
      "zonas de fachada con el revestimiento caído y la fábrica a la vista",
      "revoco abombado o fisurado en grandes paños",
      "plaquetas o aplacado con piezas sueltas o faltantes",
      "manchas de humedad alrededor de la zona desprendida",
    ],
    confundibleCon: [
      {
        id: "humedad-filtracion-fachada",
        comoDistinguir:
          "Suelen ir juntas: el agua despega el revestimiento y el revestimiento despegado deja entrar más agua. Se reparan a la vez.",
      },
    ],
    causas: [
      "agua que entra por detrás del revestimiento y lo empuja",
      "ciclos de hielo y deshielo",
      "falta de adherencia o de anclaje de origen",
      "movimientos del soporte sin juntas",
    ],
    comprobaciones: [
      "golpear sistemáticamente todo el paño para delimitar lo hueco: casi siempre hay mucho más de lo que se ve caído",
      "comprobar si hay riesgo de caída sobre vía pública o sobre zona de paso",
      "revisar remates de coronación y vierteaguas, que es por donde suele entrar el agua",
    ],
    urgencia: "alta",
    porQueUrgencia:
      "Un desprendimiento en altura sobre acera o patio es un riesgo para las personas, y la responsabilidad recae sobre la propiedad.",
    actuacion: [
      "poner medios de protección o red y balizar la zona bajo la fachada",
      "repicar todo lo hueco, no solo lo caído",
      "reponer con revestimiento y malla de refuerzo donde proceda",
      "corregir remates y coronaciones para que no vuelva a entrar agua",
    ],
    partidas: ["Revoco monocapa o revestimiento exterior con remates y vierteaguas", "Protección de zonas de paso y mobiliario"],
    derivar:
      "Si hay riesgo de caída a vía pública, es una actuación urgente: balizar el mismo día y comunicarlo a la propiedad por escrito.",
  },

  // ─────────────────── Cubiertas, carpintería e instalaciones ───────────────────
  {
    id: "cubierta-tejas",
    etiqueta: "Tejas rotas, desplazadas o cubierta deteriorada",
    familia: "Cubiertas",
    senales: [
      "tejas partidas, movidas de su posición o ausentes",
      "vegetación o musgo creciendo entre las piezas",
      "línea de cumbrera o limahoya con el mortero descarnado",
      "chapa de remate levantada o con la fijación suelta",
    ],
    confundibleCon: [
      {
        id: "humedad-filtracion-cubierta",
        comoDistinguir: "Esto es el origen visto desde arriba; la filtración es el mismo problema visto desde dentro.",
      },
    ],
    causas: [
      "viento, granizo o tránsito sobre la cubierta",
      "mortero de cumbrera y limas degradado por la edad",
      "solape insuficiente en la colocación original",
    ],
    comprobaciones: [
      "revisar toda la faldón, no solo la vertical de la mancha interior: el agua recorre antes de caer",
      "comprobar el estado del rastrel y del soporte bajo las piezas movidas",
      "mirar canalones y limahoyas, que es donde se acumula",
    ],
    urgencia: "alta",
    porQueUrgencia: "Cada lluvia que pasa con la cubierta abierta moja el forjado, y el daño acumulado sí llega a ser estructural.",
    actuacion: [
      "reponer piezas rotas o desplazadas con el solape correcto",
      "rehacer cumbreras y limas con mortero o pieza seca",
      "revisar y limpiar canalones y bajantes",
      "comprobar el estado del entramado bajo la zona reparada",
    ],
    partidas: ["Protección de zonas de paso y mobiliario"],
    derivar: "Trabajo en altura: exige línea de vida o andamio. No se sube a un tejado sin medios de protección.",
  },
  {
    id: "desague-obstruido",
    etiqueta: "Canalón, bajante o sumidero obstruido",
    familia: "Instalaciones",
    senales: [
      "canalón con hojas, tierra o vegetación dentro",
      "regueros y manchas verticales en la fachada bajo el canalón",
      "agua que rebosa por el borde en lugar de bajar por la bajante",
      "sumidero de cubierta cegado o con la rejilla rota",
      "mancha de humedad en el paramento junto al trazado de una bajante",
    ],
    confundibleCon: [
      {
        id: "humedad-filtracion-fachada",
        comoDistinguir:
          "Si la mancha de fachada está justo bajo un canalón que rebosa, la causa es el desagüe y no el cerramiento. Se limpia el canalón antes de tocar la fachada.",
      },
    ],
    causas: [
      "falta de mantenimiento y acumulación de hojas",
      "pendiente insuficiente o canalón descolgado",
      "bajante rota o desconectada",
    ],
    comprobaciones: [
      "verter agua por el canalón y ver por dónde sale",
      "comprobar la pendiente hacia la bajante",
      "revisar la unión de canalón con bajante y los pasos por el interior",
    ],
    urgencia: "media",
    porQueUrgencia:
      "Es de las causas más baratas de resolver y de las que más daño acumulado provocan si se dejan: mucha filtración de fachada empieza aquí.",
    actuacion: [
      "limpiar el canalón y probar el desagüe",
      "corregir pendiente o sustituir el tramo dañado",
      "colocar protección antihojas si el entorno lo pide",
      "reparar después la fachada o el paramento manchado",
    ],
    partidas: ["Revoco monocapa o revestimiento exterior con remates y vierteaguas"],
    normativa: ["hs5-pendiente-derivaciones"],
  },
  {
    id: "instalacion-electrica-obsoleta",
    etiqueta: "Instalación eléctrica obsoleta o insegura",
    familia: "Instalaciones",
    senales: [
      "cuadro antiguo con fusibles de porcelana o sin diferencial",
      "cables con aislamiento de tela o goma agrietada",
      "empalmes con cinta aislante fuera de caja de registro",
      "enchufe o mecanismo quemado, ennegrecido o derretido",
      "enchufes sin toma de tierra o cableado por fuera del tubo",
      "mecanismos dentro del volumen de protección de la ducha o la bañera",
    ],
    confundibleCon: [],
    causas: [
      "instalación anterior al reglamento vigente y nunca renovada",
      "ampliaciones sucesivas hechas sin criterio",
      "sección insuficiente para la potencia que se consume hoy",
    ],
    comprobaciones: [
      "comprobar si hay diferencial y si salta al pulsar el botón de prueba",
      "comprobar continuidad de la toma de tierra en los enchufes",
      "comprobar que no haya mecanismos dentro de los volúmenes de protección del baño",
      "medir la sección de los circuitos de cocina y lavadora",
    ],
    urgencia: "muy alta",
    porQueUrgencia:
      "Es riesgo de electrocución y de incendio, no un problema de confort. Una instalación sin diferencial no protege a nadie.",
    actuacion: [
      "sustituir el cuadro por uno con ICP, diferencial y magnetotérmicos por circuito",
      "renovar los circuitos con las secciones que exige el reglamento",
      "garantizar la toma de tierra en toda la vivienda",
      "retirar los mecanismos situados en los volúmenes de protección del baño",
      "emitir el boletín de la instalación por instalador autorizado",
    ],
    partidas: [
      "Cuadro eléctrico con ICP y diferenciales",
      "Instalación eléctrica completa de vivienda según ITC-BT",
      "Punto de luz o enchufe nuevo",
    ],
    normativa: ["rebt-circuitos-vivienda", "rebt-bano-volumenes"],
    derivar:
      "La instalación la firma un instalador autorizado y se entrega con boletín. Sin ese documento no hay alta ni cobertura del seguro.",
  },
  {
    id: "carpinteria-deteriorada",
    etiqueta: "Carpintería exterior deteriorada o sin estanquidad",
    familia: "Carpintería",
    senales: [
      "condensación permanente entre los vidrios de la unidad (vaho que no se limpia)",
      "marco de madera con la pintura levantada y la madera abierta",
      "juntas de goma endurecidas, agrietadas o que faltan",
      "hoja que no cierra a tope o que deja pasar aire",
      "agua acumulada en el marco tras la lluvia",
    ],
    confundibleCon: [
      {
        id: "humedad-condensacion",
        comoDistinguir:
          "El vaho ENTRE los vidrios significa que la cámara ha perdido estanquidad y la ventana está agotada; el vaho SOBRE el vidrio por dentro es condensación ambiental y se corrige ventilando.",
      },
      {
        id: "humedad-filtracion-fachada",
        comoDistinguir: "Si el agua entra por el perímetro del marco, el problema es el sellado; si entra por la hoja, es la carpintería.",
      },
    ],
    causas: [
      "sellado perimetral agotado",
      "vidrio con la cámara perdida",
      "herrajes descolgados o desajustados",
      "ausencia de rotura de puente térmico en carpintería antigua de aluminio",
    ],
    comprobaciones: [
      "prueba de estanquidad al aire con la mano o con una llama en el perímetro",
      "comprobar si el vaho está dentro de la cámara (irreversible) o en la cara interior (ambiental)",
      "revisar el desagüe del marco, que suele estar tapado por pintura",
    ],
    urgencia: "baja",
    porQueUrgencia:
      "No es un riesgo, pero mientras siga, la vivienda pierde energía y aparecen condensaciones en el entorno del hueco.",
    actuacion: [
      "rehacer el sellado perimetral con masilla elástica",
      "sustituir gomas y ajustar herrajes cuando el perfil esté bien",
      "sustituir la carpintería si el perfil no tiene rotura de puente térmico o el vidrio ha perdido la cámara",
    ],
    partidas: ["Ventana de aluminio o PVC con RPT y vidrio 4/16/6 bajo emisivo", "Persiana de aluminio con aislamiento"],
    normativa: ["he-transmitancia"],
  },
];

export const IDS_PATOLOGIA = PATOLOGIAS.map((p) => p.id);

export function patologiaPorId(id: string): Patologia | undefined {
  return PATOLOGIAS.find((p) => p.id === id);
}

/** Orden de gravedad, para ordenar resultados y decidir el aviso de urgencia. */
export const ORDEN_URGENCIA: Record<Urgencia, number> = {
  baja: 0,
  media: 1,
  alta: 2,
  "muy alta": 3,
};

/**
 * Las señales, tal como se le pasan al modelo.
 *
 * Se le da SOLO el id, la etiqueta y lo que se ve, nunca las causas ni la
 * reparación: si le enseñas el diagnóstico completo tiende a razonar hacia atrás
 * desde la conclusión que le parece más interesante, en vez de mirar la foto.
 */
export function catalogoParaElModelo(): string {
  return PATOLOGIAS.map((p) => `- ${p.id} (${p.etiqueta}): ${p.senales.join("; ")}`).join("\n");
}

/** Normativa relacionada con una patología, ya resuelta desde los ids. */
export function normativaDe(p: Patologia): EntradaNormativa[] {
  return (p.normativa || [])
    .map((id) => NORMATIVA.find((n) => n.id === id))
    .filter((n): n is EntradaNormativa => !!n);
}

/**
 * Partidas orientativas de la reparación, con el precio del baremo.
 *
 * Va sin cantidades a propósito: la medición sale de la visita, no de la foto.
 * Poner una cantidad estimada aquí sería justo el error que la aplicación lleva
 * meses evitando en los presupuestos.
 */
export function partidasDe(p: Patologia) {
  return p.partidas
    .map((concepto) => BAREMO.find((b) => b.concepto === concepto))
    .filter((b): b is (typeof BAREMO)[number] => !!b)
    .map((b) => ({ concepto: b.concepto, unidad: b.unidad, precio: b.conMaterial }));
}
