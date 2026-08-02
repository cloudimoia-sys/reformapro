-- Código postal, población y provincia en Empresa y Cliente.
--
-- Hacen falta para exportar a Facturae: el esquema los exige y sin ellos el
-- programa de gestión del cliente rechaza la importación.
--
-- Solo ADD COLUMN con valor por defecto: no toca ninguna fila existente, no
-- borra nada y no puede fallar sobre datos que ya estén ahí.

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "codigoPostal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "poblacion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "provincia" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "codigoPostal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "poblacion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "provincia" TEXT NOT NULL DEFAULT '';
