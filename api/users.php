<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    $stmt = $pdo->query("SELECT id, rol, documento, nombre, email, contacto FROM usuarios");
    responseJSON('success', '', $stmt->fetchAll());
}
?>
