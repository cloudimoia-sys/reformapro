"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botón de dictado para los campos largos.
 *
 * Existe porque quien describe una obra suele estar EN la obra, con el móvil en
 * una mano y sin ganas de teclear diez líneas.
 *
 * SEGUNDA VERSIÓN. La primera usaba el reconocimiento de voz del navegador
 * (`webkitSpeechRecognition`): gratis e instantáneo, pero apoyado en un servicio
 * de Google al que el navegador tiene que poder llegar. En Brave está presente
 * pero sin claves, así que pedía permiso al micrófono y acto seguido fallaba con
 * `network`; en Firefox no existe; y en una red que filtre ese servicio, igual.
 * El síntoma era desconcertante: das permiso y se para.
 *
 * Ahora se graba y se transcribe en el servidor. Funciona en todo lo que tenga
 * micrófono, y transcribe mejor el vocabulario de obra.
 *
 * EL AUDIO SALE DEL DISPOSITIVO. Va a Google para transcribirse, igual que las
 * fotos del diagnóstico, y no se guarda en ninguna parte. Conviene saberlo antes
 * de dictar delante de un cliente.
 */

/** Tope de grabación. A 16 kHz mono son unos 2,5 MB de base64, con margen. */
const MAX_SEGUNDOS = 60;
/** Por debajo de esto no hay nada que transcribir: fue un toque sin querer. */
const MINIMO_SEGUNDOS = 1;

/** Frecuencia de la transcripción: el habla no necesita más y pesa cuatro veces menos. */
const HERCIOS = 16000;

/**
 * Convierte lo grabado a WAV de 16 kHz mono y 16 bits.
 *
 * Se hace aquí, en el navegador, y no se manda el archivo tal cual porque cada
 * navegador graba en un formato distinto (Chrome en webm/opus, Safari en mp4) y
 * no todos entran en la API de transcripción. Pasándolo siempre a WAV, el
 * servidor recibe lo mismo venga de donde venga, y de paso el archivo se queda
 * en una cuarta parte de lo que ocuparía a 44 kHz en estéreo.
 */
/**
 * Nivel por debajo del cual se considera que no se ha dicho nada.
 *
 * Es el valor eficaz (RMS) de la señal. Un micrófono abierto en una habitación
 * en silencio se queda en torno a 0,001; hablando, aunque sea flojo y de lejos,
 * se pasa de 0,01 con holgura.
 */
const SILENCIO_RMS = 0.004;

async function aWavBase64(blob: Blob): Promise<{ base64: string; hayVoz: boolean }> {
  const bytes = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let decodificado: AudioBuffer;
  try {
    decodificado = await ctx.decodeAudioData(bytes.slice(0));
  } finally {
    ctx.close();
  }

  // Remuestreo a 16 kHz y mezcla a un solo canal.
  const destino = new OfflineAudioContext(
    1,
    Math.ceil((decodificado.duration * HERCIOS) || 1),
    HERCIOS
  );
  const fuente = destino.createBufferSource();
  fuente.buffer = decodificado;
  fuente.connect(destino.destination);
  fuente.start();
  const mono = await destino.startRendering();

  const muestras = mono.getChannelData(0);
  const buffer = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };

  // Cabecera WAV canónica de 44 bytes, PCM sin comprimir.
  texto(0, "RIFF");
  v.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true); // tamaño del bloque fmt
  v.setUint16(20, 1, true); // 1 = PCM
  v.setUint16(22, 1, true); // canales
  v.setUint32(24, HERCIOS, true);
  v.setUint32(28, HERCIOS * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // alineación de bloque
  v.setUint16(34, 16, true); // bits por muestra
  texto(36, "data");
  v.setUint32(40, muestras.length * 2, true);

  /**
   * De paso se mide el nivel, para no mandar silencio a transcribir.
   *
   * No es una optimización: probado con dos segundos de silencio, el modelo
   * devolvió "4 m²" —se había copiado un ejemplo del prompt—. Eso metería una
   * medición que nadie ha dicho en la descripción de un presupuesto. El prompt ya
   * está corregido, pero un dato que se puede comprobar en código no se deja al
   * criterio de un modelo.
   */
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) {
    // Recortar antes de convertir: un pico por encima de 1 daría la vuelta y
    // sonaría como un chasquido.
    const m = Math.max(-1, Math.min(1, muestras[i]));
    suma += m * m;
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  const rms = muestras.length ? Math.sqrt(suma / muestras.length) : 0;

  // De binario a base64 por tramos: pasarle el array entero a fromCharCode
  // revienta la pila con audios de más de unos segundos.
  const bin = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bin.length; i += 8192) {
    s += String.fromCharCode(...bin.subarray(i, i + 8192));
  }
  return { base64: btoa(s), hayVoz: rms >= SILENCIO_RMS };
}

