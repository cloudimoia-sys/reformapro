-- CreateEnum
CREATE TYPE "TipoCatalogo" AS ENUM ('MATERIAL', 'PARTIDA');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "capitulo" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "tipo" "TipoCatalogo" NOT NULL DEFAULT 'MATERIAL',
ALTER COLUMN "provId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Producto_empresaId_tipo_idx" ON "Producto"("empresaId", "tipo");
