/**
 * Guardián del escapado en los documentos exportados. Corre en cada build.
 *
 * EXISTE POR UN AGUJERO REAL: `lib/docExport.ts` no escapaba absolutamente nada.
 * El nombre del cliente, el concepto de una partida o las notas iban tal cual al
 * HTML que se abre con `document.write` en una ventana del MISMO origen, así que
 * un `<img onerror=...>` guardado en cualquiera de esos campos ejecutaba código
 * como el usuario que exportaba el documento.
 *
 * Lo comprueba de forma estrecha a propósito —solo lo que de verdad se puede
 * detectar sin interpretar el código— para que no dé falsos avisos y acabe
 * ignorándose:
 *
 *   1. Que cada fichero que genera HTML tenga una función `esc` y que escape
 *      también las COMILLAS. Sin ellas se sale de un atributo, que es el caso
 *      con el que se cuela un `onerror`.
 *   2. Que ningún atributo HTML interpole un valor sin pasar por `esc`.
 */
import { readFileSync } from "fs";

const FICHEROS = ["lib/docExport.ts", "lib/informeExport.ts", "lib/parteExport.ts"];
const problemas = [];

for (const ruta of FICHEROS) {
  const codigo = readFileSync(ruta, "utf8");

  if (!/function esc\(/.test(codigo)) {
    problemas.push(`${ruta}: no define una función esc()`);
    continue;
  }
  // Las cinco sustituciones mínimas: & < > " '
  for (const [nombre, patron] of [
    ["&", /replace\(\/&\/g/],
    ["<", /replace\(\/<\/g/],
    [">", /replace\(\/>\/g/],
    ['"', /replace\(\/"\/g/],
    ["'", /replace\(\/'\/g/],
  ]) {
    if (!patron.test(codigo)) problemas.push(`${ruta}: esc() no escapa ${nombre}`);
  }

  /**
   * Atributos con valor interpolado: src="${…}", href="${…}", style="${…}".
   * Si lo de dentro no pasa por esc(), se sale del atributo.
   */
  for (const m of codigo.matchAll(/(src|href|alt|title)="\$\{([^}]+)\}/g)) {
    const expresion = m[2];
    if (expresion.includes("esc(")) continue;
    const linea = codigo.slice(0, m.index).split("\n").length;
    problemas.push(`${ruta}:${linea}: ${m[1]}="\${${expresion.slice(0, 40)}}" sin escapar`);
  }
}

if (problemas.length) {
  console.error("\nHTML SIN ESCAPAR EN LOS DOCUMENTOS — build detenido:\n");
  for (const p of problemas) console.error("  - " + p);
  console.error(
    "\n  Estos documentos se abren con document.write en una ventana del mismo\n" +
      "  origen: lo que no se escapa, se ejecuta. Pásalo por esc().\n"
  );
  process.exit(1);
}

console.log("check-escape: correcto, los documentos exportados escapan lo que interpolan.");
