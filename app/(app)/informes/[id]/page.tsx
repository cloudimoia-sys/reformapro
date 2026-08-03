import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import InformeEditor, { type InformeCompleto } from "./InformeEditor";
import type { ContenidoInforme } from "@/lib/informe";

export default async function InformePage({ params }: { params: Promise<{ id: string }> }) {
  // Desde Next 15, los params de una ruta llegan como promesa.
  const { id } = await params;
  const { db } = await requireTenant();

  // findFirst, no findUnique: el cliente por empresa solo puede inyectar el
  // filtro en un `where` normal, así que es la vía por la que un informe de otra
  // empresa simplemente no aparece.
  const inf = await db.informe.findFirst({
    where: { id: id },
    include: { cliente: true, fotos: { orderBy: { orden: "asc" } } },
  });
  if (!inf) notFound();

  const empresa = await db.empresa.findFirst();

  const informe: InformeCompleto = {
    id: inf.id,
    numero: inf.numero,
    tipo: inf.tipo,
    titulo: inf.titulo,
    fecha: inf.fecha.toISOString().slice(0, 10),
    inmueble: inf.inmueble,
    refCatastral: inf.refCatastral,
    solicitante: inf.solicitante,
    perito: inf.perito,
    titulacion: inf.titulacion,
    colegiado: inf.colegiado,
    estado: inf.estado as "BORRADOR" | "FINALIZADO",
    contenido: inf.contenido as unknown as ContenidoInforme,
    fotos: inf.fotos.map((f) => ({ id: f.id, datos: f.datos, pie: f.pie })),
  };

  return (
    <InformeEditor
      informe={informe}
      cliente={inf.cliente ? { nombre: inf.cliente.nombre, direccion: inf.cliente.direccion, nif: inf.cliente.nif } : null}
      empresa={{
        nombre: empresa?.nombre || "",
        cif: empresa?.cif || "",
        direccion: empresa?.direccion || "",
        tel: empresa?.tel || "",
        email: empresa?.email || "",
        logo: empresa?.logo || null,
      }}
    />
  );
}
