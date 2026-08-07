# ReformaPro

Gestión de presupuestos para reformistas: clientes, catálogo de precios por proveedor, presupuestos con capítulos y asistente IA, firma del cliente, facturas y control de acceso por roles (admin/empleado).

Fase 1 de la puesta en producción: Next.js 14 + PostgreSQL + Prisma + NextAuth. Dos vías de despliegue: gratis en Vercel + Neon, o con Docker en tu propio VPS. Fuera de esta fase quedan: email real por Resend, PDF en servidor con Puppeteer, importador BC3/Excel de precios, Verifactu y PWA/Android.

## Requisitos

- Node.js 20+
- Docker y Docker Compose (solo para Postgres en desarrollo local, y para el despliegue en VPS — no hace falta para el despliegue gratis en Vercel)

## Desarrollo local

```bash
cp .env.example .env          # rellena NEXTAUTH_SECRET y GEMINI_API_KEY
npm install
docker compose -f docker-compose.dev.yml up -d   # solo Postgres
npm run db:migrate
npm run dev
```

Abre http://localhost:3000 — como la base de datos está vacía, te llevará directo a **la pantalla de primer arranque** para crear tu cuenta de administrador y los datos de tu empresa (ver más abajo). Esa pantalla desaparece en cuanto existe el primer usuario; a partir de ahí entras por `/login` y el resto de usuarios se crean desde **Equipo**.

Si además quieres datos de ejemplo (proveedores, catálogo de precios, un cliente) para trastear en local, `npm run db:seed` los añade — no crea usuarios si ya tienes uno, y si la base está vacía crea también dos usuarios de prueba imprimiendo sus contraseñas temporales por consola.

Genera `NEXTAUTH_SECRET` con `openssl rand -base64 32`. Consigue `GEMINI_API_KEY` en aistudio.google.com/apikey (capa gratuita) — sin ella, el asistente IA de presupuestos no funcionará (el resto de la app sí).

### ⚠️ Nunca uses la base de datos de producción como "shadow database"

`prisma migrate diff --from-migrations` y `prisma migrate dev` **vacían** la base que
se les pasa en `--shadow-database-url`: la borran entera y reproducen las migraciones
encima para calcular el diff. Apuntar ahí a producción destruye todos los datos, sin
preguntar y sin aviso previo. Ya pasó una vez en este proyecto.

Para eso está la base local de Docker, que es desechable:

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://reformapro:reformapro@localhost:5432/shadow" \
  --script > prisma/migrations/<fecha>_<nombre>/migration.sql
```

Y sobre producción, dos reglas:

1. **Mira antes de tocar.** Cuenta las filas de las tablas principales; si salen a
   cero cuando esperabas datos, para y averigua por qué antes de seguir.
2. **Revisa el SQL antes de commitearlo.** Comprueba que solo contiene
   `CREATE`/`ALTER ... ADD` y que no hay ningún `DROP` ni `ALTER ... DROP`.

### Cómo se aplican las migraciones en producción

Las aplica el despliegue: `prebuild` ejecuta `scripts/migrar.mjs`, que llama a
`prisma migrate deploy` **solo cuando corre en Vercel**. En local no hace nada, para
que un `npm run build` de comprobación no escriba en tu base de datos de trabajo.

Esto no contradice la regla 2. `migrate deploy` **no genera SQL**: ejecuta en orden
los ficheros de `prisma/migrations` que ya están escritos y revisados a mano. Los
comandos que sí deciden por su cuenta —`migrate dev`, `db push` y sobre todo
`migrate diff --shadow-database-url`— siguen sin tocar producción jamás. Lo que se
automatiza es el paso mecánico de aplicar, que hacerlo a mano cada vez es
precisamente donde se cometió el error que vació la base de datos.

Requisito: **`DIRECT_URL` tiene que estar en las variables de entorno de Vercel**
(la cadena "direct"/"unpooled" de Neon; las migraciones no pueden ir por el pooler).
Si falta, el build se detiene con un mensaje explicando por qué, en lugar de
desplegar código nuevo contra un esquema antiguo.

## Despliegue gratis (Vercel + Neon)

Vía sin coste: hosting en Vercel (gratis para este volumen) + Postgres en Neon (capa gratuita) + subdominio gratis tipo `tu-proyecto.vercel.app`. No hace falta Docker para esto — Vercel construye directo desde el repositorio de Git.

1. **Sube el código a GitHub**: crea una cuenta en github.com si no tienes, crea un repositorio nuevo (puede ser privado) y sube este proyecto:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/reformapro.git
   git branch -M main
   git push -u origin main
   ```
2. **Crea la base de datos en Neon**: cuenta gratis en neon.tech → "New Project". Te da dos cadenas de conexión distintas — cópialas, las necesitas en el paso siguiente:
   - La que tiene `-pooler` en el host → es tu `DATABASE_URL`.
   - La que NO lleva `-pooler` → es tu `DIRECT_URL`.
