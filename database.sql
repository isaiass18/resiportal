-- Configuración de la base de datos MySQL (Multi-tenant)
CREATE DATABASE IF NOT EXISTS conjunto_residencial;
USE conjunto_residencial;

CREATE TABLE IF NOT EXISTS conjuntos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    logo_url VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    rol ENUM('admin', 'secretaria', 'vigilante', 'propietario', 'residente') NOT NULL,
    documento VARCHAR(50) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    password_hash VARCHAR(255),
    contacto VARCHAR(50),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inmuebles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    torre VARCHAR(50),
    apartamento VARCHAR(50),
    parqueadero VARCHAR(50),
    coeficiente DECIMAL(10,4),
    mora_actual DECIMAL(12,2) DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relacion_inmuebles_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo_relacion ENUM('propietario', 'residente') NOT NULL,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    placa VARCHAR(20) NOT NULL,
    tipo VARCHAR(50),
    marca VARCHAR(50),
    linea VARCHAR(50),
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mascotas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    descripcion TEXT,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE
);

-- Zonas Sociales
CREATE TABLE IF NOT EXISTS zonas_sociales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tarifa DECIMAL(10,2) DEFAULT 0,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zona_id INT NOT NULL,
    usuario_id INT NOT NULL,
    fecha_reserva DATE NOT NULL,
    estado ENUM('pendiente', 'aprobada', 'rechazada') DEFAULT 'pendiente',
    FOREIGN KEY (zona_id) REFERENCES zonas_sociales(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Reclamaciones
CREATE TABLE IF NOT EXISTS reclamaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    estado ENUM('abierto', 'en_progreso', 'cerrado') DEFAULT 'abierto',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Sprint 1: Portería y Seguridad
CREATE TABLE IF NOT EXISTS visitantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    documento VARCHAR(50),
    vehiculo_placa VARCHAR(20),
    fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_salida TIMESTAMP NULL,
    autorizado_por INT,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE,
    FOREIGN KEY (autorizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS minuta_porteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vigilante_id INT NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    novedad TEXT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vigilante_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paquetes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    transportadora VARCHAR(100),
    descripcion VARCHAR(255),
    estado ENUM('pendiente', 'entregado') DEFAULT 'pendiente',
    fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP NULL,
    recibido_por INT,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE,
    FOREIGN KEY (recibido_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Sprint 2: Finanzas y Cartera
CREATE TABLE IF NOT EXISTS cuotas_administracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    mes INT NOT NULL,
    anio INT NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    estado ENUM('pendiente', 'pagado') DEFAULT 'pendiente',
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    metodo_pago ENUM('transferencia', 'efectivo', 'pse', 'consignacion') NOT NULL,
    referencia VARCHAR(100),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registrado_por INT,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles(id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Datos por defecto para pruebas
INSERT IGNORE INTO conjuntos (id, nombre) VALUES (1, 'Conjunto Residencial Demo');
INSERT IGNORE INTO usuarios (conjunto_id, rol, documento, nombre, email, password_hash) VALUES (1, 'admin', '123456', 'Administrador', 'admin@demo.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'); -- password: password
