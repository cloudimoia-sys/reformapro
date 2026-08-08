/**
 * Comprobaciones del copiloto técnico: qué encuentra, qué NO encuentra, y que
 * nunca confunde una costumbre del oficio con una exigencia legal.
 *
 * La mitad de estas pruebas son negativas a propósito. Un buscador que
 * encuentra algo para todo es tan inútil como uno que no encuentra nada: el
 * valor del copiloto está en que cuando cita una fuente, esa fuente responde de
 * verdad a lo que se ha preguntado.
 */

import {
  NORMATIVA,
  buscarNormativa,
  invocaNormativaSinRespaldo,
  AVISO_NORMATIVA,
  AVISO_PRACTICA,
  type EntradaNormativa,
} from "../lib/normativa";

let fallos = 0;
let hechas = 0;

function ok(condicion: boolean, texto: string) {
  hechas++;
  if (condicion) {
    console.log(`  ok   ${texto}`);
  } else {
    fallos++;
    console.log(`  FALLA ${texto}`);
  }
}

function bloque(titulo: string) {
  console.log(`\n${titulo}`);
}

const temas = (p: string) => buscarNormativa(p).map((e) => e.tema);
const ids = (p: string) => buscarNormativa(p).map((e) => e.id);
const tipos = (p: string) => buscarNormativa(p).map((e) => e.tipo);

/* ─────────────── Las tres preguntas que se quedaron sin responder ─────────────── */

bloque("Las preguntas reales que el copiloto no sabía contestar");

const fraguado = buscarNormativa("Tiempo de fraguado de cemento cola rápido.");
ok(
  fraguado.some((e) => e.id === "practica-fraguado-cemento-cola"),
  "«tiempo de fraguado de cemento cola rápido» encuentra los tiempos del cemento cola"
);
ok(
  fraguado.every((e) => e.tipo === "practica"),
  "y lo hace como práctica del oficio, no como normativa: no existe un CTE del fraguado"
);

const griferia = buscarNormativa("Altura de la grifería del lavabo.");
ok(
  griferia.some((e) => e.id === "practica-alturas-fontaneria-bano"),
  "«altura de la grifería del lavabo» encuentra las alturas de tomas del baño"
);
ok(
  !griferia.some((e) => e.id === "sua1-barandilla"),
  "y ya NO devuelve la altura de las barandillas, que era la respuesta absurda de antes"
);

const llaves = buscarNormativa(
  "Altura de las tomas generales de las llaves de cierre de un cuarto de baño."
);
ok(
  llaves.some((e) => e.id === "practica-altura-llaves-corte"),
  "«altura de las llaves de cierre del baño» encuentra dónde se dejan habitualmente"
);
ok(
  llaves.some((e) => e.id === "hs4-llaves-corte"),
  "y además la parte que SÍ es normativa: que tienen que existir y quedar accesibles"
);

/* ─────────────── Huecos detectados usando el copiloto de verdad ─────────────── */

bloque("Preguntas corrientes que se quedaban sin respuesta");

const colores = buscarNormativa("¿De qué color va cada cable en una vivienda?");
ok(
  colores.some((e) => e.id === "rebt-colores-conductores"),
  "«de qué color va cada cable» encuentra la identificación de conductores"
);
ok(
  buscarNormativa("colores del cableado eléctrico").some(
    (e) => e.id === "rebt-colores-conductores"
  ),
  "«colores del cableado» también la encuentra"
);

/*
 * Esta pregunta es el mejor ejemplo de por qué el copiloto no puede limitarse
 * a "buscar el dato": NO EXISTE una distancia mínima entre hojas en ninguna
 * norma. Sale del cálculo térmico y acústico. La respuesta correcta no es un
 * número, es explicar que quien te dé un número «según el CTE» se lo inventa.
 */
const muro = buscarNormativa("Distancia mínima entre el muro interior y el exterior.");
ok(muro.length > 0, "«distancia mínima entre muro interior y exterior» ya no se queda muda");
ok(
  muro.some((e) => e.id === "practica-fachada-doble-hoja"),
  "y da la composición habitual de fachada de doble hoja"
);
ok(
  muro.some((e) => e.id === "he-transmitancia"),
  "junto con la entrada que explica que el espesor sale del cálculo, no de una tabla"
);

const fachada = NORMATIVA.find((e) => e.id === "practica-fachada-doble-hoja")!;
ok(
  /no hay una distancia m[ií]nima/i.test(fachada.matiz || ""),
  "la propia entrada avisa de que ninguna norma fija esa distancia"
);
ok(
  fachada.tipo === "practica",
  "y va como práctica, porque la composición es costumbre y no exigencia"
);

/*
 * Segunda tanda de huecos, salidos de enseñárselo a alguien de verdad.
 * "altura de lavabo" es el caso feo: el dato SÍ estaba cargado, pero la
 * comparación por raíz daba por buena "lavabo" ≈ "lavadero" ≈ "lavadora"
 * —comparten "lava"— y las alturas de la COCINA le ganaban a las del baño.
 */
