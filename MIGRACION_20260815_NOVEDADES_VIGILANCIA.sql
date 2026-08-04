-- Ejecutar una única vez después de realizar un respaldo.
-- Crea la gestión administrativa e historial de las novedades de portería.
ALTER TABLE minuta_porteria
ADD COLUMN conjunto_id INT NULL AFTER id,
ADD COLUMN estado ENUM(
    'pendiente',
    'en_progreso',
    'resuelta',
    'cerrada'
) NOT NULL DEFAULT 'pendiente' AFTER fecha_novedad,
ADD COLUMN primera_vista_por INT NULL AFTER estado,
ADD COLUMN primera_vista_en DATETIME NULL AFTER primera_vista_por,
ADD COLUMN resuelto_por INT NULL AFTER primera_vista_en,
ADD COLUMN resuelto_en DATETIME NULL AFTER resuelto_por,
ADD COLUMN cerrado_por INT NULL AFTER resuelto_en,
ADD COLUMN cerrado_en DATETIME NULL AFTER cerrado_por;

UPDATE minuta_porteria m
JOIN usuarios u ON u.id = m.vigilante_id
SET
    m.conjunto_id = u.conjunto_id
WHERE
    m.conjunto_id IS NULL;

ALTER TABLE minuta_porteria
MODIFY conjunto_id INT NOT NULL,
ADD KEY idx_minuta_bandeja_admin (
    conjunto_id,
    estado,
    fecha_registro
),
ADD KEY idx_minuta_no_vistas (
    conjunto_id,
    primera_vista_en,
    fecha_registro
),
ADD CONSTRAINT fk_minuta_conjunto FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE,
ADD CONSTRAINT fk_minuta_primera_vista FOREIGN KEY (primera_vista_por) REFERENCES usuarios (id) ON DELETE SET NULL,
ADD CONSTRAINT fk_minuta_resuelto_por FOREIGN KEY (resuelto_por) REFERENCES usuarios (id) ON DELETE SET NULL,
ADD CONSTRAINT fk_minuta_cerrado_por FOREIGN KEY (cerrado_por) REFERENCES usuarios (id) ON DELETE SET NULL;

CREATE TABLE minuta_lecturas (
    minuta_id INT NOT NULL,
    usuario_id INT NOT NULL,
    vista_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (minuta_id, usuario_id),
    KEY idx_minuta_lecturas_usuario_fecha (usuario_id, vista_en),
    CONSTRAINT fk_minuta_lecturas_minuta FOREIGN KEY (minuta_id) REFERENCES minuta_porteria (id) ON DELETE CASCADE,
    CONSTRAINT fk_minuta_lecturas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE minuta_seguimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    minuta_id INT NOT NULL,
    autor_id INT NULL,
    tipo ENUM(
        'creacion',
        'vista',
        'respuesta',
        'cambio_estado',
        'resolucion',
        'cierre',
        'reapertura'
    ) NOT NULL,
    contenido TEXT NULL,
    estado_anterior ENUM(
        'pendiente',
        'en_progreso',
        'resuelta',
        'cerrada'
    ) NULL,
    estado_nuevo ENUM(
        'pendiente',
        'en_progreso',
        'resuelta',
        'cerrada'
    ) NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_minuta_seguimientos_cronologia (minuta_id, creado_en, id),
    CONSTRAINT fk_minuta_seguimientos_minuta FOREIGN KEY (minuta_id) REFERENCES minuta_porteria (id) ON DELETE CASCADE,
    CONSTRAINT fk_minuta_seguimientos_autor FOREIGN KEY (autor_id) REFERENCES usuarios (id) ON DELETE SET NULL
);

-- Conserva la creación como primer evento de la cronología de registros históricos.
INSERT INTO
    minuta_seguimientos (
        minuta_id,
        autor_id,
        tipo,
        contenido,
        creado_en
    )
SELECT m.id, m.vigilante_id, 'creacion', m.novedad, COALESCE(m.fecha_registro, NOW())
FROM
    minuta_porteria m
    LEFT JOIN minuta_seguimientos s ON s.minuta_id = m.id
    AND s.tipo = 'creacion'
WHERE
    s.id IS NULL;