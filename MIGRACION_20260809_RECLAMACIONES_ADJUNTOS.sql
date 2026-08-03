-- Ejecutar una sola vez, después de respaldo de la base de datos de ResiPortal.
-- No elimina ni modifica reclamaciones existentes.
CREATE TABLE IF NOT EXISTS reclamacion_adjuntos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reclamacion_id INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    tamano INT UNSIGNED NOT NULL,
    subido_por INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reclamacion_adjuntos_reclamacion (reclamacion_id),
    CONSTRAINT fk_reclamacion_adjuntos_reclamacion FOREIGN KEY (reclamacion_id) REFERENCES reclamaciones (id) ON DELETE CASCADE,
    CONSTRAINT fk_reclamacion_adjuntos_usuario FOREIGN KEY (subido_por) REFERENCES usuarios (id) ON DELETE SET NULL
);