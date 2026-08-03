/**
 * Comprueba lo que SOBRA en un presupuesto, no solo lo que falta.
 *
 * CASO REAL QUE LO PROVOCA. Se pidió: solar el suelo de un baño, poner paneles
 * decorativos en toda la pared y cambiar inodoro, lavabo y plato de ducha con la
 * mampara. Nada más. El presupuesto llegó con:
 *
 *   - Un alicatado de paredes de 508 € que nadie había pedido, y encima sobre la
 *     misma pared que ya iba panelada.
 *   - Una renovación de la red de fontanería de 480 €, cuando cambiar los
 *     aparatos es sustituir la pieza sobre la toma que ya está.
 *   - El panel medido a 10 m² con 7,1 m² de suelo: menos de la mitad de la pared.
 *   - El panel a 45 €/m², por encima del alicatado, cuando va PEGADO y lleva
 *     mucha menos mano de obra.
 *   - El inodoro sin descripción.
 *
 * Casi mil euros de más sobre un total de 3.500, y un acabado corto. Un
 * presupuesto que trae de más se descubre delante del cliente, y ahí ya no hay
 * forma de defenderlo.
 *
 * Ejecutar con: npx tsx scripts/verificar-sobrantes.ts
 */
import { BAREMO } from "../lib/baremo";
import {
  acabadoDeParedNoPedido,
  acabadosIncompatibles,
  descripcionesVacias,
  paredesCortas,
  trabajosNoPedidos,
} from "../lib/revision";

let fallos = 0;
const mal = (que: string, detalle: string) => {
  fallos++;
  console.log(`  MAL  ${que}: ${detalle}`);
};
const bien = (que: string) => console.log(`  ok   ${que}`);

/** Lo que el usuario pidió de verdad, con sus palabras. */
const PEDIDO =
  "Alicatado de suelo del baño, colocar paneles decorativos en toda la pared y " +
  "cambiar WC, lavabo y plato de ducha con la mampara.";

const l = (concepto: string, descripcion = "", cantidad = 1, unidad = "ud") => ({
  concepto,
  descripcion,
  cantidad,
  unidad,
});

console.log("\nTrabajo que no se pidió");

const conFontaneria = [l("Renovación de red de fontanería en baño", "Renovación completa de la red", 1, "pa")];
if (!trabajosNoPedidos(PEDIDO, conFontaneria).length) {
  mal("fontanería no pedida", "no se avisa");
} else {
  bien("avisa de la renovación de fontanería que no se había pedido");
}

// Y NO molesta cuando sí se pide: un aviso que salta siempre se ignora.
if (trabajosNoPedidos("Renovar la fontanería entera del baño", conFontaneria).length) {
  mal("fontanería pedida", "avisa aunque sí se hubiera pedido");
} else {
  bien("cuando la fontanería sí se pide, no dice nada");
}

const conElectricidad = [l("Instalación eléctrica completa de vivienda", "", 1, "pa")];
if (!trabajosNoPedidos(PEDIDO, conElectricidad).length) mal("obra eléctrica no pedida", "no se avisa");
else bien("avisa de la obra eléctrica que no se había pedido");

const conTabiques = [l("Demolición de tabique", "", 6, "m²")];
if (!trabajosNoPedidos(PEDIDO, conTabiques).length) mal("tirar tabiques", "no se avisa");
else bien("avisa de tirar tabiques cuando no se pidió cambiar la distribución");

console.log("\nAcabados que se pisan");

const dos = [l("Alicatado de paredes con azulejo", "", 12, "m²"), l("Panel decorativo de pared", "", 10, "m²")];
if (!acabadosIncompatibles(dos).length) {
  mal("alicatado + panel", "no detecta que son alternativas sobre la misma pared");
} else {
  bien("detecta que alicatar y panelar la misma pared es cobrarla dos veces");
}
if (acabadosIncompatibles([l("Panel decorativo de pared", "", 24, "m²")]).length) {
  mal("un solo acabado", "avisa sin motivo");
} else {
  bien("con un solo acabado no dice nada");
}

