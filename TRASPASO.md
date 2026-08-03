# Traspaso de ReformaPro a otra cuenta

Este documento existe porque **la conversación no se lleva**. Al cambiar de cuenta de
Claude se pierde el hilo entero: lo que se decidió, lo que se rompió y por qué está
hecho como está. El código viaja solo (está en GitHub); lo que se pierde es el
criterio, y eso es lo que hay escrito aquí.

Léelo entero antes de tocar nada. Son diez minutos y evita repetir errores que ya
costaron caros.

---

## 1. Lo primero: esto NO está en Claude

El proyecto no vive en ninguna cuenta de Claude. Vive en cuatro sitios que son
tuyos y que **no hay que migrar, solo saber entrar**:

| Servicio | Para qué | Qué cuenta |
|---|---|---|
| **GitHub** | El código | `cloudimoia-sys/reformapro` |
| **Vercel** | Donde corre la app | Proyecto conectado a ese repo, despliega solo con cada `git push` |
| **Neon** | La base de datos PostgreSQL | Con datos reales de clientes dentro |
| **Google AI Studio** | La clave de Gemini | Capa gratuita, pendiente de pasar a pago |
| **Brevo** *(opcional)* | Envío de correos de "recuperar contraseña" | Solo si está configurado |

Cambiar de cuenta de Claude **no afecta a ninguno de estos**. La app en producción
sigue funcionando aunque no vuelvas a abrir Claude nunca.

Lo único que se pierde al cambiar de cuenta es el historial de la conversación.
Por eso este fichero.

---

## 2. Arrancarlo desde cero en otra máquina

```bash
git clone https://github.com/cloudimoia-sys/reformapro.git
cd reformapro
npm install
```

Luego copia `.env.example` a `.env` y rellénalo. **Los valores reales de producción
están en Vercel** → proyecto ReformaPro → Settings → Environment Variables. Ahí se
pueden ver y copiar.

Para desarrollo local hace falta una base de datos aparte (nunca la de producción):

```bash
docker compose -f docker-compose.dev.yml up -d
npm run db:migrate
npm run dev
```

Requisitos: **Node 20 o superior** (aquí se usó Node 24), Docker solo para la base
local.

### Variables de entorno, una por una

| Variable | Obligatoria | Qué pasa si falta |
|---|---|---|
| `DATABASE_URL` | Sí | Nada funciona. En Neon es la cadena que lleva `-pooler` en el host |
| `DIRECT_URL` | Sí | Las migraciones fallan. Es la cadena **sin** `-pooler` |
| `NEXTAUTH_SECRET` | Sí | No se puede iniciar sesión. Se genera con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Sí | Ver la advertencia de abajo — está puesta pero el código ya no depende de ella |
| `GEMINI_API_KEY` | Sí | El asistente de IA no genera nada; el resto de la app sí funciona |
| `GEMINI_MODEL` | No | Por defecto `gemini-3.5-flash-lite`. **Nunca pongas un alias `-latest`** |
| `REGISTRO_CODIGO` | No | Si tiene valor, el registro pide ese código. Si se borra, el registro queda abierto a cualquiera |
| `ADMIN_EMAIL` | Sí, para administrar | Si está vacía **no entra nadie** al panel de suscripciones. El fallo por defecto es negar |
| `BREVO_API_KEY` o `RESEND_API_KEY` | No | Los correos de recuperar contraseña se escriben por consola en vez de enviarse |
| `EMAIL_REMITENTE` | Si envías correo | Tiene que ser una dirección verificada en Brevo/Resend |

---

## 3. Las reglas que no se negocian

Cada una de estas está aquí porque **ya se rompió una vez**. No son estilo, son
cicatrices.

### 3.1 Lo que tiene que ser correcto se escribe en código, no en el prompt

Es el principio que ordena todo el proyecto. La IA redacta prosa sobre datos que le
da el programa; **no calcula, no decide precios y no elige qué trabajos entran**.

Se demostró con evidencia: el mismo prompt, dos veces, dio dos resultados distintos
— uno correcto y otro con 630 € de trabajo inventado. La conclusión fue que el
arreglo va en el código, no en cambiar de modelo. Si en algún momento alguien
propone "mejorarlo tocando el prompt", ese es el debate que ya se tuvo.

Dónde vive esa lógica:

