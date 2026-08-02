/**
 * Comprueba el catálogo de patologías y las reglas de contexto.
 *
 * Lo que se prueba aquí es justo lo que no se puede probar con un prompt: que un
 * dato de contexto concreto mueva el diagnóstico en la dirección correcta. El
 * caso que da sentido a todo el módulo es el primero — la misma mancha oscura en
 * una esquina, con "aparece en invierno" es condensación y con "aparece después
 * de llover" es filtración, y la reparación de una no tiene nada que ver con la
 * de la otra.
 *
 * Ejecutar con: npx tsx scripts/verificar-diagnostico.ts
 */
import { PATOLOGIAS, patologiaPorId, partidasDe, normativaDe, catalogoParaElModelo } from "../lib/patologias";
import { NORMATIVA } from "../lib/normativa";
import { BAREMO } from "../lib/baremo";
import {
  ordenarCandidatos,
  esConcluyente,
  diferencial,
  comprobacionesPendientes,
  urgenciaGlobal,
  type Contexto,
  type Observacion,
} from "../lib/diagnostico";

let fallos = 0;
const mal = (que: string, detalle: string) => {
  fallos++;
  console.log(`  MAL  ${que}: ${detalle}`);
};
const bien = (que: string) => console.log(`  ok   ${que}`);

// ───────────────────────── Integridad del catálogo ─────────────────────────
console.log("\nCatálogo de patologías");

const ids = new Set<string>();
for (const p of PATOLOGIAS) {
  if (ids.has(p.id)) mal("ids únicos", `"${p.id}" está repetido`);
  ids.add(p.id);
  if (!p.senales.length) mal(`${p.id}`, "no tiene señales visibles, así que el modelo no puede clasificarla");
  if (!p.comprobaciones.length) mal(`${p.id}`, "no tiene comprobaciones de visita");
  if (!p.actuacion.length) mal(`${p.id}`, "no tiene actuación");
  if (!p.porQueUrgencia) mal(`${p.id}`, "tiene urgencia sin justificar");
}
if (!fallos) bien(`${PATOLOGIAS.length} fichas, todas completas y con id único`);

// Una referencia rota deja al usuario sin la partida o sin la fuente, en silencio.
let rotas = 0;
for (const p of PATOLOGIAS) {
  for (const c of p.confundibleCon) {
    if (!patologiaPorId(c.id)) {
      mal(`${p.id}`, `se confunde con "${c.id}", que no existe en el catálogo`);
      rotas++;
    }
  }
  for (const concepto of p.partidas) {
    if (!BAREMO.some((b) => b.concepto === concepto)) {
      mal(`${p.id}`, `la partida "${concepto}" no está en el baremo`);
      rotas++;
    }
  }
  for (const n of p.normativa || []) {
    if (!NORMATIVA.some((x) => x.id === n)) {
      mal(`${p.id}`, `la normativa "${n}" no existe`);
      rotas++;
    }
  }
  if (p.partidas.length && partidasDe(p).length !== p.partidas.length) {
    mal(`${p.id}`, "alguna partida no se resuelve contra el baremo");
    rotas++;
  }
  if ((p.normativa || []).length && normativaDe(p).length !== (p.normativa || []).length) {
    mal(`${p.id}`, "alguna normativa no se resuelve");
    rotas++;
  }
}
if (!rotas) bien("todas las referencias a otras fichas, al baremo y a la normativa resuelven");

// El catálogo que se le pasa al modelo no puede llevar causas ni reparación:
// si las ve, razona hacia atrás desde la conclusión en vez de mirar la foto.
const paraElModelo = catalogoParaElModelo();
const filtra = PATOLOGIAS.filter((p) =>
  p.actuacion.some((a) => paraElModelo.includes(a)) || p.causas.some((c) => paraElModelo.includes(c))
);
if (filtra.length) mal("catálogo para el modelo", `filtra causas o actuación de ${filtra.length} fichas`);
else bien("al modelo solo se le dan las señales visibles, no las causas ni la reparación");

