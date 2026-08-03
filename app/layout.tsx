import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

/**
 * Las fuentes se sirven desde nuestro propio dominio, no desde Google.
 *
 * Antes globals.css hacía `@import url(fonts.googleapis.com...)`, y al poner la
 * CSP eso quedó bloqueado: la aplicación estuvo un rato en producción con la
 * tipografía caída a la de sistema. Se arregla bien, no relajando la CSP:
 * `next/font` descarga las fuentes al construir y las sirve desde `/_next`, así
 * que en tiempo de ejecución no hay ni una petición a terceros.
 *
 * De paso se gana lo obvio —una conexión menos, sin salto de tipografía— y se
 * quita de en medio que Google registre la IP de cada visitante.
 */
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReformaPro",
  description: "Presupuestos, informes técnicos y planificación de obra para reformistas",
  manifest: "/manifest.webmanifest",
  applicationName: "ReformaPro",
  appleWebApp: {
    capable: true,
    title: "ReformaPro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icono-180.png", sizes: "180x180", type: "image/png" }],
  },
  // Que el móvil no convierta en enlaces de llamada los números de un presupuesto.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1D4E6B",
  width: "device-width",
  initialScale: 1,
  // Para que en un móvil con muesca el azul de la barra llegue hasta el borde.
  viewportFit: "cover",
};

/**
 * Arranque de la instalación, en línea y en TODAS las páginas.
 *
 * Dos motivos para que esté aquí y no dentro del componente de React:
 *
 *  1. El service worker se registraba solo después de entrar, dentro del área
 *     con sesión. Pero el navegador decide si una web es instalable AL CARGAR la
 *     página, y la primera que carga cualquiera es /login: sin service worker en
 *     ese momento, no la daba por instalable y no ofrecía instalar nunca.
 *
 *  2. `beforeinstallprompt` se dispara muy pronto, normalmente antes de que
 *     React haya hidratado. Si el único que escucha es un componente, el evento
 *     ya ha pasado cuando llega. Aquí se guarda en cuanto ocurre y el componente
 *     lo recoge cuando monta.
 */
const ARRANQUE_PWA = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__instalable = e;
  window.dispatchEvent(new Event('reformapro:instalable'));
});
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ARRANQUE_PWA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
