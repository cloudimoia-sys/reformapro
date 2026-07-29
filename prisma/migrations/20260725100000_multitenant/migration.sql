-- =====================================================================
-- ReformaPro: de app de una sola empresa a SaaS multi-empresa.
--
-- Escrita a mano A PROPOSITO: `prisma migrate dev` genera un DROP/CREATE
-- de "Empresa" (cambia el tipo de la clave primaria) que borraria los datos
-- de produccion, y ADD COLUMN ... NOT NULL sin DEFAULT falla sobre tablas
-- con filas existentes.
--
-- Estrategia: EXPANDIR -> RELLENAR -> RESTRINGIR.
--   Se anade "empresaId" con un DEFAULT que apunta al tenant heredado, de
--   modo que las filas que ya existen quedan asignadas a esa empresa.
--   Una SEGUNDA migracion posterior quita esos DEFAULT: a partir de ahi un
--   "empresaId" olvidado es un error duro y no una fuga silenciosa.
--
-- Prisma ejecuta este archivo dentro de una transaccion, asi que cualquier
-- RAISE EXCEPTION revierte el fichero entero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Guarda: este script asume 0 o 1 empresas (modelo antiguo de fila unica).
-- ---------------------------------------------------------------------
DO $$ BEGIN
  IF (SELECT count(*) FROM "Empresa") > 1 THEN
    RAISE EXCEPTION 'Se esperaban 0 o 1 filas en Empresa antes de migrar a multi-empresa, hay %',
      (SELECT count(*) FROM "Empresa");
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- FASE 1 - Empresa: la clave primaria pasa de Int a texto (cuid).
-- Ninguna tabla apunta todavia a Empresa, asi que no hay FKs que repuntar.
-- El id del tenant heredado es un literal fijo (no gen_random_uuid()) para
-- que local, ensayo y produccion queden identicos y se puedan comparar.
-- ---------------------------------------------------------------------
ALTER TABLE "Empresa" ADD COLUMN "id_nuevo" TEXT;
UPDATE "Empresa" SET "id_nuevo" = 'clxcloudimo0000000000000';
ALTER TABLE "Empresa" DROP CONSTRAINT "Empresa_pkey";
ALTER TABLE "Empresa" DROP COLUMN "id";
ALTER TABLE "Empresa" RENAME COLUMN "id_nuevo" TO "id";
ALTER TABLE "Empresa" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id");

-- ---------------------------------------------------------------------
-- FASE 2 - Empresa gana los campos de suscripcion y de alta.
-- El registro solo pide nombre y email; cif/direccion/tel se rellenan
-- despues en "Mi empresa", por eso pasan a tener DEFAULT ''.
-- ---------------------------------------------------------------------
CREATE TYPE "PlanSuscripcion" AS ENUM ('PRUEBA', 'BASICO', 'PRO');
CREATE TYPE "EstadoSuscripcion" AS ENUM ('PRUEBA', 'ACTIVA', 'SUSPENDIDA', 'CANCELADA');

ALTER TABLE "Empresa"
  ADD COLUMN "plan"          "PlanSuscripcion"   NOT NULL DEFAULT 'PRUEBA',
  ADD COLUMN "estadoSusc"    "EstadoSuscripcion" NOT NULL DEFAULT 'PRUEBA',
  ADD COLUMN "trialFinaliza" TIMESTAMP(3),
  ADD COLUMN "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Empresa" ALTER COLUMN "cif"       SET DEFAULT '';
ALTER TABLE "Empresa" ALTER COLUMN "direccion" SET DEFAULT '';
ALTER TABLE "Empresa" ALTER COLUMN "tel"       SET DEFAULT '';

-- El tenant heredado ya es un usuario real, no una prueba de 14 dias.
UPDATE "Empresa"
   SET "plan" = 'PRO', "estadoSusc" = 'ACTIVA'
 WHERE "id" = 'clxcloudimo0000000000000';

