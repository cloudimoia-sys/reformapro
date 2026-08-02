import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/session";
import { planificar } from "@/lib/planificacion";
import ObraEditor from "./ObraEditor";

export const dynamic = "force-dynamic";

export default async function ObraPage({ params }: { params: { id: string } }) {
  const { db } = await requireTenant();

  const [obra, clientes] = await Promise.all([
    db.obra.findFirst({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        presupuesto: { select: { id: true, numero: true } },
        fases: { orderBy: { orden: "asc" } },
      },
    }),
    db.cliente.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  if (!obra) notFound();

  const plan = planificar(obra.fases, obra.inicio, {
    festivosPropios: obra.festivosPropios.split(",").filter(Boolean),
    sabadosSeTrabaja: obra.sabadosSeTrabaja,
  });

  /**
   * La URL del feed se compone en el servidor con el host real de la petición.
   *
   * Escribirla a mano en una variable de entorno se olvida al cambiar de dominio,
   * y entonces se le da al cliente un enlace que no responde. Así siempre apunta
   * a donde está corriendo la aplicación.
   */
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const protocolo = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const urlCalendario = `${protocolo}://${host}/api/calendario/${obra.tokenCalendario}`;

  return (
    <ObraEditor
      obra={{
        id: obra.id,
        nombre: obra.nombre,
        direccion: obra.direccion,
        clienteId: obra.clienteId,
        clienteNombre: obra.cliente?.nombre || "",
        presupuestoNumero: obra.presupuesto?.numero || "",
        presupuestoId: obra.presupuesto?.id || "",
        inicio: obra.inicio.toISOString().slice(0, 10),
        estado: obra.estado,
        festivosPropios: obra.festivosPropios,
        sabadosSeTrabaja: obra.sabadosSeTrabaja,
        notas: obra.notas,
      }}
      fases={obra.fases.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        oficio: f.oficio,
        dias: f.dias,
        esperaDias: f.esperaDias,
        dependeDe: f.dependeDe,
        hito: f.hito,
        notas: f.notas,
      }))}
      plan={plan}
      clientes={clientes}
      urlCalendario={urlCalendario}
    />
  );
}
