-- ResiPortal: desactivación reversible de usuarios y vigilantes.
-- Ejecute una vez después de MIGRACION_20260805_PARQUEADEROS.sql.

ALTER TABLE usuarios
ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1 AFTER contacto,
ADD COLUMN desactivado_en DATETIME NULL AFTER activo,
ADD COLUMN desactivado_por INT NULL AFTER desactivado_en,
ADD COLUMN motivo_desactivacion VARCHAR(255) NULL AFTER desactivado_por,
ADD CONSTRAINT fk_usuarios_desactivado_por FOREIGN KEY (desactivado_por) REFERENCES usuarios (id) ON DELETE SET NULL;