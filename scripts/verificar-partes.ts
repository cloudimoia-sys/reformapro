/**
 * Comprueba los cálculos de un parte de trabajo.
 *
 * No hay ninguna IA aquí que probar: el técnico escribe las horas y el
 * material, y este fichero solo suma. Lo que sí hay que comprobar es que la
 * suma no mezcla lo que no se debe mezclar — mano de obra y material se leen
 * distinto y por eso van por separado— y que un parte sin nada no revienta.
 *
 * Ejecutar con: npx tsx scripts/verificar-partes.ts
 */
import { importeLineaParte, totalesParte, estadoParteClase, estadoParteLabel, type LineaParteCalc } from "../lib/parteTrabajo";

let fallos = 0;
const mal = (q: string, d: string) => { fallos++; console.log(`  MAL  ${q}: ${d}`); };
const bien = (q: string) => console.log(`  ok   ${q}`);

// ─────────────────────────── Importe de una línea ───────────────────────────
console.log("\nImporte de una línea");

if (importeLineaParte({ tipo: "MANO_OBRA", cantidad: 3, precio: 22 }) !== 66) {
  mal("mano de obra", "3 h a 22 €/h no dan 66 €");
} else bien("3 h a 22 €/h dan 66 €");

if (importeLineaParte({ tipo: "MATERIAL", cantidad: 12, precio: 4.5 }) !== 54) {
  mal("material", "12 ud a 4,50 € no dan 54 €");
} else bien("12 ud a 4,50 € dan 54 €");

// A diferencia de un presupuesto, un parte no tiene descuento: registra lo que
// ha costado, no negocia un precio. Si alguien le añadiera un campo descuento
// algún día, esta prueba lo detectaría en cuanto cambiara el resultado.
if (importeLineaParte({ tipo: "MATERIAL", cantidad: 10, precio: 10 }) !== 100) {
  mal("sin descuento", "10 x 10 no da 100: algo está restando de más");
} else bien("no hay descuento oculto en el cálculo");

// ─────────────────────────────── Totales ───────────────────────────────
console.log("\nTotales: mano de obra y material no se mezclan");

const PARTE_REAL: LineaParteCalc[] = [
  { tipo: "MANO_OBRA", cantidad: 4, precio: 25 }, // 100 €
  { tipo: "MANO_OBRA", cantidad: 1.5, precio: 25 }, // 37,5 €
  { tipo: "MATERIAL", cantidad: 2, precio: 18.9 }, // 37,8 €
  { tipo: "MATERIAL", cantidad: 6, precio: 3.2 }, // 19,2 €
];
const t = totalesParte(PARTE_REAL);

if (t.horas !== 5.5) mal("horas", `suma 5,5 h de dos líneas y da ${t.horas}`);
else bien("las horas de las dos líneas de mano de obra se suman: 5,5 h");

if (Math.abs(t.costeManoObra - 137.5) > 0.001) mal("coste mano de obra", `debería ser 137,50 € y da ${t.costeManoObra}`);
else bien("el coste de mano de obra es 137,50 €");

if (Math.abs(t.costeMaterial - 57) > 0.001) mal("coste material", `debería ser 57 € y da ${t.costeMaterial}`);
else bien("el coste de material es 57 €");

if (Math.abs(t.total - 194.5) > 0.001) mal("total", `debería ser 194,50 € y da ${t.total}`);
else bien("el total junta los dos: 194,50 €");

// El caso que de verdad importa probar: un material NO suma horas, y una hora
// NO suma como si fuera material. Si el filtro por tipo se rompiera (por
// ejemplo comparando mal el enum), esta prueba es la que lo pillaría.
const SOLO_MATERIAL: LineaParteCalc[] = [{ tipo: "MATERIAL", cantidad: 100, precio: 1 }];
if (totalesParte(SOLO_MATERIAL).horas !== 0) {
  mal("aislamiento de tipos", "una línea de MATERIAL está sumando horas");
} else bien("una línea de MATERIAL no suma ninguna hora");

const SOLO_MANO_OBRA: LineaParteCalc[] = [{ tipo: "MANO_OBRA", cantidad: 8, precio: 20 }];
if (totalesParte(SOLO_MANO_OBRA).costeMaterial !== 0) {
  mal("aislamiento de tipos", "una línea de MANO_OBRA está sumando coste de material");
} else bien("una línea de MANO_OBRA no suma ningún coste de material");

// Un parte recién creado no tiene líneas todavía, y no puede reventar por eso.
const t0 = totalesParte([]);
if (t0.horas !== 0 || t0.costeManoObra !== 0 || t0.costeMaterial !== 0 || t0.total !== 0) {
  mal("parte vacío", "un parte sin líneas no da todo a cero");
} else bien("un parte recién creado, sin líneas, da todo a cero");

// ─────────────────────────────── Estado ───────────────────────────────
console.log("\nEstado");

if (estadoParteLabel("BORRADOR") !== "Borrador") mal("etiqueta", "BORRADOR no se lee «Borrador»");
if (estadoParteLabel("FIRMADO") !== "Firmado") mal("etiqueta", "FIRMADO no se lee «Firmado»");
if (estadoParteClase("BORRADOR") === estadoParteClase("FIRMADO")) {
  mal("clase", "un parte firmado usa la misma clase visual que uno en borrador");
} else bien("un parte borrador y uno firmado se distinguen visualmente");

console.log("");
if (fallos) {
  console.log(`PARTES DE TRABAJO INCORRECTO — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("PARTES DE TRABAJO CORRECTO — mano de obra y material se suman aparte, y un parte vacío no revienta");
