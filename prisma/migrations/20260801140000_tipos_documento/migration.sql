-- Nuevos tipos de documento. Solo añade valores al enum: los informes ya
-- guardados conservan el suyo y nada se reescribe.
--
-- Cada ALTER TYPE ... ADD VALUE va suelto a propósito: Postgres no deja usar un
-- valor nuevo de enum dentro de la misma transacción en que se crea, así que
-- estas sentencias se aplican fuera de transacción.
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'ACTA_VISITA';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'ACTA_ENTREGA';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'CERTIFICADO_OBRA';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'MEMORIA_TECNICA';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'PLAN_TRABAJO';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'CERTIFICACION';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'RECLAMACION';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'CARTA_SEGURO';
ALTER TYPE "TipoInforme" ADD VALUE IF NOT EXISTS 'SOLICITUD_AYUNTAMIENTO';
