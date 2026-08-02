"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant, requireTenantAdmin } from "@/lib/session";
import { ejecutar, type Resultado, type ResultadoConRedirect } from "@/lib/accion";
import { fasesDesdeCapitulos } from "@/lib/planificacion";
import { importeLinea } from "@/lib/presupuesto";

export type EstadoObra = "PLANIFICADA" | "EN_CURSO" | "PARADA" | "TERMINADA";

export type DatosObra = {
  nombre: string;
  direccion?: string;
  clienteId?: string | null;
  inicio: string;
  estado?: EstadoObra;
  festivosPropios?: string;
  sabadosSeTrabaja?: boolean;
  notas?: string;
};

export type DatosFase = {
  nombre: string;
  oficio?: string;
  dias: number;
  esperaDias?: number;
  dependeDe?: string;
  hito?: boolean;
  notas?: string;
};

/**
 * Token del feed de calendario.
 *
 * 32 bytes en base64url: quien tenga la URL ve la obra, así que tiene que ser
 * imposible de adivinar a fuerza de probar. Se genera con el generador
 * criptográfico, no con Math.random().
 */
const nuevoToken = () => randomBytes(32).toString("base64url");

/** La fecha llega como AAAA-MM-DD; se guarda como día, sin hora ni zona. */
const aFecha = (iso: string) => new Date(`${(iso || "").slice(0, 10) || new Date().toISOString().slice(0, 10)}T00:00:00Z`);

export async function crearObra(datos: DatosObra): Promise<ResultadoConRedirect> {
  return ejecutar("crearObra", async () => {
    const { db, empresaId } = await requireTenant();
    if (!datos.nombre?.trim()) throw new Error("Ponle un nombre a la obra");

    const obra = await db.obra.create({
      data: {
        empresaId,
        nombre: datos.nombre.trim(),
        direccion: datos.direccion || "",
        clienteId: datos.clienteId || null,
        inicio: aFecha(datos.inicio),
        festivosPropios: datos.festivosPropios || "",
        sabadosSeTrabaja: !!datos.sabadosSeTrabaja,
        notas: datos.notas || "",
        tokenCalendario: nuevoToken(),
      },
    });

    revalidatePath("/obras");
    redirect(`/obras/${obra.id}`);
  });
}

/**
 * Crea la obra a partir de un presupuesto, con una fase por capítulo.
 *
 * Las duraciones que salen de aquí son un punto de partida para editar, no una
 * estimación: se calculan por importe del capítulo, y el importe no sabe si la
 * cuadrilla son dos o son seis. Lo que sí aporta, y es donde falla la
 * planificación hecha de memoria, es el ORDEN y las esperas de fraguado.
 */
export async function crearObraDesdePresupuesto(
  presupuestoId: string,
  inicio: string
): Promise<ResultadoConRedirect> {
  return ejecutar("crearObraDesdePresupuesto", async () => {
    const { db, empresaId } = await requireTenant();

    const p = await db.presupuesto.findFirst({
      where: { id: presupuestoId },
      include: { lineas: { orderBy: { orden: "asc" } } },
    });
    if (!p) throw new Error("Presupuesto no encontrado");

    // Se agrupa por capítulo respetando el orden en que aparecen: es el orden en
    // que el reformista los escribió, y suele ser ya el de ejecución.
    const capitulos: { nombre: string; importe: number }[] = [];
    for (const l of p.lineas) {
      const nombre = (l.capitulo || "Trabajos").trim() || "Trabajos";
      const existente = capitulos.find((c) => c.nombre === nombre);
      const importe = importeLinea(l);
      if (existente) existente.importe += importe;
      else capitulos.push({ nombre, importe });
    }

    const fases = fasesDesdeCapitulos(capitulos);

    const obra = await db.obra.create({
      data: {
        empresaId,
        nombre: p.titulo || `Obra de ${p.numero}`,
        clienteId: p.clienteId,
        presupuestoId: p.id,
        inicio: aFecha(inicio),
        tokenCalendario: nuevoToken(),
      },
    });

    /**
     * Las fases se crean en dos pasos porque `dependeDe` apunta al id REAL de la
     * fase anterior, y ese id no existe hasta haberla creado. El generador de
     * fases usa ids provisionales (f1, f2…), así que aquí se traducen.
     */
    const idReal = new Map<string, string>();
    for (const [i, f] of fases.entries()) {
      const creada = await db.fase.create({
        data: {
          empresaId,
          obraId: obra.id,
          orden: i,
          nombre: f.nombre,
          oficio: f.oficio || "",
          dias: f.dias,
          esperaDias: f.esperaDias || 0,
          dependeDe: f.dependeDe ? idReal.get(f.dependeDe) || "" : "",
          notas: f.motivoEspera ? `Espera de ${f.esperaDias} días: ${f.motivoEspera}.` : "",
        },
      });
      idReal.set(f.id, creada.id);
    }

    revalidatePath("/obras");
    redirect(`/obras/${obra.id}`);
  });
}

