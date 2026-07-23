# ReformaPro

Gestión de presupuestos para reformistas: clientes, catálogo de precios por proveedor, presupuestos con capítulos y asistente IA, firma del cliente, facturas y control de acceso por roles (admin/empleado).

Fase 1 de la puesta en producción: Next.js 14 + PostgreSQL + Prisma + NextAuth, con Docker listo para desplegar. Fuera de esta fase quedan: email real por Resend, PDF en servidor con Puppeteer, importador BC3/Excel de precios, Verifactu y PWA/Android.

## Requisitos

- Node.js 20+
- Docker y Docker Compose (para Postgres local y para el despliegue en el VPS)

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

## Roles

- **Admin**: todo, incluida facturación, equipo y datos de empresa.
- **Empleado**: clientes, precios y presupuestos, sin acceso a facturación/equipo/empresa ni permiso de borrado. La restricción se aplica tanto en la interfaz como dentro de cada Server Action (no es solo cosmética).
