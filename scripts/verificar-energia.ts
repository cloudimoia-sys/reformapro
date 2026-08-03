/**
 * Comprueba la evaluación energética previa.
 *
 * Lo que más importa aquí no es que el cálculo sea fino —es una estimación y se
 * presenta como tal—, sino que el documento NO PUEDA CONFUNDIRSE CON UN
 * CERTIFICADO. Emitir un certificado de eficiencia energética exige técnico
 * competente, programa reconocido y registro en la comunidad autónoma
 * (RD 390/2021). Un documento que se le parezca sin eso es un problema para
 * quien lo firma y para quien vende el programa.
 *
 * De ahí que la mitad de las comprobaciones sean sobre el aviso y sobre que la
 * letra salga siempre como rango.
 *
 * Ejecutar con: npx tsx scripts/verificar-energia.ts
 */
import { BAREMO } from "../lib/baremo";
import {
  AVISO_NO_ES_CERTIFICADO,
  bloqueParaElModelo,
  estimar,
  fichaParaElTecnico,
  mejorasPara,
  periodoDe,
  zonaClimatica,
  type DatosEnergeticos,
} from "../lib/energia";

let fallos = 0;
const mal = (q: string, d: string) => { fallos++; console.log(`  MAL  ${q}: ${d}`); };
const bien = (q: string) => console.log(`  ok   ${q}`);

/** Vivienda de referencia: piso de 1972, el caso más común en España. */
const BASE: DatosEnergeticos = {
  provincia: "Málaga",
  anio: 1972,
  superficie: 85,
  tipo: "PISO_ULTIMA_PLANTA",
  ventanas: "SIMPLE_METAL",
  fachadaAislada: false,
  cubiertaAislada: false,
  sistemaCalefaccion: "CALDERA_GASOLEO",
  sistemaAcs: "CALDERA_GASOLEO",
  renovables: false,
};

// ───────────────────── Nada puede parecer un certificado ─────────────────────
console.log("\nNada puede parecer un certificado oficial");

for (const [que, patron] of [
  ["dice que NO es un certificado", /no es un certificado/i],
  ["cita el RD 390/2021", /390\/2021/],
  ["exige técnico competente", /t[eé]cnico competente/i],
  ["nombra los programas reconocidos", /CE3X/],
  ["explica que hay que registrarlo en la comunidad autónoma", /registro de la comunidad aut[oó]noma/i],
] as [string, RegExp][]) {
  if (!patron.test(AVISO_NO_ES_CERTIFICADO)) mal("aviso", `no ${que}`);
  else bien(`el aviso ${que}`);
}

const instrucciones = bloqueParaElModelo(BASE);
if (!/PROHIBIDO/.test(instrucciones) || !/llamarlo certificado/i.test(instrucciones)) {
  mal("prompt", "no se le prohíbe al modelo llamarlo certificado");
} else bien("al modelo se le prohíbe expresamente llamarlo certificado");

if (!/n[uú]mero de registro/i.test(instrucciones)) {
  mal("prompt", "no se le prohíbe inventarse un número de registro, que es lo que lo haría pasar por oficial");
} else bien("al modelo se le prohíbe inventar un número de registro");

// La letra tiene que viajar como rango también en el prompt.
if (!/entre [A-G] y [A-G]/.test(instrucciones)) {
  mal("prompt", "la calificación no se le pasa al modelo como rango");
} else bien("la calificación se le pasa al modelo como rango, no como letra");

// ───────────────────────── La letra siempre es rango ─────────────────────────
console.log("\nLa calificación se da como rango, nunca como letra única");

const casos: [string, DatosEnergeticos][] = [
  ["piso de 1972 con gasóleo", BASE],
  ["unifamiliar de 1960 sin nada", { ...BASE, anio: 1960, tipo: "UNIFAMILIAR" }],
  ["piso de 2010", { ...BASE, anio: 2010, ventanas: "DOBLE_CON_ROTURA", sistemaCalefaccion: "CALDERA_GAS", sistemaAcs: "CALDERA_GAS" }],
  ["obra nueva de 2022 con aerotermia", { ...BASE, anio: 2022, ventanas: "TRIPLE", fachadaAislada: true, cubiertaAislada: true, sistemaCalefaccion: "AEROTERMIA", sistemaAcs: "AEROTERMIA", renovables: true }],
];
for (const [nombre, d] of casos) {
  const e = estimar(d);
  if (!e.desde || !e.hasta) mal(nombre, "no devuelve rango");
  else if (!e.motivos.length) mal(nombre, "no explica por qué sale ese rango");
}
if (!fallos) bien(`los ${casos.length} casos devuelven rango y explican el porqué`);