// ───────────────────────── Reglas de contexto ─────────────────────────
console.log("\nReglas de contexto");

const obs = (...ids: string[]): Observacion[] => [
  { imagen: 1, loQueSeVe: "prueba", candidatos: ids.map((id) => ({ id, confianza: "media" as const })) },
];

const gana = (caso: string, observaciones: Observacion[], ctx: Contexto, esperado: string) => {
  const vivos = ordenarCandidatos(observaciones, ctx).filter((c) => !c.descartado);
  if (!vivos.length) return mal(caso, "no ha quedado ningún candidato vivo");
  if (vivos[0].patologia.id !== esperado) {
    mal(caso, `esperaba "${esperado}" y ha ganado "${vivos[0].patologia.id}"`);
  } else {
    bien(`${caso} → ${vivos[0].patologia.etiqueta}`);
  }
};

const descarta = (caso: string, observaciones: Observacion[], ctx: Contexto, id: string) => {
  const todos = ordenarCandidatos(observaciones, ctx);
  const c = todos.find((x) => x.patologia.id === id);
  if (!c) return mal(caso, `"${id}" no aparece siquiera entre los candidatos`);
  if (!c.descartado) mal(caso, `"${id}" sigue vivo con ${c.puntos} puntos`);
  else bien(`${caso} → descarta ${c.patologia.etiqueta}`);
};

// EL CASO QUE JUSTIFICA EL MÓDULO: la misma mancha, dos diagnósticos opuestos.
const manchaHumeda = obs("humedad-condensacion", "humedad-filtracion-fachada", "humedad-capilaridad", "moho");
gana("Mancha en esquina que sale en invierno", manchaHumeda, { cuando: "invierno" }, "humedad-condensacion");
gana("La misma mancha, pero sale al llover", manchaHumeda, { cuando: "lluvia" }, "humedad-filtracion-fachada");

// La capilaridad sube desde el terreno: en una tercera planta no se sostiene.
gana(
  "Mancha baja en planta baja e igual todo el año",
  obs("humedad-capilaridad", "humedad-condensacion"),
  { planta: "baja", cuando: "siempre" },
  "humedad-capilaridad"
);
descarta(
  "La misma mancha en planta intermedia",
  obs("humedad-capilaridad", "humedad-condensacion"),
  { planta: "intermedia", cuando: "invierno" },
  "humedad-capilaridad"
);

// Lo que hay encima decide si el agua viene de cubierta o de una fuga.
gana(
  "Mancha de techo con un baño encima",
  obs("humedad-fuga-fontaneria", "humedad-filtracion-cubierta"),
  { encima: "bano-cocina" },
  "humedad-fuga-fontaneria"
);
gana(
  "Mancha de techo en última planta y con lluvia",
  obs("humedad-fuga-fontaneria", "humedad-filtracion-cubierta"),
  { encima: "cubierta", planta: "ultima", cuando: "lluvia" },
  "humedad-filtracion-cubierta"
);
descarta(
  "Filtración de cubierta con vivienda encima",
  obs("humedad-filtracion-cubierta", "humedad-fuga-fontaneria"),
  { encima: "vivienda", planta: "intermedia" },
  "humedad-filtracion-cubierta"
);

// Fisuras: la obra al lado es lo que convierte una fisura en un asiento.
gana(
  "Fisura con obra en la parcela contigua",
  obs("grieta-asiento", "fisura-retraccion"),
  { obraCerca: true },
  "grieta-asiento"
);
gana(
  "Fisura fina en edificio recién entregado",
  obs("grieta-asiento", "fisura-retraccion"),
  { antiguedad: 3 },
  "fisura-retraccion"
);

