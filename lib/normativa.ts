/**
 * Datos que el copiloto puede citar: normativa española y práctica del oficio.
 *
 * ESTA ES LA PIEZA CRÍTICA DEL COPILOTO, y el motivo de que exista como fichero
 * y no como conocimiento del modelo: una IA responde "el CTE exige 8 cm" con el
 * mismo aplomo tanto si es verdad como si se lo acaba de inventar, y un
 * constructor que ejecuta con un dato falso y no pasa la inspección se vuelve
 * contra quien se lo dio. El copiloto responde ÚNICAMENTE desde esta lista; lo
 * que no esté aquí, se dice que no se tiene.
 *
 * POR QUÉ HAY DOS TIPOS DE DATO
 * -----------------------------
 * La primera versión solo admitía normativa de obligado cumplimiento, y eso
 * dejaba mudo al copiloto ante las preguntas que más se hacen a pie de obra:
 * "¿a qué altura va la grifería del lavabo?", "¿cuánto tarda en fraguar el
 * cemento cola rápido?". No están en el CTE porque NO SON NORMATIVA — son
 * práctica del oficio y ficha técnica del fabricante. Contestar "no lo tengo"
 * a todas ellas era técnicamente honesto e inútil en la práctica.
 *
 * Así que hay dos tipos, y no se mezclan nunca:
 *   - `normativa`: obligado cumplimiento, con documento y apartado concretos.
 *   - `practica`:  valor estándar del oficio o rango habitual de fabricante.
 *                  NO es exigible, y se presenta siempre diciéndolo.
 *
 * La diferencia se mantiene de punta a punta: el prompt las recibe en bloques
 * separados, la respuesta lleva un aviso distinto según el caso, y la pantalla
 * las pinta distinto. Un dato de práctica no puede acabar presentado como si
 * fuera una exigencia legal — eso sería peor que no darlo.
 *
 * ADVERTENCIA IMPORTANTE PARA QUIEN MANTENGA ESTO
 * -----------------------------------------------
 * Estos valores están transcritos de la normativa vigente al redactarlos, pero
 * NO han sido validados uno a uno contra el BOE por un técnico. Antes de vender
 * el copiloto como fuente fiable hay que:
 *   1. Contrastar cada entrada con el texto oficial y anotar la fecha en `revisado`.
 *   2. Repasarlos cuando se publique una modificación del CTE o del REBT.
 * Mientras `revisado` esté vacío, la respuesta sale marcada como pendiente de
 * verificar. Es preferible admitirlo que aparentar una certeza que no se tiene.
 *
 * Los de tipo `practica` no se pueden "verificar contra el BOE" por definición:
 * son rangos habituales. Su verificación es otra — que un técnico confirme que
 * el rango es el que de verdad se usa — y por eso llevan su propio aviso.
 */

export type TipoDato = "normativa" | "practica";

export type EntradaNormativa = {
  id: string;
  /** Palabras por las que se encuentra la entrada al buscar. */
  claves: string[];
  tema: string;
  /**
   * De obligado cumplimiento (`normativa`) o costumbre del oficio (`practica`).
   * No es una etiqueta decorativa: decide el aviso y cómo se presenta.
   */
  tipo: TipoDato;
  /** El dato, redactado para leerse tal cual. */
  respuesta: string;
  /**
   * De dónde sale. En `normativa`, el documento y el apartado concretos. En
   * `practica`, de dónde viene la costumbre (fabricantes, guías de colocación).
   */
  fuente: string;
  /** Matices que evitan aplicarlo mal. */
  matiz?: string;
  /** Fecha en que un técnico lo contrastó con el texto oficial. Vacío = pendiente. */
  revisado?: string;
};