// Y el orden tiene que ser el que es: lo viejo y sucio, peor que lo nuevo y limpio.
const vieja = estimar({ ...BASE, anio: 1960, tipo: "UNIFAMILIAR" });
const nueva = estimar(casos[3][1]);
const ESCALA = ["G", "F", "E", "D", "C", "B", "A"];
if (ESCALA.indexOf(vieja.desde) >= ESCALA.indexOf(nueva.desde)) {
  mal("orden", `una unifamiliar de 1960 sale igual o mejor (${vieja.desde}) que una de 2022 con aerotermia (${nueva.desde})`);
} else bien(`una unifamiliar de 1960 (${vieja.desde}) sale por debajo de una de 2022 con aerotermia (${nueva.desde})`);

// El gasóleo tiene que pesar: la letra se calcula sobre emisiones.
const conGasoleo = estimar(BASE);
const conAerotermia = estimar({ ...BASE, sistemaCalefaccion: "AEROTERMIA", sistemaAcs: "AEROTERMIA" });
if (ESCALA.indexOf(conAerotermia.desde) <= ESCALA.indexOf(conGasoleo.desde)) {
  mal("sistema", "cambiar gasóleo por aerotermia no mejora la estimación, y sobre emisiones sí lo hace");
} else bien("cambiar gasóleo por aerotermia mejora la estimación");

/*
 * Una rehabilitación no convierte un edificio viejo en uno nuevo.
 *
 * Sin este techo, un piso de 1972 con fachada aislada, ventanas nuevas y
 * aerotermia salía A, la letra de un edificio de consumo casi nulo. Prometer una
 * A que el técnico luego no confirma deja al reformista dando explicaciones.
 */
const rehabilitado = estimar({
  ...BASE,
  ventanas: "DOBLE_PVC",
  fachadaAislada: true,
  cubiertaAislada: true,
  sistemaCalefaccion: "AEROTERMIA",
  sistemaAcs: "AEROTERMIA",
});
if (ESCALA.indexOf(rehabilitado.desde) > ESCALA.indexOf("C")) {
  mal("techo", `un piso de 1972 rehabilitado sale ${rehabilitado.desde}, y sin renovables no debería pasar de C`);
} else bien(`un piso de 1972 rehabilitado a fondo se queda en ${rehabilitado.desde}-${rehabilitado.hasta}, no llega a A`);

if (!rehabilitado.motivos.some((m) => /puentes t[eé]rmicos/i.test(m))) {
  mal("techo", "no se explica por qué no llega más arriba");
} else bien("y se explica por qué: los puentes térmicos y la hermeticidad no se arreglan a posteriori");

// Pero una obra nueva sí puede llegar arriba: el techo es por época, no un tope general.
if (estimar({ ...BASE, anio: 2022, ventanas: "TRIPLE", sistemaCalefaccion: "AEROTERMIA", sistemaAcs: "AEROTERMIA", renovables: true }).desde !== "A") {
  mal("techo", "el techo por época también frena a una obra nueva, y no debe");
} else bien("una obra nueva de 2022 con aerotermia y solar sí llega a A");

// ─────────────────────────── Zona climática ───────────────────────────
console.log("\nZona climática");

if (zonaClimatica("Málaga") !== "A3") mal("zona", `Málaga da ${zonaClimatica("Málaga")}, no A3`);
else bien("Málaga es A3");
if (zonaClimatica("MALAGA") !== "A3") mal("zona", "no reconoce la provincia sin tildes ni en mayúsculas");
else bien("reconoce la provincia escrita sin tildes o en mayúsculas");
if (zonaClimatica("Burgos") !== "E1") mal("zona", `Burgos da ${zonaClimatica("Burgos")}, no E1`);
else bien("Burgos es E1");

// La altitud endurece el invierno: una localidad de sierra no es su capital.
const llano = zonaClimatica("Granada");
const sierra = zonaClimatica("Granada", 1200);
if (!llano || !sierra || llano === sierra) mal("altitud", `a 1.200 m sale la misma zona que en la capital (${llano})`);
else bien(`a 1.200 m, Granada pasa de ${llano} a ${sierra}`);

if (zonaClimatica("Springfield") !== null) mal("zona", "se inventa la zona de una provincia que no existe");
else bien("una provincia que no reconoce devuelve nada, en vez de inventársela");

