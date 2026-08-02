# Seguridad de ReformaPro

Estado a 2 de agosto de 2026. Este documento dice lo que está cubierto **y lo que
no**, porque un documento de seguridad que solo cuenta lo bueno no sirve para
tomar decisiones.

## Qué protege qué

| Riesgo | Dónde se ataja |
|---|---|
| Que una empresa vea datos de otra | `lib/tenantDb.ts` — el filtro por empresa se inyecta en el cliente de base de datos y las tablas se derivan del esquema, así que una tabla nueva queda protegida por existir |
| Que se escriba con la cuenta vencida | `lib/tenantDb.ts` — las operaciones de escritura se bloquean en el mismo sitio |
| Fuerza bruta contra el login | `lib/auth.ts` + `lib/limite.ts` — 5 intentos fallidos por email y 20 por IP cada 15 min |
| Vaciar el cupo de IA | `lib/limite.ts` — 60 llamadas por hora y empresa en las seis rutas de IA |
| Altas masivas | `app/registro/actions.ts` — 3 por IP y 30 globales cada hora, más código de invitación |
| Clickjacking | `frame-ancestors 'none'` y `X-Frame-Options` |
| XSS | CSP en `next.config.js`; `connect-src 'self'` impide que un script inyectado saque datos fuera |
| Adivinar el feed de calendario | Token aleatorio de 32 bytes, y se rechaza sin tocar la base de datos si es corto |
| Instrucciones escondidas en el texto del usuario | `comoDato()` en `lib/gemini.ts`, y sobre todo la validación de la salida contra listas cerradas |
| Que una migración destruya datos | Se escriben a mano, se revisan y solo se aplican con `prisma migrate deploy` desde el despliegue |

Además: las claves de IA solo existen en el servidor, el navegador nunca habla
con Google directamente; las contraseñas van con bcrypt; los tokens de
recuperación se guardan hasheados; y las IP se cuentan hasheadas con un secreto,
nunca en claro.

## Lo que NO está resuelto

### 1. Next.js 14.2.35 acumula avisos de seguridad sin parche en su rama

`npm audit` lista una veintena de avisos para Next 14. **Ya estamos en la última
14.2.x que existe**: no hay parche dentro de la rama. El arreglo pasa por saltar
a Next 16, que es un cambio mayor — en Next 15 `headers()`, `cookies()` y los
`params` de las páginas pasaron a ser asíncronos, y esta aplicación los usa de
forma síncrona en varios sitios.

Atenuantes reales, sin exagerarlos: buena parte de esos avisos son de denegación
de servicio o envenenamiento de caché en escenarios de *self-hosting*, con
`next/image` o con reescrituras, y esta aplicación se sirve desde Vercel, no usa
el optimizador de imágenes y no tiene reescrituras. Pero no todos aplican solo a
eso, y quedarse en una versión sin soporte de seguridad no es sostenible.

**Pendiente:** migrar a Next 16 como tarea propia, con su repaso y sus pruebas.
No es algo que deba colarse dentro de otro cambio.

### 2. `xlsx` (SheetJS) 0.18.5, sin versión corregida en npm

Dos avisos: contaminación de prototipos y ReDoS. npm dice "no fix available"
porque SheetJS dejó de publicar en npm y sus versiones nuevas están en su propio
CDN.

**Por qué aquí el riesgo es muy bajo:** esta aplicación solo **escribe** hojas de
cálculo (`aoa_to_sheet`, `book_new`, `book_append_sheet`, `writeFile`). No abre
ni analiza ninguna, y los dos avisos están en el camino de lectura. Para que
afectaran habría que darle a la librería un archivo ajeno, cosa que no ocurre en
ningún punto del código.

**Pendiente:** si algún día se añade importación de Excel —por ejemplo cargar
precios desde un listado del proveedor—, esto deja de ser inofensivo y hay que
pasar a la distribución del CDN de SheetJS **antes** de escribir esa función.

### 3. La CSP admite `unsafe-inline` en los scripts

Next.js inyecta scripts en línea para hidratar la página. Hacerlo bien exige un
*nonce* por petición, lo que obliga a renderizar toda la aplicación en dinámico y
a reescribir la cabecera desde el middleware. Queda como la siguiente vuelta de
tuerca; mientras tanto, `connect-src 'self'`, `form-action 'self'` y
`object-src 'none'` recortan bastante lo que un script inyectado podría hacer.

## Cómo se comprueba

```bash
npm run test:aislamiento    # 58 comprobaciones de que una empresa no alcanza otra
npm run test:todo           # reglas de negocio: precios, diagnóstico, plazos, suscripción, facturación
```

El aislamiento se comprueba **contra una base de datos real** y recorre todas las
tablas del esquema, no una lista escrita a mano. Esa lista escrita a mano ya
falló una vez: al añadir las obras no se actualizó y una empresa vio las obras de
otra durante unas horas.
