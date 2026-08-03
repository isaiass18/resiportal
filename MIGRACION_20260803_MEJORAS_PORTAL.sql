-- ResiPortal: migración 2026-08-03 para instalaciones existentes.
-- Ejecute UNA sola vez después de un respaldo. Las instalaciones nuevas usan database.sql.

ALTER TABLE zonas_sociales
ADD COLUMN imagen_url VARCHAR(255) NULL AFTER reglamento;

ALTER TABLE zonas_sociales
ADD COLUMN youtube_url VARCHAR(255) NULL AFTER imagen_url;

ALTER TABLE reclamaciones
ADD COLUMN categoria VARCHAR(80) NOT NULL DEFAULT 'General' AFTER descripcion;

ALTER TABLE inmuebles
ADD COLUMN tipo_unidad ENUM('apartamento', 'casa') NOT NULL DEFAULT 'apartamento' AFTER conjunto_id;

ALTER TABLE inmuebles
ADD COLUMN nomenclatura VARCHAR(100) NULL AFTER apartamento;

UPDATE inmuebles
SET
    nomenclatura = apartamento
WHERE (
        nomenclatura IS NULL
        OR nomenclatura = ''
    )
    AND apartamento IS NOT NULL;

-- La aplicación valida documento, correo y nomenclatura por conjunto.
-- En bases históricas, agregue índices únicos solo después de depurar duplicados existentes.