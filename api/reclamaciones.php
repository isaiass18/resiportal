<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$conjuntoId = (int) $_SESSION['conjunto_id'];
$rol = $_SESSION['user_rol'];

if ($action === 'list') {
    if ($rol === 'admin') {
        $stmt = $pdo->prepare('SELECT r.id, r.asunto, r.descripcion, r.categoria, r.estado, r.creado_en, u.nombre AS usuario_nombre FROM reclamaciones r JOIN usuarios u ON u.id = r.usuario_id WHERE r.conjunto_id = ? ORDER BY r.creado_en DESC');
        $stmt->execute([$conjuntoId]);
    } else {
        $stmt = $pdo->prepare('SELECT id, asunto, descripcion, categoria, estado, creado_en FROM reclamaciones WHERE conjunto_id = ? AND usuario_id = ? ORDER BY creado_en DESC');
        $stmt->execute([$conjuntoId, $userId]);
    }
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'crear') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Solo residentes o propietarios pueden radicar PQRS');
    $asunto = trim($_POST['asunto'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $categoria = trim($_POST['categoria'] ?? 'General');
    if ($asunto === '' || $descripcion === '') responseJSON('error', 'Asunto y descripción son obligatorios');
    if (mb_strlen($asunto) > 150 || mb_strlen($categoria) > 80) responseJSON('error', 'La información excede la longitud permitida');
    $stmt = $pdo->prepare("INSERT INTO reclamaciones (conjunto_id, usuario_id, asunto, descripcion, categoria, estado) VALUES (?, ?, ?, ?, ?, 'abierto')");
    $stmt->execute([$conjuntoId, $userId, $asunto, $descripcion, $categoria ?: 'General']);
    responseJSON('success', 'PQRS radicada correctamente. Quedó en estado abierto.');
}

responseJSON('error', 'Acción no válida');
