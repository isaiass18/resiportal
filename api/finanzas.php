<?php
session_start();
require_once 'config.php';
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    responseJSON('error', 'No autorizado');
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function inmuebleUsuario(PDO $pdo, int $userId, int $conjuntoId): ?array
{
    $stmt = $pdo->prepare('SELECT i.id, i.mora_actual, i.torre, i.apartamento, i.nomenclatura FROM inmuebles i JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id WHERE r.usuario_id = ? AND i.conjunto_id = ? LIMIT 1');
    $stmt->execute([$userId, $conjuntoId]);
    return $stmt->fetch() ?: null;
}
function guardarSoporte(array $file, int $conjuntoId): string
{
    if ($file['error'] !== UPLOAD_ERR_OK) responseJSON('error', 'No se pudo cargar el soporte');
    if ($file['size'] > 5 * 1024 * 1024) responseJSON('error', 'El soporte no puede superar 5MB');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'pdf' => 'application/pdf'];
    if (!isset($mimes[$ext]) || (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) !== $mimes[$ext]) responseJSON('error', 'Formato de soporte no permitido');
    $dir = __DIR__ . '/../../uploads_privados/soportes';
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) responseJSON('error', 'No se pudo preparar el almacenamiento');
    $name = 'soporte_' . $conjuntoId . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) responseJSON('error', 'No se pudo guardar el soporte');
    return $name;
}

if ($action === 'mi_deuda') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Permiso denegado');
    $cuenta = inmuebleUsuario($pdo, $userId, $conjuntoId);
    if (!$cuenta) responseJSON('success', '', ['mora_actual' => 0, 'inmueble' => null]);
    responseJSON('success', '', ['mora_actual' => (float)$cuenta['mora_actual'], 'inmueble' => $cuenta]);
}

