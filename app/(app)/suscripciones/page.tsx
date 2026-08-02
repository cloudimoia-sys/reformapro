import { notFound } from "next/navigation";
import { requireDuenoApp } from "@/lib/session";
import { prismaUnsafe } from "@/lib/prisma";
import { estadoDeSuscripcion, type EstadoSuscripcion } from "@/lib/suscripcion";
import SuscripcionesClient from "./SuscripcionesClient";

export const dynamic = "force-dynamic";

/**
 * Panel del dueño de ReformaPro.
 *
 * Para cualquier otro, esta página NO EXISTE: se devuelve 404, no un error ni una
 * versión recortada. Un 500 delataría que la ruta está ahí y solo le falta el
 * permiso, que es justo lo que invita a insistir. La pestaña tampoco se pinta,
 * pero eso es cosmético — la barrera es esta.
 */
export default async function SuscripcionesPage() {
  try {
    await requireDuenoApp();
  } catch {
    notFound();
  }

  const empresas = await prismaUnsafe.empresa.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nombre: true,
      email: true,
      plan: true,
      estadoSusc: true,
      trialFinaliza: true,
      createdAt: true,
      _count: { select: { usuarios: true, presupuestos: true, informes: true, obras: true } },
    },
  });

  const filas = empresas.map((e) => {
    const s = estadoDeSuscripcion({
      estadoSusc: e.estadoSusc as EstadoSuscripcion,
      trialFinaliza: e.trialFinaliza,
    });
    return {
      id: e.id,
      nombre: e.nombre,
      email: e.email,
      plan: e.plan as string,
      estado: s.estado,
      diasRestantes: s.diasRestantes,
      soloLectura: s.soloLectura,
      alta: e.createdAt.toISOString().slice(0, 10),
      usuarios: e._count.usuarios,
      // Lo que de verdad dice si una cuenta está viva: cuánto ha producido.
      trabajo: e._count.presupuestos + e._count.informes + e._count.obras,
    };
  });

  return <SuscripcionesClient empresas={filas} />;
}
