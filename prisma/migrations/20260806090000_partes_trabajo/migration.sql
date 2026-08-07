-- Partes de trabajo: horas, trabajo hecho y material puesto en cada visita.
--
-- No es un presupuesto (eso se estima antes) ni una factura (eso la emite el
-- programa del cliente): es el registro de lo que de verdad ha pasado en la
-- obra, y el material lo rellena el técnico a mano porque nadie más lo sabe.

-- CreateEnum
CREATE TYPE "EstadoParte" AS ENUM ('BORRADOR', 'FIRMADO');

-- CreateEnum
CREATE TYPE "TipoLineaParte" AS ENUM ('MANO_OBRA', 'MATERIAL');

-- AlterTable: código del cliente en el ERP externo, para casarlo al importar.
ALTER TABLE "Cliente" ADD COLUMN     "codigoErp" TEXT;

-- CreateTable
CREATE TABLE "ParteTrabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "codigoErp" TEXT,
    "clienteId" TEXT,
    "obraId" TEXT,
    "titulo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL DEFAULT '',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "tecnico" TEXT NOT NULL DEFAULT '',
    "autor" TEXT,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "observaciones" TEXT NOT NULL DEFAULT '',
    "firma" TEXT,
    "fechaFirma" TIMESTAMP(3),
    "firmaIp" TEXT,
    "estado" "EstadoParte" NOT NULL DEFAULT 'BORRADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParteTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaParteTrabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "parteId" TEXT NOT NULL,
    "tipo" "TipoLineaParte" NOT NULL DEFAULT 'MATERIAL',
    "concepto" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "unidad" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LineaParteTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoParteTrabajo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "parteId" TEXT NOT NULL,
    "datos" TEXT NOT NULL,
    "pie" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FotoParteTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParteTrabajo_empresaId_idx" ON "ParteTrabajo"("empresaId");

-- CreateIndex
CREATE INDEX "ParteTrabajo_clienteId_empresaId_idx" ON "ParteTrabajo"("clienteId", "empresaId");

-- CreateIndex
CREATE INDEX "ParteTrabajo_obraId_empresaId_idx" ON "ParteTrabajo"("obraId", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ParteTrabajo_empresaId_numero_key" ON "ParteTrabajo"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ParteTrabajo_id_empresaId_key" ON "ParteTrabajo"("id", "empresaId");

-- CreateIndex
CREATE INDEX "LineaParteTrabajo_empresaId_idx" ON "LineaParteTrabajo"("empresaId");

-- CreateIndex
CREATE INDEX "LineaParteTrabajo_parteId_empresaId_idx" ON "LineaParteTrabajo"("parteId", "empresaId");

-- CreateIndex
CREATE INDEX "FotoParteTrabajo_empresaId_idx" ON "FotoParteTrabajo"("empresaId");

-- CreateIndex
CREATE INDEX "FotoParteTrabajo_parteId_empresaId_idx" ON "FotoParteTrabajo"("parteId", "empresaId");

-- AddForeignKey
ALTER TABLE "ParteTrabajo" ADD CONSTRAINT "ParteTrabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteTrabajo" ADD CONSTRAINT "ParteTrabajo_clienteId_empresaId_fkey" FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ParteTrabajo" ADD CONSTRAINT "ParteTrabajo_obraId_empresaId_fkey" FOREIGN KEY ("obraId", "empresaId") REFERENCES "Obra"("id", "empresaId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LineaParteTrabajo" ADD CONSTRAINT "LineaParteTrabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaParteTrabajo" ADD CONSTRAINT "LineaParteTrabajo_parteId_empresaId_fkey" FOREIGN KEY ("parteId", "empresaId") REFERENCES "ParteTrabajo"("id", "empresaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoParteTrabajo" ADD CONSTRAINT "FotoParteTrabajo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoParteTrabajo" ADD CONSTRAINT "FotoParteTrabajo_parteId_empresaId_fkey" FOREIGN KEY ("parteId", "empresaId") REFERENCES "ParteTrabajo"("id", "empresaId") ON DELETE CASCADE ON UPDATE CASCADE;