if ($action === 'mis_pagos') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Permiso denegado');
    $cuenta = inmuebleUsuario($pdo, $userId, $conjuntoId);
    if (!$cuenta) responseJSON('error', 'No tienes un inmueble asignado');
    $stmt = $pdo->prepare('SELECT id, valor, metodo_pago, referencia, descripcion, soporte_archivo, estado, fecha_pago FROM pagos WHERE inmueble_id = ? AND registrado_por = ? ORDER BY fecha_pago DESC');
    $stmt->execute([$cuenta['id'], $userId]);
    responseJSON('success', '', ['cuenta' => $cuenta, 'historial' => $stmt->fetchAll()]);
}
if ($action === 'reportar_pago') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Permiso denegado');
    $valor = (float) ($_POST['valor'] ?? 0);
    $metodo = $_POST['metodo'] ?? '';
    $referencia = trim($_POST['referencia'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    if ($valor <= 0 || $referencia === '') responseJSON('error', 'Valor y referencia son obligatorios');
    if (!in_array($metodo, ['transferencia', 'consignacion', 'pse'], true)) responseJSON('error', 'Método de pago inválido');
    $cuenta = inmuebleUsuario($pdo, $userId, $conjuntoId);
    if (!$cuenta) responseJSON('error', 'No tienes un inmueble asignado');
    $soporte = isset($_FILES['soporte']) && $_FILES['soporte']['error'] !== UPLOAD_ERR_NO_FILE ? guardarSoporte($_FILES['soporte'], $conjuntoId) : null;
    $stmt = $pdo->prepare("INSERT INTO pagos (inmueble_id, valor, metodo_pago, referencia, descripcion, soporte_archivo, registrado_por, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')");
    $stmt->execute([$cuenta['id'], $valor, $metodo, $referencia, $descripcion ?: null, $soporte, $userId]);
    responseJSON('success', 'Pago reportado. Está pendiente de aprobación');
}
if ($action === 'ver_soporte') {
    $pagoId = (int) ($_GET['pago_id'] ?? 0);
    $sql = $rol === 'admin' ? 'SELECT p.soporte_archivo FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE p.id = ? AND i.conjunto_id = ?' : 'SELECT p.soporte_archivo FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE p.id = ? AND p.registrado_por = ? AND i.conjunto_id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($rol === 'admin' ? [$pagoId, $conjuntoId] : [$pagoId, $userId, $conjuntoId]);
    $row = $stmt->fetch();
    $path = $row ? __DIR__ . '/../../uploads_privados/soportes/' . basename($row['soporte_archivo'] ?? '') : '';
    if (!$row || !$row['soporte_archivo'] || !is_file($path)) {
        http_response_code(404);
        exit('Soporte no encontrado');
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'pdf' => 'application/pdf'];
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Content-Disposition: inline; filename="soporte.' . $ext . '"');
    readfile($path);
    exit;
}

if ($rol !== 'admin') responseJSON('error', 'Permiso denegado');
if ($action === 'cartera') {
    $stmt = $pdo->prepare("SELECT i.id, i.torre, i.apartamento, i.nomenclatura, i.mora_actual, u.nombre AS propietario_nombre FROM inmuebles i LEFT JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id AND r.tipo_relacion = 'propietario' LEFT JOIN usuarios u ON u.id = r.usuario_id WHERE i.conjunto_id = ? AND i.mora_actual > 0 ORDER BY i.mora_actual DESC");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'pagos_pendientes') {
    $stmt = $pdo->prepare("SELECT p.id, p.valor, p.metodo_pago, p.referencia, p.descripcion, p.soporte_archivo, p.fecha_pago, i.torre, i.apartamento, i.nomenclatura, u.nombre AS residente FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id LEFT JOIN usuarios u ON u.id = p.registrado_por WHERE p.estado = 'pendiente' AND i.conjunto_id = ? ORDER BY p.fecha_pago");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'historial_pagos') {
    $stmt = $pdo->prepare('SELECT p.*, i.torre, i.apartamento, i.nomenclatura, u.nombre AS registrado_por_nombre FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id LEFT JOIN usuarios u ON u.id = p.registrado_por WHERE i.conjunto_id = ? ORDER BY p.fecha_pago DESC LIMIT 100');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'aprobar_pago') {
    $id = (int) ($_POST['pago_id'] ?? 0);
    $estado = $_POST['estado'] ?? '';
    if (!in_array($estado, ['aprobado', 'rechazado'], true)) responseJSON('error', 'Estado inválido');
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT p.inmueble_id, p.valor FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE p.id = ? AND i.conjunto_id = ? AND p.estado = ? FOR UPDATE');
        $stmt->execute([$id, $conjuntoId, 'pendiente']);
        $pago = $stmt->fetch();
        if (!$pago) throw new Exception('Pago no encontrado o ya procesado');
        $pdo->prepare('UPDATE pagos SET estado = ? WHERE id = ?')->execute([$estado, $id]);
        if ($estado === 'aprobado') $pdo->prepare('UPDATE inmuebles SET mora_actual = GREATEST(0, mora_actual - ?) WHERE id = ?')->execute([$pago['valor'], $pago['inmueble_id']]);
        $pdo->commit();
        responseJSON('success', 'Pago procesado');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'registrar_pago') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $valor = (float) ($_POST['valor'] ?? 0);
    $metodo = $_POST['metodo'] ?? 'transferencia';
    $referencia = trim($_POST['referencia'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    if ($inmuebleId <= 0 || $valor <= 0 || !in_array($metodo, ['transferencia', 'efectivo', 'pse', 'consignacion'], true)) responseJSON('error', 'Datos de pago inválidos');
    $soporte = isset($_FILES['soporte']) && $_FILES['soporte']['error'] !== UPLOAD_ERR_NO_FILE ? guardarSoporte($_FILES['soporte'], $conjuntoId) : null;
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $stmt->execute([$inmuebleId, $conjuntoId]);
        if (!$stmt->fetch()) throw new Exception('Inmueble no encontrado');
        $pdo->prepare("INSERT INTO pagos (inmueble_id, valor, metodo_pago, referencia, descripcion, soporte_archivo, registrado_por, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado')")->execute([$inmuebleId, $valor, $metodo, $referencia ?: null, $descripcion ?: null, $soporte, $userId]);
        $pdo->prepare('UPDATE inmuebles SET mora_actual = GREATEST(0, mora_actual - ?) WHERE id = ?')->execute([$valor, $inmuebleId]);
        $pdo->commit();
        responseJSON('success', 'Pago registrado');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'generar_cobro') {
    $valor = (float) ($_POST['valor'] ?? 0);
    if ($valor <= 0) responseJSON('error', 'Valor inválido');
    $pdo->prepare('UPDATE inmuebles SET mora_actual = mora_actual + ? WHERE conjunto_id = ?')->execute([$valor, $conjuntoId]);
    responseJSON('success', 'Cobro masivo generado');
}
if ($action === 'dashboard_financiero') {
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(mora_actual),0) AS total_cartera FROM inmuebles WHERE conjunto_id=?');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetch());
}
responseJSON('error', 'Acción no válida');
