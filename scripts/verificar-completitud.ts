/**
 * Comprueba que la lista de capítulos obligatorios detecta lo que falta.
 *
 * Nace de una revisión técnica de un presupuesto de obra nueva de 68 m² generado
 * por la app: faltaban entre 26.000 y 55.000 € en partidas ausentes, incluida la
 * calefacción y el ACS, sin las cuales no hay licencia de primera ocupación.
 *
 * Lo importante aquí son los casos NEGATIVOS: que un presupuesto incompleto
 * genere aviso. Una comprobación que solo se prueba con presupuestos completos no
 * demuestra nada.
 *
 * Ejecutar con: npx tsx scripts/verificar-completitud.ts
 */
import { listaObligatoria, faltan } from "../lib/completitud";

type Linea = { capitulo: string; concepto: string; descripcion: string };
const l = (concepto: string): Linea => ({ capitulo: "", concepto, descripcion: "" });

let fallos = 0;
const mal = (q: string, d: string) => { fallos++; console.log(`  MAL  ${q}: ${d}`); };
const bien = (q: string) => console.log(`  ok   ${q}`);

const OBRA_NUEVA = "Vivienda unifamiliar de obra nueva";

// 1) Un trabajo concreto no exige nada: seria absurdo pedirle una cubierta a un aseo.
if (listaObligatoria("Suelos y alicatados", "Alicatar un aseo").length) {
  mal("trabajo concreto", "se le exigen capítulos que no vienen a cuento");
} else bien("un alicatado de aseo no exige capítulos de vivienda completa");

// 2) La obra nueva sí los exige.
const lista = listaObligatoria(OBRA_NUEVA, "Vivienda de 68 m²");
if (lista.length < 20) mal("obra nueva", `solo ${lista.length} capítulos obligatorios`);
else bien(`obra nueva exige ${lista.length} capítulos`);

// 3) El presupuesto incompleto que se vio en producción: debe avisar de cada hueco.
const incompleto = [
  "Instalación de caseta de obra", "Desbroce y limpieza del terreno", "Excavación en zanjas",
  "Hormigón de limpieza", "Zapatas de hormigón armado", "Forjado sanitario", "Estructura de hormigón",
  "Cubierta inclinada de teja", "Cerramiento de fachada", "Tabiquería interior", "Aislamiento térmico",
  "Ventanas de aluminio", "Instalación de fontanería", "Instalación eléctrica",
  "Solado de gres", "Alicatado de baños", "Pintura plástica", "Puerta de paso block",
  "Aparatos sanitarios", "Seguridad y salud", "Gestión de residuos", "Control de calidad",
].map(l);

const huecos = faltan(lista, incompleto).map((o) => o.nombre);
const debeAvisar = [
  "Calefacción y agua caliente sanitaria", "Ventilación mecánica",
  "Infraestructura de telecomunicaciones (ICT)", "Acometidas de agua, luz y saneamiento",
  "Estudio geotécnico", "Mobiliario de cocina", "Persianas o protección solar",
  "Puerta de entrada", "Armarios empotrados", "Urbanización exterior",
  "Acabado exterior de fachada",
];
for (const n of debeAvisar) {
  if (!huecos.includes(n)) mal(`falta detectar "${n}"`, "no se avisó y no estaba presupuestado");
}
if (!fallos) bien(`detecta los ${debeAvisar.length} capítulos que faltaban en el presupuesto real`);

// 4) Un presupuesto completo no debe dar avisos falsos.
const completo = [
  ...incompleto,
  l("Estudio geotécnico previo"), l("Acometidas de agua, electricidad y saneamiento"),
  l("Calefacción y ACS por aerotermia"), l("Ventilación mecánica de doble flujo"),
  l("Infraestructura común de telecomunicaciones ICT"), l("Mobiliario de cocina con encimera"),
  l("Persianas de aluminio"), l("Puerta de entrada blindada"), l("Armarios empotrados"),
  l("Urbanización exterior y acceso"), l("Revoco monocapa en fachada con vierteaguas"),
];
const falsos = faltan(lista, completo).map((o) => o.nombre);
if (falsos.length) mal("presupuesto completo", `avisa en falso de: ${falsos.join(", ")}`);
else bien("un presupuesto completo no produce avisos falsos");

/*
 * 5) El caso real que rompió esto: una COCINA descrita como "reforma integral".
 *
 * El usuario eligió "Cocina completa" en el desplegable, 8 m², y escribió
 * "Reforma integral de la cocina con puertas y cajones de cierre suave". Como el
 * tipo y los detalles se concatenaban antes de buscar "reforma integral", le
 * salieron once avisos exigiéndole el listado entero de una vivienda: puerta de
 * entrada, persianas, ACS con renovable, ventilación mecánica, control de
 * calidad. Para una cocina.
 */
const COCINA = "Reforma integral de la cocina con puertas y cajones de cierre suave.";
if (listaObligatoria("Cocina completa", COCINA).length) {
  mal("cocina", 'decir "reforma integral de la cocina" le exige el listado de una vivienda entera');
} else bien('una cocina descrita como "reforma integral" sigue siendo una cocina');

// Y lo mismo con el resto de estancias, que es donde más se usa esa expresión.
for (const [tipo, texto] of [
  ["Baño completo", "Reforma integral del baño"],
  ["Suelos y alicatados", "Reforma completa del salón"],
  ["Pintura y acabados", "Reforma integral del dormitorio principal"],
] as [string, string][]) {
  if (listaObligatoria(tipo, texto).length) mal(tipo, `"${texto}" escala a vivienda entera`);
}
if (!fallos) bien("baño, salón y dormitorio tampoco escalan a vivienda entera");

// 6) Pero la vivienda entera SÍ tiene que seguir exigiéndolo, por los dos caminos.
if (listaObligatoria("Reforma integral de vivienda", "Piso de 90 m²").length < 15) {
  mal("reforma integral", "una reforma integral de vivienda ya no exige capítulos");
} else bien("una reforma integral de vivienda sigue exigiendo su listado");

// Con "Otra", que es el único tipo que no dice nada, se lee el texto libre.
if (listaObligatoria("Otra (descríbela en los detalles)", "Reforma integral de un piso de 90 m²").length < 15) {
  mal("tipo Otra", 'con "Otra" no se lee el texto libre y se pierde la exigencia');
} else bien('con "Otra", una reforma integral de piso sí exige su listado');

if (listaObligatoria("Otra (descríbela en los detalles)", "Reforma integral de la cocina").length) {
  mal("tipo Otra", '"reforma integral de la cocina" escala a vivienda entera');
} else bien('con "Otra", "reforma integral de la cocina" no escala');

// 7) En reforma no hay estructura, así que no se pide un ensayo de hormigón.
const reforma = listaObligatoria("Reforma integral de vivienda", "");
if (reforma.some((o) => /control de calidad/i.test(o.nombre))) {
  mal("control de calidad", "se exige en una reforma, donde no hay estructura que ensayar");
} else bien("una reforma no exige control de calidad: no hay estructura");

console.log("");
if (fallos) {
  console.log(`COMPLETITUD INCORRECTA — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("COMPLETITUD CORRECTA — lo que falta se avisa, y lo completo no da falsos avisos");
