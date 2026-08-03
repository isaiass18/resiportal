<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    // Lista de inmuebles con info básica
    $stmt = $pdo->query("SELECT i.*, 
        (SELECT COUNT(*) FROM vehiculos v WHERE v.inmueble_id = i.id) as num_vehiculos,
        (SELECT COUNT(*) FROM mascotas m WHERE m.inmueble_id = i.id) as num_mascotas
        FROM inmuebles i");
    responseJSON('success', '', $stmt->fetchAll());
}
?>
