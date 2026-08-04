-- Ejecutar una única vez después de realizar un respaldo de la base de datos.
-- Añade lecturas de alertas y consignas operativas destinadas a vigilancia.
CREATE TABLE notificacion_lecturas (
    usuario_id INT NOT NULL,
    clave VARCHAR(191) NOT NULL,
    leida_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, clave),
    KEY idx_notificacion_lecturas_usuario_fecha (usuario_id, leida_en),
    CONSTRAINT fk_notificacion_lecturas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE consignas_vigilancia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    destino_tipo ENUM('todos', 'vigilante', 'turno') NOT NULL,
    vigilante_id INT NULL,
    turno VARCHAR(50) NULL,
    titulo VARCHAR(150) NOT NULL,
    contenido TEXT NOT NULL,
    creado_por INT NOT NULL,
    creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vence_en DATETIME NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    cerrada_en DATETIME NULL,
    KEY idx_consignas_vigilancia_bandeja (
        conjunto_id,
        activa,
        creada_en
    ),
    KEY idx_consignas_vigilancia_destino (
        conjunto_id,
        destino_tipo,
        vigilante_id,
        turno
    ),
    CONSTRAINT fk_consignas_vigilancia_conjunto FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE,
    CONSTRAINT fk_consignas_vigilancia_vigilante FOREIGN KEY (vigilante_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_consignas_vigilancia_creado_por FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE RESTRICT
);

CREATE TABLE consigna_vistas (
    consigna_id INT NOT NULL,
    vigilante_id INT NOT NULL,
    vista_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (consigna_id, vigilante_id),
    KEY idx_consigna_vistas_vigilante_fecha (vigilante_id, vista_en),
    CONSTRAINT fk_consigna_vistas_consigna FOREIGN KEY (consigna_id) REFERENCES consignas_vigilancia (id) ON DELETE CASCADE,
    CONSTRAINT fk_consigna_vistas_vigilante FOREIGN KEY (vigilante_id) REFERENCES usuarios (id) ON DELETE CASCADE
);