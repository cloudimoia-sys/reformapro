"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AsistenteInforme from "@/components/AsistenteInforme";
import { fallo } from "@/lib/accion";
import { ETIQUETA_TIPO, type TipoInforme } from "@/lib/informe";
import { crearInforme, borrarInforme, type DatosInforme, type FotoNueva } from "./actions";
import type { ContenidoInforme } from "@/lib/informe";

type Fila = {
  id: string;
  numero: string;
  titulo: string;
  tipo: TipoInforme;
  inmueble: string;
  clienteNombre: string;
  fecha: string;
  estado: string;
  fotos: number;
};

export default function InformesListClient({
  informes,
  clientes,
  peritoPorDefecto,
  isAdmin,
}: {
  informes: Fila[];
  clientes: { id: string; nombre: string }[];
  peritoPorDefecto: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [asistente, setAsistente] = useState(false);

  const onDone = async (datos: DatosInforme, contenido: ContenidoInforme, fotos: FotoNueva[]) => {
    const e = fallo(await crearInforme(datos, contenido, fotos));
    if (e) throw new Error(e);
  };

  const borrar = async (id: string, numero: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (!window.confirm(`¿Eliminar el documento ${numero}? Se borrarán también sus fotos.`)) return;
    const r = await borrarInforme(id);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 22 }}>Informes y documentos</h2>
        <div className="spacer" />
        <button className="btn amber" onClick={() => setAsistente(true)}>+ Nuevo documento</button>
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>
        Informes de patologías, dictámenes periciales, actas de visita y entrega, certificados, memorias técnicas,
        planes de trabajo, certificaciones, reclamaciones, cartas al seguro y solicitudes al ayuntamiento. Con anexo
        fotográfico y presupuesto cuando el documento lo lleva. Exportables a Word, Excel y PDF.
      </p>
      <table className="t">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Informe</th>
            <th className="hidemob">Inmueble</th>
            <th className="hidemob">Fecha</th>
            <th className="hidemob">Tipo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {informes.map((x) => (
            <tr key={x.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/informes/${x.id}`)}>
              <td>{x.numero}</td>
              <td>
                {x.titulo}
                {x.fotos > 0 && <span className="hint"> · {x.fotos} foto{x.fotos > 1 ? "s" : ""}</span>}
              </td>
              <td className="hidemob">{x.inmueble || "—"}</td>
              <td className="hidemob">{x.fecha}</td>
              <td className="hidemob"><span className="badge b-enviado">{ETIQUETA_TIPO[x.tipo]}</span></td>
              <td>
                <span className={`badge ${x.estado === "FINALIZADO" ? "b-facturado" : ""}`}>
                  {x.estado === "FINALIZADO" ? "finalizado" : "borrador"}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                {isAdmin && <button className="btn sm red" onClick={(e) => borrar(x.id, x.numero, e)}>Eliminar</button>}
              </td>
            </tr>
          ))}
          {!informes.length && (
            <tr><td colSpan={7} className="hint">Sin documentos todavía. Crea el primero con la IA.</td></tr>
          )}
        </tbody>
      </table>

      {asistente && (
        <AsistenteInforme
          clientes={clientes}
          peritoPorDefecto={peritoPorDefecto}
          onDone={onDone}
          onCancel={() => setAsistente(false)}
        />
      )}
    </div>
  );
}
