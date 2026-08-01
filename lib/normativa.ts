/**
 * Valores de normativa española que el copiloto puede citar.
 *
 * ESTA ES LA PIEZA CRÍTICA DEL COPILOTO, y el motivo de que exista como fichero
 * y no como conocimiento del modelo: una IA responde "el CTE exige 8 cm" con el
 * mismo aplomo tanto si es verdad como si se lo acaba de inventar, y un
 * constructor que ejecuta con un dato falso y no pasa la inspección se vuelve
 * contra quien se lo dio. El copiloto responde ÚNICAMENTE desde esta lista; lo
 * que no esté aquí, se dice que no se tiene.
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
 */

export type EntradaNormativa = {
  id: string;
  /** Palabras por las que se encuentra la entrada al buscar. */
  claves: string[];
  tema: string;
  /** El dato, redactado para leerse tal cual. */
  respuesta: string;
  /** De dónde sale, con el documento y el apartado concretos. */
  fuente: string;
  /** Matices que evitan aplicarlo mal. */
  matiz?: string;
  /** Fecha en que un técnico lo contrastó con el texto oficial. Vacío = pendiente. */
  revisado?: string;
};

export const NORMATIVA: EntradaNormativa[] = [
  // ---- Salubridad: evacuación de aguas (DB-HS 5) ----
  {
    id: "hs5-pendiente-derivaciones",
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
    claves: ["diametro", "desague", "inodoro", "lavabo", "ducha", "banera", "fregadero", "bidet", "lavadora"],
    tema: "Diámetro mínimo del sifón y la derivación por aparato",
    respuesta:
      "Lavabo 32 mm · bidé 32 mm · ducha 40 mm · bañera 40 mm · fregadero 40 mm · lavadora 40 mm · lavavajillas 40 mm · inodoro 100 mm · sumidero sifónico 40 mm.",
    fuente: "CTE DB-HS 5, tabla 4.1 (Diámetros mínimos de sifones y derivaciones individuales)",
  },

  // ---- Salubridad: suministro de agua (DB-HS 4) ----
  {
    id: "hs4-caudales",
    claves: ["caudal", "agua", "fontaneria", "instantaneo", "lavabo", "ducha", "fregadero", "inodoro"],
    tema: "Caudal instantáneo mínimo por aparato (agua fría)",
    respuesta:
      "Lavabo 0,10 l/s · ducha 0,20 l/s · bañera de 1,40 m o más 0,30 l/s · bidé 0,10 l/s · inodoro con cisterna 0,10 l/s · fregadero doméstico 0,20 l/s · lavavajillas doméstico 0,15 l/s · lavadora doméstica 0,20 l/s.",
    fuente: "CTE DB-HS 4, tabla 2.1 (Caudal instantáneo mínimo para cada tipo de aparato)",
    matiz: "Para agua caliente, los caudales de la misma tabla son en general la mitad o algo menos.",
  },
  {
    id: "hs4-presion",
    claves: ["presion", "agua", "grifo", "fluxor", "fontaneria"],
    tema: "Presión mínima y máxima en los puntos de consumo",
    respuesta:
      "Mínimo 100 kPa (1 bar) en grifos comunes y 150 kPa (1,5 bar) en fluxores y calentadores. La presión máxima en cualquier punto no debe superar 500 kPa (5 bar).",
    fuente: "CTE DB-HS 4, apartado 2.1.3 (Condiciones mínimas de suministro)",
  },
  {
    id: "hs4-velocidad",
    claves: ["velocidad", "tuberia", "agua", "fontaneria", "ruido"],
    tema: "Velocidad de cálculo en las tuberías de agua",
    respuesta:
      "Entre 0,50 y 2,00 m/s en tuberías metálicas, y entre 0,50 y 3,50 m/s en tuberías termoplásticas y multicapa.",
    fuente: "CTE DB-HS 4, apartado 4.2.1 (Dimensionado de los tramos)",
    matiz: "Por encima de esos valores la instalación empieza a sonar, aunque el diámetro dé de sobra.",
  },

  // ---- Salubridad: ventilación (DB-HS 3) ----
  {
    id: "hs3-caudales",
    claves: ["ventilacion", "caudal", "aire", "dormitorio", "salon", "cocina", "bano", "aseo", "hs3"],
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
    claves: ["escalera", "huella", "contrahuella", "peldano", "tabica"],
    tema: "Huella y contrahuella en escaleras de uso general",
    respuesta:
      "En vivienda: contrahuella entre 13 y 20 cm, y huella de 22 cm como mínimo. Debe cumplirse además 54 cm ≤ 2·contrahuella + huella ≤ 70 cm. En zonas de uso público la contrahuella máxima baja a 17,5 cm y la huella mínima sube a 28 cm.",
    fuente: "CTE DB-SUA 1, apartado 4.2 (Escaleras de uso general)",
    matiz: "Dentro de un mismo tramo, todos los peldaños deben tener la misma huella y la misma contrahuella.",
  },
  {
    id: "sua1-barandilla",
    claves: ["barandilla", "altura", "proteccion", "caida", "antepecho", "baranda"],
    tema: "Altura de las barreras de protección",
    respuesta:
      "90 cm cuando la diferencia de cota que protegen no supera los 6 m, y 110 cm en el resto de los casos. Se mide desde el nivel del suelo o desde la línea de inclinación de la escalera.",
    fuente: "CTE DB-SUA 1, apartado 3.2 (Barreras de protección)",
    matiz:
      "Además no deben poder ser escaladas: entre 30 y 50 cm de altura no puede haber salientes horizontales, y los huecos no dejarán pasar una esfera de 10 cm.",
  },
  {
    id: "sua9-puertas",
    claves: ["accesibilidad", "puerta", "ancho", "pasillo", "silla de ruedas", "itinerario"],
    tema: "Anchos mínimos en itinerario accesible",
    respuesta:
      "Puertas de 0,80 m de anchura libre de paso como mínimo, y pasillos de 1,10 m. En el giro frente a una puerta debe poder inscribirse un círculo de 1,20 m de diámetro libre de obstáculos.",
    fuente: "CTE DB-SUA 9 y Anejo A (Condiciones de accesibilidad)",
  },

  // ---- Instalación eléctrica (REBT) ----
  {
    id: "rebt-circuitos-vivienda",
    claves: ["electricidad", "circuito", "seccion", "cable", "enchufe", "rebt", "magnetotermico"],
    tema: "Circuitos y secciones en vivienda con electrificación básica",
    respuesta:
      "C1 iluminación 1,5 mm² con protección de 10 A · C2 tomas de uso general 2,5 mm² con 16 A · C3 cocina y horno 6 mm² con 25 A · C4 lavadora, lavavajillas y termo 4 mm² con 20 A · C5 tomas de baños y auxiliares de cocina 2,5 mm² con 16 A.",
    fuente: "REBT ITC-BT-25, tabla 1 (Circuitos independientes en viviendas)",
    matiz:
      "Son secciones mínimas para tiradas normales de vivienda: en recorridos largos hay que comprobar la caída de tensión, que puede obligar a subir de sección.",
  },
  {
    id: "rebt-bano-volumenes",
    claves: ["bano", "volumen", "electricidad", "ducha", "banera", "enchufe", "seguridad"],
    tema: "Volúmenes de protección en cuartos de baño",
    respuesta:
      "Volumen 0: el interior de la bañera o el plato de ducha. Volumen 1: hasta 2,25 m de altura sobre el fondo. Volumen 2: los 0,60 m que rodean al volumen 1. En los volúmenes 0 y 1 no se admiten cajas de conexión ni tomas de corriente, salvo alimentación por muy baja tensión de seguridad.",
    fuente: "REBT ITC-BT-27 (Instalaciones en cuartos de baño y aseos)",
  },

  // ---- Ahorro de energía (DB-HE) ----
  {
    id: "he-transmitancia",
    claves: ["aislamiento", "transmitancia", "espesor", "he1", "termico", "fachada", "cubierta"],
    tema: "Transmitancia térmica límite de la envolvente",
    respuesta:
      "El DB-HE 1 no fija un espesor de aislante: fija la transmitancia (U, en W/m²K) que no se puede superar, y varía según la zona climática del municipio y el elemento (fachada, cubierta, suelo, hueco). El espesor sale de calcular con la conductividad del material que se vaya a poner.",
    fuente: "CTE DB-HE 1, tabla 3.1.1.a (Valores límite de transmitancia térmica)",
    matiz:
      "Por eso no existe una respuesta del tipo «pon 8 cm»: con lana mineral y con XPS, para la misma U, salen espesores distintos. Hace falta la zona climática y el material.",
  },
  {
    id: "he4-acs-renovable",
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
    claves: ["junta", "dilatacion", "solado", "baldosa", "pavimento", "ceramico"],
    tema: "Juntas en solados cerámicos",
    respuesta:
      "Junta perimetral de al menos 5 mm contra todos los paramentos, y juntas de partición cada 50-70 m² en interior (o cada 8 m de lado). En exterior, cada 20-25 m² por la mayor variación térmica.",
    fuente: "Guía de la Norma UNE 138002 (Colocación de baldosas cerámicas)",
    matiz:
      "La junta perimetral es la que más se olvida y la que provoca que el solado se abombe: el pavimento tiene que poder moverse.",
  },
];