bloque("Preguntas cortas, tal y como se escriben de verdad");

const lavabo = buscarNormativa("altura de lavabo");
ok(
  lavabo.some((e) => e.id === "practica-alturas-fontaneria-bano"),
  "«altura de lavabo», escrito corto y sin más contexto, encuentra las alturas del baño"
);
ok(
  !lavabo.some((e) => e.id === "practica-alturas-fontaneria-cocina"),
  "y NO se cuela la cocina: «lavabo» no es «lavadero» ni «lavadora»"
);
ok(
  buscarNormativa("altura del fregadero").some(
    (e) => e.id === "practica-alturas-fontaneria-cocina"
  ),
  "pero la cocina se sigue encontrando cuando se pregunta por lo suyo"
);

const fusibles = buscarNormativa("Tipos de fusible en un cuadro eléctrico.");
ok(
  fusibles.some((e) => e.id === "rebt-protecciones-cuadro"),
  "«tipos de fusible en un cuadro» encuentra las protecciones del cuadro"
);
ok(
  /no se usan fusibles/i.test(
    NORMATIVA.find((e) => e.id === "rebt-protecciones-cuadro")!.respuesta
  ),
  "y la respuesta corrige la premisa: en vivienda el cuadro no lleva fusibles"
);

ok(
  buscarNormativa("altura de barandilla en una ventana").some((e) => e.id === "sua1-barandilla"),
  "«altura de barandilla en una ventana» encuentra las barreras de protección"
);
ok(
  /55 cm/.test(NORMATIVA.find((e) => e.id === "sua1-barandilla")!.respuesta),
  "y ahora dice a partir de qué desnivel hay que proteger un hueco"
);

/* ─────────────── El fallo de subcadena que ensuciaba las respuestas ─────────────── */

bloque("Buscar por raíz de palabra, no por trozo de palabra");

ok(
  !ids("Tiempo de fraguado del cemento cola").includes("hs4-presion"),
  "«fraguado» ya no arrastra la presión del agua: contenía la subcadena «agua»"
);
ok(
  !ids("¿Cuánto tarda en fraguar?").includes("hs4-velocidad"),
  "«fraguar» tampoco arrastra la velocidad del agua en tuberías"
);
ok(
  temas("¿A qué altura va la barandilla?").includes("Altura de las barreras de protección"),
  "«barandilla» sigue encontrando su entrada: arreglar el ruido no rompió lo que iba bien"
);
ok(
  buscarNormativa("¿Qué presión de agua necesita un fluxor?").some((e) => e.id === "hs4-presion"),
  "y la presión del agua se sigue encontrando cuando de verdad se pregunta por ella"
);

/* ─────────────── Lo que no se sabe, se sigue sin saber ─────────────── */

bloque("Lo que no está cargado se sigue diciendo que no está");

ok(
  buscarNormativa("¿Qué distancia mínima hay entre pilares según la EHE?").length === 0,
  "una pregunta de estructuras que no está cargada no devuelve nada"
);
ok(
  buscarNormativa("¿Cuál es la capital de Francia?").length === 0,
  "una pregunta ajena a la obra no devuelve nada"
);
ok(
  buscarNormativa("¿Cuánto cobra un oficial de primera en Madrid?").length === 0,
  "una pregunta de convenio, que el copiloto no cubre, no devuelve nada"
);
ok(
  buscarNormativa("altura").length === 0,
  "una palabra genérica suelta no basta: antes «altura» sola ya devolvía barandillas"
);
ok(buscarNormativa("").length === 0, "una pregunta vacía no revienta ni devuelve nada");

/* ─────────────── La separación entre norma y costumbre ─────────────── */

bloque("Una costumbre del oficio no puede pasar por exigencia legal");

ok(
  NORMATIVA.every((e) => e.tipo === "normativa" || e.tipo === "practica"),
  "toda entrada declara si es normativa o práctica: no hay término medio"
);

const practicas = NORMATIVA.filter((e) => e.tipo === "practica");
const normas = NORMATIVA.filter((e) => e.tipo === "normativa");
ok(practicas.length > 0 && normas.length > 0, "hay entradas de los dos tipos cargadas");

ok(
  practicas.every((e) => !/^CTE\b|^REBT\b|^EHE/i.test(e.fuente)),
  "ninguna entrada de práctica se atribuye a sí misma el CTE, el REBT o la EHE como fuente"
);
ok(
  normas.every((e) => /CTE|REBT|EHE|UNE/i.test(e.fuente)),
  "toda entrada de normativa cita un documento oficial concreto"
);

/* La red de seguridad en código, que es lo que no depende de que el modelo obedezca. */

const soloPractica: EntradaNormativa[] = practicas.slice(0, 1);
const conNormativa: EntradaNormativa[] = normas.slice(0, 1);

