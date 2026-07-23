import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function passwordTemporal() {
  return crypto.randomBytes(6).toString("base64url");
}

async function main() {
  await prisma.empresa.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      nombre: "Reformas García S.L.",
      cif: "B12345678",
      direccion: "C/ Mayor 12, Pontevedra",
      tel: "600 123 456",
      email: "info@reformasgarcia.es",
      ivaDefecto: 10,
    },
    update: {},
  });

  const usuariosSeed = [
    { nombre: "Manuel García", email: "manuel@reformasgarcia.es", rol: "ADMIN" as const },
    { nombre: "Pedro Souto", email: "pedro@reformasgarcia.es", rol: "EMPLEADO" as const },
  ];

  console.log("\nUsuarios creados (guarda estas contraseñas temporales, no se volverán a mostrar):\n");
  for (const u of usuariosSeed) {
    const existe = await prisma.usuario.findUnique({ where: { email: u.email } });
    if (existe) {
      console.log(`- ${u.email} ya existía, se mantiene su contraseña actual.`);
      continue;
    }
    const passwordTmp = passwordTemporal();
    const passwordHash = await bcrypt.hash(passwordTmp, 10);
    await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, passwordHash, rol: u.rol },
    });
    console.log(`- ${u.email} (${u.rol}) → contraseña temporal: ${passwordTmp}`);
  }
  console.log("");

  const p1 = await prisma.proveedor.upsert({
    where: { id: "p1" },
    create: { id: "p1", nombre: "Obramat", web: "https://www.obramat.es" },
    update: { web: "https://www.obramat.es" },
  });
  const p2 = await prisma.proveedor.upsert({
    where: { id: "p2" },
    create: { id: "p2", nombre: "Leroy Merlin", web: "https://www.leroymerlin.es" },
    update: { web: "https://www.leroymerlin.es" },
  });

  const productos = [
    { id: "m1", provId: p1.id, nombre: "Saco cemento gris 25 kg", unidad: "ud", precio: 4.85 },
    { id: "m2", provId: p1.id, nombre: "Placa yeso laminado 13 mm 120x250", unidad: "ud", precio: 6.9 },
    { id: "m3", provId: p1.id, nombre: "Mortero cola porcelánico 25 kg", unidad: "ud", precio: 9.75 },
    { id: "m4", provId: p2.id, nombre: "Gres porcelánico imitación madera m²", unidad: "m²", precio: 18.95 },
    { id: "m5", provId: p2.id, nombre: "Plato ducha resina 120x80", unidad: "ud", precio: 219.0 },
    { id: "m6", provId: p2.id, nombre: "Pintura plástica blanca 15 L", unidad: "ud", precio: 42.5 },
  ];
  for (const m of productos) {
    await prisma.producto.upsert({
      where: { id: m.id },
      create: m,
      update: {},
    });
  }

  await prisma.cliente.upsert({
    where: { id: "c1" },
    create: {
      id: "c1",
      nombre: "Ana López Rey",
      tel: "612 345 678",
      email: "ana.lopez@mail.com",
      direccion: "Av. de Vigo 45, 3ºB, Pontevedra",
      nif: "35123456X",
      notas: "Reforma piso heredado",
    },
    update: {},
  });

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
