/**
 * Comprueba el calendario laboral, el motor de planificación y el .ics.
 *
 * Una fecha de entrega es un compromiso con un cliente. Si el programa cuenta
 * mal un puente o mete el fraguado en días laborables, la obra se promete antes
 * de lo posible y quien da la cara es el reformista. Por eso esto se prueba con
 * fechas reales y comprobables a mano en un calendario de pared.
 *
 * Ejecutar con: npx tsx scripts/verificar-planificacion.ts
 */
import { domingoDePascua, festivosNacionales, calendarioLaboral } from "../lib/festivos";
import { planificar, fasesDesdeCapitulos, type FaseEntrada } from "../lib/planificacion";
import { generarICS } from "../lib/ics";

let fallos = 0;
const mal = (que: string, detalle: string) => {
  fallos++;
  console.log(`  MAL  ${que}: ${detalle}`);
};
const bien = (que: string) => console.log(`  ok   ${que}`);
const igual = (que: string, obtenido: unknown, esperado: unknown) =>
  obtenido === esperado ? bien(`${que} → ${obtenido}`) : mal(que, `esperaba ${esperado} y ha dado ${obtenido}`);

// ───────────────────────── Calendario laboral ─────────────────────────
console.log("\nCalendario laboral");

// Fechas contrastables: Pascua de 2026 fue el 5 de abril; la de 2027, el 28 de marzo.
igual("Domingo de Pascua 2026", domingoDePascua(2026).toISOString().slice(0, 10), "2026-04-05");
igual("Domingo de Pascua 2027", domingoDePascua(2027).toISOString().slice(0, 10), "2027-03-28");

const v2026 = festivosNacionales(2026).find((f) => f.nombre === "Viernes Santo");
igual("Viernes Santo 2026", v2026?.fecha, "2026-04-03");

const cal = calendarioLaboral(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2027, 0, 1)));
const dia = (s: string) => new Date(`${s}T00:00:00Z`);

if (cal.esLaborable(dia("2026-12-25"))) mal("Navidad", "sale como día de trabajo");
else bien("Navidad no es laborable");
if (cal.esLaborable(dia("2026-08-15"))) mal("15 de agosto", "sale como día de trabajo");
else bien("la Asunción no es laborable");
if (cal.esLaborable(dia("2026-04-03"))) mal("Viernes Santo", "sale como día de trabajo");
else bien("el Viernes Santo no es laborable");
// 2026-08-01 es sábado.
if (cal.esLaborable(dia("2026-08-01"))) mal("sábado", "sale como día de trabajo sin haberlo pedido");
else bien("los sábados no se trabajan salvo que se diga");

const calSab = calendarioLaboral(dia("2026-01-01"), dia("2027-01-01"), [], true);
if (!calSab.esLaborable(dia("2026-08-01"))) mal("sábados activados", "sigue sin contar el sábado");
else bien("activando sábados, el sábado cuenta");

const calPropio = calendarioLaboral(dia("2026-01-01"), dia("2027-01-01"), ["2026-09-08"]);
if (calPropio.esLaborable(dia("2026-09-08"))) mal("festivo propio", "no se ha tenido en cuenta");
else bien("los festivos locales que añade el usuario se descuentan");

// ───────────────────────── Motor de planificación ─────────────────────────
console.log("\nPlanificación");

// Cinco jornadas empezando el lunes 1 de junio de 2026 acaban el viernes 5.
const unaFase: FaseEntrada[] = [{ id: "a", nombre: "Demoliciones", dias: 5 }];
const p1 = planificar(unaFase, "2026-06-01");
igual("5 días desde el lunes 1 de junio", p1.fin, "2026-06-05");

// Las mismas cinco jornadas empezando el jueves saltan el fin de semana.
const p2 = planificar(unaFase, "2026-06-04");
igual("5 días desde el jueves 4 de junio", p2.fin, "2026-06-10");

// Si el inicio cae en sábado, la obra arranca el lunes.
const p3 = planificar([{ id: "a", nombre: "x", dias: 1 }], "2026-06-06");
igual("inicio en sábado", p3.inicio, "2026-06-08");