export const NORMATIVA: EntradaNormativa[] = [
  // ═══════════════════════════════════════════════════════════════════════
  //  NORMATIVA — obligado cumplimiento
  // ═══════════════════════════════════════════════════════════════════════

  // ---- Salubridad: evacuación de aguas (DB-HS 5) ----
  {
    id: "hs5-pendiente-derivaciones",
    tipo: "normativa",
    claves: ["pendiente", "derivacion", "desague", "saneamiento", "bajante", "tuberia", "inodoro", "lavabo"],
    tema: "Pendiente de las derivaciones individuales de saneamiento",
    respuesta:
      "Entre el 2% y el 4% para derivaciones individuales con sifón individual. Con bote sifónico, entre el 2% y el 4% también, pero la distancia del bote al bajante no debe pasar de 2,00 m.",
    fuente: "CTE DB-HS 5, apartado 4.4 (Dimensionado de la red de evacuación de aguas residuales)",
    matiz:
      "Menos del 2% no arrastra; más del 4% hace que el agua corra por delante del sólido y la derivación se atasque igual.",
  },
  {
    id: "hs5-diametro-aparatos",
    tipo: "normativa",
    claves: ["diametro", "desague", "inodoro", "lavabo", "ducha", "banera", "fregadero", "bidet", "lavadora"],
    tema: "Diámetro mínimo del sifón y la derivación por aparato",
    respuesta:
      "Lavabo 32 mm · bidé 32 mm · ducha 40 mm · bañera 40 mm · fregadero 40 mm · lavadora 40 mm · lavavajillas 40 mm · inodoro 100 mm · sumidero sifónico 40 mm.",
    fuente: "CTE DB-HS 5, tabla 4.1 (Diámetros mínimos de sifones y derivaciones individuales)",
  },

  // ---- Salubridad: suministro de agua (DB-HS 4) ----
  {
    id: "hs4-caudales",
    tipo: "normativa",
    claves: ["caudal", "agua", "fontaneria", "instantaneo", "lavabo", "ducha", "fregadero", "inodoro"],
    tema: "Caudal instantáneo mínimo por aparato (agua fría)",
    respuesta:
      "Lavabo 0,10 l/s · ducha 0,20 l/s · bañera de 1,40 m o más 0,30 l/s · bidé 0,10 l/s · inodoro con cisterna 0,10 l/s · fregadero doméstico 0,20 l/s · lavavajillas doméstico 0,15 l/s · lavadora doméstica 0,20 l/s.",
    fuente: "CTE DB-HS 4, tabla 2.1 (Caudal instantáneo mínimo para cada tipo de aparato)",
    matiz: "Para agua caliente, los caudales de la misma tabla son en general la mitad o algo menos.",
  },
  {
    id: "hs4-presion",
    tipo: "normativa",
    claves: ["presion", "agua", "grifo", "griferia", "fluxor", "fontaneria", "bar"],
    tema: "Presión mínima y máxima en los puntos de consumo",
    respuesta:
      "Mínimo 100 kPa (1 bar) en grifos comunes y 150 kPa (1,5 bar) en fluxores y calentadores. La presión máxima en cualquier punto no debe superar 500 kPa (5 bar).",
    fuente: "CTE DB-HS 4, apartado 2.1.3 (Condiciones mínimas de suministro)",
  },
  {
    id: "hs4-velocidad",
    tipo: "normativa",
    claves: ["velocidad", "tuberia", "agua", "fontaneria", "ruido"],
    tema: "Velocidad de cálculo en las tuberías de agua",
    respuesta:
      "Entre 0,50 y 2,00 m/s en tuberías metálicas, y entre 0,50 y 3,50 m/s en tuberías termoplásticas y multicapa.",
    fuente: "CTE DB-HS 4, apartado 4.2.1 (Dimensionado de los tramos)",
    matiz: "Por encima de esos valores la instalación empieza a sonar, aunque el diámetro dé de sobra.",
  },
  {
    id: "hs4-llaves-corte",
    tipo: "normativa",
    claves: ["llave de corte", "llave de cierre", "llave", "corte", "cierre", "cuarto humedo", "bano", "registro"],
    tema: "Llaves de corte obligatorias en la instalación de agua",
    respuesta:
      "La instalación debe llevar llave de corte general del edificio, llave de corte de cada vivienda, y una llave de corte en la entrada de CADA cuarto húmedo (baño, aseo, cocina, lavadero). Todas deben quedar accesibles para poder maniobrarlas.",
    fuente: "CTE DB-HS 4, apartado 3.2 (Elementos que componen la instalación)",
    matiz:
      "Lo que la norma exige es que existan y que se pueda llegar a ellas. La ALTURA concreta a la que se colocan no está normalizada: eso es criterio de proyecto y práctica del instalador.",
  },

  // ---- Salubridad: ventilación (DB-HS 3) ----
  {
    id: "hs3-caudales",
    tipo: "normativa",
    claves: ["ventilacion", "caudal", "aire", "dormitorio", "salon", "cocina", "bano", "aseo", "hs3", "extractor"],
    tema: "Caudal mínimo de ventilación en vivienda",
    respuesta:
      "Dormitorios 8 l/s por ocupante · salón y comedor 3 l/s por ocupante · baños y aseos 15 l/s por local · cocinas 2 l/s por m² útil, más un extractor con caudal mínimo de 50 l/s para los humos de la cocción.",
    fuente: "CTE DB-HS 3, tabla 2.1 (Caudales mínimos para ventilación de caudal constante)",
    matiz:
      "La ventilación de la cocina para humos es adicional a la general: no se sustituye una por otra.",
  },

  // ---- Seguridad de utilización (DB-SUA) ----
  {
    id: "sua1-escaleras",
    tipo: "normativa",
    claves: ["escalera", "huella", "contrahuella", "peldano", "tabica"],
    tema: "Huella y contrahuella en escaleras de uso general",
    respuesta:
      "En vivienda: contrahuella entre 13 y 20 cm, y huella de 22 cm como mínimo. Debe cumplirse además 54 cm ≤ 2·contrahuella + huella ≤ 70 cm. En zonas de uso público la contrahuella máxima baja a 17,5 cm y la huella mínima sube a 28 cm.",
    fuente: "CTE DB-SUA 1, apartado 4.2 (Escaleras de uso general)",
    matiz: "Dentro de un mismo tramo, todos los peldaños deben tener la misma huella y la misma contrahuella.",
  },
  {
    id: "sua1-barandilla",
    tipo: "normativa",
    claves: [
      "barandilla", "baranda", "altura", "proteccion", "caida", "antepecho",
      "pasamanos", "ventana", "hueco", "balcon", "terraza", "desnivel",
    ],
    tema: "Altura de las barreras de protección",
    respuesta:
      "90 cm cuando la diferencia de cota que protegen no supera los 6 m, y 110 cm en el resto de los casos. Se mide desde el nivel del suelo o desde la línea de inclinación de la escalera. Hay que proteger todo desnivel de más de 55 cm, y por eso una ventana cuyo antepecho quede por debajo de esa altura necesita protección.",
    fuente: "CTE DB-SUA 1, apartado 3.2 (Barreras de protección)",
    matiz:
      "Además no deben poder ser escaladas: entre 30 y 50 cm de altura no puede haber salientes horizontales, y los huecos no dejarán pasar una esfera de 10 cm. Ese detalle es el que suele suspender una barandilla de barrotes horizontales por muy bien rematada que esté.",
  },
  {
    id: "sua9-puertas",
    tipo: "normativa",
    claves: ["accesibilidad", "accesible", "puerta", "ancho", "pasillo", "silla de ruedas", "itinerario"],
    tema: "Anchos mínimos en itinerario accesible",
    respuesta:
      "Puertas de 0,80 m de anchura libre de paso como mínimo, y pasillos de 1,10 m. En el giro frente a una puerta debe poder inscribirse un círculo de 1,20 m de diámetro libre de obstáculos.",
    fuente: "CTE DB-SUA 9 y Anejo A (Condiciones de accesibilidad)",
  },
  {
    id: "sua9-mecanismos-accesibles",
    tipo: "normativa",
    claves: ["mecanismo", "accesible", "accesibilidad", "interruptor", "enchufe", "altura", "alcance"],
    tema: "Altura de los mecanismos en vivienda accesible",
    respuesta:
      "En vivienda accesible y en itinerarios accesibles, los mecanismos (interruptores, enchufes, pulsadores, telefonillo) deben quedar entre 80 cm y 120 cm de altura, y separados al menos 35 cm de los rincones.",
    fuente: "CTE DB-SUA 9, Anejo A (Condiciones de accesibilidad) y normativa autonómica de accesibilidad",
    matiz:
      "Solo es exigible en viviendas accesibles y zonas de uso público. En una vivienda corriente la altura de los mecanismos NO está normalizada y se resuelve por práctica del oficio.",
  },

  // ---- Instalación eléctrica (REBT) ----
  {
    id: "rebt-circuitos-vivienda",
    tipo: "normativa",
    claves: ["electricidad", "circuito", "seccion", "cable", "enchufe", "rebt", "magnetotermico", "electrificacion"],
    tema: "Circuitos y secciones en vivienda con electrificación básica",
    respuesta:
      "C1 iluminación 1,5 mm² con protección de 10 A · C2 tomas de uso general 2,5 mm² con 16 A · C3 cocina y horno 6 mm² con 25 A · C4 lavadora, lavavajillas y termo 4 mm² con 20 A · C5 tomas de baños y auxiliares de cocina 2,5 mm² con 16 A.",
    fuente: "REBT ITC-BT-25, tabla 1 (Circuitos independientes en viviendas)",
    matiz:
      "Son secciones mínimas para tiradas normales de vivienda: en recorridos largos hay que comprobar la caída de tensión, que puede obligar a subir de sección.",
  },
  {
    id: "rebt-colores-conductores",
    tipo: "normativa",
    claves: [
      "color", "cableado", "cable", "conductor", "hilo", "fase", "neutro",
      "tierra", "proteccion", "marron", "azul", "identificacion",
    ],
    tema: "Colores de identificación de los conductores",
    respuesta:
      "Neutro: azul claro. Conductor de protección (tierra): bicolor amarillo-verde, que no se puede usar para ninguna otra función. Fases: marrón, negro y gris. En monofásico de vivienda lo habitual es fase marrón, neutro azul y tierra amarillo-verde.",
    fuente:
      "REBT ITC-BT-19 (Instalaciones interiores o receptoras. Prescripciones generales), identificación de conductores, en concordancia con la norma UNE-EN 60445",
    matiz:
      "El amarillo-verde está reservado en exclusiva a la protección: usarlo de fase o de neutro es una de las cosas que un inspector no deja pasar. En instalaciones viejas te encontrarás el neutro en gris o negro, y eso hay que corregirlo al renovar.",
  },
  {
    id: "rebt-protecciones-cuadro",
    tipo: "normativa",
    claves: [
      "fusible", "proteccion", "cuadro", "diferencial", "magnetotermico", "pia",
      "iga", "icp", "automatico", "tipo", "electricidad", "cgp",
    ],
    tema: "Qué protecciones lleva el cuadro de una vivienda",
    respuesta:
      "En vivienda NO se usan fusibles en el cuadro: se usan interruptores automáticos. El cuadro lleva el IGA (interruptor general automático, normalmente de 25 A o 40 A según electrificación), un interruptor diferencial de 30 mA de sensibilidad, y un pequeño interruptor automático (PIA o magnetotérmico) por cada circuito. El ICP de control de potencia va hoy en el contador.",
    fuente:
      "REBT ITC-BT-17 (Dispositivos generales e individuales de mando y protección) e ITC-BT-25 (Instalaciones interiores en viviendas)",
    matiz:
      "Los fusibles sí existen, pero aguas arriba: en la Caja General de Protección del edificio y en la centralización de contadores, donde son de cuchilla tipo gG. Si te encuentras fusibles dentro del cuadro de una vivienda, es una instalación antigua que toca renovar.",
  },
  {
    id: "rebt-cuadro-altura",
    tipo: "normativa",
    claves: [
      "cuadro", "altura", "icp", "diferencial", "magnetotermico", "proteccion",
      "mando", "electricidad", "general",
    ],
    tema: "Altura del cuadro general de mando y protección",
    respuesta:
      "Los dispositivos generales de mando y protección se sitúan entre 1,40 m y 2,00 m del suelo en viviendas. En locales comerciales e industriales la altura mínima sube a 1,00 m.",
    fuente: "REBT ITC-BT-17 (Dispositivos generales e individuales de mando y protección)",
  },
  {
    id: "rebt-bano-volumenes",
    tipo: "normativa",
    claves: ["bano", "volumen", "electricidad", "ducha", "banera", "enchufe", "seguridad", "rebt"],
    tema: "Volúmenes de protección en cuartos de baño",
    respuesta:
      "Volumen 0: el interior de la bañera o el plato de ducha. Volumen 1: hasta 2,25 m de altura sobre el fondo. Volumen 2: los 0,60 m que rodean al volumen 1. En los volúmenes 0 y 1 no se admiten cajas de conexión ni tomas de corriente, salvo alimentación por muy baja tensión de seguridad.",
    fuente: "REBT ITC-BT-27 (Instalaciones en cuartos de baño y aseos)",
  },

  // ---- Ahorro de energía (DB-HE) ----
  {
    id: "he-transmitancia",
    tipo: "normativa",
    // Ojo al ampliar esta lista: "distancia" y "minima" estuvieron aquí un rato
    // y hacían que "¿qué distancia mínima hay entre pilares?" cayera en la
    // transmitancia térmica. Las claves genéricas arrastran preguntas de otro
    // oficio; van claves del CERRAMIENTO, que es de lo que trata la entrada.
    claves: [
      "aislamiento", "transmitancia", "espesor", "he1", "termico", "fachada",
      "cubierta", "muro", "camara", "cerramiento", "hoja", "exterior", "interior",
    ],
    tema: "Transmitancia térmica límite de la envolvente",
    respuesta:
      "El DB-HE 1 no fija un espesor de aislante: fija la transmitancia (U, en W/m²K) que no se puede superar, y varía según la zona climática del municipio y el elemento (fachada, cubierta, suelo, hueco). El espesor sale de calcular con la conductividad del material que se vaya a poner.",
    fuente: "CTE DB-HE 1, tabla 3.1.1.a (Valores límite de transmitancia térmica)",
    matiz:
      "Por eso no existe una respuesta del tipo «pon 8 cm»: con lana mineral y con XPS, para la misma U, salen espesores distintos. Hace falta la zona climática y el material.",
  },
  {
    id: "he4-acs-renovable",
    tipo: "normativa",
    claves: ["acs", "agua caliente", "renovable", "solar", "aerotermia", "he4", "licencia"],
    tema: "Aporte renovable obligatorio para el agua caliente sanitaria",
    respuesta:
      "En obra nueva y en rehabilitación integral, la demanda de agua caliente sanitaria debe cubrirse en parte con energía renovable (solar térmica, aerotermia, biomasa o similar).",
    fuente: "CTE DB-HE 4 (Contribución mínima de energía renovable para cubrir la demanda de ACS)",
    matiz:
      "Es el motivo por el que una vivienda sin sistema de ACS con aporte renovable no obtiene el certificado energético ni la licencia de primera ocupación.",
  },

  // ---- Estructuras y ejecución ----
  {
    id: "ehe-recubrimiento",
    tipo: "normativa",
    claves: ["recubrimiento", "armadura", "hormigon", "ehe", "corrosion", "acero"],
    tema: "Recubrimiento mínimo de las armaduras",
    respuesta:
      "En ambiente normal interior (clase I) el recubrimiento nominal habitual es de 25 mm; en ambiente exterior o con humedad (clase IIa) sube a 30-35 mm; en ambiente marino se va a 40 mm o más.",
    fuente: "EHE-08, artículo 37.2.4 (Recubrimientos)",
    matiz:
      "El recubrimiento insuficiente es la causa más común de la corrosión de armaduras que luego revienta el hormigón.",
  },
  {
    id: "juntas-dilatacion-solado",
    tipo: "normativa",
    claves: ["junta", "dilatacion", "solado", "baldosa", "pavimento", "ceramico", "perimetral"],
    tema: "Juntas en solados cerámicos",
    respuesta:
      "Junta perimetral de al menos 5 mm contra todos los paramentos, y juntas de partición cada 50-70 m² en interior (o cada 8 m de lado). En exterior, cada 20-25 m² por la mayor variación térmica.",
    fuente: "Guía de la Norma UNE 138002 (Colocación de baldosas cerámicas)",
    matiz:
      "La junta perimetral es la que más se olvida y la que provoca que el solado se abombe: el pavimento tiene que poder moverse.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  PRÁCTICA DEL OFICIO — no exigible, pero es lo que se hace
  // ═══════════════════════════════════════════════════════════════════════

  // ---- Alturas de instalación: fontanería ----
  {
    id: "practica-alturas-fontaneria-bano",
    tipo: "practica",
    claves: [
      "altura", "alto", "toma", "griferia", "grifo", "lavabo", "bidet", "inodoro",
      "ducha", "banera", "fontaneria", "instalacion", "bano", "aseo", "replanteo",
    ],
    tema: "Alturas habituales de las tomas de agua en un baño",
    respuesta:
      "Medido desde el suelo acabado: lavabo, tomas a 55-60 cm y desagüe a 45-50 cm (con el lavabo terminado a 85-90 cm) · inodoro, toma a 15-25 cm · bidé, tomas a 20-25 cm · bañera, grifería a 60-75 cm · ducha, mezclador o termostática a 100-110 cm y rociador fijo a 200-220 cm.",
    fuente: "Práctica habitual de instalación en vivienda española y guías de montaje de fabricantes de sanitarios",
    matiz:
      "Son valores de replanteo, no exigencias. El aparato concreto manda: comprueba la ficha de montaje del sanitario y la altura del mueble antes de picar la roza.",
  },
  {
    id: "practica-alturas-fontaneria-cocina",
    tipo: "practica",
    claves: [
      "altura", "toma", "fregadero", "lavadora", "lavavajillas", "cocina",
      "lavadero", "fontaneria", "electrodomestico", "instalacion",
    ],
    tema: "Alturas habituales de las tomas de agua en cocina y lavadero",
    respuesta:
      "Desde el suelo acabado: fregadero, tomas a 50-60 cm y desagüe a 40-50 cm · lavadora y lavavajillas, toma a 80-90 cm con el desagüe a 60-80 cm, para que el latiguillo y el tubo lleguen sin forzar con el electrodoméstico dentro del hueco.",
    fuente: "Práctica habitual de instalación en vivienda española",
    matiz:
      "Las tomas se dejan fuera de la proyección del electrodoméstico siempre que se pueda: si quedan justo detrás, el aparato no entra a ras y luego no hay forma de cerrar la llave.",
  },
  {
    id: "practica-altura-llaves-corte",
    tipo: "practica",
    claves: [
      "altura", "llave de corte", "llave de cierre", "llave", "corte", "cierre",
      "registro", "bano", "cuarto humedo", "general", "toma",
    ],
    tema: "Dónde se dejan habitualmente las llaves de corte de un cuarto húmedo",
    respuesta:
      "Lo más común es agruparlas en un registro accesible a la entrada del cuarto húmedo, a 30-60 cm del suelo si van bajas, o a 180-200 cm si se ocultan sobre el falso techo o tras una tapa de registro alta. Cuando van vistas junto a cada aparato, se dejan a la altura de la propia toma del aparato.",
    fuente: "Práctica habitual de instalación en vivienda española",
    matiz:
      "La altura NO está normalizada: lo que sí exige el CTE DB-HS 4 es que cada cuarto húmedo tenga su llave de corte y que quede accesible. Una llave detrás de un alicatado sin registro incumple, esté a la altura que esté.",
  },

  // ---- Alturas de instalación: electricidad ----
  {
    id: "practica-alturas-mecanismos",
    tipo: "practica",
    claves: [
      "altura", "enchufe", "interruptor", "mecanismo", "toma de corriente",
      "electricidad", "caja", "replanteo", "encimera", "television",
    ],
    tema: "Alturas habituales de enchufes e interruptores en vivienda",
    respuesta:
      "Desde el suelo acabado: enchufes generales a 20-30 cm · interruptores a 105-110 cm · tomas sobre encimera de cocina a 100-115 cm (unos 15-25 cm por encima de la encimera) · toma de televisión a 40-50 cm, o a 120-140 cm si el televisor va colgado.",
    fuente: "Práctica habitual de instalación en vivienda española",
    matiz:
      "En vivienda corriente esto es costumbre, no norma. En vivienda accesible sí hay exigencia: los mecanismos deben quedar entre 80 y 120 cm.",
  },

  // ---- Tiempos de fraguado, secado y curado ----
  {
    id: "practica-fraguado-cemento-cola",
    tipo: "practica",
    claves: [
      "fraguado", "fraguar", "secado", "curado", "tiempo", "cemento cola", "adhesivo",
      "rapido", "tiempo abierto", "rejuntado", "transito", "alicatado", "solado", "baldosa",
    ],
    tema: "Tiempos del cemento cola: normal y de fraguado rápido",
    respuesta:
      "Adhesivo normal (C1 o C2): tiempo abierto de 20-30 min, rejuntado a las 8-12 h en pared y 24 h en suelo, tránsito peatonal a las 24 h y puesta en servicio plena a los 7-14 días. Adhesivo rápido (clase F): tiempo abierto de 10-15 min, y rejuntado y tránsito a las 3-4 h.",
    fuente:
      "Rangos habituales de fichas técnicas de adhesivos cementosos según la clasificación de la norma UNE-EN 12004 (la clase F es la de fraguado rápido)",
    matiz:
      "MANDA LA FICHA TÉCNICA DEL PRODUCTO QUE ESTÉS USANDO. Estos tiempos se alargan con frío y humedad y se acortan con calor: por debajo de 5 °C prácticamente no fragua, y al sol directo en verano el tiempo abierto se queda en la mitad.",
  },
  {
    id: "practica-fraguado-otros",
    tipo: "practica",
    claves: [
      "fraguado", "fraguar", "secado", "curado", "tiempo", "yeso", "escayola", "mortero",
      "hormigon", "autonivelante", "silicona", "sellado", "pintura", "mano", "espera",
    ],
    tema: "Tiempos de fraguado y secado de otros materiales corrientes",
    respuesta:
      "Yeso de guarnecido: fragua en 20-30 min. Mortero de cemento: fraguado inicial en torno a 1 h y resistencia de proyecto a 28 días. Hormigón: 28 días para la resistencia característica. Autonivelante: tránsito a las 24 h. Silicona: forma piel en 10-20 min y cura del todo en 24 h. Pintura plástica: 4-6 h entre manos.",
    fuente: "Rangos habituales de fichas técnicas de fabricantes españoles",
    matiz:
      "Un recrecido de mortero necesita además tiempo de SECADO antes de recibir un pavimento sensible a la humedad (madera, vinílico): la regla de oro del oficio es aproximadamente una semana por cada centímetro de espesor.",
  },

  // ---- Cocina ----
  {
    id: "practica-alturas-cocina",
    tipo: "practica",
    claves: [
      "altura", "encimera", "mueble", "alto", "cocina", "campana", "placa",
      "vitroceramica", "induccion", "gas", "amueblamiento",
    ],
    tema: "Alturas habituales del amueblamiento de cocina",
    respuesta:
      "Encimera terminada a 85-90 cm del suelo. Entre encimera y mueble alto se dejan 50-60 cm libres, con lo que la base del mueble alto queda a 140-150 cm. Campana: 65-75 cm sobre placa de gas y 55-70 cm sobre vitrocerámica o inducción.",
    fuente: "Práctica habitual de amueblamiento y manuales de instalación de campanas",
    matiz:
      "La separación de la campana la fija el fabricante y es una cuestión de seguridad con gas, no de estética: ponerla más baja de lo indicado sobre una placa de gas es riesgo de incendio.",
  },

  // ---- Carpintería ----
  {
    id: "practica-medidas-puertas",
    tipo: "practica",
    claves: [
      "puerta", "hoja", "medida", "ancho", "altura", "hueco", "paso",
      "carpinteria", "premarco", "estandar",
    ],
    tema: "Medidas estándar de puertas de paso en España",
    respuesta:
      "Hojas de serie: 62,5 · 72,5 · 82,5 cm de ancho, con 203 cm de altura. En vivienda se usa 72,5 cm para baños y dormitorios y 82,5 cm para paso principal y cocina. El hueco de obra se deja unos 8-10 cm más ancho y 5-6 cm más alto que la hoja para el cerco y el premarco.",
    fuente: "Medidas de serie habituales de la carpintería de interior española",
    matiz:
      "Si la puerta tiene que servir a un itinerario accesible, la hoja de 72,5 cm se queda corta: hacen falta 80 cm LIBRES de paso, y eso obliga a hoja de 82,5 cm o más.",
  },

  // ---- Cerramientos ----
  {
    id: "practica-fachada-doble-hoja",
    tipo: "practica",
    claves: [
      "fachada", "muro", "camara", "cerramiento", "hoja", "distancia", "separacion",
      "exterior", "interior", "aire", "tabique", "aislamiento", "espesor", "ladrillo",
    ],
    tema: "Composición habitual de una fachada de doble hoja con cámara",
    respuesta:
      "Lo corriente en vivienda española: hoja exterior de ½ pie de ladrillo perforado (11,5 cm), cámara de 3-5 cm, aislamiento de 4-8 cm y hoja interior de tabique de 7-9 cm o placa de yeso laminado sobre estructura. El cerramiento acabado suele quedar entre 25 y 30 cm. En construcción actual el aislante ocupa casi toda la cámara y quedan 1-2 cm de aire, o se rellena entera.",
    fuente: "Composición habitual de la fachada de doble hoja en vivienda española",
    matiz:
      "NO hay una distancia mínima entre hojas que fije ninguna norma. El espesor sale del CÁLCULO: la transmitancia que exige el DB-HE según zona climática y el aislamiento acústico del DB-HR. Con lana mineral y con XPS, para la misma exigencia, salen espesores distintos. Cualquiera que te dé un número de cámara «según el CTE» te lo está inventando.",
  },

  // ---- Pendientes de ejecución ----
  {
    id: "practica-pendiente-ducha-terraza",
    tipo: "practica",
    claves: [
      "pendiente", "ducha", "plato", "sumidero", "terraza", "balcon", "obra",
      "desague", "agua", "formacion",
    ],
    tema: "Pendientes de ejecución hacia el sumidero",
    respuesta:
      "Ducha de obra: entre 1,5% y 2% hacia el sumidero, que es 1,5-2 cm por cada metro. Terrazas y balcones: entre 1% y 2% hacia el desagüe. En una ducha sin plato conviene no bajar del 1,5% o el agua se queda parada.",
    fuente: "Práctica habitual de ejecución y guías de colocación cerámica",
    matiz:
      "Pasar del 2% en una ducha hace que se note el desnivel al pisar y que la mampara no cierre bien contra el suelo. Es tan problema quedarse corto como pasarse.",
  },
];

/** Aviso que acompaña a toda respuesta apoyada en normativa. */
export const AVISO_NORMATIVA =
  "Dato de referencia. Contrástalo con el texto oficial vigente antes de ejecutar o de firmar: la normativa se modifica y hay condiciones particulares por municipio y comunidad autónoma.";

/**
 * Aviso que acompaña a toda respuesta apoyada en práctica del oficio.
 *
 * Es deliberadamente más tajante que el de normativa: aquí no hay un texto
 * oficial que respalde el número, así que la responsabilidad de comprobarlo
 * recae entera en quien ejecuta, y eso hay que decirlo sin suavizarlo.
 */
export const AVISO_PRACTICA =
  "Esto NO es normativa: es la práctica habitual del oficio y puede variar. Manda siempre la ficha técnica del producto, la hoja de montaje del aparato y el proyecto. Compruébalo antes de ejecutar.";

/** Quita tildes y mayúsculas para poder comparar. */
function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿Son la misma palabra, admitiendo plural y variación de género o sufijo?
 *
 * Se compara por RAÍZ y no por subcadena, y ese detalle no es cosmético: el
 * buscador anterior hacía `pregunta.includes(clave)`, así que "fraguado"
 * contenía "agua" y la pregunta "tiempo de fraguado del cemento cola" devolvía
 * la presión del agua del DB-HS 4. La respuesta salía honesta ("no lo tengo")
 * pero con una fuente de fontanería colgando debajo, que es peor que no citar.
 */
function mismaPalabra(a: string, b: string) {
  if (a === b) return true;
  const corta = a.length <= b.length ? a : b;
  const larga = a.length <= b.length ? b : a;
  // Palabras muy cortas ("m", "de", "ud") solo valen si son idénticas: su raíz
  // coincide con demasiadas cosas.
  if (corta.length < 4) return false;
  let comun = 0;
  while (comun < corta.length && corta[comun] === larga[comun]) comun++;

  /*
   * Dos reglas, y son estrictas por un motivo concreto: con el margen anterior
   * (bastaba compartir 4 letras y diferir 3) "LAVABO" casaba con "LAVADERO" y
   * con "LAVADORA", que comparten "lava". Preguntar "altura de lavabo" traía
   * las alturas de la COCINA por delante de las del baño, y la del baño ni
   * aparecía. Tres palabras distintas de tres aparatos distintos.
   *
   *   1. Plural o variación de una letra: "bano"/"banos", "altura"/"alturas".
   *   2. Sufijo largo, pero exigiendo 5 letras de raíz: "fraguar"/"fraguado".
   *
   * Lo que se pierde con esto ("grifo" ya no alcanza a "griferia") se resuelve
   * declarando las dos variantes como claves, que es explícito y no adivina.
   */
  if (comun >= 4 && comun >= corta.length - 1) return true;
  return comun >= 5 && comun >= corta.length - 2;
}

/** ¿Aparece la clave en la pregunta? Las claves de varias palabras exigen todas. */
function claveEnPregunta(clave: string, palabras: string[]) {
  const partes = normalizar(clave).split(" ").filter(Boolean);
  return partes.every((p) => palabras.some((w) => mismaPalabra(p, w)));
}

/**
 * Palabras con las que una respuesta se está atribuyendo fuerza legal.
 *
 * No busca "normativa" a secas: una respuesta puede decir "esto no lo fija la
 * normativa" y sería correcta. Busca las construcciones con las que se AFIRMA
 * una obligación.
 */
const INVOCA_OBLIGACION =
  /\b(?:el\s+)?(?:cte|rebt|ehe|db-?h[se]|db-?sua)\b|\bnormativa\s+(?:exige|obliga|establece|fija)\b|\b(?:es|son)\s+obligatorio\b|\bexige\s+la\s+norma\b|\bpor\s+normativa\b|\bincumpl\w+\b/i;

/**
 * Remitir a una norma NO es invocarla.
 *
 * "Ese dato no lo tengo, míralo en la EHE" es la respuesta honesta que se
 * quiere, y sin esta exclusión saltaba el aviso de que la respuesta citaba
 * normativa sin respaldo — contradiciendo justo a la frase que reconocía no
 * tener el dato. Un aviso que salta donde no toca no es una precaución de más:
 * es un defecto, porque enseña a ignorar los avisos.
 */
const REMITE_A_LA_NORMA =
  // El cuantificador es VORAZ a propósito: con uno perezoso, "consulta el CTE
  // DB-HS 4" se comía solo hasta "CTE" y dejaba "DB-HS 4" suelto, que volvía a
  // disparar la detección. La remisión tiene que llevarse la referencia entera.
  /\b(?:mira|miralo|míralo|mirar|consulta|consultalo|consúltalo|consultar|revisa|revisalo|revísalo|revisar|busca|buscalo|búscalo|buscar|comprueba|compruebalo|compruébalo|comprobar|verlo|ver)\b[^.;\n]{0,60}\b(?:cte|rebt|ehe|db-?h[se]|db-?sua|normativa|norma)\b/gi;

/**
 * ¿La respuesta invoca una obligación legal sin tener ni una entrada de
 * normativa detrás?
 *
 * ES LA RED DE SEGURIDAD DE LA SEPARACIÓN ENTRE LOS DOS TIPOS DE DATO. Al
 * modelo se le indica por prompt que la práctica del oficio se presenta como
 * práctica y nunca como exigencia, pero "se le indica" no es garantía: un
 * prompt se cumple casi siempre, y "casi" no vale cuando la consecuencia es que
 * un reformista ejecute creyendo que una costumbre es de obligado cumplimiento,
 * o peor, que discuta con un técnico citando un CTE que no dice eso.
 *
 * Así que se comprueba en código, igual que `lineasSinCantidad` comprueba que
 * la IA no rellenó horas que nadie dijo.
 */
export function invocaNormativaSinRespaldo(
  respuesta: string,
  entradas: EntradaNormativa[]
): boolean {
  const hayNormativa = entradas.some((e) => e.tipo === "normativa");
  if (hayNormativa) return false;
  // Se quitan primero las remisiones ("míralo en el CTE"), que son la respuesta
  // correcta cuando no se tiene el dato, y solo después se busca la afirmación.
  const texto = (respuesta || "").replace(REMITE_A_LA_NORMA, " ");
  return INVOCA_OBLIGACION.test(texto);
}

/**
 * Busca las entradas que responden a la pregunta.
 *
 * Devuelve tanto normativa como práctica: quien llama decide cómo presentarlas,
 * pero nunca las mezcla. No devuelve nada cuando no hay coincidencia real, que
 * es justo el caso en que el copiloto tiene que decir que no lo sabe.
 *
 * Exige DOS claves distintas, o una sola si es de varias palabras ("cemento
 * cola", "llave de corte"). El criterio anterior aceptaba una clave suelta si
 * la entrada tenía pocas claves en total, y eso premiaba justo a las entradas
 * peor etiquetadas: "altura de la grifería del lavabo" devolvía la altura de
 * las BARANDILLAS, porque las tres entradas que hablan de lavabos tenían
 * demasiados sinónimos y quedaban descartadas por tenerlos.
 */
export function buscarNormativa(pregunta: string, maximo = 3): EntradaNormativa[] {
  const palabras = normalizar(pregunta).split(" ").filter(Boolean);
  if (!palabras.length) return [];

  const puntuadas = NORMATIVA.map((e) => {
    const casadas = e.claves.filter((c) => claveEnPregunta(c, palabras));
    const compuestas = casadas.filter((c) => c.includes(" ")).length;
    return { e, aciertos: casadas.length, compuestas };
  }).filter((x) => x.aciertos >= 2 || x.compuestas >= 1);

  // Una clave de varias palabras vale más que dos sueltas: "cemento cola" en la
  // pregunta identifica el tema mucho mejor que "tiempo" + "rapido".
  puntuadas.sort((a, b) => b.compuestas * 2 + b.aciertos - (a.compuestas * 2 + a.aciertos));
  return puntuadas.slice(0, maximo).map((x) => x.e);
}
