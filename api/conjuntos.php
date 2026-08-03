<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
// Suponiendo un sistema con un solo conjunto por ahora (ID 1)
$conjunto_id = 1;

if ($action === 'get_config') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    
    $stmt = $pdo->prepare("SELECT nombre, logo_url FROM conjuntos WHERE id = ?");
    $stmt->execute([$conjunto_id]);
    responseJSON('success', '', $stmt->fetch());
}
elseif ($action === 'update_config') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    
    $nombre = $_POST['nombre'] ?? '';
    $logo_url = $_POST['logo_url'] ?? '';
    
    if (empty($nombre)) responseJSON('error', 'El nombre es obligatorio');
    
    $stmt = $pdo->prepare("UPDATE conjuntos SET nombre = ?, logo_url = ? WHERE id = ?");
    $stmt->execute([$nombre, $logo_url, $conjunto_id]);
    
    responseJSON('success', 'Configuración actualizada correctamente');
}
?>