/**
 * Una fase que cruza la Navidad se alarga por el festivo y el fin de semana.
 *
 * A mano: lunes 21, martes 22, miércoles 23 y jueves 24 son días de trabajo (la
 * Nochebuena NO es festivo nacional, por mucho que lo parezca); el viernes 25 es
 * Navidad y el 26 y 27 caen en fin de semana. La quinta jornada es el lunes 28.
 */
const p4 = planificar([{ id: "a", nombre: "x", dias: 5 }], "2026-12-21");
igual("5 días desde el lunes 21 de diciembre", p4.fin, "2026-12-28");

// LA ESPERA VA EN DÍAS DE CALENDARIO: el hormigón fragua también en domingo.
const conEspera: FaseEntrada[] = [
  { id: "a", nombre: "Cimentación", dias: 5, esperaDias: 21 },
  { id: "b", nombre: "Estructura", dias: 10, dependeDe: "a" },
];
const p5 = planificar(conEspera, "2026-06-01");
const fa = p5.fases.find((f) => f.id === "a")!;
const fb = p5.fases.find((f) => f.id === "b")!;
igual("cimentación termina", fa.fin, "2026-06-05");
// 5 de junio + 21 días naturales = 26 de junio (viernes); la siguiente arranca el lunes 29.
igual("estructura arranca tras el fraguado", fb.inicio, "2026-06-29");

// Dos fases que dependen de la misma corren en paralelo.
const paralelo: FaseEntrada[] = [
  { id: "a", nombre: "Rozas", dias: 4 },
  { id: "b", nombre: "Fontanería", dias: 6, dependeDe: "a" },
  { id: "c", nombre: "Electricidad", dias: 4, dependeDe: "a" },
];
const p6 = planificar(paralelo, "2026-06-01");
const pb = p6.fases.find((f) => f.id === "b")!;
const pc = p6.fases.find((f) => f.id === "c")!;
igual("fontanería y electricidad empiezan el mismo día", pb.inicio, pc.inicio);
// El camino crítico pasa por la más larga de las dos, no por las dos.
if (!pb.critica || pc.critica) {
  mal("camino crítico", `crítica fontanería=${pb.critica}, electricidad=${pc.critica}`);
} else {
  bien("el camino crítico pasa por la fase larga, y la corta queda con holgura");
}

// Un bucle de dependencias se detecta y se explica, no cuelga la pantalla.
const bucle: FaseEntrada[] = [
  { id: "a", nombre: "A", dias: 2, dependeDe: "b" },
  { id: "b", nombre: "B", dias: 2, dependeDe: "a" },
];
const p7 = planificar(bucle, "2026-06-01");
if (p7.fases.length || !p7.avisos.some((a) => /círculo/i.test(a))) {
  mal("bucle de dependencias", "no se ha detectado");
} else {
  bien("un bucle de dependencias se detecta y se avisa en vez de colgarse");
}

// Una dependencia que apunta a una fase borrada no puede dar una fecha inventada.
const huerfana = planificar([{ id: "a", nombre: "A", dias: 3, dependeDe: "ya-no-existe" }], "2026-06-01");
if (!huerfana.avisos.length) mal("dependencia rota", "no ha avisado");
else bien("una dependencia que ya no existe se avisa y se planifica desde el inicio");

// Mover el inicio de la obra mueve todo, y el resultado es siempre el mismo.
const a = planificar(conEspera, "2026-06-01");
const b = planificar(conEspera, "2026-06-01");
if (JSON.stringify(a) !== JSON.stringify(b)) mal("determinismo", "dos cálculos iguales dan resultados distintos");
else bien("el mismo dato de entrada da siempre la misma fecha");

// Los días naturales que ve el cliente son más que los trabajados.
if (p5.diasNaturales <= p5.diasLaborables) {
  mal("días naturales", `${p5.diasNaturales} naturales frente a ${p5.diasLaborables} laborables`);
} else {
  bien(`${p5.diasLaborables} días de trabajo son ${p5.diasNaturales} naturales para el cliente`);
}

// ───────────────────────── Fases desde capítulos ─────────────────────────
console.log("\nArranque desde un presupuesto");