- `lib/baremo.ts` — precios de referencia
- `lib/calculos.ts` — mediciones y superficies
- `lib/revision.ts` — los avisos que detectan trabajo no pedido, acabados
  incompatibles, paredes imposiblemente cortas, descripciones vacías
- `lib/patologias.ts` — catálogo **cerrado** de 24 patologías. Al modelo solo se le
  dan los identificadores y las señales visibles: nunca las causas ni las
  reparaciones, para que no las recite sin haberlas visto
- `lib/diagnostico.ts` — reglas de contexto que reordenan candidatos
- `lib/festivos.ts`, `lib/planificacion.ts` — calendario laboral y plazos
- `lib/normativa.ts` — 15 referencias normativas **pendientes de validar por un técnico**

### 3.2 Un aviso que salta cuando no toca es peor que no tener aviso

Enseña al usuario a ignorarlos todos. Por eso **la mitad de las pruebas son
negativas**: comprueban que el aviso NO salta en un caso correcto.

Si añades una regla nueva a `lib/revision.ts`, añade las dos pruebas: la que
comprueba que salta cuando debe y la que comprueba que se calla cuando no.

### 3.3 Nunca uses la base de producción como "shadow database"

`prisma migrate dev` y `prisma migrate diff --shadow-database-url` **vacían** la base
que se les pasa. La borran entera, sin preguntar. Ya pasó una vez en este proyecto.
Para eso está la base local de Docker, que es desechable.

### 3.4 El aislamiento entre empresas no se hace a mano

Esto es lo más grave que puede fallar: que un cliente vea los datos de otro.

Prisma trata `where: { empresaId: undefined }` como "sin filtro" y **devuelve la
tabla entera sin dar ningún error**. Por eso no se filtra a mano en cada consulta —
un olvido no daría error, solo una fuga silenciosa.

Cómo está resuelto, en cuatro capas:

1. `lib/prisma.ts` se exporta como `prismaUnsafe`, con un nombre incómodo a propósito
2. `lib/tenantDb.ts` es una extensión de Prisma que inyecta `empresaId` sola. La
   lista de modelos con inquilino **se deriva de `Prisma.dmmf`**, no se escribe a
   mano — precisamente porque escribirla a mano ya provocó una fuga: se añadieron
   los modelos `Obra` y `Fase` y nadie actualizó la lista
3. Claves foráneas compuestas `(id, empresaId)` en Postgres, para que apuntar a otra
   empresa sea imposible aunque el código falle
4. `scripts/check-tenant-scope.mjs` corre en `prebuild` y **tumba el despliegue** si
   alguien usa `prismaUnsafe` fuera de la lista blanca

La prueba `npm run test:aislamiento` (58 comprobaciones) barre **todas** las tablas
del esquema. Se verificó que detecta una fuga reintroducida a propósito.

### 3.5 En producción, los errores de las server actions se borran

Next.js sustituye el mensaje de las excepciones por un identificador opaco. Si una
acción lanza, el usuario ve "algo ha fallado" y nadie sabe qué.

Por eso las acciones **devuelven el error como valor**, no lo lanzan. Mira el patrón
`Resultado` / `ejecutar` / `fallo()` en `lib/accion.ts`.

### 3.6 Esta app NO emite facturas, y no debe empezar a hacerlo

Emitir facturas en España es actividad regulada (Verifactu). La sanción por
comercializar software no conforme **recae sobre quien lo vende: hasta 150.000 € por
año**.

Lo que genera la app es un **parte de obra ejecutada** (serie `ALB-`, de albarán):
el detalle de lo hecho, medido y valorado, para que la factura la emita el programa
de facturación del cliente. Salida principal: **Excel**. Facturae (XML) existe pero
es secundario — algunos programas lo importan y otros ni lo miran.

Si alguien propone "ya que estamos, que emita la factura": no. Ese es el único
cambio del proyecto que puede acabar en sanción.

### 3.7 Cosas pequeñas que costaron una tarde cada una

- **El service worker no debe cachear HTML autenticado ni respuestas de la API.**
  Cachearlas sirve la pantalla de un usuario a otro
- **`headers()` y los `params` de ruta son `async`** desde Next 15
- **CSP:** nada de `@import` a fuentes externas en el CSS. Las tipografías se
  autoalojan con `next/font`. `scripts/check-csp.mjs` lo vigila