/** Aviso que acompaña a toda respuesta normativa. */
export const AVISO_NORMATIVA =
  "Dato de referencia. Contrástalo con el texto oficial vigente antes de ejecutar o de firmar: la normativa se modifica y hay condiciones particulares por municipio y comunidad autónoma.";

/** Quita tildes y mayúsculas para poder comparar. */
function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

/**
 * Busca las entradas que responden a la pregunta.
 *
 * Puntúa por número de claves presentes y devuelve las mejores. No devuelve nada
 * cuando no hay coincidencia real: es justo el caso en que el copiloto tiene que
 * decir que no lo sabe, en vez de improvisar.
 */
export function buscarNormativa(pregunta: string, maximo = 3): EntradaNormativa[] {
  const texto = normalizar(pregunta);
  const puntuadas = NORMATIVA.map((e) => {
    const aciertos = e.claves.filter((c) => texto.includes(normalizar(c))).length;
    return { e, aciertos };
  })
    .filter((x) => x.aciertos > 0)
    .sort((a, b) => b.aciertos - a.aciertos);

  // Con una sola clave suelta ("agua", "puerta") la coincidencia suele ser casual.
  // Se exige o dos claves, o que la única que casa sea muy específica.
  const buenas = puntuadas.filter(
    (x) => x.aciertos >= 2 || (x.aciertos === 1 && x.e.claves.length <= 6)
  );
  return buenas.slice(0, maximo).map((x) => x.e);
}
