-- Obras y fases de planificación.
--
-- Escrita a mano y solo con sentencias aditivas: crea dos tablas nuevas y no
-- toca ni una sola fila existente. Ningún DROP, ningún ALTER sobre tablas con
-- datos. Se puede aplicar en producción sin riesgo para lo que ya hay.

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('PLANIFICADA', 'EN_CURSO', 'PARADA', 'TERMINADA');

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL DEFAULT '',
    "clienteId" TEXT,
    "presupuestoId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoObra" NOT NULL DEFAULT 'PLANIFICADA',
    "festivosPropios" TEXT NOT NULL DEFAULT '',
    "sabadosSeTrabaja" BOOLEAN NOT NULL DEFAULT false,
    "tokenCalendario" TEXT NOT NULL,
    "notas" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fase" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "nombre" TEXT NOT NULL,
    "oficio" TEXT NOT NULL DEFAULT '',
    "dias" INTEGER NOT NULL DEFAULT 1,
    "esperaDias" INTEGER NOT NULL DEFAULT 0,
    "dependeDe" TEXT NOT NULL DEFAULT '',
    "hito" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Fase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Obra_tokenCalendario_key" ON "Obra"("tokenCalendario");

-- CreateIndex
CREATE INDEX "Obra_empresaId_idx" ON "Obra"("empresaId");

-- CreateIndex
CREATE INDEX "Obra_clienteId_empresaId_idx" ON "Obra"("clienteId", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_id_empresaId_key" ON "Obra"("id", "empresaId");

-- CreateIndex
CREATE INDEX "Fase_empresaId_idx" ON "Fase"("empresaId");

-- CreateIndex
CREATE INDEX "Fase_obraId_empresaId_idx" ON "Fase"("obraId", "empresaId");

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_clienteId_empresaId_fkey" FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_presupuestoId_empresaId_fkey" FOREIGN KEY ("presupuestoId", "empresaId") REFERENCES "Presupuesto"("id", "empresaId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Fase" ADD CONSTRAINT "Fase_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fase" ADD CONSTRAINT "Fase_obraId_empresaId_fkey" FOREIGN KEY ("obraId", "empresaId") REFERENCES "Obra"("id", "empresaId") ON DELETE CASCADE ON UPDATE CASCADE;
