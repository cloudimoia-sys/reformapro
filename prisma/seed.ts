import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

/** Email del admin de la empresa de ejemplo: sirve de ancla para no duplicarla. */
const EMAIL_ADMIN_DEMO = "manuel@reformasgarcia.es";

function passwordTemporal() {
  return crypto.randomBytes(6).toString("base64url");
}

/**
 * Crea una empresa de ejemplo con datos para trastear en local.
 *
 * Ya no usa ids fijos ("p1", "m1", "c1"): esos ids son únicos en toda la base, así
 * que al ejecutar la semilla dos veces o con varias empresas chocarían entre sí.
 * Ahora el ancla es el email del admin, que sí es único por diseño.
 */
async function main() {
  const yaExiste = await prisma.usuario.findUnique({
    where: { email: EMAIL_ADMIN_DEMO },
    select: { empresaId: true },
  });

  if (yaExiste) {
    console.log("La empresa de ejemplo ya existe; no se toca nada.");
    return;
  }

  const empresa = await prisma.empresa.create({
    data: {
      nombre: "Reformas García S.L.",
      cif: "B12345678",
      direccion: "C/ Mayor 12, Pontevedra",
      tel: "600 123 456",
      email: "info@reformasgarcia.es",
      ivaDefecto: 10,
      plan: "PRO",
      estadoSusc: "ACTIVA",
    },
  });
  const empresaId = empresa.id;

  const usuariosSeed = [
    { nombre: "Manuel García", email: EMAIL_ADMIN_DEMO, rol: "ADMIN" as const },
    { nombre: "Pedro Souto", email: "pedro@reformasgarcia.es", rol: "EMPLEADO" as const },
  ];

  console.log("\nUsuarios creados (guarda estas contraseñas, no se volverán a mostrar):\n");
  for (const u of usuariosSeed) {
    const passwordTmp = passwordTemporal();
    await prisma.usuario.create({
      data: {
        empresaId,
        nombre: u.nombre,
        email: u.email,
        passwordHash: await bcrypt.hash(passwordTmp, 10),
        rol: u.rol,
      },
    });
    console.log(`- ${u.email} (${u.rol}) → contraseña: ${passwordTmp}`);
  }
  console.log("");

  const obramat = await prisma.proveedor.create({
    data: { empresaId, nombre: "Obramat", web: "https://www.obramat.es" },
  });
  const leroy = await prisma.proveedor.create({
    data: { empresaId, nombre: "Leroy Merlin", web: "https://www.leroymerlin.es" },
  });

  await prisma.producto.createMany({
    data: [
      { empresaId, provId: obramat.id, nombre: "Saco cemento gris 25 kg", unidad: "ud", precio: 4.85 },
      { empresaId, provId: obramat.id, nombre: "Placa yeso laminado 13 mm 120x250", unidad: "ud", precio: 6.9 },
      { empresaId, provId: obramat.id, nombre: "Mortero cola porcelánico 25 kg", unidad: "ud", precio: 9.75 },
      { empresaId, provId: leroy.id, nombre: "Gres porcelánico imitación madera m²", unidad: "m²", precio: 18.95 },
      { empresaId, provId: leroy.id, nombre: "Plato ducha resina 120x80", unidad: "ud", precio: 219.0 },
      { empresaId, provId: leroy.id, nombre: "Pintura plástica blanca 15 L", unidad: "ud", precio: 42.5 },
    ],
  });

  await prisma.cliente.create({
    data: {
      empresaId,
      nombre: "Ana López Rey",
      tel: "612 345 678",
      email: "ana.lopez@mail.com",
      direccion: "Av. de Vigo 45, 3ºB, Pontevedra",
      nif: "35123456X",
      notas: "Reforma piso heredado",
    },
  });

  console.log("Seed completado. Empresa de ejemplo:", empresa.nombre);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