// ───────────────── Las mejoras existen y no se repiten ─────────────────
console.log("\nMejoras propuestas");

/*
 * Esta es la comprobación que evita el fallo silencioso.
 *
 * Las mejoras heredan el precio buscándose por su concepto EXACTO en el baremo.
 * Si alguien reescribe un concepto en lib/baremo.ts, la mejora deja de encontrar
 * su precio y sale sin valorar, sin que nada avise.
 */
for (const m of mejorasPara({ ...BASE, tipo: "UNIFAMILIAR" })) {
  if (!BAREMO.some((b) => b.concepto === m.concepto)) {
    mal("baremo", `la mejora "${m.concepto}" no existe con ese nombre exacto en lib/baremo.ts, así que saldría sin precio`);
  }
}
if (!fallos) bien("todas las mejoras encuentran su precio en el baremo");

// Lo que ya está hecho no se vuelve a presupuestar.
const yaAislada = mejorasPara({ ...BASE, fachadaAislada: true, cubiertaAislada: true });
if (yaAislada.some((m) => /SATE|insuflado/i.test(m.concepto))) {
  mal("mejoras", "propone aislar la fachada a quien ya la tiene aislada");
} else bien("no propone aislar la fachada si ya está aislada");
if (yaAislada.some((m) => /cubierta/i.test(m.concepto))) {
  mal("mejoras", "propone aislar la cubierta a quien ya la tiene aislada");
} else bien("no propone aislar la cubierta si ya está aislada");

const conBuenasVentanas = mejorasPara({ ...BASE, ventanas: "TRIPLE" });
if (conBuenasVentanas.some((m) => /Ventana/i.test(m.concepto))) {
  mal("mejoras", "propone cambiar ventanas de triple acristalamiento");
} else bien("no propone cambiar unas ventanas que ya son buenas");

// Un piso intermedio no tiene cubierta propia: presupuestarla es cobrar de más.
const intermedio = mejorasPara({ ...BASE, tipo: "PISO_INTERMEDIO" });
if (intermedio.some((m) => /cubierta/i.test(m.concepto))) {
  mal("mejoras", "propone aislar la cubierta de un piso en planta intermedia");
} else bien("un piso intermedio no lleva aislamiento de cubierta");

// Y las mediciones tienen que ser mayores que cero, o la partida sale en blanco.
if (mejorasPara(BASE).some((m) => m.cantidad <= 0)) {
  mal("mediciones", "alguna mejora sale con cantidad cero");
} else bien("todas las mejoras salen con medición mayor que cero");

// ─────────────────────── La ficha para el técnico ───────────────────────
console.log("\nFicha de toma de datos para el técnico");

const ficha = fichaParaElTecnico(BASE);
for (const campo of ["Zona climática", "Año de construcción", "Normativa", "Superficie", "Huecos", "Calefacción", "ACS"]) {
  if (!ficha.some((c) => c.campo.includes(campo))) mal("ficha", `no incluye "${campo}", que es de los que pregunta CE3X`);
}
if (!fallos) bien(`la ficha lleva los ${ficha.length} datos que necesita el técnico`);

// Sin altitud, la ficha tiene que decirlo en vez de callarse: la zona depende de eso.
const sinAltitud = fichaParaElTecnico(BASE).find((c) => c.campo === "Altitud");
if (!sinAltitud || !/compru[eé]bala/i.test(sinAltitud.valor)) {
  mal("ficha", "si falta la altitud no se avisa, y de ella depende la zona climática");
} else bien("si falta la altitud, la ficha se lo advierte al técnico");

// La época manda por encima de todo, y hasta 1979 no había exigencia ninguna.
if (!/NBE-CT-79/.test(periodoDe(1990).normativa)) mal("época", "1990 no se asocia a la NBE-CT-79");
else bien("1990 cae bajo la NBE-CT-79");
if (!/Sin exigencia/i.test(periodoDe(1972).normativa)) mal("época", "1972 no se marca como sin exigencia de aislamiento");
else bien("1972 se marca como sin ninguna exigencia de aislamiento");

console.log("");
if (fallos) {
  console.log(`EVALUACIÓN ENERGÉTICA INCORRECTA — ${fallos} comprobaciones mal`);
  process.exit(1);
}
console.log("EVALUACIÓN ENERGÉTICA CORRECTA — no puede confundirse con un certificado, la letra va como rango y las mejoras tienen precio");
