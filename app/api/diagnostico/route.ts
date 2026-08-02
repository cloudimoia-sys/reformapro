import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/session";
import { llamarAGemini, respuestaDeError, leerJson, extraerLista, type Parte } from "@/lib/gemini";
import {
  catalogoParaElModelo,
  normativaDe,
  partidasDe,
  patologiaPorId,
} from "@/lib/patologias";
import {
  comprobacionesPendientes,
  diferencial,
  esConcluyente,
  ordenarCandidatos,
  urgenciaGlobal,
  type Confianza,
  type Contexto,
  type Observacion,
} from "@/lib/diagnostico";

export const maxDuration = 60;

/**
 * Diagnóstico de patologías a partir de fotografías.
 *
 * EL REPARTO DE TRABAJO, que es lo que hace que esto sirva para algo:
 *
 *   La IA hace UNA cosa: mirar la foto, describir lo que se ve y decir a cuáles
 *   de las fichas del catálogo se parece. Nada más. No decide la causa, no fija
 *   la urgencia, no propone la reparación y no pone precios.
 *
 *   El programa hace el resto: aplica las reglas de contexto de lib/diagnostico,
 *   ordena los candidatos, decide si el diagnóstico se puede cerrar o no, y saca
 *   del catálogo las comprobaciones, la actuación y los precios.
 *
 * El motivo es sencillo: en una fotografía, una condensación y una filtración de
 * fachada son la misma mancha. Un modelo que tenga que elegir elegirá una, con
 * mucho aplomo, y acertará más o menos la mitad de las veces. Picar y trasdosar
 * una pared cuya humedad venía de una fisura en fachada son mil euros tirados y
 * la humedad vuelve. Así que aquí el resultado normal y correcto es "es esto o
 * esto otro, y esto es lo que hay que mirar en la visita para saber cuál".
 */

const MAX_IMAGENES = 6;
const MAX_BASE64_TOTAL = 3.5 * 1024 * 1024;
const TIPOS_ACEPTADOS = ["image/png", "image/jpeg", "image/webp"];

const CONFIANZAS: Confianza[] = ["alta", "media", "baja"];

type ImagenEntrada = { mimeType?: string; datos?: string; pie?: string };