// Un paramento interior no puede tener una filtración de fachada.
descarta(
  "Filtración de fachada en tabique interior",
  obs("humedad-filtracion-fachada", "humedad-fuga-fontaneria"),
  { exterior: false },
  "humedad-filtracion-fachada"
);

// El contexto no puede inventar patologías que la foto no sugiere.
const inventadas = ordenarCandidatos(obs("moho"), { obraCerca: true, planta: "baja", cuando: "lluvia" });
if (inventadas.some((c) => c.patologia.id !== "moho")) {
  mal("el contexto no inventa", `ha aparecido ${inventadas.map((c) => c.patologia.id).join(", ")}`);
} else {
  bien("el contexto ajusta lo que ve la foto, pero no añade candidatos nuevos");
}

// Varias fotos de la misma lesión no deben inflar la puntuación.
const unaFoto = ordenarCandidatos(obs("moho"), {});
const tresFotos = ordenarCandidatos(
  [1, 2, 3].map((i) => ({ imagen: i, loQueSeVe: "x", candidatos: [{ id: "moho", confianza: "media" as const }] })),
  {}
);
if (unaFoto[0].puntos !== tresFotos[0].puntos) {
  mal("fotos repetidas", `una foto da ${unaFoto[0].puntos} y tres dan ${tresFotos[0].puntos}`);
} else {
  bien("tres fotos de la misma lesión no puntúan más que una");
}

// ───────────────────────── Honestidad del resultado ─────────────────────────
console.log("\nHonestidad del resultado");

// Sin contexto, la foto NO puede cerrar un diagnóstico de humedad.
const sinContexto = ordenarCandidatos(manchaHumeda, {}).filter((c) => !c.descartado);
if (esConcluyente(sinContexto)) {
  mal("diagnóstico sin contexto", "se ha dado por concluyente teniendo cuatro humedades compatibles");
} else {
  bien("con cuatro humedades compatibles y sin contexto, NO se cierra el diagnóstico");
}

// Y cuando no se cierra, tiene que decir cómo distinguirlas.
const dif = diferencial(sinContexto);
if (!dif.length) mal("diferencial", "no explica cómo distinguir el primer candidato de los siguientes");
else bien(`el diferencial explica cómo separarlo de ${dif.length} patologías parecidas`);

// Nunca se devuelve un diagnóstico sin comprobaciones que hacer en la visita.
const comps = comprobacionesPendientes(sinContexto);
if (comps.length < 3) mal("comprobaciones", `solo ha devuelto ${comps.length}`);
else bien(`${comps.length} comprobaciones concretas para la visita`);

// La urgencia del conjunto es la del candidato más grave, no la del primero.
const conEstructura = ordenarCandidatos(obs("fisura-retraccion", "flecha-forjado"), { antiguedad: 3 });
const urg = urgenciaGlobal(conEstructura.filter((c) => !c.descartado));
if (urg?.nivel !== "muy alta") {
  mal("urgencia global", `con una flecha de forjado entre los candidatos ha dado urgencia "${urg?.nivel}"`);
} else {
  bien("con una posible flecha de forjado, la urgencia sube aunque no sea el primer candidato");
}

// Toda patología que puede acabar en un problema estructural avisa de derivar.
const sinDerivar = PATOLOGIAS.filter((p) => p.urgencia === "muy alta" && !p.derivar);
if (sinDerivar.length) {
  mal("derivar a técnico", `${sinDerivar.map((p) => p.id).join(", ")} son de urgencia muy alta y no derivan`);
} else {
  bien("todas las patologías de urgencia muy alta indican cuándo llamar a un técnico");
}

console.log(
  fallos
    ? `\nDIAGNÓSTICO INCORRECTO — ${fallos} ${fallos === 1 ? "fallo" : "fallos"}`
    : "\nDIAGNÓSTICO CORRECTO — el contexto mueve el diagnóstico como debe, y lo que la foto no puede cerrar se dice"
);
process.exit(fallos ? 1 : 0);
