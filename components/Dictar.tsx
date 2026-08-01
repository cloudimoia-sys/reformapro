"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botón de dictado para los campos largos.
 *
 * Usa el reconocimiento de voz del propio navegador: no manda audio a ningún
 * servidor nuestro ni gasta cupo de IA. A cambio, no está en todos: Chrome y Edge
 * sí, Firefox no. Donde no está, el botón no aparece y el campo se sigue usando
 * escribiendo — que es justo lo que hay que hacer con una función accesoria.
 *
 * Existe porque quien describe una obra suele estar en la obra, con el móvil en
 * una mano y sin ganas de teclear diez líneas.
 */
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export default function Dictar({
  onTexto,
  disabled,
}: {
  /** Recibe el texto reconocido para añadirlo a lo que ya hubiera escrito. */
  onTexto: (texto: string) => void;
  disabled?: boolean;
}) {
  const [soportado, setSoportado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Reconocimiento | null>(null);

  useEffect(() => {
    const w = window as any;
    setSoportado(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);

  const alternar = () => {
    if (grabando) {
      rec.current?.stop();
      return;
    }
    const w = window as any;
    const Motor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Motor) return;

    const r: Reconocimiento = new Motor();
    r.lang = "es-ES";
    // Continuo: describir una obra son varias frases con pausas entre medias, y
    // sin esto el micrófono se corta al primer silencio.
    r.continuous = true;
    r.interimResults = false;

    r.onresult = (e: any) => {
      let texto = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) texto += e.results[i][0].transcript;
      }
      if (texto.trim()) onTexto(texto.trim());
    };
    r.onerror = (e: any) => {
      setError(
        e?.error === "not-allowed"
          ? "No has dado permiso al micrófono. Actívalo en el candado de la barra de direcciones."
          : "No se pudo escuchar. Inténtalo otra vez."
      );
      setGrabando(false);
    };
    r.onend = () => setGrabando(false);

    rec.current = r;
    setError("");
    setGrabando(true);
    r.start();
  };

  if (!soportado) return null;

  return (
    <>
      <button
        type="button"
        className={`btn sm ${grabando ? "red" : "ghost"}`}
        disabled={disabled}
        onClick={alternar}
        title="Dictar en vez de escribir"
      >
        {grabando ? "■ Parar de dictar" : "🎙 Dictar"}
      </button>
      {grabando && <span className="hint"> Escuchando… habla con normalidad y pulsa Parar al terminar.</span>}
      {error && <p className="error">{error}</p>}
    </>
  );
}
