/**
 * Prueba de aislamiento entre empresas.
 *
 * Monta dos empresas con datos completos y comprueba que, actuando como la empresa
 * A, es imposible leer o tocar nada de la B. No comprueba el código "por encima":
 * ejecuta de verdad las operaciones contra una base de datos real usando el mismo
 * cliente filtrado que usan las páginas y las acciones.
 *
 * Uso (NUNCA contra producción — borra datos):
 *   DATABASE_URL=<url-de-pruebas> DIRECT_URL=<idem> npx tsx scripts/verificar-aislamiento.ts
 */
import { PrismaClient } from "@prisma/client";
import { tenantDb } from "../lib/tenantDb";

const prisma = new PrismaClient();

let fallos = 0;
let pasadas = 0;

function ok(nombre: string) {
  pasadas++;
  console.log(`  OK   ${nombre}`);
}

function mal(nombre: string, detalle: string) {
  fallos++;
  console.error(`  FUGA ${nombre} -> ${detalle}`);
}

/** Comprueba que una operación cruzada no devuelve ni toca nada. */
async function noDebeVer(nombre: string, fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    if (r === null || r === undefined) return ok(nombre);
    if (Array.isArray(r) && r.length === 0) return ok(nombre);
    if (typeof r === "number" && r === 0) return ok(nombre);
    if (typeof r === "object" && r !== null && "count" in r) {
      const n = (r as { count: number }).count;
      return n === 0 ? ok(nombre) : mal(nombre, `afectó a ${n} filas de la otra empresa`);
    }
    return mal(nombre, `devolvió datos: ${JSON.stringify(r).slice(0, 120)}`);
  } catch (e) {
    // Que lance también es aceptable: significa que no pasó.
    return ok(`${nombre} (rechazado: ${(e as Error).message.slice(0, 60)})`);
  }
}

/** Comprueba que una operación PROHIBIDA por el cliente filtrado efectivamente lanza. */
async function debeLanzar(nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    mal(nombre, "NO lanzó: la operación insegura está permitida");
  } catch {
    ok(nombre);
  }
}

async function crearEmpresaDePrueba(sufijo: string) {
  const empresa = await prisma.empresa.create({
    data: { nombre: `Empresa ${sufijo}`, email: `test-${sufijo}@ejemplo.test` },
  });
  const empresaId = empresa.id;

  const usuario = await prisma.usuario.create({
    data: {
      empresaId,
      nombre: `Admin ${sufijo}`,
      email: `admin-${sufijo}@ejemplo.test`,
      passwordHash: "x",
      rol: "ADMIN",
    },
  });
  const cliente = await prisma.cliente.create({ data: { empresaId, nombre: `Cliente ${sufijo}` } });
  const proveedor = await prisma.proveedor.create({ data: { empresaId, nombre: `Proveedor ${sufijo}` } });
  const producto = await prisma.producto.create({
    data: { empresaId, provId: proveedor.id, nombre: `Material secreto ${sufijo}`, unidad: "ud", precio: 999 },
  });
  const presupuesto = await prisma.presupuesto.create({
    data: { empresaId, numero: "PRE-2099-001", clienteId: cliente.id, titulo: `Obra ${sufijo}`, iva: 10 },
  });
  const linea = await prisma.lineaPresupuesto.create({
    data: {
      empresaId,
      presupuestoId: presupuesto.id,
      concepto: `Partida ${sufijo}`,
      cantidad: 1,
      unidad: "ud",
      precio: 100,
    },
  });
  const factura = await prisma.factura.create({
    data: { empresaId, numero: "FAC-2099-001", presupuestoId: presupuesto.id, clienteId: cliente.id, base: 100, iva: 10, total: 110 },
  });

  return { empresaId, usuario, cliente, proveedor, producto, presupuesto, linea, factura };
}

async function limpiar() {
  const empresas = await prisma.empresa.findMany({
    where: { email: { endsWith: "@ejemplo.test" } },
    select: { id: true },
  });
  // El borrado en cascada se lleva por delante todo lo que cuelga de cada empresa.
  for (const e of empresas) await prisma.empresa.delete({ where: { id: e.id } });
}

