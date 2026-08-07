"use client";

import { useState } from "react";
import { crearParteBlanco } from "./actions";

/**
 * Crea un parte en blanco y entra directo a su editor.
 *
 * Es un componente de cliente, y no un `<form action={...}>` en el servidor,
 * por un motivo concreto: un formulario descarta lo que devuelve la acción, y
 * `crearParteBlanco` devuelve el error como VALOR en vez de lanzarlo —porque
 * Next borra el mensaje de las excepciones en producción—. Con un formulario,
 * un fallo al crear dejaría un botón que no hace nada y nadie sabría por qué.
 *
 * Se comparte entre el panel y la lista de partes para que ese detalle esté
 * resuelto en un solo sitio.
 */
export default function BotonNuevoParte({ className = "btn amber" }: { className?: string }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  const crear = async () => {
    setCreando(true);
    setError("");
    // Si va bien, la acción redirige y este componente se desmonta. Si vuelve
    // con algo, es que ha fallado.
    const r = await crearParteBlanco();
    if (r && !r.ok) setError(r.error);
    setCreando(false);
  };

  return (
    <>
      <button className={className} disabled={creando} onClick={crear}>
        {creando ? "Creando…" : "+ Nuevo parte"}
      </button>
      {error && (
        <span className="error" style={{ marginLeft: 8 }}>
          {error}
        </span>
      )}
    </>
  );
}