export async function actualizarObra(id: string, patch: Partial<DatosObra>): Promise<Resultado> {
  return ejecutar("actualizarObra", async () => {
    const { db } = await requireTenant();
    const r = await db.obra.updateMany({
      where: { id },
      data: {
        ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
        ...(patch.direccion !== undefined ? { direccion: patch.direccion } : {}),
        ...(patch.clienteId !== undefined ? { clienteId: patch.clienteId || null } : {}),
        ...(patch.inicio !== undefined ? { inicio: aFecha(patch.inicio) } : {}),
        ...(patch.estado !== undefined ? { estado: patch.estado } : {}),
        ...(patch.festivosPropios !== undefined ? { festivosPropios: patch.festivosPropios } : {}),
        ...(patch.sabadosSeTrabaja !== undefined ? { sabadosSeTrabaja: patch.sabadosSeTrabaja } : {}),
        ...(patch.notas !== undefined ? { notas: patch.notas } : {}),
      },
    });
    if (!r.count) throw new Error("Obra no encontrada");
    revalidatePath("/obras");
    revalidatePath(`/obras/${id}`);
  });
}

export async function anadirFase(obraId: string, datos: DatosFase): Promise<Resultado> {
  return ejecutar("anadirFase", async () => {
    const { db, empresaId } = await requireTenant();

    // Se comprueba que la obra es de esta empresa ANTES de colgarle nada: el id
    // viene del navegador.
    const obra = await db.obra.findFirst({ where: { id: obraId }, select: { id: true } });
    if (!obra) throw new Error("Obra no encontrada");

    const ultima = await db.fase.findFirst({ where: { obraId }, orderBy: { orden: "desc" }, select: { orden: true } });

    await db.fase.create({
      data: {
        empresaId,
        obraId,
        orden: (ultima?.orden ?? -1) + 1,
        nombre: datos.nombre || "Fase nueva",
        oficio: datos.oficio || "",
        dias: Math.max(1, Math.round(datos.dias || 1)),
        esperaDias: Math.max(0, Math.round(datos.esperaDias || 0)),
        dependeDe: datos.dependeDe || "",
        hito: !!datos.hito,
        notas: datos.notas || "",
      },
    });

    revalidatePath(`/obras/${obraId}`);
  });
}

export async function actualizarFase(faseId: string, patch: Partial<DatosFase>): Promise<Resultado> {
  return ejecutar("actualizarFase", async () => {
    const { db } = await requireTenant();
    const r = await db.fase.updateMany({
      where: { id: faseId },
      data: {
        ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
        ...(patch.oficio !== undefined ? { oficio: patch.oficio } : {}),
        ...(patch.dias !== undefined ? { dias: Math.max(1, Math.round(patch.dias)) } : {}),
        ...(patch.esperaDias !== undefined ? { esperaDias: Math.max(0, Math.round(patch.esperaDias)) } : {}),
        // Una fase no puede esperarse a sí misma: sería un bucle de un solo paso.
        ...(patch.dependeDe !== undefined ? { dependeDe: patch.dependeDe === faseId ? "" : patch.dependeDe } : {}),
        ...(patch.hito !== undefined ? { hito: patch.hito } : {}),
        ...(patch.notas !== undefined ? { notas: patch.notas } : {}),
      },
    });
    if (!r.count) throw new Error("Fase no encontrada");
  });
}

/**
 * Borra una fase y deja huérfanas a las que dependían de ella.
 *
 * Se limpia la referencia en vez de dejarla apuntando al vacío: si no, el motor
 * de planificación tendría que adivinar qué hacer, y las fases siguientes se
 * quedarían con una fecha de inicio inventada sin que nadie avisara.
 */
export async function borrarFase(faseId: string): Promise<Resultado> {
  return ejecutar("borrarFase", async () => {
    const { db } = await requireTenant();
    const fase = await db.fase.findFirst({ where: { id: faseId }, select: { obraId: true, dependeDe: true } });
    if (!fase) throw new Error("Fase no encontrada");

    // Las que la esperaban pasan a esperar a lo que ella esperaba: así la cadena
    // no se rompe y no aparecen fases arrancando el primer día sin motivo.
    await db.fase.updateMany({ where: { dependeDe: faseId }, data: { dependeDe: fase.dependeDe } });
    await db.fase.deleteMany({ where: { id: faseId } });

    revalidatePath(`/obras/${fase.obraId}`);
  });
}

/** Corta el acceso a quien tuviera la URL del calendario. */
export async function regenerarTokenCalendario(obraId: string): Promise<Resultado> {
  return ejecutar("regenerarTokenCalendario", async () => {
    const { db } = await requireTenant();
    const r = await db.obra.updateMany({ where: { id: obraId }, data: { tokenCalendario: nuevoToken() } });
    if (!r.count) throw new Error("Obra no encontrada");
    revalidatePath(`/obras/${obraId}`);
  });
}

export async function borrarObra(id: string): Promise<Resultado> {
  return ejecutar("borrarObra", async () => {
    const { db } = await requireTenantAdmin();
    const r = await db.obra.deleteMany({ where: { id } });
    if (!r.count) throw new Error("Obra no encontrada");
    revalidatePath("/obras");
  });
}
