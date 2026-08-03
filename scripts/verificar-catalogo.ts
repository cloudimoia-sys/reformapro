/**
 * Comprueba que el catálogo solo cambia precios, nunca añade trabajo.
 *
 * Existe por un fallo real en producción: al pasarle las partidas del catálogo a
 * la IA dentro del prompt, metía "sustitución de plato de ducha" en un
 * presupuesto de alicatar un aseo, solo porque estaba en el catálogo. La lección
 * fue que hay que probar el caso NEGATIVO —el trabajo que NO coincide— y no solo
 * el que sí.
 *
 * Ejecutar con: npx tsx scripts/verificar-catalogo.ts
 */
import { aplicarCatalogo, type PartidaCatalogo } from "../lib/coincidencia";

const CATALOGO: PartidaCatalogo[] = [
  { nombre: "Sustitución de plato de ducha", descripcion: "Descripción del usuario.", capitulo: "Instalaciones", unidad: "ud", precio: 285 },
  { nombre: "Punto nuevo de agua", descripcion: "Descripción del usuario.", capitulo: "Instalaciones", unidad: "ud", precio: 95 },
  { nombre: "Cambio de WC", descripcion: "Descripción del usuario.", capitulo: "Equipamiento", unidad: "ud", precio: 130 },
];

/** [concepto que genera la IA, debe aplicarse la tarifa propia] */
const CASOS: [string, boolean][] = [
  // Mismo trabajo, aunque lo nombre de otra forma.
  ["Sustitución de plato de ducha", true],
  ["Suministro e instalación de plato de ducha", true],
  ["Colocación de plato de ducha aportado por la propiedad", true],
  ["Punto nuevo de agua para lavadora", true],
  ["Sustitución de inodoro (WC)", true],

  // Mismo elemento pero acción contraria: quitar no es poner.
  ["Demolición de alicatado y plato de ducha", false],
  ["Retirada de plato de ducha existente", false],
  ["Demolición y retirada de WC existente", false],

  // Trabajos distintos: aquí estaba el fallo que reportó el usuario.
  ["Alicatado con baldosa cerámica", false],
  ["Solado con baldosa de gres", false],
  ["Sustitución de ventana de aluminio", false],
  ["Instalación eléctrica: punto de luz", false],
  ["Pintura plástica en paramentos", false],
  ["Protección de zonas de paso", false],
  ["Gestión de residuos de construcción", false],
  ["Estudio básico de seguridad y salud", false],
];

let fallos = 0;

for (const [concepto, debeAplicar] of CASOS) {
  const entrada = [{ capitulo: "x", concepto, descripcion: "texto genérico", cantidad: 1, unidad: "ud", precio: 99 }];
  const r = aplicarCatalogo(entrada, CATALOGO);
  const aplico = r.aplicadas.length > 0;

  if (r.lineas.length !== entrada.length) {
    fallos++;
    console.log(`  MAL  el catálogo cambió el número de líneas en "${concepto}"`);
    continue;
  }
  if (aplico !== debeAplicar) {
    fallos++;
    console.log(`  MAL  "${concepto}" → ${aplico ? "aplicó tarifa propia" : "no aplicó"}, se esperaba lo contrario`);
    continue;
  }
  console.log(`  ok   ${concepto.slice(0, 54).padEnd(56)}${aplico ? `tarifa propia (${r.lineas[0].precio} €)` : "precio estimado"}`);
}

console.log("");
console.log(
  fallos
    ? `CATÁLOGO INCORRECTO — ${fallos} ${fallos === 1 ? "fallo" : "fallos"}`
    : "CATÁLOGO CORRECTO — no se añade trabajo que no se pidió, ni se cobra dos veces la misma pared"
);
process.exit(fallos ? 1 : 0);