ok(
  invocaNormativaSinRespaldo("Según el CTE, la grifería va a 55-60 cm.", soloPractica),
  "se detecta que una respuesta cita el CTE sin tener detrás ni un dato normativo"
);
ok(
  invocaNormativaSinRespaldo("Es obligatorio dejarlo a esa altura.", soloPractica),
  "se detecta un «es obligatorio» apoyado solo en práctica del oficio"
);
ok(
  !invocaNormativaSinRespaldo(
    "La práctica habitual es dejarlo a 55-60 cm. No es una exigencia: manda la ficha del fabricante.",
    soloPractica
  ),
  "una respuesta que dice claramente que es práctica NO se marca"
);
ok(
  !invocaNormativaSinRespaldo("Esa altura no la fija la normativa.", soloPractica),
  "negar que algo esté en la normativa no cuenta como invocarla"
);
ok(
  !invocaNormativaSinRespaldo("El CTE DB-HS 4 exige llave de corte por cuarto húmedo.", conNormativa),
  "citar el CTE teniendo detrás una entrada normativa de verdad NO se marca"
);

/*
 * El falso positivo que apareció al probarlo en vivo: el copiloto contestaba
 * "ese dato no lo tengo, míralo en la EHE" —la respuesta honesta que se
 * busca— y saltaba el aviso de que citaba normativa sin respaldo, justo encima
 * de la frase que reconocía no tenerlo. Remitir a una norma no es invocarla.
 */
ok(
  !invocaNormativaSinRespaldo(
    "Ese dato no lo tengo cargado. Míralo en el anejo correspondiente de la EHE o en el proyecto de estructura.",
    []
  ),
  "«no lo tengo, míralo en la EHE» NO se marca: remitir a una norma no es invocarla"
);
ok(
  !invocaNormativaSinRespaldo("No lo tengo. Consulta el CTE DB-HS 4 para ese caso.", []),
  "«consulta el CTE» tampoco se marca"
);
ok(
  !invocaNormativaSinRespaldo("Revísalo en la normativa autonómica que te aplique.", []),
  "«revísalo en la normativa» tampoco se marca"
);
ok(
  invocaNormativaSinRespaldo(
    "Míralo en la ficha del fabricante. De todos modos el CTE exige 55 cm para esa toma.",
    soloPractica
  ),
  "pero si además de remitir AFIRMA una exigencia inventada, se sigue marcando"
);

/* ─────────────── Los avisos ─────────────── */

bloque("Cada tipo de dato lleva su aviso");

ok(
  AVISO_NORMATIVA.length > 0 && AVISO_PRACTICA.length > 0,
  "existen los dos avisos y son distintos entre sí"
);
// El cast a string es necesario: TypeScript infiere el literal exacto de cada
// constante y da por imposible la comparación. Se quiere comprobar en ejecución,
// para que copiar el texto de un aviso en el otro haga fallar la prueba.
ok(
  (AVISO_NORMATIVA as string) !== (AVISO_PRACTICA as string),
  "no se reutiliza el mismo texto para las dos cosas"
);
ok(
  /no es normativa/i.test(AVISO_PRACTICA),
  "el aviso de práctica dice explícitamente que no es normativa"
);
ok(
  /ficha t[eé]cnica/i.test(AVISO_PRACTICA),
  "y remite a la ficha técnica, que es lo que de verdad manda en un material"
);

/* ─────────────── Coherencia de la base ─────────────── */

bloque("La base de datos está bien formada");

ok(new Set(NORMATIVA.map((e) => e.id)).size === NORMATIVA.length, "no hay ids repetidos");
ok(
  NORMATIVA.every((e) => e.claves.length > 0 && e.tema && e.respuesta && e.fuente),
  "toda entrada tiene claves, tema, respuesta y fuente"
);
ok(
  NORMATIVA.every((e) => e.claves.every((c) => c === c.toLowerCase())),
  "las claves están en minúscula, que es como se comparan"
);
ok(
  NORMATIVA.every((e) => e.claves.every((c) => !/[áéíóúñ]/.test(c))),
  "las claves van sin tildes ni eñes: la pregunta se normaliza antes de comparar"
);

const mezclaTipos = buscarNormativa(
  "Altura de las tomas generales de las llaves de cierre de un cuarto de baño."
);
ok(
  new Set(mezclaTipos.map((e) => e.tipo)).size === 2,
  "una pregunta puede devolver normativa y práctica a la vez, y las dos viajan etiquetadas"
);

/* ─────────────── Resultado ─────────────── */

console.log(
  fallos === 0
    ? `\nCOPILOTO CORRECTO — ${hechas} comprobaciones: encuentra lo que tiene, calla lo que no, y no confunde costumbre con norma`
    : `\n${fallos} de ${hechas} comprobaciones han fallado`
);
process.exit(fallos === 0 ? 0 : 1);
