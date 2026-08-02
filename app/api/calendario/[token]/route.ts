import { NextResponse } from "next/server";
import { prismaUnsafe } from "@/lib/prisma";
import { planificar } from "@/lib/planificacion";
import { generarICS } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Feed de calendario de una obra, para suscribirse desde Google, Apple u Outlook.
 *
 * ESTA RUTA NO TIENE SESIÓN, y es a propósito: Google no puede iniciar sesión en
 * ReformaPro para leer el calendario. La autorización es el token, que es
 * aleatorio, largo, va en la URL y se puede regenerar desde la obra para cortar
 * el acceso a quien ya la tenga.
 *
 * Por eso es la única consulta de la aplicación que busca por token en vez de por
 * empresa: aquí NO se sabe quién pregunta, se sabe qué obra se pide. La consulta
 * está acotada a esa única fila por un campo único, así que no puede devolver
 * datos de otra empresa aunque quiera.
 *
 * Lo que se expone es deliberadamente poco: nombre de la obra, dirección, fases y
 * fechas. Ni cliente, ni importes, ni presupuesto. Quien consiga la URL ve un
 * calendario de trabajos, no la contabilidad.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = (params.token || "").replace(/\.ics$/i, "").trim();

  // Un token corto sería adivinable a fuerza de probar: se rechaza antes de ir a
  // la base de datos.
  if (token.length < 24) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const obra = await prismaUnsafe.obra.findUnique({
    where: { tokenCalendario: token },
    select: {
      id: true,
      nombre: true,
      direccion: true,
      inicio: true,
      festivosPropios: true,
      sabadosSeTrabaja: true,
      fases: {
        orderBy: { orden: "asc" },
        select: {
          id: true,
          nombre: true,
          oficio: true,
          dias: true,
          esperaDias: true,
          dependeDe: true,
          hito: true,
        },
      },
    },
  });

  if (!obra) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const plan = planificar(obra.fases, obra.inicio, {
    festivosPropios: obra.festivosPropios.split(",").filter(Boolean),
    sabadosSeTrabaja: obra.sabadosSeTrabaja,
  });

  const ics = generarICS({
    obraId: obra.id,
    nombreObra: obra.nombre,
    direccion: obra.direccion,
    fases: plan.fases,
    dominio: "reformapro.app",
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${obra.id}.ics"`,
      // Sin caché: si el calendario se cachea, el cliente sigue viendo la
      // planificación vieja después de moverla, que es justo lo que se intenta
      // evitar teniendo un feed.
      "Cache-Control": "no-store, max-age=0",
      // No es una página: que no la indexe nadie ni la siga ningún robot.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
