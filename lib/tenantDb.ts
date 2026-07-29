import { prismaUnsafe } from "@/lib/prisma";

/**
 * Cliente de base de datos atado a UNA empresa.
 *
 * Por qué existe: la app tiene ~75 consultas repartidas en 21 archivos. Si a una
 * sola se le olvida `where: { empresaId }`, un cliente ve los datos de otro y no
 * salta ningún error — la consulta simplemente devuelve de más. Peor aún: Prisma
 * interpreta `where: { empresaId: undefined }` como "sin filtro", así que un dato
 * ausente no falla, devuelve la tabla entera.
 *
 * Por eso el filtro no se escribe a mano en cada sitio: se inyecta aquí, y la única
 * forma de obtener este cliente es pasando por `requireTenant()`, que no puede
 * devolver nada sin una empresa. Olvidarse de filtrar deja de ser posible.
 */

/** Tablas que pertenecen a una empresa y se filtran por `empresaId`. */
const MODELOS_TENANT = new Set([
  "Usuario",
  "Cliente",
  "Proveedor",
  "Producto",
  "Presupuesto",
  "LineaPresupuesto",
  "Factura",
]);

/** Operaciones que aceptan un `where` normal: se les añade el filtro de empresa. */
const OPS_FILTRABLES = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

/** Operaciones de alta: se les inyecta `empresaId` en los datos. */
const OPS_ALTA = new Set(["create", "createMany"]);

/**
 * Operaciones prohibidas fuera de `Empresa`.
 *
 * Prisma exige que su `where` identifique una fila ÚNICA (normalmente `{ id }`),
 * y no admite condiciones extra, así que es imposible añadirles el filtro de
 * empresa: quedarían sin proteger. Y son justo las que usan un id que llega del
 * navegador, es decir, exactamente por donde un cliente podría tocar los datos
 * de otro escribiendo otro id en la URL.
 *
 * La alternativa segura es equivalente y solo un poco más larga:
 *   findUnique({ where: { id } })  ->  findFirst({ where: { id } })      + comprobar null
 *   update({ where: { id } })      ->  updateMany({ where: { id } })     + comprobar count
 *   delete({ where: { id } })      ->  deleteMany({ where: { id } })     + comprobar count
 */
const OPS_PROHIBIDAS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "upsert",
]);

const ALTERNATIVA: Record<string, string> = {
  findUnique: "findFirst",
  findUniqueOrThrow: "findFirst",
  update: "updateMany",
  delete: "deleteMany",
  upsert: "findFirst + create/updateMany",
};

export function tenantDb(empresaId: string) {
  // Guarda deliberadamente en tiempo de ejecución y no solo en tipos: si por un JWT
  // viejo o un fallo llegara `undefined`, Prisma lo trataría como "sin filtro" y
  // devolvería los datos de todas las empresas. Mejor reventar aquí.
  if (typeof empresaId !== "string" || empresaId.length === 0) {
    throw new Error("tenantDb() llamado sin empresaId: se aborta para no exponer datos de otras empresas");
  }

  return prismaUnsafe.$extends({
    name: "aislamiento-por-empresa",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Operaciones sin modelo ($queryRaw y similares) no se pueden filtrar.
          // Hoy no se usa ninguna; si alguien añade una, que sea una decisión consciente.
          if (!model) return query(args);

          // `Empresa` es la propia empresa: se filtra por su clave primaria, no por
          // `empresaId`. Forzamos el id siempre, así que aquí las operaciones "únicas"
          // sí son seguras (el where lo ponemos nosotros, no el navegador).
          if (model === "Empresa") {
            const a = (args ?? {}) as Record<string, unknown>;
            if (operation === "create" || operation === "createMany") {
              throw new Error("Crear empresas solo desde el registro (usa prismaUnsafe en app/registro)");
            }
            a.where = { ...(a.where as object), id: empresaId };
            return query(a);
          }

          if (!MODELOS_TENANT.has(model)) return query(args);

          if (OPS_PROHIBIDAS.has(operation)) {
            throw new Error(
              `${model}.${operation}() no está permitido: no admite el filtro por empresa y dejaría los datos al descubierto. Usa ${ALTERNATIVA[operation]}.`
            );
          }

          const a = (args ?? {}) as Record<string, unknown>;

          if (OPS_FILTRABLES.has(operation)) {
            a.where = { ...(a.where as object), empresaId };
            return query(a);
          }

          if (OPS_ALTA.has(operation)) {
            // OJO: esto cubre el alta de primer nivel. Los `create` anidados
            // (p. ej. presupuesto.create({ data: { lineas: { create: [...] } } }))
            // NO pasan por aquí — Prisma no los expone a la extensión. Como
            // `empresaId` es NOT NULL sin valor por defecto, olvidarlo revienta con
            // un error claro en vez de guardar mal; aun así, hay que ponerlo a mano
            // en la llamada.
            if (Array.isArray(a.data)) {
              a.data = (a.data as Record<string, unknown>[]).map((d) => ({ ...d, empresaId }));
            } else {
              a.data = { ...(a.data as object), empresaId };
            }
            return query(a);
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;

/**
 * Un cliente extendido por empresa. `$extends` devuelve un envoltorio sobre el
 * MISMO motor y el mismo pool de conexiones (no abre conexiones nuevas), y la
 * clave depende solo de `empresaId`, así que cachear es seguro incluso en
 * funciones serverless reutilizadas.
 */
const cache = new Map<string, TenantDb>();

export function tenantDbCacheado(empresaId: string): TenantDb {
  const yaEstaba = cache.get(empresaId);
  if (yaEstaba) return yaEstaba;
  const db = tenantDb(empresaId);
  cache.set(empresaId, db);
  return db;
}