3. **Crea el proyecto en Vercel**: cuenta gratis en vercel.com (puedes entrar con tu cuenta de GitHub) → "Add New Project" → importa el repositorio que acabas de subir.
4. **Variables de entorno** (en la pantalla de configuración del proyecto, antes de darle a "Deploy", o después en Settings → Environment Variables):
   - `DATABASE_URL` y `DIRECT_URL` — las de Neon del paso 2.
   - `NEXTAUTH_SECRET` — genera uno con `openssl rand -base64 32`.
   - `NEXTAUTH_URL` — la URL que te va a dar Vercel, tipo `https://reformapro.vercel.app` (si no la sabes aún, despliega una vez, cópiala de la pantalla del proyecto, y vuelve a poner esta variable con el valor correcto).
   - `GEMINI_API_KEY` — la de aistudio.google.com/apikey.
5. **Build Command**: en Settings → Build & Development Settings, cambia el comando de build a:
   ```
   npx prisma migrate deploy && npm run build
   ```
   Así cada vez que subas cambios de esquema, se aplican solos antes de construir la app (igual que hace el contenedor Docker en la vía del VPS).
6. Dale a **Deploy**. Cuando termine, abre la URL `https://tu-proyecto.vercel.app`: al no haber ningún usuario, te lleva directo a la pantalla de primer arranque para crear tu cuenta de administrador y los datos de tu empresa.
7. Para actualizar la app más adelante: `git push` a `main` — Vercel despliega solo con cada push.
8. Si más adelante quieres un dominio propio en vez del subdominio gratis: cómpralo donde quieras (Namecheap, Porkbun, nic.es para `.es`...) y añádelo en Vercel → Settings → Domains. Solo cambia el dominio, nada del código.

**Límites de la capa gratuita** a tener en cuenta: Neon pausa la base de datos tras un rato sin uso (se reactiva sola en el primer request siguiente, con un pequeño retraso de un par de segundos) y tiene un tope de almacenamiento (0.5 GB, de sobra para años de presupuestos y facturas de un negocio pequeño). Vercel gratis no admite uso comercial de alto tráfico, pero para el uso normal de una reformista esto no se acerca ni de lejos al límite.

## Despliegue en tu VPS

1. Contrata un VPS (Hetzner, OVH, Contabo — 2 vCPU / 4 GB sobra), Ubuntu 24.04, y apunta un registro A de tu dominio a su IP.
2. Instala Docker: `curl -fsSL https://get.docker.com | sh`
3. Clona este repositorio en el servidor.
4. Copia `.env.example` a `.env` y rellena TODOS los valores reales: `DATABASE_URL` no hace falta tocarlo en producción (lo arma `docker-compose.yml` con `POSTGRES_*`), pero sí `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (`https://tudominio.es`), `GEMINI_API_KEY` y `DOMAIN`.
5. Edita `Caddyfile` si quieres añadir tu email para Let's Encrypt u otras opciones (por defecto usa `{$DOMAIN}` del `.env`).
6. Levanta todo:
   ```bash
   docker compose up -d --build
   ```
   Esto construye la imagen de la app, levanta Postgres, aplica las migraciones (`prisma migrate deploy` corre automáticamente al arrancar el contenedor `app`) y expone la app por HTTPS vía Caddy con certificado automático.
7. Abre `https://tudominio.es`: al no haber ningún usuario todavía, la app te lleva directo a la pantalla de primer arranque para crear tu cuenta de administrador (con tu propia contraseña) y los datos fiscales de tu empresa. No hace falta ejecutar nada a mano ni recordar contraseñas generadas — esa pantalla solo aparece una vez y luego desaparece.
8. Para actualizar tras cambios:
   ```bash
   git pull && docker compose up -d --build
   ```
9. Copias de seguridad: programa un cron diario con `pg_dump` (ver la guía de despliegue) y súbelo a otro sitio (Backblaze B2, otro servidor). No es opcional — ahí van las facturas.
10. Seguridad básica: firewall (`ufw` permitiendo solo 22, 80, 443), SSH solo con clave, `fail2ban`.

## Estructura del proyecto

- `app/setup` — pantalla de primer arranque (crea el admin inicial + datos de empresa); se autodeshabilita en cuanto existe un usuario.
- `app/(app)/*` — páginas protegidas (panel, clientes, precios, presupuestos, facturas, equipo, empresa), cada una con su `actions.ts` de Server Actions.
- `app/api/generar-presupuesto` — única ruta que llama a un proveedor de IA (Gemini Flash, capa gratuita), server-side; la clave nunca llega al navegador.
- `app/api/auth/[...nextauth]` — login con NextAuth (Credentials + bcrypt).
- `prisma/schema.prisma` / `prisma/seed.ts` — modelo de datos y datos iniciales.
- `lib/` — helpers compartidos (Prisma client, sesión/roles, numeración de presupuestos/facturas, formato, exportación a PDF/Word/Excel).
- `components/` — `SignaturePad` (firma en canvas) y `WizardIA` (asistente IA), ambos client components.

