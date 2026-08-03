<?php
session_start();
require_once 'config.php';

header('Content-Type: application/json');
$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'login') {
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($email) || empty($password)) {
        responseJSON('error', 'Faltan credenciales');
    }

    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_rol'] = $user['rol'];
        $_SESSION['user_nombre'] = $user['nombre'];
        
        responseJSON('success', 'Login exitoso', [
            'id' => $user['id'],
            'rol' => $user['rol'],
            'nombre' => $user['nombre']
        ]);
    } else {
        responseJSON('error', 'Credenciales inválidas');
    }
} 
elseif ($action === 'logout') {
    session_destroy();
    responseJSON('success', 'Sesión cerrada');
}
elseif ($action === 'check') {
    if (isset($_SESSION['user_id'])) {
        responseJSON('success', 'Autenticado', [
            'id' => $_SESSION['user_id'],
            'rol' => $_SESSION['user_rol'],
            'nombre' => $_SESSION['user_nombre']
        ]);
    } else {
        responseJSON('error', 'No autenticado');
    }
}
?>
