-- El código de ERP se mueve del CLIENTE al ARTÍCULO.
--
-- Un ERP identifica los artículos de forma única por código: la referencia la
-- tiene el material, no la persona a la que se le factura. Ponerlo en el cliente
-- fue un error de diseño de la migración anterior (20260806090000).
--
-- Se puede borrar la columna sin más porque se añadió en el despliegue anterior
-- y no llegó a rellenarse: el campo era opcional, estaba vacío en todas las
-- filas y no había forma de que un cliente lo hubiera usado todavía.

-- DropColumn: el cliente no tiene referencia de ERP.
ALTER TABLE "Cliente" DROP COLUMN IF EXISTS "codigoErp";

-- AddColumn: el artículo del catálogo sí, y es opcional — la mayoría de
-- reformistas no tienen ERP y no deben verse obligados a rellenar nada.
ALTER TABLE "Producto" ADD COLUMN     "codigoErp" TEXT;

-- AddColumn: la línea del parte se queda con una COPIA del código, igual que se
-- queda con una copia del precio. Un parte registra lo que pasó ese día: si
-- mañana se corrige la ficha del catálogo, el parte ya firmado tiene que seguir
-- diciendo lo que se puso.
ALTER TABLE "LineaParteTrabajo" ADD COLUMN     "codigoErp" TEXT;
