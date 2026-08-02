/**
 * Service worker de ReformaPro.
 *
 * QUÉ HACE Y QUÉ NO, porque aquí es fácil prometer de más:
 *
 *   SÍ: que la aplicación abra al instante aunque la cobertura sea mala, y que
 *   al quedarse sin red aparezca una pantalla que lo explica en vez del dinosaurio
 *   del navegador.
 *
 *   NO: trabajar sin conexión. Los presupuestos, las obras y los informes viven
 *   en el servidor y se generan en cada visita. Sin red no hay datos, y fingir lo
 *   contrario sería peor que no tener nada.
 *
 * LO QUE NUNCA SE GUARDA EN CACHÉ, y es la decisión importante de este fichero:
 * ni el HTML de las páginas con sesión, ni ninguna respuesta de /api. En una obra
 * se comparte tablet, y una página cacheada le enseñaría al siguiente los datos
 * del anterior. Solo se guardan los archivos de compilación, que son públicos,
 * inmutables y no contienen datos de nadie.
 */

// Subir la versión invalida la caché entera. Cambiar este número es la forma de
// forzar que todos los dispositivos suelten lo viejo.
const VERSION = "v1";
const CACHE = `reformapro-${VERSION}`;
const SIN_CONEXION = "/sin-conexion";

const IMPRESCINDIBLES = [SIN_CONEXION, "/icono-192.png", "/icono-512.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(IMPRESCINDIBLES))
      // Entra en servicio sin esperar a que se cierren las pestañas abiertas.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Archivos de compilación: mismo origen, inmutables y sin datos de nadie. */
function esEstatico(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      /\.(png|svg|ico|woff2?)$/.test(url.pathname))
  );
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  // NUNCA la API: respuestas con datos de una empresa concreta, y además las hay
  // que cambian cada vez (el calendario, el estado de la suscripción).
  if (url.pathname.startsWith("/api/")) return;

  if (esEstatico(url)) {
    // Los archivos de /_next/static llevan un hash en el nombre: si está en
    // caché es exactamente el mismo archivo, así que se sirve sin preguntar.
    evento.respondWith(
      caches.match(peticion).then(
        (guardado) =>
          guardado ||
          fetch(peticion).then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(CACHE).then((c) => c.put(peticion, copia));
            }
            return respuesta;
          })
      )
    );
    return;
  }

  // Navegación: SIEMPRE a la red. Lo que se ve tiene que ser lo que hay en el
  // servidor, nunca una copia vieja. Si no hay red, la pantalla de sin conexión.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion).catch(() => caches.match(SIN_CONEXION).then((r) => r || Response.error()))
    );
  }
});
