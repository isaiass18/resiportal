<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];

if ($action === 'list') {
    if ($rol === 'admin') {
        $stmt = $pdo->query("SELECT r.*, z.nombre as zona_nombre, u.nombre as usuario_nombre FROM reservas r JOIN zonas_sociales z ON r.zona_id = z.id JOIN usuarios u ON r.usuario_id = u.id ORDER BY r.fecha_reserva DESC");
        responseJSON('success', '', $stmt->fetchAll());
    } else {
        $stmt = $pdo->prepare("SELECT r.*, z.nombre as zona_nombre FROM reservas r JOIN zonas_sociales z ON r.zona_id = z.id WHERE r.usuario_id = ? ORDER BY r.fecha_reserva DESC");
        $stmt->execute([$user_id]);
        responseJSON('success', '', $stmt->fetchAll());
    }
} elseif ($action === 'zonas_list') {
    $stmt = $pdo->query("SELECT * FROM zonas_sociales");
    responseJSON('success', '', $stmt->fetchAll());
} elseif ($action === 'crear_zona') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    
    $nombre = $_POST['nombre'] ?? '';
    $aforo = $_POST['aforo'] ?? 0;
    $horarios = $_POST['horarios'] ?? '';
    $reglamento = $_POST['reglamento'] ?? '';
    
    if (!$nombre) responseJSON('error', 'Falta el nombre');
    
    $stmt = $pdo->prepare("INSERT INTO zonas_sociales (conjunto_id, nombre, aforo, horarios, reglamento) VALUES (1, ?, ?, ?, ?)");
    $stmt->execute([$nombre, $aforo, $horarios, $reglamento]);
    
    $stmtLog = $pdo->prepare("INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, 'crear', 'zonas_sociales', ?)");
    $stmtLog->execute([$user_id, "Zona: $nombre"]);
    
    responseJSON('success', 'Zona social configurada exitosamente');
} elseif ($action === 'estado_reserva') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    
    $reserva_id = $_POST['reserva_id'] ?? 0;
    $estado = $_POST['estado'] ?? 'Aprobada'; // Aprobada o Rechazada
    
    $stmt = $pdo->prepare("UPDATE reservas SET estado = ? WHERE id = ?");
    $stmt->execute([$estado, $reserva_id]);
    responseJSON('success', 'Estado de la reserva actualizado');
}
?>
