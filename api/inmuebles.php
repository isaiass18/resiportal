<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function getInmuebleId(PDO $pdo, int $userId): ?int
{
    $stmt = $pdo->prepare('SELECT r.inmueble_id FROM relacion_inmuebles_usuarios r JOIN inmuebles i ON i.id = r.inmueble_id WHERE r.usuario_id = ? AND i.conjunto_id = ? LIMIT 1');
    $stmt->execute([$userId, $_SESSION['conjunto_id']]);
    $row = $stmt->fetch();
    return $row ? (int) $row['inmueble_id'] : null;
}

function inmuebleDelConjunto(PDO $pdo, int $inmuebleId, int $conjuntoId): bool
{
    $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$inmuebleId, $conjuntoId]);
    return (bool) $stmt->fetch();
}

if ($action === 'list') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $stmt = $pdo->prepare("SELECT i.*, (SELECT COUNT(*) FROM vehiculos v WHERE v.inmueble_id = i.id) AS num_vehiculos, (SELECT COUNT(*) FROM mascotas m WHERE m.inmueble_id = i.id) AS num_mascotas, (SELECT COUNT(DISTINCT r.usuario_id) FROM relacion_inmuebles_usuarios r WHERE r.inmueble_id = i.id) AS num_personas, (SELECT COUNT(DISTINCT r.usuario_id) FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.inmueble_id = i.id AND r.tipo_relacion = 'residente') AS num_residentes, (SELECT COUNT(DISTINCT r.usuario_id) FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.inmueble_id = i.id AND u.password_hash IS NOT NULL AND u.password_hash <> '') AS num_cuentas, a.id AS asignacion_parqueadero_id, p.id AS parqueadero_id, p.codigo AS parqueadero_codigo, p.tipo AS parqueadero_tipo FROM inmuebles i LEFT JOIN asignaciones_parqueadero a ON a.inmueble_id = i.id AND a.retirado_en IS NULL LEFT JOIN parqueaderos p ON p.id = a.parqueadero_id WHERE i.conjunto_id = ? ORDER BY COALESCE(i.torre, i.nomenclatura), i.apartamento");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'detalle') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $inmuebleId = (int) ($_GET['inmueble_id'] ?? 0);
    if (!inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Inmueble no encontrado');
    $inmueble = $pdo->prepare('SELECT i.*, p.codigo AS parqueadero_codigo, p.tipo AS parqueadero_tipo FROM inmuebles i LEFT JOIN asignaciones_parqueadero a ON a.inmueble_id = i.id AND a.retirado_en IS NULL LEFT JOIN parqueaderos p ON p.id = a.parqueadero_id WHERE i.id = ? AND i.conjunto_id = ?');
    $inmueble->execute([$inmuebleId, $conjuntoId]);
    $personas = $pdo->prepare("SELECT r.id AS relacion_id, r.tipo_relacion, u.id, u.nombre, u.documento, u.email, u.contacto, u.activo, CASE WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 0 ELSE 1 END AS tiene_cuenta FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.inmueble_id = ? AND u.conjunto_id = ? ORDER BY FIELD(r.tipo_relacion, 'propietario', 'residente'), u.nombre");
    $personas->execute([$inmuebleId, $conjuntoId]);
    $vehiculos = $pdo->prepare('SELECT id, placa, tipo, marca, linea FROM vehiculos WHERE inmueble_id = ? ORDER BY placa');
    $vehiculos->execute([$inmuebleId]);
    $mascotas = $pdo->prepare('SELECT id, descripcion FROM mascotas WHERE inmueble_id = ? ORDER BY id DESC');
    $mascotas->execute([$inmuebleId]);
    responseJSON('success', '', ['inmueble' => $inmueble->fetch(), 'personas' => $personas->fetchAll(), 'vehiculos' => $vehiculos->fetchAll(), 'mascotas' => $mascotas->fetchAll()]);
}

if ($action === 'vincular_usuario') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $usuarioId = (int) ($_POST['usuario_id'] ?? 0);
    $tipoRelacion = $_POST['tipo_relacion'] ?? '';
    if (!$usuarioId || !in_array($tipoRelacion, ['residente', 'propietario'], true) || !inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Selecciona una persona, una relación y un inmueble válidos');
    $usuario = $pdo->prepare('SELECT id, rol FROM usuarios WHERE id = ? AND conjunto_id = ?');
    $usuario->execute([$usuarioId, $conjuntoId]);
    $persona = $usuario->fetch();
    if (!$persona || $persona['rol'] !== $tipoRelacion) responseJSON('error', 'La persona debe tener el mismo rol que la relación seleccionada');
    $existe = $pdo->prepare('SELECT id FROM relacion_inmuebles_usuarios WHERE inmueble_id = ? AND usuario_id = ? AND tipo_relacion = ? LIMIT 1');
    $existe->execute([$inmuebleId, $usuarioId, $tipoRelacion]);
    if (!$existe->fetch()) $pdo->prepare('INSERT INTO relacion_inmuebles_usuarios (inmueble_id, usuario_id, tipo_relacion) VALUES (?, ?, ?)')->execute([$inmuebleId, $usuarioId, $tipoRelacion]);
    responseJSON('success', 'Persona enlazada al inmueble');
}

