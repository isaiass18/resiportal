-- ResiPortal: catálogo y asignación histórica de parqueaderos.
-- Ejecute una vez después del respaldo de base de datos.

CREATE TABLE parqueaderos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    tipo ENUM(
        'privado',
        'administracion',
        'visitante',
        'otro'
    ) NOT NULL DEFAULT 'administracion',
    estado ENUM(
        'disponible',
        'asignado',
        'inactivo'
    ) NOT NULL DEFAULT 'disponible',
    observaciones VARCHAR(255) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_parqueadero_conjunto_codigo (conjunto_id, codigo),
    CONSTRAINT fk_parqueaderos_conjunto FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);

CREATE TABLE asignaciones_parqueadero (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parqueadero_id INT NOT NULL,
    inmueble_id INT NOT NULL,
    asignado_por INT NULL,
    asignado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retirado_por INT NULL,
    retirado_en TIMESTAMP NULL,
    motivo_retiro VARCHAR(255) NULL,
    CONSTRAINT fk_asignacion_parqueadero FOREIGN KEY (parqueadero_id) REFERENCES parqueaderos (id) ON DELETE CASCADE,
    CONSTRAINT fk_asignacion_inmueble FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE,
    CONSTRAINT fk_asignacion_asignado_por FOREIGN KEY (asignado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT fk_asignacion_retirado_por FOREIGN KEY (retirado_por) REFERENCES usuarios (id) ON DELETE SET NULL
);