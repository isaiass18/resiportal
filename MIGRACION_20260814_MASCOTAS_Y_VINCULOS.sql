-- Ejecutar una única vez después de realizar un respaldo.
-- Amplía el registro de mascotas y optimiza las consultas de vínculos y espacios.
ALTER TABLE mascotas
ADD COLUMN tipo VARCHAR(50) NULL AFTER inmueble_id,
ADD COLUMN nombre VARCHAR(100) NULL AFTER tipo,
ADD COLUMN raza VARCHAR(100) NULL AFTER nombre;

ALTER TABLE asignaciones_parqueadero
ADD KEY idx_asignaciones_inmueble_activa (inmueble_id, retirado_en),
ADD KEY idx_asignaciones_espacio_activa (parqueadero_id, retirado_en);

-- Consolida vínculos históricos repetidos conservando el registro más antiguo.
-- La tabla no guarda atributos adicionales, por lo que no se pierde información de relación.
DELETE duplicado
FROM
    relacion_inmuebles_usuarios duplicado
    INNER JOIN relacion_inmuebles_usuarios conservado ON duplicado.inmueble_id = conservado.inmueble_id
    AND duplicado.usuario_id = conservado.usuario_id
    AND duplicado.tipo_relacion = conservado.tipo_relacion
    AND duplicado.id > conservado.id;

ALTER TABLE relacion_inmuebles_usuarios
ADD UNIQUE KEY uq_relacion_inmueble_usuario_tipo (
    inmueble_id,
    usuario_id,
    tipo_relacion
),
ADD KEY idx_relacion_usuario_inmueble (usuario_id, inmueble_id);

-- Los registros antiguos se conservan. Completa tipo, nombre y raza desde la
-- ficha de cada mascota cuando sea posible; la descripción sigue disponible.