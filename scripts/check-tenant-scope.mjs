/**
 * Guardián de aislamiento entre empresas. Se ejecuta en cada build (prebuild).
 *
 * El peligro que cubre: alguien añade una consulta con el cliente sin filtrar y
 * nadie se da cuenta, porque no da error — simplemente devuelve datos de más.
 * Aquí eso rompe el despliegue.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const RAIZ = process.cwd();
const CARPETAS = ["app", "lib", "components", "scripts"];

/**
 * Únicos sitios donde el cliente sin filtrar es legítimo: cosas que ocurren
 * ANTES de saber a qué empresa perteneces, o que gestionan la propia lista de
 * empresas.
 */
const PERMITIDO_PRISMA_UNSAFE = [
  "lib/prisma.ts", // lo define
  "lib/tenantDb.ts", // lo envuelve con el filtro
  "lib/auth.ts", // login: busca al usuario por email para saber su empresa
  "lib/counter.ts", // upsert atómico con la empresa ya en la clave primaria
  "app/registro/actions.ts", // crea la empresa: aún no existe
  "app/recuperar/actions.ts", // recuperar contraseña: sin sesión todavía
  "app/restablecer/actions.ts",
  // Feed de calendario: Google no puede iniciar sesión, así que la autorización
  // es el token secreto de la obra. La consulta está acotada a una sola fila por
  // un campo único, no puede alcanzar datos de otra empresa.
  "app/api/calendario/[token]/route.ts",
];

/** Operaciones que el cliente por empresa prohíbe (ver lib/tenantDb.ts). */
const OPS_PROHIBIDAS = /\b(?:db|tx)\.(\w+)\.(findUnique|findUniqueOrThrow|update|delete|upsert)\(/g;
/** `empresa` es la excepción: su filtro ES la clave primaria, forzada por la extensión. */
const MODELO_EXENTO = "empresa";

/** El propio guardián habla de prismaUnsafe todo el rato; no se analiza a sí mismo. */
const SE_IGNORA = ["scripts/check-tenant-scope.mjs"];

/**
 * Quita comentarios antes de analizar: si no, mencionar "prismaUnsafe" en una
 * explicación (como hace lib/session.ts para decir que NO se use) daría un falso
 * positivo y bloquearía el build sin motivo.
 */
function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Uso real: o se importa, o se invoca como `prismaUnsafe.algo`. */
const USA_PRISMA_UNSAFE = /import[^;]*\bprismaUnsafe\b|(?<![\w.])prismaUnsafe\s*\./;

const problemas = [];

function archivos(dir) {
  const salida = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return salida;
  }
  for (const e of entradas) {
    const ruta = join(dir, e);
    if (statSync(ruta).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      salida.push(...archivos(ruta));
    } else if (/\.(ts|tsx|mjs)$/.test(e)) {
      salida.push(ruta);
    }
  }
  return salida;
}

for (const carpeta of CARPETAS) {
  for (const ruta of archivos(join(RAIZ, carpeta))) {
    const rel = relative(RAIZ, ruta).split(sep).join("/");
    if (SE_IGNORA.includes(rel)) continue;
    const codigo = sinComentarios(readFileSync(ruta, "utf8"));

    if (USA_PRISMA_UNSAFE.test(codigo) && !PERMITIDO_PRISMA_UNSAFE.includes(rel)) {
      problemas.push(
        `${rel}: usa prismaUnsafe (cliente SIN filtrar por empresa).\n` +
          `    Usa el 'db' que devuelve requireTenant(). Si de verdad hace falta el ` +
          `cliente sin filtrar, añade el archivo a PERMITIDO_PRISMA_UNSAFE explicando por qué.`
      );
    }

    // Solo dentro de app/: ahí es donde llegan ids del navegador.
    if (rel.startsWith("app/")) {
      for (const m of codigo.matchAll(OPS_PROHIBIDAS)) {
        const [entero, modelo, op] = m;
        if (modelo.toLowerCase() === MODELO_EXENTO) continue;
        const linea = codigo.slice(0, m.index).split("\n").length;
        problemas.push(
          `${rel}:${linea}: ${entero.trim()} no admite el filtro por empresa.\n` +
            `    Cambia ${op} por ${op.startsWith("find") ? "findFirst" : op === "delete" ? "deleteMany" : "updateMany"} y comprueba el resultado.`
        );
      }
    }
  }
}

if (problemas.length) {
  console.error("\nAISLAMIENTO ENTRE EMPRESAS EN RIESGO — build detenido:\n");
  for (const p of problemas) console.error("  - " + p);
  console.error("");
  process.exit(1);
}

console.log("check-tenant-scope: correcto, todas las consultas pasan por el filtro de empresa.");