export default function Dictar({
  onTexto,
  disabled,
}: {
  /** Recibe el texto transcrito para añadirlo a lo que ya hubiera escrito. */
  onTexto: (texto: string) => void;
  disabled?: boolean;
}) {
  const [soportado, setSoportado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState("");

  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const pista = useRef<MediaStream | null>(null);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  const soltarMicrofono = () => {
    pista.current?.getTracks().forEach((t) => t.stop());
    pista.current = null;
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
  };

  useEffect(() => {
    setSoportado(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
    // Si el usuario navega a otra página con el micrófono abierto, se cierra: el
    // piloto rojo encendido después de salir asusta, y con razón.
    return () => {
      grabadora.current?.state === "recording" && grabadora.current.stop();
      soltarMicrofono();
    };
  }, []);

  const empezar = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pista.current = stream;
      trozos.current = [];

      const mr = new MediaRecorder(stream);
      grabadora.current = mr;

      mr.ondataavailable = (e) => e.data.size && trozos.current.push(e.data);
      mr.onstop = async () => {
        soltarMicrofono();
        setGrabando(false);
        const blob = new Blob(trozos.current, { type: mr.mimeType || "audio/webm" });
        trozos.current = [];
        if (!blob.size) return setError("No se grabó nada. ¿Está el micrófono tapado?");
        await transcribir(blob);
      };

      mr.start();
      setGrabando(true);
      setSegundos(0);
      reloj.current = setInterval(() => {
        setSegundos((s) => {
          // Corte automático: si alguien deja el botón pulsado, el archivo
          // crecería hasta no poder enviarse.
          if (s + 1 >= MAX_SEGUNDOS) grabadora.current?.state === "recording" && grabadora.current.stop();
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      soltarMicrofono();
      setGrabando(false);
      setError(
        e?.name === "NotAllowedError" || e?.name === "SecurityError"
          ? "No has dado permiso al micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo."
          : e?.name === "NotFoundError"
          ? "No se ha encontrado ningún micrófono."
          : "No se pudo abrir el micrófono."
      );
    }
  };

  const transcribir = async (blob: Blob) => {
    setTranscribiendo(true);
    try {
      const { base64: audio, hayVoz } = await aWavBase64(blob);
      if (!hayVoz) {
        setError("No se ha oído nada. Comprueba que el micrófono es el que crees y que no está silenciado.");
        return;
      }
      const r = await fetch("/api/transcribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo transcribir.");
      if (d.texto) onTexto(d.texto);
    } catch (e: any) {
      setError(e?.message || "No se pudo transcribir.");
    } finally {
      setTranscribiendo(false);
    }
  };

  const parar = () => {
    if (grabadora.current?.state === "recording") {
      if (segundos < MINIMO_SEGUNDOS) {
        // Descartar sin transcribir: un toque sin querer no debe gastar cupo.
        grabadora.current.onstop = () => {
          soltarMicrofono();
          setGrabando(false);
        };
      }
      grabadora.current.stop();
    }
  };

  // Donde no hay micrófono utilizable, el botón no aparece y el campo se escribe
  // a mano, que es lo que hay que hacer con una función accesoria.
  if (!soportado) return null;

  return (
    <>
      <button
        type="button"
        className={`btn sm ${grabando ? "red" : "ghost"}`}
        disabled={disabled || transcribiendo}
        onClick={grabando ? parar : empezar}
        title="Dictar en vez de escribir"
      >
        {transcribiendo
          ? "Transcribiendo…"
          : grabando
          ? `■ Parar (${MAX_SEGUNDOS - segundos}s)`
          : "🎙 Dictar"}
      </button>
      {grabando && (
        <span className="hint"> Grabando… habla con normalidad y pulsa Parar al terminar.</span>
      )}
      {error && <p className="error">{error}</p>}
    </>
  );
}
