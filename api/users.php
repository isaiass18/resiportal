<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['user_rol'] !== 'admin') responseJSON('error', 'Sin permisos');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$conjuntoId = (int) $_SESSION['conjunto_id'];
$rolesPermitidos = ['admin', 'vigilante', 'residente', 'propietario'];

function datosUsuario(): array
{
    return [
        trim($_POST['documento'] ?? ''),
        trim($_POST['nombre'] ?? ''),
        strtolower(trim($_POST['email'] ?? '')),
        trim($_POST['rol'] ?? '')
    ];
}

function validarUsuario(array $datos, array $rolesPermitidos): void
{
    [$documento, $nombre, $email, $rol] = $datos;
    if ($documento === '' || $nombre === '' || $email === '' || $rol === '') responseJSON('error', 'Documento, nombre, correo y rol son obligatorios');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) responseJSON('error', 'El correo no es válido');
    if (!in_array($rol, $rolesPermitidos, true)) responseJSON('error', 'Rol no permitido');
}

if ($action === 'list') {
    $stmt = $pdo->prepare('SELECT id, rol, documento, nombre, email FROM usuarios WHERE conjunto_id = ? ORDER BY nombre');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'crear_usuario' || $action === 'update') {
    [$documento, $nombre, $email, $rol] = datosUsuario();
    validarUsuario([$documento, $nombre, $email, $rol], $rolesPermitidos);
    $password = $_POST['password'] ?? '';
    $id = (int) ($_POST['id'] ?? 0);
    if ($action === 'crear_usuario') {
        if (strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres');
        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR email = ?) LIMIT 1');
        $stmt->execute([$conjuntoId, $documento, $email]);
        if ($stmt->fetch()) responseJSON('error', 'Documento o correo ya existe en este conjunto');
        $stmt = $pdo->prepare('INSERT INTO usuarios (conjunto_id, rol, documento, nombre, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$conjuntoId, $rol, $documento, $nombre, $email, password_hash($password, PASSWORD_DEFAULT)]);
        responseJSON('success', 'Usuario registrado correctamente');
    }
    if ($id <= 0) responseJSON('error', 'Usuario inválido');
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    if (!$stmt->fetch()) responseJSON('error', 'Usuario no encontrado');
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR email = ?) AND id <> ? LIMIT 1');
    $stmt->execute([$conjuntoId, $documento, $email, $id]);
    if ($stmt->fetch()) responseJSON('error', 'Documento o correo ya existe en este conjunto');
    if ($password !== '' && strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres');
    $sql = $password === '' ? 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = ? WHERE id = ? AND conjunto_id = ?' : 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = ?, password_hash = ? WHERE id = ? AND conjunto_id = ?';
    $valores = $password === '' ? [$rol, $documento, $nombre, $email, $id, $conjuntoId] : [$rol, $documento, $nombre, $email, password_hash($password, PASSWORD_DEFAULT), $id, $conjuntoId];
    $pdo->prepare($sql)->execute($valores);
    responseJSON('success', 'Usuario actualizado correctamente');
}

responseJSON('error', 'Acción no válida');
