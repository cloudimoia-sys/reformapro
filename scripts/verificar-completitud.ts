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

console.log("");
if (fallos) {
  console.log(`COMPLETITUD INCORRECTA — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("COMPLETITUD CORRECTA — lo que falta se avisa, y lo completo no da falsos avisos");
