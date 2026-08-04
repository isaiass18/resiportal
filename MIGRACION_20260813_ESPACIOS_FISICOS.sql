-- Ejecutar una única vez después de realizar un respaldo.
-- Convierte el catálogo de parqueaderos en inventario de espacios físicos:
-- carro, moto o bodega, identificados por sótano/nivel y ubicación.
ALTER TABLE parqueaderos
ADD COLUMN clase_espacio ENUM('carro', 'moto', 'bodega') NOT NULL DEFAULT 'carro' AFTER tipo,
ADD COLUMN sotano VARCHAR(50) NULL AFTER clase_espacio,
ADD COLUMN ubicacion VARCHAR(100) NULL AFTER sotano;

-- Los registros históricos existentes conservan su código, tipo administrativo,
-- asignaciones e historial; se clasifican inicialmente como espacio para carro.
UPDATE parqueaderos
SET
    clase_espacio = 'carro'
WHERE
    clase_espacio IS NULL
    OR clase_espacio = '';