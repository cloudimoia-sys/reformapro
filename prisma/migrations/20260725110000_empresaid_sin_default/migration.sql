-- =====================================================================
-- Paso RESTRINGIR del patron expandir -> rellenar -> restringir.
--
-- La migracion anterior puso un DEFAULT en "empresaId" para poder rellenar
-- las filas que ya existian. Ese DEFAULT es peligroso si se queda: cualquier
-- INSERT al que se le olvide "empresaId" iria a parar SILENCIOSAMENTE a la
-- empresa heredada, mezclando datos de dos clientes sin dar ningun error.
--
-- Al quitarlo, ese mismo olvido pasa a ser un error NOT NULL inmediato.
-- =====================================================================

ALTER TABLE "Usuario"          ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "Cliente"          ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "Proveedor"        ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "Producto"         ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "Presupuesto"      ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "LineaPresupuesto" ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "Factura"          ALTER COLUMN "empresaId" DROP DEFAULT;
ALTER TABLE "Counter"          ALTER COLUMN "empresaId" DROP DEFAULT;