async function main() {
  console.log("Preparando dos empresas de prueba...\n");
  await limpiar();
  const A = await crearEmpresaDePrueba("A");
  const B = await crearEmpresaDePrueba("B");

  // Este es el cliente que usan de verdad las páginas y las acciones.
  const db = tenantDb(A.empresaId);

  console.log("1) Los listados de A no incluyen nada de B");
  for (const [nombre, fn] of [
    ["clientes", () => db.cliente.findMany()],
    ["proveedores", () => db.proveedor.findMany()],
    ["productos", () => db.producto.findMany()],
    ["presupuestos", () => db.presupuesto.findMany()],
    ["lineas", () => db.lineaPresupuesto.findMany()],
    ["facturas", () => db.factura.findMany()],
    ["usuarios", () => db.usuario.findMany()],
  ] as const) {
    const filas = (await fn()) as { empresaId: string }[];
    const ajenas = filas.filter((r) => r.empresaId !== A.empresaId);
    if (ajenas.length) mal(`listado de ${nombre}`, `${ajenas.length} filas de otra empresa`);
    else ok(`listado de ${nombre} (${filas.length} propias)`);
  }

  console.log("\n2) Con los ids de B, la empresa A no ve nada");
  await noDebeVer("leer cliente de B", () => db.cliente.findFirst({ where: { id: B.cliente.id } }));
  await noDebeVer("leer presupuesto de B", () => db.presupuesto.findFirst({ where: { id: B.presupuesto.id } }));
  await noDebeVer("leer producto de B", () => db.producto.findFirst({ where: { id: B.producto.id } }));
  await noDebeVer("leer factura de B", () => db.factura.findFirst({ where: { id: B.factura.id } }));
  await noDebeVer("leer usuario de B", () => db.usuario.findFirst({ where: { id: B.usuario.id } }));
  await noDebeVer("leer empresa B", () => db.empresa.findFirst({ where: { id: B.empresaId } }));

  console.log("\n3) Con los ids de B, la empresa A no puede modificar ni borrar");
  await noDebeVer("cambiar contraseña del admin de B", () =>
    db.usuario.updateMany({ where: { id: B.usuario.id }, data: { passwordHash: "tomado" } })
  );
  await noDebeVer("borrar usuario de B", () => db.usuario.deleteMany({ where: { id: B.usuario.id } }));
  await noDebeVer("editar cliente de B", () =>
    db.cliente.updateMany({ where: { id: B.cliente.id }, data: { nombre: "tomado" } })
  );
  await noDebeVer("borrar cliente de B", () => db.cliente.deleteMany({ where: { id: B.cliente.id } }));
  await noDebeVer("editar presupuesto de B", () =>
    db.presupuesto.updateMany({ where: { id: B.presupuesto.id }, data: { titulo: "tomado" } })
  );
  await noDebeVer("borrar presupuesto de B", () => db.presupuesto.deleteMany({ where: { id: B.presupuesto.id } }));
  await noDebeVer("firmar presupuesto de B", () =>
    db.presupuesto.updateMany({ where: { id: B.presupuesto.id }, data: { estado: "APROBADO" } })
  );
  await noDebeVer("editar linea de B", () =>
    db.lineaPresupuesto.updateMany({ where: { id: B.linea.id }, data: { precio: 0 } })
  );
  await noDebeVer("borrar linea de B", () => db.lineaPresupuesto.deleteMany({ where: { id: B.linea.id } }));
  await noDebeVer("marcar pagada la factura de B", () =>
    db.factura.updateMany({ where: { id: B.factura.id }, data: { estado: "PAGADA" } })
  );
  await noDebeVer("editar producto de B", () =>
    db.producto.updateMany({ where: { id: B.producto.id }, data: { precio: 1 } })
  );
  await noDebeVer("editar datos de la empresa B", () =>
    db.empresa.update({ where: { id: B.empresaId }, data: { nombre: "tomado" } })
  );

  console.log("\n4) Las operaciones inseguras estan prohibidas");
  await debeLanzar("cliente.findUnique", () => db.cliente.findUnique({ where: { id: B.cliente.id } }));
  await debeLanzar("presupuesto.update", () =>
    db.presupuesto.update({ where: { id: B.presupuesto.id }, data: { titulo: "x" } })
  );
  await debeLanzar("usuario.delete", () => db.usuario.delete({ where: { id: B.usuario.id } }));
  await debeLanzar("factura.upsert", () =>
    db.factura.upsert({ where: { id: B.factura.id }, create: {} as never, update: {} })
  );
  await debeLanzar("tenantDb sin empresa", async () => tenantDb(""));

  console.log("\n5) La base de datos impide por si misma mezclar empresas");
  await debeLanzar("colgar una linea de A de un presupuesto de B", () =>
    prisma.lineaPresupuesto.create({
      data: {
        empresaId: A.empresaId,
        presupuestoId: B.presupuesto.id,
        concepto: "intrusa",
        cantidad: 1,
        unidad: "ud",
        precio: 1,
      },
    })
  );
  await debeLanzar("asignar a un presupuesto de A un cliente de B", () =>
    prisma.presupuesto.update({ where: { id: A.presupuesto.id }, data: { clienteId: B.cliente.id } })
  );
  await debeLanzar("colgar un producto de A de un proveedor de B", () =>
    prisma.producto.create({
      data: { empresaId: A.empresaId, provId: B.proveedor.id, nombre: "intruso", unidad: "ud", precio: 1 },
    })
  );

  console.log("\n6) Invariantes SQL (cruces entre empresas, deben ser 0)");
  const cruces = await prisma.$queryRawUnsafe<{ que: string; n: bigint }[]>(`
    SELECT 'linea/presupuesto' AS que, count(*) AS n FROM "LineaPresupuesto" l JOIN "Presupuesto" p ON p.id=l."presupuestoId" WHERE l."empresaId"<>p."empresaId"
    UNION ALL SELECT 'producto/proveedor', count(*) FROM "Producto" pr JOIN "Proveedor" v ON v.id=pr."provId" WHERE pr."empresaId"<>v."empresaId"
    UNION ALL SELECT 'presupuesto/cliente', count(*) FROM "Presupuesto" p JOIN "Cliente" c ON c.id=p."clienteId" WHERE p."empresaId"<>c."empresaId"
    UNION ALL SELECT 'factura/presupuesto', count(*) FROM "Factura" f JOIN "Presupuesto" p ON p.id=f."presupuestoId" WHERE f."empresaId"<>p."empresaId"
    UNION ALL SELECT 'factura/cliente', count(*) FROM "Factura" f JOIN "Cliente" c ON c.id=f."clienteId" WHERE f."empresaId"<>c."empresaId"
  `);
  for (const c of cruces) {
    if (Number(c.n) === 0) ok(`sin cruces en ${c.que}`);
    else mal(`cruces en ${c.que}`, `${c.n} filas`);
  }

  await limpiar();

  console.log(`\n${"=".repeat(50)}`);
  console.log(fallos === 0 ? `AISLAMIENTO CORRECTO — ${pasadas} comprobaciones` : `${fallos} FUGAS DETECTADAS de ${pasadas + fallos}`);
  console.log("=".repeat(50));

  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("La prueba se rompio:", e);
  await prisma.$disconnect();
  process.exit(1);
});
