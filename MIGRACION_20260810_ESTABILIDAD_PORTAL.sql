-- Ejecutar una sola vez, después de respaldo de la base de datos de ResiPortal.
-- Complementa instalaciones antiguas: adjuntos de novedades y tabla de eventos.

CREATE TABLE IF NOT EXISTS minuta_adjuntos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    minuta_id INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    tamano INT UNSIGNED NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_minuta_adjuntos_minuta (minuta_id),
    CONSTRAINT fk_minuta_adjuntos_minuta FOREIGN KEY (minuta_id) REFERENCES minuta_porteria (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    fecha_hora DATETIME NOT NULL,
    lugar VARCHAR(100) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_eventos_conjunto_fecha (conjunto_id, fecha_hora),
    CONSTRAINT fk_eventos_conjunto FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);