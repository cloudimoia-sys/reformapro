/**
 * Aplica las migraciones pendientes antes de construir. Se ejecuta en prebuild.
 *
 * POR QUÉ EXISTE, y por qué no contradice la regla del README de "aplica el SQL
 * revisado, no un comando que decida solo":
 *
 *   `prisma migrate deploy` NO genera SQL. Ejecuta, en orden, los ficheros de
 *   prisma/migrations que ya están escritos a mano, revisados y commiteados. Los
 *   comandos peligrosos son otros — `migrate dev`, `db push` y sobre todo
 *   `migrate diff --shadow-database-url`, que es el que en su día vació la base
 *   de datos de producción. Ese sigue prohibido contra producción.
 *
 *   La disciplina de revisar cada migración a mano antes de commitearla no
 *   cambia. Lo que se automatiza es el paso mecánico de aplicarla, que hacerlo a
 *   mano cada vez es precisamente donde se cometió aquel error.
 *
 * SI FALLA, EL BUILD FALLA. Es deliberado: desplegar código nuevo contra un
 * esquema viejo da errores en producción que no se entienden y que aparecen
 * tarde, cuando ya hay alguien delante usando la aplicación.
 */
import { execFileSync } from "child_process";

const enVercel = !!process.env.VERCEL;

/**
 * En local no se toca nada.
 *
 * En desarrollo las migraciones se aplican con `npx prisma migrate dev`, que
 * además regenera el cliente. Si esto corriera también en local, un `npm run
 * build` para comprobar que compila acabaría escribiendo en la base de datos de
 * trabajo sin haberlo pedido.
 */
if (!enVercel) {
  console.log("migrar: fuera de Vercel no se aplican migraciones (usa `npx prisma migrate dev`).");
  process.exit(0);
}

if (!process.env.DIRECT_URL) {
  console.error(
    "\nFALTA DIRECT_URL — build detenido.\n\n" +
      "  Las migraciones necesitan la conexión DIRECTA a Postgres (sin pooling).\n" +
      "  En Vercel: Settings → Environment Variables → DIRECT_URL, con la cadena\n" +
      "  'direct'/'unpooled' de Neon.\n\n" +
      "  Se detiene el build a propósito: desplegar la aplicación contra un esquema\n" +
      "  antiguo rompe en producción y el motivo no se ve por ninguna parte.\n"
  );
  process.exit(1);
}

console.log("migrar: aplicando migraciones pendientes…");
try {
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: true });
} catch {
  console.error(
    "\nLAS MIGRACIONES HAN FALLADO — build detenido.\n\n" +
      "  Revisa el error de arriba. Si dice P3005 (la base de datos no está vacía y\n" +
      "  no tiene historial de migraciones), hay que marcarlas como aplicadas con\n" +
      "  `prisma migrate resolve --applied <nombre>` tras comprobar que el esquema\n" +
      "  ya coincide.\n"
  );
  process.exit(1);
}
