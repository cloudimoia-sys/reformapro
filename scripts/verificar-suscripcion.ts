/**
 * Comprueba el período de prueba.
 *
 * Esto decide si a un cliente que está pagando se le deja trabajar. Los dos
 * fallos posibles no son igual de graves y la prueba lo refleja: bloquear a quien
 * puede escribir es un cliente parado con una obra delante llamándote por
 * teléfono; dejar escribir un día de más a quien no ha pagado no le hace daño a
 * nadie. Ante la duda, se deja pasar.
 *
 * Ejecutar con: npx tsx scripts/verificar-suscripcion.ts
 */
import { estadoDeSuscripcion, type EstadoSuscripcion } from "../lib/suscripcion";

let fallos = 0;
const mal = (que: string, detalle: string) => {
  fallos++;
  console.log(`  MAL  ${que}: ${detalle}`);
};
const bien = (que: string) => console.log(`  ok   ${que}`);

const AHORA = new Date("2026-08-02T12:00:00Z");
const enDias = (d: number) => new Date(AHORA.getTime() + d * 24 * 60 * 60 * 1000);

const s = (estadoSusc: EstadoSuscripcion, trialFinaliza: Date | null) =>
  estadoDeSuscripcion({ estadoSusc, trialFinaliza }, AHORA);

const escribe = (caso: string, e: EstadoSuscripcion, t: Date | null) => {
  const r = s(e, t);
  if (r.soloLectura) mal(caso, "ha quedado en solo lectura y debería poder escribir");
  else bien(`${caso} → escribe`);
};

const soloLee = (caso: string, e: EstadoSuscripcion, t: Date | null) => {
  const r = s(e, t);
  if (!r.soloLectura) mal(caso, "puede escribir y no debería");
  else if (!r.aviso) mal(caso, "está bloqueada y no se le explica por qué");
  else bien(`${caso} → solo lectura, con aviso`);
};

console.log("\nQuién puede trabajar");

escribe("Cuenta pagada", "ACTIVA", enDias(-100));
escribe("Prueba con 10 días por delante", "PRUEBA", enDias(10));
escribe("Prueba con unas horas todavía", "PRUEBA", new Date(AHORA.getTime() + 3 * 60 * 60 * 1000));

soloLee("Prueba vencida ayer", "PRUEBA", enDias(-1));
soloLee("Prueba vencida hace un mes", "PRUEBA", enDias(-30));
soloLee("Cuenta suspendida", "SUSPENDIDA", enDias(30));
soloLee("Cuenta cancelada", "CANCELADA", null);

/**
 * El caso que más miedo da: un campo vacío no puede dejar a nadie sin trabajar.
 *
 * Es lo que pasaría con las cuentas creadas antes de que esto existiera, y es
 * además la forma de dejar una cuenta abierta sin marcarla como pagada.
 */
escribe("Prueba SIN fecha de fin", "PRUEBA", null);

// Una cuenta pagada manda sobre la fecha de prueba, esté como esté.
const pagadaVencida = s("ACTIVA", enDias(-500));
if (pagadaVencida.soloLectura || pagadaVencida.aviso) {
  mal("Pagada con la prueba vencida hace año y medio", "sale bloqueada o con aviso");
} else {
  bien("una cuenta pagada manda sobre la fecha de prueba, y no enseña ningún aviso");
}

console.log("\nQué se le dice al usuario");

// Nada de avisos al principio: uno permanente deja de leerse.
const dia14 = s("PRUEBA", enDias(14));
if (dia14.aviso) mal("Recién registrada", "ya le sale un aviso el primer día");
else bien("los primeros días no se avisa de nada");

const dia5 = s("PRUEBA", enDias(5));
if (!dia5.aviso || dia5.aviso.tono !== "info") mal("A 5 días", `tono ${dia5.aviso?.tono}`);
else bien("a 5 días aparece el aviso, en tono informativo");

const dia2 = s("PRUEBA", enDias(2));
if (dia2.aviso?.tono !== "atencion") mal("A 2 días", `tono ${dia2.aviso?.tono}`);
else bien("a 2 días el aviso sube de tono");

const vencida = s("PRUEBA", enDias(-1));
if (vencida.aviso?.tono !== "bloqueo") mal("Vencida", `tono ${vencida.aviso?.tono}`);
else bien("vencida, el aviso es de bloqueo");

// El mensaje tiene que decir que NO se pierde nada. Es lo que evita la llamada
// de teléfono asustada, y es verdad: la cuenta queda en solo lectura.
for (const [nombre, r] of [
  ["prueba vencida", vencida],
  ["suspendida", s("SUSPENDIDA", null)],
  ["cancelada", s("CANCELADA", null)],
] as const) {
  if (!/consultar|acceso|sigue/i.test(r.aviso?.texto || "")) {
    mal(`Mensaje de ${nombre}`, "no deja claro que su trabajo sigue estando");
  } else {
    bien(`el mensaje de ${nombre} aclara que no se pierde nada`);
  }
}

console.log("\nDías restantes");

// Se redondea hacia arriba: con 30 horas quedan 2 días, no 1. Hacia abajo, el
// último día se anunciaría como "te quedan 0 días" con la cuenta funcionando.
const casos: [number, number][] = [
  [10, 10],
  [1, 1],
  [0.2, 1],
  [1.25, 2],
];
for (const [dias, esperado] of casos) {
  const r = s("PRUEBA", new Date(AHORA.getTime() + dias * 24 * 60 * 60 * 1000));
  if (r.diasRestantes !== esperado) mal(`${dias} días reales`, `dice ${r.diasRestantes}, esperaba ${esperado}`);
  else bien(`${dias} días reales → "${esperado}"`);
}

const singular = s("PRUEBA", enDias(1));
if (!singular.aviso?.texto.includes("1 día de prueba")) {
  mal("Singular", `dice "${singular.aviso?.texto.slice(0, 40)}…"`);
} else {
  bien('con un día dice "1 día", no "1 días"');
}

console.log(
  fallos
    ? `\nSUSCRIPCIÓN INCORRECTA — ${fallos} ${fallos === 1 ? "fallo" : "fallos"}`
    : "\nSUSCRIPCIÓN CORRECTA — nadie que deba trabajar se queda bloqueado, y a quien vence se le explica sin asustarle"
);
process.exit(fallos ? 1 : 0);