console.log("\nParedes medidas por lo bajo");

/**
 * El perímetro de una estancia cuadrada de A m² es 4·raíz(A); por 2,5 m de
 * altura salen 10·raíz(A) m² de paramento. Con 7,1 m² de suelo son unos 26 m²,
 * así que 10 m² de panel es menos de la mitad de la pared.
 */
const corta = [l("Solado de gres porcelánico", "", 7.1, "m²"), l("Panel decorativo de pared", "", 10, "m²")];
const PIDE_TODA_LA_PARED = "Panelar toda la pared del baño y solar el suelo.";
const aviso = paredesCortas(corta, PIDE_TODA_LA_PARED);
if (!aviso.length) {
  mal("pared corta", "10 m² de panel con 7,1 m² de suelo no salta");
} else if (!/2[5-7]/.test(aviso[0])) {
  mal("pared corta", `no dice cuánto debería medir: ${aviso[0].slice(0, 90)}`);
} else {
  bien("avisa de que 10 m² de pared es imposible con 7,1 m² de suelo, y dice cuánto sería");
}

if (paredesCortas([l("Solado de gres porcelánico", "", 7.1, "m²"), l("Panel decorativo de pared", "", 24, "m²")], PIDE_TODA_LA_PARED).length) {
  mal("pared bien medida", "avisa sin motivo");
} else {
  bien("con la pared bien medida no dice nada");
}

// Sin solado no hay con qué comparar: mejor callarse que inventarse una regla.
if (paredesCortas([l("Panel decorativo de pared", "", 4, "m²")], PIDE_TODA_LA_PARED).length) {
  mal("sin suelo de referencia", "avisa sin tener con qué comparar");
} else {
  bien("sin solado con el que comparar, no se inventa el aviso");
}

console.log("\nDescripciones");

if (!descripcionesVacias([l("Sustitución de inodoro", "")]).length) {
  mal("descripción vacía", "no se detecta");
} else if (!descripcionesVacias([l("Sustitución de inodoro", "")])[0].includes("inodoro")) {
  mal("descripción vacía", "no dice cuál es la partida");
} else {
  bien("avisa de la partida sin descripción y dice cuál es");
}
if (descripcionesVacias([l("Sustitución de inodoro", "Retirada del existente y montaje del nuevo")]).length) {
  mal("descripción puesta", "avisa igualmente");
} else {
  bien("con la descripción puesta no dice nada");
}

console.log("\nPrecio del panel");

const panel = BAREMO.find((b) => /panel decorativo/i.test(b.concepto));
const alicatado = BAREMO.find((b) => /alicatado de paredes/i.test(b.concepto));

if (!panel) {
  mal("panel decorativo", "no está en el baremo, así que la IA se inventa el precio");
} else if (panel.soloMano === null || !alicatado || alicatado.soloMano === null) {
  mal("panel decorativo", "falta el precio de solo mano de obra");
} else if (panel.soloMano >= alicatado.soloMano) {
  mal(
    "mano de obra del panel",
    `${panel.soloMano} €/m² frente a ${alicatado.soloMano} del alicatado, y el panel va pegado`
  );
} else if (panel.conMaterial > alicatado.conMaterial) {
  mal("panel con material", `${panel.conMaterial} €/m², por encima del alicatado (${alicatado.conMaterial})`);
} else {
  bien(
    `el panel pegado sale por debajo del alicatado: ${panel.soloMano} frente a ${alicatado.soloMano} €/m² de mano de obra`
  );
}

