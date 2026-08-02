-- Generaliza el contador de intentos: además de altas, ahora cuenta inicios de
-- sesión fallidos y llamadas a la IA.
--
-- La tabla NO se renombra (el modelo de Prisma la mapea con @@map), así que las
-- filas y los índices que ya existen siguen igual. Solo se añade una columna con
-- valor por defecto y un índice: nada que pueda fallar sobre datos existentes.

-- AlterTable
ALTER TABLE "RegistroIntento" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'registro';

-- CreateIndex
CREATE INDEX "RegistroIntento_tipo_ipHash_createdAt_idx" ON "RegistroIntento"("tipo", "ipHash", "createdAt");
