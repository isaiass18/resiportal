<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];

if ($action === 'list_visitantes') {
    $stmt = $pdo->query("SELECT v.*, i.apartamento, u.nombre as autorizador FROM visitantes v LEFT JOIN inmuebles i ON v.inmueble_id = i.id LEFT JOIN usuarios u ON v.autorizado_por = u.id ORDER BY v.fecha_ingreso DESC LIMIT 50");
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'list_minuta') {
    $stmt = $pdo->query("SELECT m.*, u.nombre as vigilante FROM minuta_porteria m JOIN usuarios u ON m.vigilante_id = u.id ORDER BY m.fecha_registro DESC LIMIT 50");
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'list_paquetes') {
    $stmt = $pdo->query("SELECT p.*, i.apartamento, u.nombre as receptor FROM paquetes p LEFT JOIN inmuebles i ON p.inmueble_id = i.id LEFT JOIN usuarios u ON p.recibido_por = u.id ORDER BY p.fecha_recepcion DESC LIMIT 50");
    responseJSON('success', '', $stmt->fetchAll());
}
?>
