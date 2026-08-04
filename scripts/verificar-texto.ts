/**
 * Comprueba el detector de texto que no es espanol.
 *
 * Nace de un fallo que estuvo semanas sin verse: la clase de caracteres se
 * corrompio al escribir el fichero y perdio el primer extremo de un rango, con
 * lo que TODA letra normal pasaba a ser sospechosa. Cada informe salia con un
 * aviso por apartado y otro por partida -doce avisos falsos seguidos- sobre un
 * documento que estaba perfectamente bien.
 *
 * No lo detecto nadie porque esta funcion no tenia ni una sola prueba. Los
 * casos de aqui abajo son texto REAL del informe que lo destapo.
 *
 * Las cadenas van con escapes \u y no con caracteres literales, por el mismo
 * motivo por el que se rompio el original.
 *
 * Ejecutar con: npx tsx scripts/verificar-texto.ts
 */
import { textoSospechoso } from "../lib/revision";

let fallos = 0;
const mal = (q: string, d: string) => { fallos++; console.log(`  MAL  ${q}: ${d}`); };
const bien = (q: string) => console.log(`  ok   ${q}`);

console.log("\nEl texto espanol normal NO se marca");

const BUENOS: [string, string][] = [
  ["Aviso del apartado 1", "Este documento NO es un certificado de eficiencia energetica (RD 390/2021)."],
  ["Zona climatica", "Zona climatica estimada (CTE DB-HE): C1"],
  ["Partida de aislamiento", "Aislamiento termico por el exterior (SATE), con andamio y acabado"],
  ["Medicion con simbolo", "54 m\u00B2 a 88,00 \u20AC/m\u00B2 = 4.752,00 \u20AC"],
  ["Texto con tildes y ene", "El a\u00F1o de construcci\u00F3n es 1981, anterior al CTE. Ma\u00F1ana se revisa."],
  ["Guion largo y comillas", "\u2014 La \u201Cletra\u201D oficial la da el t\u00E9cnico\u2026"],
  ["Grados y ordinales", "Fisura a 45\u00BA, 3\u00BA B, temperatura de 21\u00B0C"],
];
for (const [donde, texto] of BUENOS) {
  const avisos = textoSospechoso([{ donde, texto }]);
  if (avisos.length) mal(donde, `salta en falso: ${avisos[0]}`);
}
if (!fallos) bien(`los ${BUENOS.length} textos reales del informe no producen ningun aviso`);

// El documento entero de golpe, que es como llega en la practica.
if (textoSospechoso(BUENOS.map(([donde, texto]) => ({ donde, texto }))).length) {
  mal("documento entero", "un informe correcto genera avisos");
} else bien("un informe correcto entero no genera ni un aviso");

console.log("\nY lo que si es basura se sigue detectando");

const MALOS: [string, string][] = [
  ["Chino en una partida", "tablones de repart\u8377\u91CD"],
  ["Cirilico", "Aislamiento \u043F\u0440\u043E"],
  ["Emoji", "Reforma terminada \u1F600"],
];
for (const [donde, texto] of MALOS) {
  if (!textoSospechoso([{ donde, texto }]).length) mal(donde, `no se detecta: ${texto}`);
  else bien(`${donde}: detectado`);
}

console.log("");
if (fallos) {
  console.log(`DETECTOR DE TEXTO INCORRECTO - ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("DETECTOR DE TEXTO CORRECTO - no salta con espanol normal y sigue cazando la basura");