-- ---------------------------------------------------------------------
-- FASE 3 - empresaId en todas las tablas de negocio.
-- El DEFAULT hace de relleno para las filas existentes. Se quita en la
-- migracion siguiente (20260725110000_empresaid_sin_default).
-- ---------------------------------------------------------------------
ALTER TABLE "Usuario"          ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "Cliente"          ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "Proveedor"        ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "Producto"         ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "Presupuesto"      ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "LineaPresupuesto" ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "Factura"          ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';

ALTER TABLE "Usuario" ADD COLUMN "emailVerificado" BOOLEAN NOT NULL DEFAULT false;

-- Si habia filas de negocio pero ninguna Empresa (base a medias), el FK de la
-- fase 5 fallaria con un mensaje oscuro. Mejor abortar aqui y explicarlo.
DO $$ BEGIN
  IF (SELECT count(*) FROM "Empresa") = 0
     AND (SELECT count(*) FROM "Usuario") + (SELECT count(*) FROM "Presupuesto") > 0 THEN
    RAISE EXCEPTION 'Hay datos de negocio sin ninguna Empresa a la que asignarlos';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- FASE 4 - La numeracion pasa a ser unica POR EMPRESA, no global.
-- "Usuario_email_key" se mantiene global a proposito: asi el login no
-- necesita preguntar de que empresa eres.
-- ---------------------------------------------------------------------
DROP INDEX "Presupuesto_numero_key";
DROP INDEX "Factura_numero_key";
CREATE UNIQUE INDEX "Presupuesto_empresaId_numero_key" ON "Presupuesto"("empresaId", "numero");
CREATE UNIQUE INDEX "Factura_empresaId_numero_key"     ON "Factura"("empresaId", "numero");

-- ---------------------------------------------------------------------
-- FASE 5 - Claves foraneas al tenant + indices.
-- ---------------------------------------------------------------------
ALTER TABLE "Usuario"          ADD CONSTRAINT "Usuario_empresaId_fkey"          FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cliente"          ADD CONSTRAINT "Cliente_empresaId_fkey"          FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Proveedor"        ADD CONSTRAINT "Proveedor_empresaId_fkey"        FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Producto"         ADD CONSTRAINT "Producto_empresaId_fkey"         FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Presupuesto"      ADD CONSTRAINT "Presupuesto_empresaId_fkey"      FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Factura"          ADD CONSTRAINT "Factura_empresaId_fkey"          FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Usuario_empresaId_idx"          ON "Usuario"("empresaId");
CREATE INDEX "Cliente_empresaId_idx"          ON "Cliente"("empresaId");
CREATE INDEX "Proveedor_empresaId_idx"        ON "Proveedor"("empresaId");
CREATE INDEX "Producto_empresaId_idx"         ON "Producto"("empresaId");
CREATE INDEX "Presupuesto_empresaId_idx"      ON "Presupuesto"("empresaId");
CREATE INDEX "LineaPresupuesto_empresaId_idx" ON "LineaPresupuesto"("empresaId");
CREATE INDEX "Factura_empresaId_idx"          ON "Factura"("empresaId");

-- ---------------------------------------------------------------------
-- FASE 6 - Claves foraneas COMPUESTAS (id, empresaId).
-- Esta es la red de seguridad estructural: aunque el codigo tuviera un
-- fallo, Postgres impide que una linea/producto/factura apunte a un
-- registro de OTRA empresa. No depende de que nadie recuerde filtrar.
--
-- Se usa NO ACTION en lugar de SET NULL a proposito: en una FK compuesta,
-- SET NULL anularia tambien "empresaId", que es NOT NULL, y el borrado
-- fallaria en caliente. Las acciones de borrado desvinculan antes a mano.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX "Cliente_id_empresaId_key"     ON "Cliente"("id", "empresaId");
CREATE UNIQUE INDEX "Proveedor_id_empresaId_key"   ON "Proveedor"("id", "empresaId");
CREATE UNIQUE INDEX "Presupuesto_id_empresaId_key" ON "Presupuesto"("id", "empresaId");

