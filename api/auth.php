<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'login') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    if ($email === '' || $password === '') responseJSON('error', 'Faltan credenciales');

    $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) responseJSON('error', 'Credenciales inválidas');

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_rol'] = $user['rol'];
    $_SESSION['user_nombre'] = $user['nombre'];
    $_SESSION['conjunto_id'] = $user['conjunto_id'];
    responseJSON('success', 'Login exitoso', ['id' => $user['id'], 'rol' => $user['rol'], 'nombre' => $user['nombre']]);
}

if ($action === 'logout') {
    session_destroy();
    responseJSON('success', 'Sesión cerrada');
}

if ($action === 'check') {
    if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autenticado');
    responseJSON('success', 'Autenticado', ['id' => $_SESSION['user_id'], 'rol' => $_SESSION['user_rol'], 'nombre' => $_SESSION['user_nombre'], 'conjunto_id' => $_SESSION['conjunto_id']]);
}

if ($action === 'cambiar_password') {
    if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');
    $actual = $_POST['password_actual'] ?? '';
    $nueva = $_POST['password_nueva'] ?? '';
    $confirmacion = $_POST['password_confirmacion'] ?? '';
    if ($actual === '' || $nueva === '' || $confirmacion === '') responseJSON('error', 'Completa todos los campos');
    if (strlen($nueva) < 8) responseJSON('error', 'La nueva contraseña debe tener al menos 8 caracteres');
    if (!hash_equals($nueva, $confirmacion)) responseJSON('error', 'La confirmación no coincide');
    $stmt = $pdo->prepare('SELECT password_hash FROM usuarios WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$_SESSION['user_id'], $_SESSION['conjunto_id']]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($actual, $user['password_hash'])) responseJSON('error', 'La contraseña actual es incorrecta');
    $stmt = $pdo->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([password_hash($nueva, PASSWORD_DEFAULT), $_SESSION['user_id'], $_SESSION['conjunto_id']]);
    responseJSON('success', 'Contraseña actualizada correctamente');
}

responseJSON('error', 'Acción no válida');
