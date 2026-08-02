/**
 * Cabeceras de seguridad.
 *
 * Este fichero estaba vacío: la aplicación se servía sin una sola cabecera de
 * seguridad. Eso deja la puerta abierta a que la metan en un iframe para engañar
 * al usuario (clickjacking), a que el navegador adivine tipos de archivo, y a que
 * cualquier script inyectado pueda hablar con donde le dé la gana.
 *
 * SOBRE LA CSP, que es la que de verdad limita el daño de un XSS:
 *
 *   - `script-src` lleva 'unsafe-inline' porque Next.js inyecta scripts en línea
 *     para hidratar la página. Lo correcto sería un nonce por petición, pero eso
 *     obliga a renderizar TODA la app en dinámico y a un middleware que reescriba
 *     la cabecera en cada respuesta. Queda anotado como la siguiente vuelta de
 *     tuerca; aun así el resto de directivas recorta mucho lo que un script
 *     inyectado podría llegar a hacer.
 *   - `connect-src 'self'`: la app solo habla con su propio servidor. Las
 *     llamadas a Gemini salen del servidor, nunca del navegador, así que un
 *     script inyectado no tiene a dónde mandarse los datos.
 *   - `img-src` admite data: y blob: porque las fotos de obra, los logos y las
 *     firmas viajan como data URL, y las descargas se generan como blob.
 *   - `frame-ancestors 'none'` es lo que impide el clickjacking de verdad;
 *     X-Frame-Options se mantiene por los navegadores viejos que no la entienden.
 *   - `form-action 'self'` evita que un formulario inyectado mande las
 *     credenciales a otro dominio.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const CABECERAS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // La URL de un presupuesto lleva su id dentro: no tiene por qué viajar entera
  // a otros sitios cuando se pincha un enlace externo.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Micrófono y cámara SÍ se usan (dictado y fotos de obra), así que se permiten
  // para el propio origen y se niegan para cualquier cosa incrustada.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  },
  // Dos años y subdominios: el navegador no vuelve por HTTP nunca más.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No anunciar que esto es Next. No protege por sí solo, pero tampoco hay razón
  // para regalar la versión del framework a quien pase por ahí.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: CABECERAS },
      {
        // El feed de calendario lo lee Google, no un navegador: la CSP no le
        // aplica, y en cambio sí interesa que no lo indexe nadie.
        source: "/api/calendario/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

module.exports = nextConfig;