const desdeCapitulos = fasesDesdeCapitulos([
  { nombre: "Pintura", importe: 2000 },
  { nombre: "Demoliciones", importe: 1800 },
  { nombre: "Estructura", importe: 9000 },
  { nombre: "Alicatados y solados", importe: 4000 },
]);
const orden = desdeCapitulos.map((f) => f.nombre);
if (orden[0] !== "Demoliciones" || orden[orden.length - 1] !== "Pintura") {
  mal("orden de ejecución", orden.join(" → "));
} else {
  bien(`los capítulos se ordenan por oficio: ${orden.join(" → ")}`);
}
const estructura = desdeCapitulos.find((f) => f.nombre === "Estructura")!;
if (!estructura.esperaDias) mal("espera de fraguado", "la estructura sale sin espera");
else bien(`la estructura arrastra ${estructura.esperaDias} días de fraguado antes de la fase siguiente`);
if (desdeCapitulos.some((f, i) => i > 0 && !f.dependeDe)) {
  mal("encadenado", "hay fases sueltas que arrancarían todas el primer día");
} else {
  bien("las fases salen encadenadas, no todas el primer día");
}

// ───────────────────────── Calendario .ics ─────────────────────────
console.log("\nArchivo de calendario");

const ics = generarICS({
  obraId: "obra1",
  nombreObra: "Reforma piso; Calle Mayor, 4",
  direccion: "Calle Mayor 4",
  fases: p5.fases,
  dominio: "reformapro.app",
});

if (!ics.startsWith("BEGIN:VCALENDAR") || !ics.trimEnd().endsWith("END:VCALENDAR")) {
  mal("estructura del .ics", "no abre y cierra como debe");
} else {
  bien("el archivo abre y cierra como manda la norma");
}
if (!/\r\n/.test(ics)) mal("saltos de línea", "faltan los CRLF que exige el formato");
else bien("los saltos de línea son CRLF");
// Los caracteres especiales del nombre tienen que ir escapados o el archivo se rompe.
if (!ics.includes("Reforma piso\\; Calle Mayor\\, 4")) {
  mal("escapado", "el punto y coma y la coma del nombre no van escapados");
} else {
  bien("los puntos y coma y las comas van escapados");
}
if ((ics.match(/BEGIN:VEVENT/g) || []).length !== p5.fases.length) {
  mal("eventos", "no hay un evento por fase");
} else {
  bien(`${p5.fases.length} eventos, uno por fase`);
}
// El UID estable es lo que hace que al refrescar se actualicen los eventos en
// vez de duplicarse. Es el fallo clásico de los feeds hechos a mano.
const ics2 = generarICS({
  obraId: "obra1",
  nombreObra: "Reforma piso",
  fases: planificar(conEspera, "2026-07-01").fases,
  dominio: "reformapro.app",
});
const uids = (t: string) => (t.match(/UID:[^\r\n]+/g) || []).sort().join("|");
if (uids(ics) !== uids(ics2)) {
  mal("UID estables", "cambian al replanificar, así que el calendario duplicaría los eventos");
} else {
  bien("los UID no cambian al replanificar: el calendario actualiza en vez de duplicar");
}
// DTEND es exclusivo en eventos de día completo: una fase que acaba el día 5 debe
// llevar DTEND el 6, o en el calendario se ve un día menos.
if (!ics.includes(`DTEND;VALUE=DATE:20260606`)) {
  mal("fin de evento", "DTEND no es el día siguiente al fin de la fase");
} else {
  bien("DTEND va al día siguiente, como exige el formato de día completo");
}
// Ninguna línea puede pasar de 75 octetos sin plegar.
const largas = ics.split("\r\n").filter((l) => Buffer.from(l, "utf8").length > 75);
if (largas.length) mal("líneas largas", `${largas.length} líneas sin plegar romperían Outlook`);
else bien("ninguna línea pasa de 75 octetos");

console.log(
  fallos
    ? `\nPLANIFICACIÓN INCORRECTA — ${fallos} ${fallos === 1 ? "fallo" : "fallos"}`
    : "\nPLANIFICACIÓN CORRECTA — los días laborables, los festivos y las esperas de fraguado se cuentan bien"
);
process.exit(fallos ? 1 : 0);
