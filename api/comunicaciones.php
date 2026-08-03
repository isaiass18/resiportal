<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$conjuntoPublico = (int) ($_SESSION['conjunto_id'] ?? 1);

if ($action === 'public_cartelera') {
    $stmt = $pdo->prepare('SELECT c.*, u.nombre AS autor FROM comunicados c LEFT JOIN usuarios u ON c.autor_id = u.id WHERE c.conjunto_id = ? ORDER BY c.fecha_publicacion DESC LIMIT 10');
    $stmt->execute([$conjuntoPublico]);
    responseJSON('success', '', $stmt->fetchAll());
}

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function auditar(PDO $pdo, int $usuarioId, string $accion, string $entidad, string $detalles = ''): void
{
    $stmt = $pdo->prepare('INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, ?, ?, ?)');
    $stmt->execute([$usuarioId, $accion, $entidad, $detalles]);
}

function datosComunicado(): array
{
    $titulo = trim($_POST['titulo'] ?? '');
    $contenido = trim($_POST['contenido'] ?? '');
    if ($titulo === '' || $contenido === '') responseJSON('error', 'Título y contenido son obligatorios');
    if (mb_strlen($titulo) > 150 || mb_strlen($contenido) > 10000) responseJSON('error', 'El texto supera el tamaño permitido');
    return [$titulo, $contenido];
}

if ($action === 'list_comunicados') {
    $stmt = $pdo->prepare('SELECT c.*, COALESCE(u.nombre, "Sistema") AS autor FROM comunicados c LEFT JOIN usuarios u ON c.autor_id = u.id WHERE c.conjunto_id = ? ORDER BY c.fecha_publicacion DESC LIMIT 50');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($rol !== 'admin') responseJSON('error', 'Sin permisos');

if ($action === 'crear_comunicado') {
    [$titulo, $contenido] = datosComunicado();
    $stmt = $pdo->prepare('INSERT INTO comunicados (conjunto_id, titulo, contenido, autor_id) VALUES (?, ?, ?, ?)');
    $stmt->execute([$conjuntoId, $titulo, $contenido, $userId]);
    auditar($pdo, $userId, 'crear', 'comunicados', "Título: $titulo");
    responseJSON('success', 'Novedad publicada');
}

if ($action === 'actualizar_comunicado') {
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) responseJSON('error', 'Novedad no válida');
    [$titulo, $contenido] = datosComunicado();
    $stmt = $pdo->prepare('UPDATE comunicados SET titulo = ?, contenido = ? WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$titulo, $contenido, $id, $conjuntoId]);
    if ($stmt->rowCount() === 0) responseJSON('error', 'Novedad no encontrada o sin cambios');
    auditar($pdo, $userId, 'actualizar', 'comunicados', "ID: $id");
    responseJSON('success', 'Novedad actualizada');
}

if ($action === 'eliminar_comunicado') {
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) responseJSON('error', 'Novedad no válida');
    $stmt = $pdo->prepare('DELETE FROM comunicados WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    if ($stmt->rowCount() === 0) responseJSON('error', 'Novedad no encontrada');
    auditar($pdo, $userId, 'eliminar', 'comunicados', "ID: $id");
    responseJSON('success', 'Novedad eliminada');
}

if ($action === 'list_auditoria') {
    $stmt = $pdo->prepare('SELECT a.*, COALESCE(u.nombre, "Sistema") AS usuario FROM auditoria_logs a LEFT JOIN usuarios u ON a.usuario_id = u.id WHERE u.conjunto_id = ? OR a.usuario_id = ? ORDER BY a.fecha DESC LIMIT 50');
    $stmt->execute([$conjuntoId, $userId]);
    responseJSON('success', '', $stmt->fetchAll());
}

responseJSON('error', 'Acción no válida');
