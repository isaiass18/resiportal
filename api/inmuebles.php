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

if ($action === 'list') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $stmt = $pdo->prepare('SELECT i.*, (SELECT COUNT(*) FROM vehiculos v WHERE v.inmueble_id = i.id) AS num_vehiculos, (SELECT COUNT(*) FROM mascotas m WHERE m.inmueble_id = i.id) AS num_mascotas FROM inmuebles i WHERE i.conjunto_id = ? ORDER BY COALESCE(i.torre, i.nomenclatura), i.apartamento');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
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
        $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ?');
        $stmt->execute([$id, $conjuntoId]);
        if (!$stmt->fetch()) responseJSON('error', 'Inmueble no encontrado');
        $duplicado = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND nomenclatura = ? AND id <> ?');
        $duplicado->execute([$conjuntoId, $nomenclatura, $id]);
        if ($duplicado->fetch()) responseJSON('error', 'La nomenclatura ya existe');
        $stmt = $pdo->prepare('UPDATE inmuebles SET tipo_unidad = ?, torre = ?, apartamento = ?, nomenclatura = ?, parqueadero = ?, coeficiente = ?, mora_actual = ? WHERE id = ? AND conjunto_id = ?');
        $stmt->execute([$tipo, $torre ?: null, $nomenclatura, $nomenclatura, $parqueadero ?: null, $coeficiente, $mora, $id, $conjuntoId]);
        responseJSON('success', 'Inmueble actualizado');
    }
    $duplicado = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND nomenclatura = ?');
    $duplicado->execute([$conjuntoId, $nomenclatura]);
    if ($duplicado->fetch()) responseJSON('error', 'La nomenclatura ya existe');
    $stmt = $pdo->prepare('INSERT INTO inmuebles (conjunto_id, tipo_unidad, torre, apartamento, nomenclatura, parqueadero, coeficiente, mora_actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$conjuntoId, $tipo, $torre ?: null, $nomenclatura, $nomenclatura, $parqueadero ?: null, $coeficiente, $mora]);
    responseJSON('success', 'Inmueble creado');
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
