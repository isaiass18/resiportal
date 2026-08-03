-- ResiPortal: reservas horarias asociadas a inmuebles.
-- Ejecute UNA sola vez después de un respaldo de código y MySQL.
-- Las reservas históricas conservan inmueble y horas en NULL para bloquear el día completo.

ALTER TABLE zonas_sociales
ADD COLUMN max_horas_reserva TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER horarios,
ADD COLUMN max_reservas_diarias_inmueble TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER max_horas_reserva;

ALTER TABLE reservas
ADD COLUMN inmueble_id INT NULL AFTER usuario_id,
ADD COLUMN hora_inicio TIME NULL AFTER fecha_reserva,
ADD COLUMN hora_fin TIME NULL AFTER hora_inicio,
ADD KEY idx_reservas_zona_fecha_horario (
    zona_id,
    fecha_reserva,
    estado,
    hora_inicio,
    hora_fin
),
ADD KEY idx_reservas_inmueble_zona_fecha (
    inmueble_id,
    zona_id,
    fecha_reserva,
    estado
),
ADD CONSTRAINT fk_reservas_inmueble FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE SET NULL;