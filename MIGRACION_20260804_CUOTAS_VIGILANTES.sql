-- ResiPortal: cuotas diferenciadas y perfiles de vigilancia.
-- Ejecute una sola vez después de respaldar la base de datos.
-- Compatible con MySQL 8.4: no usa ADD COLUMN IF NOT EXISTS.

ALTER TABLE inmuebles
ADD COLUMN cuota_administracion DECIMAL(12, 2) NULL AFTER coeficiente;

CREATE TABLE perfiles_vigilancia (
    usuario_id INT PRIMARY KEY,
    turno VARCHAR(50) NULL,
    horario VARCHAR(150) NULL,
    observaciones TEXT NULL,
    foto_archivo VARCHAR(255) NULL,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_perfiles_vigilancia_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- Antes de añadir un índice único de período, revise si instalaciones históricas
-- ya tienen cuotas duplicadas para el mismo inmueble, mes y año.
-- La aplicación evita duplicados al generar cuotas, sin alterar datos existentes.