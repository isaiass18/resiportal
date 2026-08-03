<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'list') {
    $stmt = $pdo->query("SELECT id, conjunto_id, rol, documento, nombre, email FROM usuarios");
    responseJSON('success', '', $stmt->fetchAll());
} elseif ($action === 'crear_usuario') {
    if ($_SESSION['user_rol'] !== 'admin') responseJSON('error', 'Sin permisos');
    
    $doc = $_POST['documento'] ?? '';
    $nom = $_POST['nombre'] ?? '';
    $email = $_POST['email'] ?? '';
    $pass = $_POST['password'] ?? '';
    $rol = $_POST['rol'] ?? 'residente';
    
    if (!$doc || !$nom || !$email || !$pass || !$rol) {
        responseJSON('error', 'Faltan datos');
    }
    
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    // Asumimos conjunto 1 por ahora para MVP
    $stmt = $pdo->prepare("INSERT INTO usuarios (conjunto_id, rol, documento, nombre, email, password_hash) VALUES (1, ?, ?, ?, ?, ?)");
    try {
        $stmt->execute([$rol, $doc, $nom, $email, $hash]);
        responseJSON('success', 'Usuario registrado correctamente');
    } catch(PDOException $e) {
        responseJSON('error', 'Error: el email o documento ya existen.');
    }
}
?>
