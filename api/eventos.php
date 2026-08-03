<?php
session_start();
require 'config.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$conjuntoId = (int) ($_SESSION['conjunto_id'] ?? 1);

function datosEvento(): array
{
    $titulo = trim($_POST['titulo'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $lugar = trim($_POST['lugar'] ?? '');
    $fechaEntrada = trim($_POST['fecha_hora'] ?? '');
    $fecha = DateTime::createFromFormat('Y-m-d\\TH:i', $fechaEntrada) ?: DateTime::createFromFormat('Y-m-d H:i:s', $fechaEntrada);
    if ($titulo === '' || $lugar === '' || !$fecha || $fecha->format('Y-m-d H:i') !== substr(str_replace('T', ' ', $fechaEntrada), 0, 16)) responseJSON('error', 'Completa título, fecha/hora y lugar con valores válidos');
    if (mb_strlen($titulo) > 150 || mb_strlen($lugar) > 100 || mb_strlen($descripcion) > 5000) responseJSON('error', 'Uno de los campos supera el tamaño permitido');
    return [$titulo, $descripcion ?: null, $fecha->format('Y-m-d H:i:s'), $lugar];
}

if ($action === 'list') {
    $stmt = $pdo->prepare('SELECT id, titulo, descripcion, fecha_hora, lugar FROM eventos WHERE conjunto_id = ? AND fecha_hora >= CURRENT_DATE ORDER BY fecha_hora ASC');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if (!isset($_SESSION['user_id']) || ($_SESSION['user_rol'] ?? '') !== 'admin') responseJSON('error', 'Permiso denegado');

if ($action === 'create') {
    [$titulo, $descripcion, $fechaHora, $lugar] = datosEvento();
    $stmt = $pdo->prepare('INSERT INTO eventos (conjunto_id, titulo, descripcion, fecha_hora, lugar) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$conjuntoId, $titulo, $descripcion, $fechaHora, $lugar]);
    responseJSON('success', 'Evento creado exitosamente');
}

if ($action === 'update') {
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) responseJSON('error', 'Evento no válido');
    [$titulo, $descripcion, $fechaHora, $lugar] = datosEvento();
    $stmt = $pdo->prepare('UPDATE eventos SET titulo = ?, descripcion = ?, fecha_hora = ?, lugar = ? WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$titulo, $descripcion, $fechaHora, $lugar, $id, $conjuntoId]);
    if ($stmt->rowCount() === 0) responseJSON('error', 'Evento no encontrado o sin cambios');
    responseJSON('success', 'Evento actualizado');
}

if ($action === 'delete') {
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) responseJSON('error', 'Evento no válido');
    $stmt = $pdo->prepare('DELETE FROM eventos WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    if ($stmt->rowCount() === 0) responseJSON('error', 'Evento no encontrado');
    responseJSON('success', 'Evento eliminado');
}

responseJSON('error', 'Acción no válida');
