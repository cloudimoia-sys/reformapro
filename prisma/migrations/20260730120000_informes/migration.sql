-- CreateEnum
CREATE TYPE "TipoInforme" AS ENUM ('PATOLOGIAS', 'PERICIAL');

-- CreateEnum
CREATE TYPE "EstadoInforme" AS ENUM ('BORRADOR', 'FINALIZADO');

-- CreateTable
CREATE TABLE "Informe" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT,
    "tipo" "TipoInforme" NOT NULL,
    "titulo" TEXT NOT NULL,
    "inmueble" TEXT NOT NULL DEFAULT '',
    "refCatastral" TEXT,
    "solicitante" TEXT,
    "perito" TEXT,
    "titulacion" TEXT,
    "colegiado" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoInforme" NOT NULL DEFAULT 'BORRADOR',
    "contenido" JSONB NOT NULL,
    "autor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Informe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InformeFoto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "informeId" TEXT NOT NULL,
    "datos" TEXT NOT NULL,
    "pie" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InformeFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Informe_empresaId_idx" ON "Informe"("empresaId");

-- CreateIndex
CREATE INDEX "Informe_clienteId_empresaId_idx" ON "Informe"("clienteId", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Informe_empresaId_numero_key" ON "Informe"("empresaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Informe_id_empresaId_key" ON "Informe"("id", "empresaId");

-- CreateIndex
CREATE INDEX "InformeFoto_empresaId_idx" ON "InformeFoto"("empresaId");

-- CreateIndex
CREATE INDEX "InformeFoto_informeId_empresaId_idx" ON "InformeFoto"("informeId", "empresaId");

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Informe" ADD CONSTRAINT "Informe_clienteId_empresaId_fkey" FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InformeFoto" ADD CONSTRAINT "InformeFoto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeFoto" ADD CONSTRAINT "InformeFoto_informeId_empresaId_fkey" FOREIGN KEY ("informeId", "empresaId") REFERENCES "Informe"("id", "empresaId") ON DELETE CASCADE ON UPDATE CASCADE;

