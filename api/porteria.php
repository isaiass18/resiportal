<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['user_rol'], ['admin', 'vigilante'], true)) responseJSON('error', 'Sin permisos');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function inmuebleDelConjunto(PDO $pdo, int $inmuebleId, int $conjuntoId): bool
{
    $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$inmuebleId, $conjuntoId]);
    return (bool) $stmt->fetch();
}

if ($action === 'list_visitantes') {
    $stmt = $pdo->prepare('SELECT v.*, i.torre, i.apartamento FROM visitantes v JOIN inmuebles i ON i.id = v.inmueble_id WHERE i.conjunto_id = ? ORDER BY v.fecha_ingreso DESC LIMIT 50');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'list_minuta') {
    $stmt = $pdo->prepare('SELECT m.*, u.nombre AS vigilante, COALESCE(m.fecha_novedad, m.fecha_registro) AS fecha_operativa FROM minuta_porteria m JOIN usuarios u ON u.id = m.vigilante_id WHERE u.conjunto_id = ? ORDER BY COALESCE(m.fecha_novedad, m.fecha_registro) DESC LIMIT 50');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'list_paquetes') {
    $stmt = $pdo->prepare('SELECT p.*, i.torre, i.apartamento, u.nombre AS receptor FROM paquetes p JOIN inmuebles i ON i.id = p.inmueble_id LEFT JOIN usuarios u ON u.id = p.recibido_por WHERE i.conjunto_id = ? ORDER BY p.fecha_recepcion DESC LIMIT 50');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'list_directorio') {
    $stmt = $pdo->prepare("SELECT r.id AS relacion_id, u.id, u.nombre, u.email, u.contacto, r.tipo_relacion, CASE WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 0 ELSE 1 END AS tiene_cuenta, COALESCE(i.torre, 'N/A') AS torre, COALESCE(i.apartamento, i.nomenclatura, 'N/A') AS apartamento FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id AND u.conjunto_id = ? JOIN inmuebles i ON i.id = r.inmueble_id AND i.conjunto_id = ? WHERE r.tipo_relacion IN ('residente', 'propietario') ORDER BY i.torre, i.nomenclatura, u.nombre");
    $stmt->execute([$conjuntoId, $conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'registrar_visita') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $documento = trim($_POST['documento'] ?? '');
    $placa = strtoupper(trim($_POST['vehiculo_placa'] ?? ''));
    if (!$inmuebleId || $nombre === '' || !inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Visitante e inmueble válido son obligatorios');
    $stmt = $pdo->prepare('INSERT INTO visitantes (inmueble_id, nombre, documento, vehiculo_placa, autorizado_por) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$inmuebleId, $nombre, $documento ?: null, $placa ?: null, $userId]);
    responseJSON('success', 'Visita registrada');
}
if ($action === 'marcar_salida') {
    $id = (int) ($_POST['visitante_id'] ?? 0);
    $stmt = $pdo->prepare('UPDATE visitantes v JOIN inmuebles i ON i.id = v.inmueble_id SET v.fecha_salida = NOW() WHERE v.id = ? AND i.conjunto_id = ? AND v.fecha_salida IS NULL');
    $stmt->execute([$id, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'Visita no encontrada o ya cerrada');
    responseJSON('success', 'Salida registrada');
}
if ($action === 'recibir_paquete') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $transportadora = trim($_POST['transportadora'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    if (!$inmuebleId || $transportadora === '' || !inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Inmueble y transportadora son obligatorios');
    $stmt = $pdo->prepare("INSERT INTO paquetes (inmueble_id, transportadora, descripcion, estado, recibido_por) VALUES (?, ?, ?, 'pendiente', ?)");
    $stmt->execute([$inmuebleId, $transportadora, $descripcion ?: null, $userId]);
    responseJSON('success', 'Paquete recibido');
}
if ($action === 'entregar_paquete') {
    $id = (int) ($_POST['paquete_id'] ?? 0);
    $stmt = $pdo->prepare("UPDATE paquetes p JOIN inmuebles i ON i.id = p.inmueble_id SET p.estado = 'entregado', p.fecha_entrega = NOW() WHERE p.id = ? AND i.conjunto_id = ? AND p.estado = 'pendiente'");
    $stmt->execute([$id, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'Paquete no encontrado o ya entregado');
    responseJSON('success', 'Entrega registrada');
}
if ($action === 'registrar_novedad') {
    $asunto = trim($_POST['asunto'] ?? '');
    $novedad = trim($_POST['novedad'] ?? '');
    $fechaNovedad = trim($_POST['fecha_novedad'] ?? '');
    $fecha = DateTime::createFromFormat('Y-m-d\\TH:i', $fechaNovedad);
    if ($asunto === '' || strlen($asunto) > 150 || $novedad === '' || !$fecha || $fecha->format('Y-m-d\\TH:i') !== $fechaNovedad) responseJSON('error', 'Asunto (máximo 150 caracteres), novedad y fecha/hora válidos son obligatorios');
    $stmt = $pdo->prepare('INSERT INTO minuta_porteria (vigilante_id, asunto, novedad, fecha_novedad) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, $asunto, $novedad, $fecha->format('Y-m-d H:i:s')]);
    responseJSON('success', 'Novedad registrada en minuta');
}
if ($action === 'list_inmuebles') {
    $stmt = $pdo->prepare('SELECT id, torre, apartamento, nomenclatura FROM inmuebles WHERE conjunto_id = ? ORDER BY torre, apartamento');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
responseJSON('error', 'Acción no válida');
