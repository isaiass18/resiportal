<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Public endpoints
if ($action === 'public_cartelera') {
    // Nota: sin conjunto autenticado no se puede filtrar; se asume portal público single-tenant por ahora.
    $stmt = $pdo->query("SELECT c.*, u.nombre as autor FROM comunicados c JOIN usuarios u ON c.autor_id = u.id ORDER BY c.fecha_publicacion DESC LIMIT 10");
    responseJSON('success', '', $stmt->fetchAll());
    exit;
}

// Protected endpoints
if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$user_id = $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjunto_id = $_SESSION['conjunto_id'];

// Función simple de auditoría
function auditar($pdo, $usuario_id, $accion, $entidad, $detalles = '')
{
    $stmt = $pdo->prepare("INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, ?, ?, ?)");
    $stmt->execute([$usuario_id, $accion, $entidad, $detalles]);
}

if ($action === 'list_comunicados') {
    $stmt = $pdo->prepare("SELECT c.*, u.nombre as autor FROM comunicados c JOIN usuarios u ON c.autor_id = u.id WHERE c.conjunto_id = ? ORDER BY c.fecha_publicacion DESC LIMIT 20");
    $stmt->execute([$conjunto_id]);
    responseJSON('success', '', $stmt->fetchAll());
} elseif ($action === 'crear_comunicado') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');

    $titulo = trim($_POST['titulo'] ?? '');
    $contenido = trim($_POST['contenido'] ?? '');
    if (!$titulo || !$contenido) responseJSON('error', 'Faltan datos');

    $stmt = $pdo->prepare("INSERT INTO comunicados (conjunto_id, titulo, contenido, autor_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([$conjunto_id, $titulo, $contenido, $user_id]);

    auditar($pdo, $user_id, 'crear', 'comunicados', "Título: $titulo");
    responseJSON('success', 'Comunicado publicado exitosamente');
} elseif ($action === 'list_auditoria') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $stmt = $pdo->prepare("SELECT a.*, u.nombre as usuario FROM auditoria_logs a LEFT JOIN usuarios u ON a.usuario_id = u.id WHERE u.conjunto_id = ? ORDER BY a.fecha DESC LIMIT 50");
    $stmt->execute([$conjunto_id]);
    responseJSON('success', '', $stmt->fetchAll());
}
