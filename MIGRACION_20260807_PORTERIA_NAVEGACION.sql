-- ResiPortal: fecha operativa de novedades de portería.
-- Ejecute una sola vez después de respaldar la base de datos.

ALTER TABLE minuta_porteria
ADD COLUMN fecha_novedad DATETIME NULL AFTER novedad;