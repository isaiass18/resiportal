<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];

if ($action === 'list') {
    if ($rol === 'admin') {
        $stmt = $pdo->query("SELECT r.*, z.nombre as zona_nombre, u.nombre as usuario_nombre FROM reservas r JOIN zonas_sociales z ON r.zona_id = z.id JOIN usuarios u ON r.usuario_id = u.id");
        responseJSON('success', '', $stmt->fetchAll());
    } else {
        $stmt = $pdo->prepare("SELECT r.*, z.nombre as zona_nombre FROM reservas r JOIN zonas_sociales z ON r.zona_id = z.id WHERE r.usuario_id = ?");
        $stmt->execute([$user_id]);
        responseJSON('success', '', $stmt->fetchAll());
    }
} elseif ($action === 'zonas_list') {
    $stmt = $pdo->query("SELECT * FROM zonas_sociales");
    responseJSON('success', '', $stmt->fetchAll());
}
?>