/**
 * Y lo que NO debe saltar: la línea de demolición.
 *
 * Salió probando por la ruta real. "Demolición de alicatado y solado, 33 m²"
 * hizo creer al programa que había un alicatado NUEVO —y disparó el aviso de
 * acabados incompatibles— y que el suelo medía 33 m² en vez de 7. Dos avisos
 * falsos sobre un presupuesto que estaba bien.
 *
 * Es la misma lección que ya costó un falso negativo en faltanReposiciones: hay
 * que excluir lo que destruye. Un aviso que salta cuando no toca es peor que no
 * tenerlo, porque enseña a ignorarlos todos.
 */
console.log("\nLa demolición no es un acabado");

const conDemolicion = [
  l("Protección de zonas de paso", "", 1, "pa"),
  l("Demolición de alicatado y solado", "Picado del alicatado y del solado existentes", 33, "m²"),
  l("Solado de gres porcelánico", "Suelo del baño", 7, "m²"),
  l("Panel decorativo de pared", "Paneles en todo el paramento", 26, "m²"),
];

const falsoAcabado = acabadosIncompatibles(conDemolicion);
if (falsoAcabado.length) mal("demolición contada como acabado", falsoAcabado[0].slice(0, 90));
else bien("picar un alicatado no cuenta como poner un alicatado");

const falsoSuelo = paredesCortas(conDemolicion, PIDE_TODA_LA_PARED);
if (falsoSuelo.length) mal("suelo de referencia", falsoSuelo[0].slice(0, 100));
else bien("el suelo de referencia es el que se pone (7 m²), no el que se pica (33)");

/**
 * EL CASO REPORTADO, con la frase literal del usuario.
 *
 * "Alicatar suelos de todo el baño. Sustituir plato de ducha, poner mampara,
 * cambiar WC y lavabo. Pintar paredes y poner panel decorativo para duchas."
 *
 * El presupuesto que salió estaba BIEN: alicatado al suelo, pintura en las
 * paredes y panel solo en la ducha. Y aun así saltaron tres avisos, los tres
 * falsos:
 *
 *   - "Alicatado de suelos" se contó como alicatado de PARED, porque la palabra
 *     es la misma. Medio país llama alicatar a poner baldosa en cualquier sitio.
 *   - "Pintura en paramentos no alicatados" también, porque la DESCRIPCIÓN
 *     contiene la palabra "alicatados".
 *   - El panel de la ducha, 3,5 m², se midió con el criterio de una pared entera.
 *
 * Pintar la pared y panelar la ducha no es un conflicto: es lo que se hace en
 * cualquier baño. De ahí las dos correcciones: mirar el CONCEPTO y no toda la
 * línea, y no opinar de la medición salvo que se haya pedido la pared entera.
 */
console.log("\nEl caso reportado: alicatar SUELOS y panelar la ducha");

const PEDIDO_REAL =
  "Alicatar suelos de todo el baño. Sustituir plato de ducha, poner mampara, " +
  "cambiar WC y lavabo. Pintar paredes y poner panel decorativo para duchas.";

const presupuestoReal = [
  l("Alicatado de suelos", "Solado con baldosa cerámica en todo el baño", 7.1, "m²"),
  // 33 m² es lo que mide la pared de un baño de 7,1. Con 10 el aviso SÍ debe
  // saltar: de los tres avisos de aquel día, ese no era falso — los otros dos sí.
  l("Pintura plástica lisa en paramentos", "Pintura sobre paramentos no alicatados", 33, "m²"),
  l("Panel decorativo de pared", "Panel para la zona de ducha", 3.5, "m²"),
  l("Sustitución de plato de ducha", "Retirada y montaje del nuevo plato"),
  l("Mampara de ducha", "Suministro y montaje"),
];

const inc = acabadosIncompatibles(presupuestoReal);
if (inc.length) mal("acabados incompatibles", inc[0].slice(0, 110));
else bien("alicatar el SUELO y panelar la ducha no cuenta como dos acabados de pared");

const cortas = paredesCortas(presupuestoReal, PEDIDO_REAL);
if (cortas.length) mal("paredes cortas", cortas[0].slice(0, 110));
else bien("un panel de 3,5 m² para la ducha no se mide con el criterio de una pared entera");

