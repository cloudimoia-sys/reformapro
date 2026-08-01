/**
 * Comprueba que los precios salen coherentes.
 *
 * Existe por un fallo que se vio en producción: dos presupuestos del mismo solado
 * de 4 m², uno CON material a 217,80 € y otro SIN material a 306,90 €. Más caro
 * sin material que con él. La causa estaba en los indirectos, que la IA se
 * inventaba en cada generación: 120 € de contenedor en uno y 9 € en el otro.
 *
 * Ejecutar con: npx tsx scripts/verificar-precios.ts
 */
import { normalizarIndirectos, type LineaIndirecta } from "../lib/indirectos";
import { BAREMO } from "../lib/baremo";
import { desglosePresupuesto, porCapitulos, type PartidaInforme } from "../lib/informe";

const total = (ls: LineaIndirecta[]) => ls.reduce((s, l) => s + l.cantidad * l.precio, 0);

let fallos = 0;
const mal = (que: string, detalle: string) => {
  fallos++;
  console.log(`  MAL  ${que}: ${detalle}`);
};
const bien = (que: string) => console.log(`  ok   ${que}`);

// 1) El mismo trabajo directo da siempre los mismos indirectos, vengan como vengan.
const directo: LineaIndirecta[] = [
  { capitulo: "Revestimientos", concepto: "Solado de gres porcelánico", descripcion: "", cantidad: 4, unidad: "m²", precio: 38 },
];
const variante = (indirectos: LineaIndirecta[]) => total(normalizarIndirectos([...directo, ...indirectos]).lineas);

const caro = variante([
  { capitulo: "Gestión de residuos", concepto: "Contenedor de escombros", descripcion: "", cantidad: 1, unidad: "pa", precio: 120 },
  { capitulo: "Seguridad y salud", concepto: "Estudio de seguridad", descripcion: "", cantidad: 1, unidad: "pa", precio: 45 },
]);
const barato = variante([
  { capitulo: "Gestión de residuos", concepto: "Gestión de residuos", descripcion: "", cantidad: 0.2, unidad: "t", precio: 45 },
  { capitulo: "Seguridad y salud", concepto: "Estudio de seguridad", descripcion: "", cantidad: 1, unidad: "pa", precio: 35 },
]);
if (caro !== barato) mal("mismos indirectos ante estimaciones distintas", `${caro} € vs ${barato} €`);
else bien(`mismos indirectos ante estimaciones distintas (${caro} €)`);

// 2) Sin material siempre sale más barato que con material, para el mismo trabajo.
for (const p of BAREMO.filter((x) => x.soloMano !== null)) {
  if (p.soloMano! >= p.conMaterial) {
    mal(`"${p.concepto}"`, `sin material ${p.soloMano} € >= con material ${p.conMaterial} €`);
  }
}
if (!fallos) bien(`el baremo nunca cobra más sin material (${BAREMO.filter((x) => x.soloMano !== null).length} partidas)`);

// 3) Un presupuesto completo sin material sale más barato que el mismo con material.
const conMaterial: LineaIndirecta[] = [
  { capitulo: "Revestimientos", concepto: "Solado de gres porcelánico", descripcion: "", cantidad: 4, unidad: "m²", precio: 38 },
  { capitulo: "Gestión de residuos", concepto: "Contenedor", descripcion: "", cantidad: 1, unidad: "pa", precio: 9 },
  { capitulo: "Seguridad y salud", concepto: "Seguridad", descripcion: "", cantidad: 1, unidad: "pa", precio: 35 },
];
const sinMaterial: LineaIndirecta[] = [
  { capitulo: "Revestimientos", concepto: "Solado de gres porcelánico", descripcion: "", cantidad: 4, unidad: "m²", precio: 26 },
  { capitulo: "Gestión de residuos", concepto: "Contenedor", descripcion: "", cantidad: 1, unidad: "pa", precio: 120 },
  { capitulo: "Seguridad y salud", concepto: "Seguridad", descripcion: "", cantidad: 1, unidad: "pa", precio: 45 },
];
const tc = total(normalizarIndirectos(conMaterial).lineas);
const ts = total(normalizarIndirectos(sinMaterial).lineas);
if (ts >= tc) mal("presupuesto sin material", `${ts} € no es menor que con material ${tc} €`);
else bien(`sin material (${ts} €) más barato que con material (${tc} €)`);

// 4) Los indirectos son proporcionales: una obra grande no lleva el mismo importe.
const obraGrande: LineaIndirecta[] = [
  { capitulo: "Revestimientos", concepto: "Solado", descripcion: "", cantidad: 400, unidad: "m²", precio: 38 },
  { capitulo: "Seguridad y salud", concepto: "Seguridad", descripcion: "", cantidad: 1, unidad: "pa", precio: 35 },
];
const seg = normalizarIndirectos(obraGrande).lineas.find((l) => /seguridad/i.test(l.concepto))!;
if (seg.precio <= 30) mal("indirectos proporcionales", `una obra de 15.200 € lleva ${seg.precio} € de seguridad`);
else bien(`indirectos proporcionales (obra de 15.200 € → ${seg.precio} € de seguridad y salud)`);

// 5) Las partidas opcionales no inflan el total obligatorio.
//
// Es lo que decide el cliente: si una mejora recomendable se suma al total, la
// cifra sale más alta de lo necesario y el presupuesto se cae por precio.
const partidas: PartidaInforme[] = [
  { codigo: "01.01", descripcion: "Tratamiento de dinteles", unidad: "ud", cantidad: 4, precio: 390 },
  { codigo: "03.01", descripcion: "Sellado de juntas", unidad: "m", cantidad: 12, precio: 66 },
  { codigo: "03.02", descripcion: "Revestimiento protector del techo", unidad: "m²", cantidad: 25, precio: 38, opcional: true },
];
const d = desglosePresupuesto(partidas);

if (Math.abs(d.ejecucionMaterial - (1560 + 792)) > 0.01) {
  mal("partidas opcionales", `el PEM (${d.ejecucionMaterial} €) incluye la opcional`);
} else bien(`el PEM excluye las opcionales (${d.ejecucionMaterial} €)`);

if (Math.abs(d.opcional - 950) > 0.01) mal("importe opcional", `${d.opcional} € en vez de 950 €`);
else bien("las opcionales se suman aparte (950 €)");

if (d.totalConOpcional <= d.total) mal("total con opcionales", "no es mayor que el total sin ellas");
else bien(`total con opcionales (${d.totalConOpcional.toFixed(2)} €) mayor que sin ellas (${d.total.toFixed(2)} €)`);

// Los subtotales por capítulo tampoco cuentan lo opcional.
const cap03 = porCapitulos(partidas).find((g) => g.codigo === "03")!;
if (Math.abs(cap03.subtotal - 792) > 0.01) mal("subtotal de capítulo", `${cap03.subtotal} € en vez de 792 €`);
else bien("los subtotales por capítulo excluyen las opcionales (792 €)");

console.log("");
if (fallos) {
  console.log(`PRECIOS INCOHERENTES — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("PRECIOS COHERENTES — sin material nunca sale más caro que con material");