- **Escapado:** `lib/docExport.ts` escribe HTML en una ventana del mismo origen. Todo
  lo interpolado pasa por `esc()`. `scripts/check-escape.mjs` lo vigila, y encontró
  un sitio que se había escapado a mano
- **Límites de peticiones contra base de datos, no en memoria.** En serverless no hay
  memoria compartida entre invocaciones
- **`NEXTAUTH_URL` estuvo mal configurada** y rompió en silencio la recuperación de
  contraseña, además de mandar el "cerrar sesión" a la pantalla de Vercel. El código
  ya no depende de esa variable: `lib/urlBase.ts` construye las URLs desde
  `x-forwarded-host`

---

## 4. Verificar que nada se ha roto

```bash
npm run test:todo
```

152 comprobaciones, sin base de datos. Cubre presupuestos, precios, sobrantes,
completitud, diagnóstico, planificación, suscripciones y facturación.

```bash
npm run test:aislamiento
```

Aparte porque necesita base de datos. **Úsala contra una rama de Neon desechable,
nunca contra producción.**

```bash
npm run build
```

El `prebuild` corre los tres guardianes (`check-tenant-scope`, `check-csp`,
`check-escape`) y aplica migraciones. Si el build pasa, esos tres han pasado.

Los PDF comerciales se regeneran con Python + reportlab:

```bash
python scripts/generar-guia.py && python scripts/generar-folleto.py
```

**Míralos siempre después de generarlos.** El texto grande se solapa si el `leading`
del `ParagraphStyle` no acompaña al tamaño de fuente — pasó tres veces.

---

## 5. Estado actual y qué queda

**Funcionando en producción** (`reformapro.vercel.app`): multiempresa con aislamiento
verificado, registro con código de invitación, recuperar contraseña, presupuestos con
asistente de IA y catálogo propio, guardar precios corregidos al catálogo, informes,
diagnóstico por foto, planificación con calendario y feed `.ics`, partes de obra a
Excel, suscripciones con prueba de 14 días, PWA instalable, cabeceras de seguridad y
freno a la fuerza bruta.

**Pendiente, por orden de urgencia:**

1. **Pasar Gemini a clave de pago** antes del primer cliente que pague. La capa
   gratuita tiene cupo por proyecto y lo comparten todas las empresas dadas de alta:
   con dos clientes activos se agota y el asistente deja de responder para todos
2. **`ADMIN_EMAIL` en Vercel**, y redesplegar para que tome efecto
3. **Que un técnico valide las 15 entradas de `lib/normativa.ts`** antes de que nadie
   firme nada basándose en ellas
4. **Consultar Verifactu con un asesor**, para confirmar por escrito que la app queda
   fuera del ámbito al no emitir facturas
5. **Stripe**, cuando haya 10-15 clientes. Hoy las altas se activan a mano desde el
   panel de suscripciones
6. **Licitaciones** — aparcado por decisión propia
7. **`README.md` está desactualizado**: dice Next.js 14 (es 16), menciona una pantalla
   `/setup` que ya no existe y da por pendientes cosas ya hechas

**Precios acordados** (en `scripts/generar-folleto.py`, como constantes arriba del
todo): Básico 19 €/mes, Pro 39 €/mes; precio fundador 15 € y 30 € para los 10
primeros; anual = 10 meses; prueba de 14 días.

---

## 6. Cómo arrancar la primera conversación en la cuenta nueva

Clona el repo, abre Claude Code en la carpeta y pega esto:

> Este es ReformaPro, un SaaS en español para empresas de reformas, ya en producción
> en reformapro.vercel.app. Vengo de otra cuenta y no tienes el historial.
>
> **Lee `TRASPASO.md` entero antes de proponer nada**, y después `SEGURIDAD.md`. En
> `TRASPASO.md` está el criterio del proyecto: qué está resuelto, qué se rompió antes
> y qué reglas no se tocan. La más importante: lo que tiene que ser correcto se
> escribe en código, no en el prompt de la IA.
>
> Cuando lo tengas leído, dime en qué estado ves el proyecto y qué harías tú primero.

Y una advertencia de método, que en este proyecto valió más que cualquier otra cosa:
**cada defecto que aparezca en un presupuesto real se convierte en una regla en
código y en dos pruebas** — la que comprueba que salta y la que comprueba que se
calla cuando no toca. Así es como se llegó a 152 comprobaciones sin escribir una
sola prueba de relleno.
