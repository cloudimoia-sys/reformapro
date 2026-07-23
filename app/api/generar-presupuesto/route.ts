import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

type PartidaIA = {
  capitulo?: string;
  concepto?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precio?: number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar GEMINI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const f = await req.json();

  const [productos, proveedores] = await Promise.all([
    prisma.producto.findMany(),
    prisma.proveedor.findMany(),
  ]);
  const catalogo = productos
    .map((p) => {
      const prov = proveedores.find((x) => x.id === p.provId);
      return `${p.nombre} (${prov ? prov.nombre : "—"}): ${p.precio} €/${p.unidad}`;
    })
    .join("; ");

  const prompt = `Eres un jefe de obra español experto en mediciones y presupuestos de reformas, que trabaja con el banco de precios del Generador de Precios de la Construcción de CYPE (generadordeprecios.info), sección Rehabilitación. Genera las partidas de un presupuesto con estos datos:
- Tipo de reforma: ${f.tipo}
- Superficie aproximada: ${f.m2 || "no indicada"} m²
- Calidad de materiales: ${f.calidad}
- Estancias afectadas: ${f.estancias || "no indicadas"}
- Detalles adicionales: ${f.detalles || "ninguno"}

Precios de materiales del catálogo propio del reformista (úsalos como referencia cuando encajen): ${catalogo}

Reglas de formato (estilo banco de precios CYPE):
- Organiza cada partida en su capítulo de obra: Demoliciones, Albañilería, Fontanería, Electricidad, Revestimientos, Carpintería, Pintura, Equipamiento o Gestión de residuos.
- El concepto es el nombre de la unidad de obra; la descripción es técnica y de una línea (material, formato, colocación, incluye mano de obra y medios auxiliares).
- Precios unitarios realistas del mercado español actual, coherentes con el banco de precios CYPE para calidad ${String(f.calidad || "").toLowerCase()}.
- Incluye siempre gestión de residuos si hay demoliciones.
Responde SOLO con JSON válido, sin markdown ni texto adicional, con este formato exacto:
{"partidas":[{"capitulo":"...","concepto":"...","descripcion":"...","cantidad":1,"unidad":"ud|m²|ml|h|pa","precio":0}]}
Máximo 14 partidas, ordenadas por capítulo en el orden lógico de ejecución de la obra.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // maxOutputTokens generoso: los modelos Gemini "thinking" consumen parte del
          // presupuesto de tokens en razonamiento interno antes de escribir el JSON final.
          generationConfig: { maxOutputTokens: 8192, responseMimeType: "application/json" },
        }),
      }
    );

    if (!r.ok) {
      const detalle = await r.text();
      console.error("Error de Gemini:", r.status, detalle);
      return NextResponse.json({ error: "El proveedor de IA no respondió correctamente." }, { status: 502 });
    }

    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("\n") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const lineas = (parsed.partidas || []).map((p: PartidaIA) => ({
      capitulo: p.capitulo || "Varios",
      concepto: p.concepto || "",
      descripcion: p.descripcion || "",
      cantidad: Number(p.cantidad) || 1,
      unidad: p.unidad || "ud",
      precio: Number(p.precio) || 0,
    }));

    if (!lineas.length) throw new Error("sin partidas");

    return NextResponse.json({ lineas });
  } catch (e) {
    console.error("Error generando presupuesto con IA:", e);
    return NextResponse.json({ error: "No se pudo generar el presupuesto." }, { status: 502 });
  }
}
