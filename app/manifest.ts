import type { MetadataRoute } from "next";

/**
 * Manifiesto de la aplicación instalable.
 *
 * Con esto, el navegador ofrece "instalar" y ReformaPro queda como un icono más
 * en el móvil, a pantalla completa y sin barra de direcciones. No hace falta
 * pasar por Google Play ni por la App Store: ni cuota anual, ni revisión, ni
 * esperar a que aprueben cada cambio.
 *
 * Los accesos directos son los cuatro sitios a los que se va desde la obra, para
 * llegar en un toque desde el icono mantenido pulsado.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReformaPro — presupuestos y obra",
    short_name: "ReformaPro",
    description:
      "Presupuestos con IA, informes técnicos, diagnóstico de patologías y planificación de obra para reformistas.",
    start_url: "/panel",
    // Si no hay sesión, /panel manda al login: se entra por donde se trabaja.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F1F3F2",
    theme_color: "#1D4E6B",
    lang: "es-ES",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // El "maskable" lleva margen: Android recorta el icono en círculo y sin ese
      // margen se comería las esquinas del dibujo.
      { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nuevo presupuesto", short_name: "Presupuesto", url: "/presupuestos" },
      { name: "Diagnóstico por foto", short_name: "Diagnóstico", url: "/diagnostico" },
      { name: "Obras", short_name: "Obras", url: "/obras" },
      { name: "Copiloto técnico", short_name: "Copiloto", url: "/copiloto" },
    ],
  };
}
