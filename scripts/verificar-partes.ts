/**
 * Comprueba los cálculos de un parte de trabajo.
 *
 * Dos cosas se prueban aquí. La suma de horas y material no mezcla lo que no
 * se debe mezclar, y un parte sin nada no revienta. Y `lineasSinCantidad`, que
 * es la red de seguridad de la parte con IA: al modelo se le prohíbe por
 * prompt inventar una hora o una cantidad que el técnico no haya dicho, pero
 * un prompt se cumple "casi siempre", y "casi" no vale en un documento que
 * firma el cliente. Esta función es la comprobación en código de que ese
 * "casi" no se cuela.
 *
 * Ejecutar con: npx tsx scripts/verificar-partes.ts
 */
import { readFileSync } from "node:fs";
import {
  importeLineaParte,
  totalesParte,
  estadoParteClase,
  estadoParteLabel,
  lineasSinCantidad,
  type LineaParteCalc,
  type LineaGeneradaParte,
} from "../lib/parteTrabajo";

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

// ───────────────────────── Códigos de ERP ─────────────────────────
console.log("\nCódigos de ERP");

/*
 * El código identifica un ARTÍCULO, no un cliente: en un ERP la referencia la
 * tiene el material, no la persona a la que se le factura. Estuvo un rato en
 * Cliente por un error de diseño, y esta comprobación existe para que no vuelva.
 */
const esquema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const modelo = (nombre: string) => esquema.split(`model ${nombre} {`)[1]?.split("\n}")[0] ?? "";

if (/codigoErp/.test(modelo("Cliente"))) {
  mal("cliente", "el cliente vuelve a tener codigoErp: la referencia es del artículo, no de quien paga");
} else bien("el cliente NO tiene código de ERP");

for (const [donde, nombre] of [
  ["el catálogo", "Producto"],
  ["la línea del parte", "LineaParteTrabajo"],
] as [string, string][]) {
  if (!/codigoErp/.test(modelo(nombre))) mal(nombre, `${donde} no tiene código de ERP y debería`);
  else bien(`${donde} tiene su código de ERP`);
}

// Y opcional de verdad: quien no tiene ERP no puede verse obligado a rellenarlo.
for (const nombre of ["Producto", "LineaParteTrabajo", "ParteTrabajo"]) {
  const linea = modelo(nombre).split("\n").find((l) => l.trim().startsWith("codigoErp")) ?? "";
  if (!linea.includes("String?")) mal(nombre, "el código de ERP no es opcional");
}
if (!fallos) bien("el código de ERP es opcional en los tres sitios donde aparece");

// ───────────── La IA que estructura el dictado: red de seguridad ─────────────
console.log("\nlineasSinCantidad: la red de seguridad de la parte con IA");

const g = (tipo: "MANO_OBRA" | "MATERIAL", concepto: string, cantidad: number): LineaGeneradaParte => ({
  tipo,
  concepto,
  cantidad,
  unidad: tipo === "MANO_OBRA" ? "h" : "ud",
  precio: 0,
});

// El caso normal: el técnico dijo un número, no hay nada que revisar.
if (lineasSinCantidad([g("MANO_OBRA", "Montaje de grifería", 2), g("MATERIAL", "Grifo monomando", 1)]).length) {
  mal("con cantidad", "avisa de una línea que sí tiene cantidad");
} else bien("una línea con horas o cantidad puestas no genera ningún aviso");

// El caso que importa: la IA ha dejado la cantidad a 0 porque no se dijo.
const sinDecir = lineasSinCantidad([g("MANO_OBRA", "Montaje de grifería", 0)]);
if (sinDecir.length !== 1 || !/horas/.test(sinDecir[0])) {
  mal("mano de obra sin horas", "no señala que faltan las horas, o el mensaje no habla de horas");
} else bien("una línea de mano de obra sin horas se señala, y el mensaje habla de horas");

const materialSinCantidad = lineasSinCantidad([g("MATERIAL", "Tubo de cobre", 0)]);
if (materialSinCantidad.length !== 1 || !/cantidad/.test(materialSinCantidad[0])) {
  mal("material sin cantidad", "no señala que falta la cantidad, o el mensaje no habla de cantidad");
} else bien("una línea de material sin cantidad se señala, y el mensaje habla de cantidad");

// Un número negativo (una IA divagando podría devolver uno) cuenta igual que
// "sin decir": nunca se acepta como si fuera una cantidad real.
if (lineasSinCantidad([g("MATERIAL", "Silicona", -1)]).length !== 1) {
  mal("cantidad negativa", "una cantidad negativa no se trata como «sin decir»");
} else bien("una cantidad negativa se trata igual que si no se hubiera dicho nada");

// Con varias líneas, se señalan solo las que de verdad faltan.
const mixto = lineasSinCantidad([g("MANO_OBRA", "Tarea A", 3), g("MANO_OBRA", "Tarea B", 0), g("MATERIAL", "Pieza", 2)]);
if (mixto.length !== 1) {
  mal("mixto", `debía señalar 1 línea de 3 y señaló ${mixto.length}`);
} else bien("con varias líneas, solo se señalan las que de verdad no tienen cantidad");

console.log("");
if (fallos) {
  console.log(`PARTES DE TRABAJO INCORRECTO — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("PARTES DE TRABAJO CORRECTO — mano de obra y material se suman aparte, y un parte vacío no revienta");