if ($action === 'guardar_inmueble') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $id = (int) ($_POST['id'] ?? 0);
    $tipo = $_POST['tipo_unidad'] ?? 'apartamento';
    $torre = trim($_POST['torre'] ?? '');
    $nomenclatura = trim($_POST['nomenclatura'] ?? '');
    $parqueadero = trim($_POST['parqueadero'] ?? '');
    $coeficiente = (float) ($_POST['coeficiente'] ?? 0);
    $mora = (float) ($_POST['mora_actual'] ?? 0);
    if (!in_array($tipo, ['apartamento', 'casa'], true) || $nomenclatura === '') responseJSON('error', 'Tipo y nomenclatura son obligatorios');
    if ($coeficiente < 0 || $mora < 0) responseJSON('error', 'Coeficiente y mora deben ser positivos');

    if ($id) {
        if (!inmuebleDelConjunto($pdo, $id, $conjuntoId)) responseJSON('error', 'Inmueble no encontrado');
        $duplicado = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND nomenclatura = ? AND id <> ?');
        $duplicado->execute([$conjuntoId, $nomenclatura, $id]);
        if ($duplicado->fetch()) responseJSON('error', 'La nomenclatura ya existe');
        $stmt = $pdo->prepare('UPDATE inmuebles SET tipo_unidad = ?, torre = ?, apartamento = ?, nomenclatura = ?, parqueadero = ?, coeficiente = ?, mora_actual = ? WHERE id = ? AND conjunto_id = ?');
        $stmt->execute([$tipo, $torre ?: null, $nomenclatura, $nomenclatura, $parqueadero ?: null, $coeficiente, $mora, $id, $conjuntoId]);
        responseJSON('success', 'Inmueble actualizado', ['id' => $id]);
    }
    $duplicado = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND nomenclatura = ?');
    $duplicado->execute([$conjuntoId, $nomenclatura]);
    if ($duplicado->fetch()) responseJSON('error', 'La nomenclatura ya existe');
    $stmt = $pdo->prepare('INSERT INTO inmuebles (conjunto_id, tipo_unidad, torre, apartamento, nomenclatura, parqueadero, coeficiente, mora_actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$conjuntoId, $tipo, $torre ?: null, $nomenclatura, $nomenclatura, $parqueadero ?: null, $coeficiente, $mora]);
    responseJSON('success', 'Inmueble creado', ['id' => (int) $pdo->lastInsertId()]);
}

if ($action === 'mis_vehiculos' || $action === 'mis_mascotas') {
    $inmuebleId = getInmuebleId($pdo, $userId);
    if (!$inmuebleId) responseJSON('success', '', []);
    $tabla = $action === 'mis_vehiculos' ? 'vehiculos' : 'mascotas';
    $stmt = $pdo->prepare("SELECT * FROM $tabla WHERE inmueble_id = ? ORDER BY id DESC");
    $stmt->execute([$inmuebleId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'add_vehiculo') {
    $inmuebleId = getInmuebleId($pdo, $userId);
    $placa = strtoupper(trim($_POST['placa'] ?? ''));
    $tipo = trim($_POST['tipo'] ?? '');
    if (!$inmuebleId || $placa === '' || $tipo === '') responseJSON('error', 'Placa y tipo son obligatorios');
    $stmt = $pdo->prepare('INSERT INTO vehiculos (inmueble_id, placa, tipo, marca, linea) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$inmuebleId, $placa, $tipo, trim($_POST['marca'] ?? '') ?: null, trim($_POST['linea'] ?? '') ?: null]);
    responseJSON('success', 'Vehículo registrado');
}
if ($action === 'add_mascota') {
    $inmuebleId = getInmuebleId($pdo, $userId);
    $descripcion = trim($_POST['descripcion'] ?? '');
    if (!$inmuebleId || $descripcion === '') responseJSON('error', 'La descripción es obligatoria');
    $stmt = $pdo->prepare('INSERT INTO mascotas (inmueble_id, descripcion) VALUES (?, ?)');
    $stmt->execute([$inmuebleId, $descripcion]);
    responseJSON('success', 'Mascota registrada');
}
responseJSON('error', 'Acción no válida');
