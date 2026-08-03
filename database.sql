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
    rol ENUM(
        'admin',
        'secretaria',
        'vigilante',
        'propietario',
        'residente'
    ) NOT NULL,
    documento VARCHAR(50) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    password_hash VARCHAR(255),
    contacto VARCHAR(50),
    activo TINYINT(1) NOT NULL DEFAULT 1,
    desactivado_en DATETIME NULL,
    desactivado_por INT NULL,
    motivo_desactivacion VARCHAR(255) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usuarios_conjunto_documento (conjunto_id, documento),
    UNIQUE KEY uq_usuarios_conjunto_email (conjunto_id, email),
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE,
    CONSTRAINT fk_usuarios_desactivado_por FOREIGN KEY (desactivado_por) REFERENCES usuarios (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS perfiles_vigilancia (
    usuario_id INT PRIMARY KEY,
    turno VARCHAR(50),
    horario VARCHAR(150),
    observaciones TEXT,
    foto_archivo VARCHAR(255),
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inmuebles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    tipo_unidad ENUM('apartamento', 'casa') NOT NULL DEFAULT 'apartamento',
    torre VARCHAR(50),
    apartamento VARCHAR(50),
    nomenclatura VARCHAR(100) NOT NULL,
    parqueadero VARCHAR(50),
    coeficiente DECIMAL(10, 4),
    cuota_administracion DECIMAL(12, 2) NULL,
    mora_actual DECIMAL(12, 2) DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inmuebles_conjunto_nomenclatura (conjunto_id, nomenclatura),
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relacion_inmuebles_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo_relacion ENUM('propietario', 'residente') NOT NULL,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    placa VARCHAR(20) NOT NULL,
    tipo VARCHAR(50),
    marca VARCHAR(50),
    linea VARCHAR(50),
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mascotas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    descripcion TEXT,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE
);

-- Parqueaderos y asignaciones históricas
CREATE TABLE IF NOT EXISTS parqueaderos (
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
    observaciones VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_parqueadero_conjunto_codigo (conjunto_id, codigo),
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asignaciones_parqueadero (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parqueadero_id INT NOT NULL,
    inmueble_id INT NOT NULL,
    asignado_por INT NULL,
    asignado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retirado_por INT NULL,
    retirado_en TIMESTAMP NULL,
    motivo_retiro VARCHAR(255) NULL,
    FOREIGN KEY (parqueadero_id) REFERENCES parqueaderos (id) ON DELETE CASCADE,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE,
    FOREIGN KEY (asignado_por) REFERENCES usuarios (id) ON DELETE SET NULL,
    FOREIGN KEY (retirado_por) REFERENCES usuarios (id) ON DELETE SET NULL
);

-- Zonas Sociales
CREATE TABLE IF NOT EXISTS zonas_sociales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tarifa DECIMAL(10, 2) DEFAULT 0,
    aforo INT DEFAULT 0,
    horarios VARCHAR(255),
    max_horas_reserva TINYINT UNSIGNED NOT NULL DEFAULT 1,
    max_reservas_diarias_inmueble TINYINT UNSIGNED NOT NULL DEFAULT 1,
    reglamento TEXT,
    imagen_url VARCHAR(255),
    youtube_url VARCHAR(255),
    UNIQUE KEY uq_zonas_sociales_conjunto_nombre (conjunto_id, nombre),
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    zona_id INT NOT NULL,
    usuario_id INT NOT NULL,
    inmueble_id INT NULL,
    fecha_reserva DATE NOT NULL,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    estado ENUM(
        'pendiente',
        'aprobada',
        'rechazada'
    ) DEFAULT 'pendiente',
    KEY idx_reservas_zona_fecha_horario (
        zona_id,
        fecha_reserva,
        estado,
        hora_inicio,
        hora_fin
    ),
    KEY idx_reservas_inmueble_zona_fecha (
        inmueble_id,
        zona_id,
        fecha_reserva,
        estado
    ),
    FOREIGN KEY (zona_id) REFERENCES zonas_sociales (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE SET NULL
);

-- Reclamaciones
CREATE TABLE IF NOT EXISTS reclamaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    categoria VARCHAR(80) NOT NULL DEFAULT 'General',
    estado ENUM(
        'abierto',
        'en_progreso',
        'cerrado'
    ) DEFAULT 'abierto',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reclamacion_adjuntos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reclamacion_id INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    archivo VARCHAR(255) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    tamano INT UNSIGNED NOT NULL,
    subido_por INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reclamacion_adjuntos_reclamacion (reclamacion_id),
    FOREIGN KEY (reclamacion_id) REFERENCES reclamaciones (id) ON DELETE CASCADE,
    FOREIGN KEY (subido_por) REFERENCES usuarios (id) ON DELETE SET NULL
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
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE,
    FOREIGN KEY (autorizado_por) REFERENCES usuarios (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS minuta_porteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vigilante_id INT NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    novedad TEXT NOT NULL,
    fecha_novedad DATETIME NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vigilante_id) REFERENCES usuarios (id) ON DELETE CASCADE
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
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE,
    FOREIGN KEY (recibido_por) REFERENCES usuarios (id) ON DELETE SET NULL
);

-- Sprint 2: Finanzas y Cartera
CREATE TABLE IF NOT EXISTS cuotas_administracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    mes INT NOT NULL,
    anio INT NOT NULL,
    valor DECIMAL(12, 2) NOT NULL,
    estado ENUM('pendiente', 'pagado') DEFAULT 'pendiente',
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inmueble_id INT NOT NULL,
    valor DECIMAL(12, 2) NOT NULL,
    metodo_pago ENUM(
        'transferencia',
        'efectivo',
        'pse',
        'consignacion'
    ) NOT NULL,
    referencia VARCHAR(100),
    descripcion VARCHAR(255),
    soporte_archivo VARCHAR(255),
    estado ENUM(
        'pendiente',
        'aprobado',
        'rechazado'
    ) DEFAULT 'pendiente',
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registrado_por INT,
    FOREIGN KEY (inmueble_id) REFERENCES inmuebles (id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL
);

-- Sprint 3: Comunicaciones, Documentos y Auditoría
CREATE TABLE IF NOT EXISTS comunicados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    contenido TEXT NOT NULL,
    fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    autor_id INT,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE,
    FOREIGN KEY (autor_id) REFERENCES usuarios (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    ruta_archivo VARCHAR(255) NOT NULL,
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subido_por INT,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE,
    FOREIGN KEY (subido_por) REFERENCES usuarios (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(100) NOT NULL,
    detalles TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
);

-- ============================================================================
-- ⚠️  DATOS DE PRUEBA/DEMO — NO USAR EN PRODUCCIÓN SIN CAMBIAR CONTRASEÑAS ⚠️
-- Las 4 cuentas siguientes usan la misma contraseña: "password".
-- Antes de desplegar con datos reales de un conjunto residencial:
--   1. Elimina estas filas o cambia su password_hash con password_hash() de PHP.
--   2. Nunca reutilices este hash en un entorno con usuarios reales.
-- ============================================================================
INSERT IGNORE INTO
    conjuntos (id, nombre)
VALUES (
        1,
        'Conjunto Residencial Demo'
    );

INSERT IGNORE INTO
    usuarios (
        conjunto_id,
        rol,
        documento,
        nombre,
        email,
        password_hash
    )
VALUES (
        1,
        'admin',
        '123456',
        'Administrador',
        'admin@demo.com',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    ), -- password: password
    (
        1,
        'residente',
        '111111',
        'Residente Prueba',
        'residente@demo.com',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    ),
    (
        1,
        'residente',
        '222222',
        'Propietario Prueba',
        'propietario@demo.com',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    ),
    (
        1,
        'vigilante',
        '333333',
        'Vigilante Prueba',
        'vigilante@demo.com',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
    );

INSERT IGNORE INTO
    zonas_sociales (
        conjunto_id,
        nombre,
        tarifa,
        aforo,
        horarios,
        reglamento
    )
VALUES (
        1,
        'Piscina Infinity',
        0,
        30,
        '06:00 - 20:00',
        'Uso obligatorio de gorro.'
    ),
    (
        1,
        'Gimnasio Moderno',
        0,
        15,
        '05:00 - 22:00',
        'Llevar toalla obligatoria.'
    ),
    (
        1,
        'Salón Comunal Elegance',
        150000,
        80,
        '10:00 - 02:00',
        'No se permite ruido excesivo después de media noche.'
    );

-- Inmuebles de prueba para Finanzas
INSERT IGNORE INTO
    inmuebles (
        id,
        conjunto_id,
        torre,
        apartamento,
        nomenclatura,
        mora_actual
    )
VALUES (
        1,
        1,
        'Torre 1',
        '101',
        '101',
        150000.00
    ),
    (
        2,
        1,
        'Torre 1',
        '102',
        '102',
        0.00
    );

-- Relacionar residente y propietario (id 2 y 3) con el inmueble 1
INSERT IGNORE INTO
    relacion_inmuebles_usuarios (
        inmueble_id,
        usuario_id,
        tipo_relacion
    )
VALUES (1, 2, 'residente'),
    (1, 3, 'propietario');

-- Tabla de Eventos (Públicos)
CREATE TABLE IF NOT EXISTS eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conjunto_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_hora DATETIME NOT NULL,
    lugar VARCHAR(100),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conjunto_id) REFERENCES conjuntos (id) ON DELETE CASCADE
);

INSERT IGNORE INTO
    eventos (
        id,
        conjunto_id,
        titulo,
        descripcion,
        fecha_hora,
        lugar
    )
VALUES (
        1,
        1,
        'Asamblea General Anual',
        'Reunión obligatoria para todos los propietarios para discutir presupuestos y normativas.',
        '2026-10-15 19:00:00',
        'Salón Comunal Elegance'
    ),
    (
        2,
        1,
        'Clase de Yoga y Bienestar',
        'Sesión matutina relajante dirigida por instructores certificados.',
        '2026-08-20 07:00:00',
        'Zona Verde Principal'
    ),
    (
        3,
        1,
        'Torneo de Ping Pong',
        'Inscríbete en portería. Premios sorpresas para los ganadores.',
        '2026-08-25 15:00:00',
        'Gimnasio Moderno'
    );