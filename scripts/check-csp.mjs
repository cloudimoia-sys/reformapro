/**
 * Guardián de la CSP. Se ejecuta en cada build (prebuild).
 *
 * EXISTE POR UN FALLO REAL: `globals.css` importaba las fuentes desde
 * `fonts.googleapis.com`. Al añadir la Content-Security-Policy, esa petición
 * quedó bloqueada y la aplicación estuvo en producción con la tipografía caída a
 * la de sistema. No dio error en consola del servidor, no rompió el build y no
 * falló ninguna prueba: solo se veía distinta, y hubo que mirarla para notarlo.
 *
 * La CSP dice `default-src 'self'`, así que cualquier recurso de otro dominio
 * escrito en el CSS o en el HTML no se va a cargar. Mejor enterarse aquí que en
 * el móvil de un cliente.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const RAIZ = process.cwd();
const CARPETAS = ["app", "components", "lib"];

/** Dominios que la CSP sí permite. Hoy ninguno: la app se sirve entera de sí misma. */
const PERMITIDOS = [];

/** `url(http…)` y `@import "http…"` dentro de CSS, y src/href externos en el JSX. */
const PATRONES = [
  { re: /url\(\s*['"]?(https?:\/\/[^'")\s]+)/gi, que: "url() a otro dominio" },
  { re: /@import\s+(?:url\()?\s*['"](https?:\/\/[^'"]+)/gi, que: "@import de otro dominio" },
  { re: /<(?:script|link|iframe)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)/gi, que: "recurso externo en el HTML" },
];

/**
 * `<img src>` NO se comprueba: la CSP permite data: y blob:, que es como viajan
 * las fotos y los logos, y una imagen externa se vería rota de inmediato — no es
 * el fallo silencioso que esto persigue.
 */
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
    } else if (/\.(css|tsx?|jsx?)$/.test(e)) {
      salida.push(ruta);
    }
  }
  return salida;
}

const problemas = [];

for (const carpeta of CARPETAS) {
  for (const ruta of archivos(join(RAIZ, carpeta))) {
    const rel = relative(RAIZ, ruta).split(sep).join("/");
    const codigo = readFileSync(ruta, "utf8");
    for (const { re, que } of PATRONES) {
      for (const m of codigo.matchAll(re)) {
        const url = m[1];
        const host = new URL(url).host;
        if (PERMITIDOS.includes(host)) continue;
        const linea = codigo.slice(0, m.index).split("\n").length;
        problemas.push(`${rel}:${linea}: ${que} → ${host}`);
      }
    }
  }
}

if (problemas.length) {
  console.error("\nRECURSOS QUE LA CSP VA A BLOQUEAR — build detenido:\n");
  for (const p of problemas) console.error("  - " + p);
  console.error(
    "\n  La CSP es `default-src 'self'`: esto no se cargaría en producción y no\n" +
      "  daría ningún error visible, solo se vería mal.\n" +
      "  Sírvelo desde el propio dominio (para fuentes, next/font) o añade el\n" +
      "  dominio a la CSP en next.config.js Y a PERMITIDOS aquí, a la vez.\n"
  );
  process.exit(1);
}

console.log("check-csp: correcto, no se carga nada de otros dominios.");
