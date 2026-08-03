<?php
session_start();
require 'config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'list') {
    // Público: todos pueden ver los próximos eventos (a partir de hoy)
    $stmt = $pdo->query("SELECT * FROM eventos WHERE fecha_hora >= CURRENT_DATE ORDER BY fecha_hora ASC");
    responseJSON('success', '', $stmt->fetchAll());
} elseif ($action === 'create') {
    if (!isset($_SESSION['user_rol']) || $_SESSION['user_rol'] !== 'admin') {
        responseJSON('error', 'Permiso denegado');
    }

    $titulo = $_POST['titulo'] ?? '';
    $descripcion = $_POST['descripcion'] ?? '';
    $fecha_hora = $_POST['fecha_hora'] ?? '';
    $lugar = $_POST['lugar'] ?? '';
    $conjunto_id = $_SESSION['conjunto_id'];

    if (!$titulo || !$fecha_hora || !$lugar) {
        responseJSON('error', 'Faltan campos obligatorios');
    }

    $stmt = $pdo->prepare("INSERT INTO eventos (conjunto_id, titulo, descripcion, fecha_hora, lugar) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$conjunto_id, $titulo, $descripcion, $fecha_hora, $lugar]);

    responseJSON('success', 'Evento creado exitosamente');
} elseif ($action === 'delete') {
    if (!isset($_SESSION['user_rol']) || $_SESSION['user_rol'] !== 'admin') {
        responseJSON('error', 'Permiso denegado');
    }

    $id = $_POST['id'] ?? '';
    if (!$id) responseJSON('error', 'ID no proporcionado');

    $stmt = $pdo->prepare("DELETE FROM eventos WHERE id = ? AND conjunto_id = ?");
    $stmt->execute([$id, $_SESSION['conjunto_id']]);

    responseJSON('success', 'Evento eliminado');
} else {
    responseJSON('error', 'Acción no válida');
}
