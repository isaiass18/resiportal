-- Ejecutar una única vez después de realizar un respaldo.
-- Crea las diapositivas administrables de la portada pública.
CREATE TABLE IF NOT EXISTS hero_slides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    texto TEXT NULL,
    etiqueta_boton VARCHAR(80) NULL,
    url_boton VARCHAR(500) NULL,
    imagen_url VARCHAR(255) NOT NULL,
    orden INT UNSIGNED NOT NULL DEFAULT 0,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_hero_slides_publico (conjunto_id, activo, orden),
    CONSTRAINT fk_hero_slides_conjunto FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);

-- Conserva la portada actual como primera diapositiva para cada conjunto existente.
INSERT INTO
    hero_slides (
        conjunto_id,
        titulo,
        texto,
        etiqueta_boton,
        url_boton,
        imagen_url,
        orden,
        activo
    )
SELECT c.id, 'Tu Conjunto Residencial, Más Conectado', 'Experimenta la máxima comodidad gestionando tu hogar desde un solo lugar. Eventos, pagos y zonas sociales a un clic de distancia.', 'Explorar Comunidad', '#seccion-eventos', 'img/hero_bg.jpg', 0, 1
FROM conjuntos c
WHERE
    NOT EXISTS (
        SELECT 1
        FROM hero_slides h
        WHERE
            h.conjunto_id = c.id
    );