ALTER TABLE "Producto" DROP CONSTRAINT "Producto_provId_fkey";
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_provId_empresaId_fkey"
  FOREIGN KEY ("provId", "empresaId") REFERENCES "Proveedor"("id", "empresaId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LineaPresupuesto" DROP CONSTRAINT "LineaPresupuesto_presupuestoId_fkey";
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_presupuestoId_empresaId_fkey"
  FOREIGN KEY ("presupuestoId", "empresaId") REFERENCES "Presupuesto"("id", "empresaId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Presupuesto" DROP CONSTRAINT "Presupuesto_clienteId_fkey";
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_clienteId_empresaId_fkey"
  FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "Factura" DROP CONSTRAINT "Factura_presupuestoId_fkey";
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_presupuestoId_empresaId_fkey"
  FOREIGN KEY ("presupuestoId", "empresaId") REFERENCES "Presupuesto"("id", "empresaId")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "Factura" DROP CONSTRAINT "Factura_clienteId_fkey";
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_clienteId_empresaId_fkey"
  FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX "Producto_provId_empresaId_idx"              ON "Producto"("provId", "empresaId");
CREATE INDEX "LineaPresupuesto_presupuestoId_empresaId_idx" ON "LineaPresupuesto"("presupuestoId", "empresaId");
CREATE INDEX "Presupuesto_clienteId_empresaId_idx"        ON "Presupuesto"("clienteId", "empresaId");
CREATE INDEX "Factura_presupuestoId_empresaId_idx"        ON "Factura"("presupuestoId", "empresaId");
CREATE INDEX "Factura_clienteId_empresaId_idx"            ON "Factura"("clienteId", "empresaId");

-- ---------------------------------------------------------------------
-- FASE 7 - Counter: de id de texto "presupuesto:2026" a (empresaId, tipo, anio).
-- Se conserva el valor vivo, asi la serie de la empresa heredada continua
-- donde estaba (PRE-2026-006 tras los 5 presupuestos existentes). La
-- correlatividad sin huecos la exige la normativa espanola de facturacion.
-- ---------------------------------------------------------------------
ALTER TABLE "Counter" ADD COLUMN "empresaId" TEXT NOT NULL DEFAULT 'clxcloudimo0000000000000';
ALTER TABLE "Counter" ADD COLUMN "tipo" TEXT;
ALTER TABLE "Counter" ADD COLUMN "anio" INTEGER;

UPDATE "Counter"
   SET "tipo" = split_part("id", ':', 1),
       "anio" = split_part("id", ':', 2)::INTEGER;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Counter" WHERE "tipo" IS NULL OR "anio" IS NULL) THEN
    RAISE EXCEPTION 'Hay filas en Counter cuyo id no tiene la forma "tipo:anio"';
  END IF;
END $$;

ALTER TABLE "Counter" ALTER COLUMN "tipo" SET NOT NULL;
ALTER TABLE "Counter" ALTER COLUMN "anio" SET NOT NULL;
ALTER TABLE "Counter" DROP CONSTRAINT "Counter_pkey";
ALTER TABLE "Counter" DROP COLUMN "id";
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("empresaId", "tipo", "anio");
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- FASE 8 - Tablas nuevas: recuperacion de contrasena y limite de altas.
-- ---------------------------------------------------------------------
CREATE TABLE "PasswordResetToken" (
    "id"        TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEn"  TIMESTAMP(3) NOT NULL,
    "usadoEn"   TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_usuarioId_idx" ON "PasswordResetToken"("usuarioId");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RegistroIntento" (
    "id"        TEXT NOT NULL,
    "ipHash"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroIntento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegistroIntento_ipHash_createdAt_idx" ON "RegistroIntento"("ipHash", "createdAt");
CREATE INDEX "RegistroIntento_createdAt_idx" ON "RegistroIntento"("createdAt");
