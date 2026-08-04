-- Ejecutar una única vez y únicamente después de realizar un respaldo.
-- Añade seguimiento, solución y adjuntos asociados a notas de PQRS.
ALTER TABLE reclamaciones
ADD COLUMN solucion TEXT NULL AFTER estado,
ADD COLUMN resuelto_por INT NULL AFTER solucion,
ADD COLUMN resuelto_en DATETIME NULL AFTER resuelto_por,
ADD COLUMN actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER creado_en,
ADD CONSTRAINT fk_reclamaciones_resuelto_por FOREIGN KEY (resuelto_por) REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE TABLE reclamacion_notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reclamacion_id INT NOT NULL,
    autor_id INT NOT NULL,
    contenido TEXT NOT NULL,
    es_solucion TINYINT(1) NOT NULL DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reclamacion_notas_cronologia (reclamacion_id, creado_en),
    CONSTRAINT fk_reclamacion_notas_reclamacion FOREIGN KEY (reclamacion_id) REFERENCES reclamaciones (id) ON DELETE CASCADE,
    CONSTRAINT fk_reclamacion_notas_autor FOREIGN KEY (autor_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

ALTER TABLE reclamacion_adjuntos
ADD COLUMN nota_id INT NULL AFTER reclamacion_id,
ADD KEY idx_reclamacion_adjuntos_nota (nota_id),
ADD CONSTRAINT fk_reclamacion_adjuntos_nota FOREIGN KEY (nota_id) REFERENCES reclamacion_notas (id) ON DELETE CASCADE;