// Nombrar el alicatado dentro de una descripción no convierte esa partida en un
// alicatado.
const porLaDescripcion = [
  l("Pintura plástica", "Sobre paramentos no alicatados", 20, "m²"),
  l("Panel decorativo de pared", "En todos los paramentos", 5, "m²"),
];
if (acabadosIncompatibles(porLaDescripcion).length) {
  mal("palabra en la descripción", "una palabra de la descripción convierte la partida en otra cosa");
} else {
  bien("mencionar el alicatado en una descripción no convierte esa partida en un alicatado");
}

// Pero el caso que SÍ es un problema se sigue detectando.
const dosDeVerdad = [
  l("Alicatado de paredes con azulejo", "Alicatado de los paramentos del baño", 22, "m²"),
  l("Panel decorativo de pared", "Panel en todos los paramentos", 22, "m²"),
];
if (!acabadosIncompatibles(dosDeVerdad).length) {
  mal("dos acabados reales", "ya no se detecta el caso que sí es un problema");
} else {
  bien("dos acabados generales sobre la misma pared se siguen detectando");
}

/**
 * LA SEGUNDA TIRADA DEL MISMO ENCARGO, que salió mal.
 *
 * Con la frase idéntica, otra generación trajo:
 *   - "Alicatado de paredes", 22 m² y 630 €, sin haberse pedido. Para la pared
 *     se había pedido pintura, y el panel solo para la ducha.
 *   - La pintura medida a 8 m², que con 7,1 m² de suelo es justo el TECHO: se
 *     pidió pintar las paredes y se midió el techo.
 *
 * Es la prueba de que el modelo no es fiable en esto: dos tiradas de la MISMA
 * frase dan resultados distintos. Por eso la barrera tiene que estar en el
 * código, y no en pedírselo mejor.
 */
console.log("\nLa segunda tirada, que salió mal");

const MAL = [
  l("Panel decorativo de pared", "Colocación de panel decorativo en ducha", 4, "m²"),
  l("Alicatado de paredes", "Alicatado de paredes del baño", 22, "m²"),
  l("Pintura plástica lisa en paramentos", "Pintura plástica lisa en techo", 8, "m²"),
  l("Solado de gres porcelánico", "Solado del baño", 7.1, "m²"),
];

const noPedido = acabadoDeParedNoPedido(PEDIDO_REAL, MAL);
if (!noPedido.length) mal("alicatado no pedido", "no se avisa del alicatado de paredes");
else if (!/pintura/i.test(noPedido[0])) mal("alicatado no pedido", "no dice qué se pidió para la pared");
else bien("avisa del alicatado de paredes y recuerda que la pared llevaba pintura");

const techo = paredesCortas(MAL, PEDIDO_REAL);
if (!techo.length) mal("pintura solo del techo", "8 m² con 7,1 de suelo no salta");
else if (!/techo/i.test(techo[0])) mal("pintura solo del techo", "no explica que eso es medir el techo");
else bien("avisa de que 8 m² de pintura es medir el techo, no las paredes");

// Y la tirada que estaba bien sigue sin dar un solo aviso.
const falsos = [
  ...acabadoDeParedNoPedido(PEDIDO_REAL, presupuestoReal),
  ...acabadosIncompatibles(presupuestoReal),
  ...paredesCortas(presupuestoReal, PEDIDO_REAL),
];
if (falsos.length) mal("la tirada buena", falsos[0].slice(0, 110));
else bien("la tirada que estaba bien sigue sin dar ni un aviso");

console.log(
  fallos
    ? `\nSOBRANTES INCORRECTO — ${fallos} ${fallos === 1 ? "fallo" : "fallos"}`
    : "\nSOBRANTES CORRECTO — no se cuela trabajo sin pedir, ni salta un aviso donde no toca"
);
process.exit(fallos ? 1 : 0);
