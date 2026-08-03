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

-- Datos por defecto para pruebas
INSERT IGNORE INTO conjuntos (id, nombre) VALUES (1, 'Conjunto Residencial Demo');
INSERT IGNORE INTO usuarios (conjunto_id, rol, documento, nombre, email, password_hash) VALUES (1, 'admin', '123456', 'Administrador', 'admin@demo.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'); -- password: password
