import type { Suscripcion } from "@/lib/suscripcion";

/**
 * Banda con el estado de la cuenta.
 *
 * Solo aparece cuando hay algo que decir: durante los primeros días de prueba no
 * sale nada. Un aviso permanente deja de leerse a la semana, y entonces el día
 * que de verdad importa tampoco se lee.
 */
const ESTILO = {
  info: { fondo: "#E3EDF5", borde: "#B9D2E6", texto: "#1B4965" },
  atencion: { fondo: "#FCF0D8", borde: "#EBD9A8", texto: "#7A5A10" },
  bloqueo: { fondo: "#F5E3E1", borde: "#E6BDB8", texto: "#8A2B21" },
} as const;

export default function AvisoSuscripcion({ suscripcion }: { suscripcion: Suscripcion }) {
  if (!suscripcion.aviso) return null;
  const c = ESTILO[suscripcion.aviso.tono];

  return (
    <div
      style={{
        background: c.fondo,
        border: `1px solid ${c.borde}`,
        color: c.texto,
        borderRadius: 8,
        padding: "10px 14px",
        margin: "0 0 14px",
        fontSize: 14,
      }}
    >
      {suscripcion.soloLectura && <strong>Solo lectura. </strong>}
      {suscripcion.aviso.texto}
    </div>
  );
}