export async function POST(req: Request) {
  try {
    await requireTenant();
  } catch {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta la clave de la IA. Avisa al administrador (GEMINI_API_KEY)." },
      { status: 500 }
    );
  }

  let f: { imagenes?: ImagenEntrada[]; contexto?: Contexto; descripcion?: string };
  try {
    f = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const imagenes = (f.imagenes || []).slice(0, MAX_IMAGENES);
  if (!imagenes.length) {
    return NextResponse.json({ error: "Sube al menos una fotografía de la lesión." }, { status: 400 });
  }
  if (imagenes.some((i) => !i.datos || !i.mimeType || !TIPOS_ACEPTADOS.includes(i.mimeType))) {
    return NextResponse.json(
      { error: "Solo se admiten fotografías en JPG, PNG o WEBP. Un plano no sirve para diagnosticar una lesión." },
      { status: 400 }
    );
  }
  const peso = imagenes.reduce((s, i) => s + (i.datos?.length || 0), 0);
  if (peso > MAX_BASE64_TOTAL) {
    return NextResponse.json(
      { error: "Las fotos pesan demasiado en conjunto. Sube menos fotos o de menor resolución." },
      { status: 400 }
    );
  }

  const contexto: Contexto = f.contexto || {};
  const descripcion = (f.descripcion || "").trim();

  const listaImagenes = imagenes
    .map((im, i) => `[Imagen ${i + 1}]${im.pie ? ` — ${im.pie}` : ""}`)
    .join("\n");

  const prompt = `Eres un arquitecto técnico español examinando fotografías de una lesión en un edificio.

TU ÚNICO TRABAJO ES OBSERVAR Y CLASIFICAR. No diagnostiques la causa, no propongas reparación, no valores nada y no digas si es urgente: de eso se encarga el programa a partir de tu clasificación.

IMÁGENES (están al principio de este mensaje):
${listaImagenes}
${descripcion ? `\nLO QUE CUENTA QUIEN HA HECHO LAS FOTOS:\n${descripcion}\n` : ""}
CATÁLOGO CERRADO DE PATOLOGÍAS. Solo puedes usar estos identificadores, escritos exactamente igual:
${catalogoParaElModelo()}

REGLAS
1. En "loQueSeVe" describe SOLO lo que se aprecia físicamente: color, forma, ubicación, extensión, textura, si hay desprendimiento, si hay grieta y su dirección. Como si se lo describieras por teléfono a alguien que no ve la foto. Nada de causas.
2. En "candidatos" pon los identificadores del catálogo compatibles con lo que ves, de 1 a 4 por imagen. Si dudas entre varios, ponlos TODOS: acertar de largo con tres candidatos vale más que fallar con uno solo.
3. No inventes identificadores. Si lo que ves no encaja en ninguno, deja "candidatos" vacío.
4. La confianza es cómo de claro está en la IMAGEN, no cómo de probable te parece la patología:
   - "alta": la imagen muestra señales inequívocas de esa ficha.
   - "media": encaja, pero podría ser otra cosa.
   - "baja": no se descarta, pero la imagen no lo sostiene.
5. Si una foto está movida, oscura o demasiado lejos para apreciar nada, dilo en "loQueSeVe" y deja "candidatos" vacío. Es una respuesta válida.

Responde SOLO con JSON válido, sin markdown:
{
 "observaciones": [
   {"imagen": 1, "loQueSeVe": "...", "candidatos": [{"id": "humedad-condensacion", "confianza": "media"}]}
 ],
 "calidadFotos": "una frase si alguna foto no permite apreciar bien la lesión, o cadena vacía"
}`;

  const partes: Parte[] = [
    ...imagenes.map((im): Parte => ({ inline_data: { mime_type: im.mimeType!, data: im.datos! } })),
    { text: prompt },
  ];

  try {
    const r = await llamarAGemini(apiKey, partes, {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
    if (!r.ok) return respuestaDeError(r, "diagnostico");

    const parsed = leerJson(await r.json());

    /**
     * Los identificadores que no existen se tiran, no se aproximan.
     *
     * Un id inventado que se pareciera a otro real acabaría trayendo la ficha
     * equivocada, con su urgencia y su reparación: peor que no traer nada.
     */
    const inventados: string[] = [];
    const observaciones: Observacion[] = extraerLista(parsed, "observaciones")
      .map((o: any, i: number) => {
        const candidatos = (Array.isArray(o?.candidatos) ? o.candidatos : [])
          .map((c: any) => ({
            id: String(c?.id ?? "").trim(),
            confianza: (CONFIANZAS.includes(c?.confianza) ? c.confianza : "media") as Confianza,
          }))
          .filter((c: { id: string }) => {
            if (patologiaPorId(c.id)) return true;
            if (c.id) inventados.push(c.id);
            return false;
          });
        return {
          imagen: Number(o?.imagen) || i + 1,
          loQueSeVe: String(o?.loQueSeVe ?? "").trim(),
          candidatos,
        };
      })
      .filter((o: Observacion) => o.loQueSeVe || o.candidatos.length);

    if (inventados.length) {
      // No rompe el diagnóstico, pero conviene verlo en los registros: si se
      // repite, es que al catálogo le falta una ficha.
      console.warn("Diagnóstico: identificadores fuera del catálogo:", inventados.join(", "));
    }

    const ordenados = ordenarCandidatos(observaciones, contexto);
    const vivos = ordenados.filter((c) => !c.descartado);
    const descartados = ordenados.filter((c) => c.descartado);

    const candidatos = vivos.map((c) => ({
      id: c.patologia.id,
      etiqueta: c.patologia.etiqueta,
      familia: c.patologia.familia,
      puntos: c.puntos,
      motivos: c.motivos,
      urgencia: c.patologia.urgencia,
      porQueUrgencia: c.patologia.porQueUrgencia,
      causas: c.patologia.causas,
      comprobaciones: c.patologia.comprobaciones,
      actuacion: c.patologia.actuacion,
      partidas: partidasDe(c.patologia),
      normativa: normativaDe(c.patologia).map((n) => ({ tema: n.tema, respuesta: n.respuesta, fuente: n.fuente })),
      derivar: c.patologia.derivar || null,
    }));

    const avisos: string[] = [];
    const calidad = String(parsed.calidadFotos ?? "").trim();
    if (calidad) avisos.push(calidad);
    if (!vivos.length) {
      avisos.push(
        observaciones.length
          ? "Lo que se ve en las fotos no encaja con ninguna patología del catálogo, o el contexto descarta las que se parecían. Describe la lesión por escrito y revísala en visita."
          : "No se ha podido apreciar ninguna lesión en las fotografías."
      );
    }
    if (vivos.some((c) => c.patologia.derivar)) {
      avisos.push("Hay algún punto que se sale de lo que puede resolver el reformista por su cuenta: revisa el apartado de cuándo llamar a un técnico.");
    }
    if (!contexto.cuando) {
      avisos.push(
        "No has indicado cuándo aparece o empeora la lesión. Es el dato que más separa una condensación de una filtración: contestarlo afina mucho el resultado."
      );
    }

    return NextResponse.json({
      observaciones,
      candidatos,
      descartados: descartados.map((c) => ({
        etiqueta: c.patologia.etiqueta,
        motivos: c.motivos,
      })),
      concluyente: esConcluyente(vivos),
      diferencial: diferencial(vivos),
      urgencia: urgenciaGlobal(vivos),
      comprobaciones: comprobacionesPendientes(vivos),
      avisos,
    });
  } catch (e: any) {
    console.error("Error en el diagnóstico:", e);
    const seAgotoElTiempo = e?.name === "TimeoutError" || e?.name === "AbortError";
    return NextResponse.json(
      {
        error: seAgotoElTiempo
          ? "El análisis ha tardado demasiado. Prueba con menos fotos o de menor resolución."
          : "No se pudo analizar las fotografías. Vuelve a intentarlo.",
      },
      { status: 502 }
    );
  }
}
