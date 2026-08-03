"use client";

import { useEffect, useState } from "react";

/**
 * Registro del service worker y botón de instalar.
 *
 * Se ofrece instalar de dos maneras porque los dos sistemas van por su cuenta:
 *
 *  - Android y Chrome de escritorio lanzan `beforeinstallprompt`, así que se
 *    puede enseñar un botón de verdad que abre el diálogo del navegador.
 *  - iOS NO tiene ese evento. Safari solo instala desde Compartir → Añadir a
 *    pantalla de inicio, y no hay forma de abrir eso por código. Lo único que se
 *    puede hacer es explicarlo, y se explica.
 *
 * No aparece nada si la app ya está instalada (se está viendo en `standalone`) ni
 * si el usuario ya lo ha rechazado.
 */

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const RECHAZADO = "reformapro:instalar-rechazado";

export default function Instalar() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [enIOS, setEnIOS] = useState(false);
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    // El service worker lo registra el script en línea de app/layout.tsx, que
    // corre en todas las páginas y antes de que React hidrate. Aquí solo se
    // decide si se enseña el aviso.
    const yaInstalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (yaInstalada || localStorage.getItem(RECHAZADO)) return;

    const ua = window.navigator.userAgent;
    const esIOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
    if (esIOS) {
      setEnIOS(true);
      setOculto(false);
      return;
    }

    /**
     * El evento puede haber ocurrido YA.
     *
     * `beforeinstallprompt` se dispara antes de que React hidrate, así que
     * escuchar desde aquí llega tarde. El script en línea lo guarda en
     * `window.__instalable` y avisa con un evento propio; se comprueban las dos
     * cosas, por si acaso.
     */
    const guardado = (window as { __instalable?: EventoInstalacion }).__instalable;
    if (guardado) {
      setEvento(guardado);
      setOculto(false);
      return;
    }

    const alPoder = () => {
      const e = (window as { __instalable?: EventoInstalacion }).__instalable;
      if (!e) return;
      setEvento(e);
      setOculto(false);
    };
    window.addEventListener("reformapro:instalable", alPoder);
    return () => window.removeEventListener("reformapro:instalable", alPoder);
  }, []);

  const cerrar = () => {
    localStorage.setItem(RECHAZADO, "1");
    setOculto(true);
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    // Aceptado o no, no se vuelve a insistir: el evento ya no sirve otra vez.
    cerrar();
  };

  if (oculto) return null;

  return (
    <div
      style={{
        background: "#EEF3F7",
        border: "1px solid #C9D9E4",
        borderRadius: 8,
        padding: "10px 14px",
        margin: "0 0 14px",
        fontSize: 14,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, minWidth: 220 }}>
        {enIOS ? (
          <>
            <strong>Ponla en la pantalla de inicio.</strong> Pulsa el botón de Compartir y luego{" "}
            <em>Añadir a pantalla de inicio</em>: se abrirá a pantalla completa, como una aplicación.
          </>
        ) : (
          <>
            <strong>Instálala en el móvil.</strong> Se abre a pantalla completa y la tienes en un toque desde la obra.
          </>
        )}
      </span>
      {!enIOS && (
        <button className="btn sm" onClick={instalar}>
          Instalar
        </button>
      )}
      <button className="btn sm ghost" onClick={cerrar}>
        Ahora no
      </button>
    </div>
  );
}