## Partes de trabajo y el código de ERP

Un **parte de trabajo** (`/partes`) registra lo que de verdad ha pasado en una
visita: horas por técnico, trabajo realizado, material puesto y fotos. No es un
presupuesto —eso se estima antes de la obra— ni una factura —eso la emite el
programa de facturación del cliente—.

**El material lo rellena el técnico, y no hay ninguna IA en este módulo.** Es
deliberado: nadie más sabe qué material ha entrado en la obra, y una IA
"proponiendo" material sería inventarlo. Lo que sí hace la aplicación es
ofrecerle el catálogo propio de la empresa, para que lo elija con su precio ya
puesto en vez de teclearlo.

### Por qué NO hay integración automática con ExitERP

Hay un campo `codigoErp` en los partes y en los clientes, y una columna propia
en la exportación a Excel. Lo que **no** hay es una sincronización en vivo, y no
es por falta de ganas:

- ExitERP no publica una API documentada con la que esta aplicación pueda
  hablar. Sin sus documentos, sus credenciales de prueba o su cooperación, no
  hay nada real que construir.
- Escribir un conector "a ciegas" contra un formato que no se puede probar es
  peor que no tenerlo: parece que funciona hasta el día en que un cliente
  descubre que los datos no cuadran.

Lo que **sí** funciona hoy, que es la misma solución que ya se tomó para
facturación: el código se anota (a mano, o se deja vacío y se rellena después) y
la exportación a Excel lo saca en su propia columna. Administración cruza los
partes por ese código en lugar de teclearlos otra vez.

Si algún día se consigue documentación de ExitERP, el sitio donde engancharla ya
está preparado: el campo existe, viaja en las exportaciones y tiene índice.

## Roles

- **Admin**: todo, incluida facturación, equipo y datos de empresa.
- **Empleado**: clientes, precios y presupuestos, sin acceso a facturación/equipo/empresa ni permiso de borrado. La restricción se aplica tanto en la interfaz como dentro de cada Server Action (no es solo cosmética).

## Multi-empresa: cómo se aísla cada cliente

Cada empresa que se registra tiene sus propios datos, invisibles para las demás. Como una sola consulta sin filtrar bastaría para filtrar datos entre clientes —y no daría ningún error, solo devolvería de más—, el aislamiento no depende de acordarse de escribir el filtro:

| Capa | Qué impide |
|---|---|
| `lib/prisma.ts` exporta `prismaUnsafe` | El nombre avisa. El cliente normal ni siquiera existe. |
| `lib/tenantDb.ts` | Inyecta el filtro de empresa en cada consulta y **prohíbe** `findUnique`/`update`/`delete`/`upsert`, que no admiten filtro y son las que reciben ids del navegador. |
| Claves foráneas compuestas `(id, empresaId)` | Es **Postgres** quien impide referenciar datos de otra empresa, aunque el código fallara. |
| `scripts/check-tenant-scope.mjs` (en `prebuild`) | Rompe el despliegue si alguien usa el cliente sin filtrar o cuela una operación prohibida. |

La única forma de consultar datos es `requireTenant()`, que no puede devolver nada sin empresa:

```ts
const { user, empresaId, db } = await requireTenant();
const clientes = await db.cliente.findMany(); // solo los de esta empresa
```

Para comprobarlo (contra una base de datos **de pruebas**, borra datos):

```bash
npm run test:aislamiento
```

Monta dos empresas e intenta leer y modificar los datos de una desde la otra: 38 comprobaciones que deben pasar todas.

## Alta de nuevos clientes

- La portada ofrece **«Crear cuenta»** e **«Iniciar sesión»**.
- Cada alta crea una empresa nueva con 14 días de prueba.
- Mientras `REGISTRO_CODIGO` tenga valor, el registro pide ese código. Bórrala para abrir el alta a cualquiera.
- Hay límite de altas por IP (guardado en base de datos, porque en Vercel un contador en memoria no serviría) y campo trampa anti-bots.

## Email

`lib/email.ts` funciona con **Brevo** (`BREVO_API_KEY`) o **Resend** (`RESEND_API_KEY`). Sin ninguno, los correos se escriben por consola, lo que basta para desarrollo.

Para producción sin dominio propio, usa **Brevo**: permite verificar una única dirección remitente (tu Gmail). Resend exige verificar un dominio entero, así que solo sirve si compras uno.
