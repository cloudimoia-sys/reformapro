/**
 * Comprueba el detector de texto que no es español.
 *
 * Nace de un fallo que estuvo semanas sin verse: la clase de caracteres se
 * corrompió al escribir el fichero y perdió el primer extremo de un rango, con
 * lo que TODA letra normal pasaba a ser sospechosa. Cada informe salía con un
 * aviso por apartado y otro por partida —doce avisos falsos seguidos— sobre un
 * documento que estaba perfectamente bien.
 *
 * No lo detectó nadie porque esta función no tenía ni una sola prueba. Los casos
 * de aquí abajo son texto REAL del informe que lo destapó, escrito con sus
 * tildes, sus símbolos y sus comillas: si algún día vuelve a romperse, es
 * exactamente este texto el que tiene que seguir pasando limpio.
 *
 * Ejecutar con: npx tsx scripts/verificar-texto.ts
 */
import { textoSospechoso } from "../lib/revision";

let fallos = 0;
const mal = (q: string, d: string) => { fallos++; console.log(`  MAL  ${q}: ${d}`); };
const bien = (q: string) => console.log(`  ok   ${q}`);

console.log("\nEl texto español normal NO se marca");

const BUENOS: [string, string][] = [
  ["Aviso del apartado 1", "Este documento NO es un certificado de eficiencia energética (RD 390/2021)."],
  ["Zona climática", "Zona climática estimada (CTE DB-HE): C1"],
  ["Partida de aislamiento", "Aislamiento térmico por el exterior (SATE), con andamio y acabado"],
  ["Medición con símbolos", "54 m² a 88,00 €/m² = 4.752,00 €"],
  ["Tildes y eñes", "El año de construcción es 1981, anterior al CTE. ¿Mañana se revisa?"],
  ["Guion largo y comillas", "— La “letra” oficial la da el técnico… «con su programa»"],
  ["Grados y ordinales", "Fisura a 45º, 3º B, temperatura de 21°C ± 2"],
  ["Fracciones y multiplicación", "Vidrio 4/16/6 · sección ½ pie · andamio 3 × 8 m"],
  ["Catalán y gallego, que también son clientes", "Reforma del bany a Sant Cugat; obra na Coruña, rúa Progreso"],
];
for (const [donde, texto] of BUENOS) {
  const avisos = textoSospechoso([{ donde, texto }]);
  if (avisos.length) mal(donde, `salta en falso: ${avisos[0]}`);
}
if (!fallos) bien(`los ${BUENOS.length} textos reales del informe no producen ningún aviso`);

// El documento entero de golpe, que es como llega en la práctica.
if (textoSospechoso(BUENOS.map(([donde, texto]) => ({ donde, texto }))).length) {
  mal("documento entero", "un informe correcto genera avisos");
} else bien("un informe correcto entero no genera ni un aviso");

console.log("\nY lo que sí es basura se sigue detectando");

const MALOS: [string, string][] = [
  ["Chino en una partida", "tablones de repart荷重"],
  ["Cirílico", "Aislamiento про"],
  ["Griego", "Coeficiente λ del aislante"],
  ["Emoji", "Reforma terminada 😀"],
];
for (const [donde, texto] of MALOS) {
  if (!textoSospechoso([{ donde, texto }]).length) mal(donde, `no se detecta: ${texto}`);
  else bien(`${donde}: detectado`);
}

console.log("");
if (fallos) {
  console.log(`DETECTOR DE TEXTO INCORRECTO — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("DETECTOR DE TEXTO CORRECTO — no salta con español normal y sigue cazando la basura");
