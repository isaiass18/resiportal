<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];

// Helper para obtener el inmueble del residente actual
function getInmuebleId($pdo, $user_id) {
    $stmt = $pdo->prepare("SELECT inmueble_id FROM relacion_inmuebles_usuarios WHERE usuario_id = ? LIMIT 1");
    $stmt->execute([$user_id]);
    $res = $stmt->fetch();
    return $res ? $res['inmueble_id'] : null;
}

if ($action === 'list') {
    // Lista de inmuebles con info básica
    $stmt = $pdo->query("SELECT i.*, 
        (SELECT COUNT(*) FROM vehiculos v WHERE v.inmueble_id = i.id) as num_vehiculos,
        (SELECT COUNT(*) FROM mascotas m WHERE m.inmueble_id = i.id) as num_mascotas
        FROM inmuebles i");
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'mis_vehiculos') {
    $inmueble_id = getInmuebleId($pdo, $user_id);
    if (!$inmueble_id) responseJSON('success', '', []);
    
    $stmt = $pdo->prepare("SELECT * FROM vehiculos WHERE inmueble_id = ?");
    $stmt->execute([$inmueble_id]);
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'add_vehiculo') {
    $inmueble_id = getInmuebleId($pdo, $user_id);
    if (!$inmueble_id) responseJSON('error', 'No tienes un inmueble asignado');
    
    $placa = $_POST['placa'] ?? '';
    $tipo = $_POST['tipo'] ?? '';
    $marca = $_POST['marca'] ?? '';
    $linea = $_POST['linea'] ?? '';
    
    if (empty($placa) || empty($tipo)) responseJSON('error', 'Placa y tipo son obligatorios');
    
    $stmt = $pdo->prepare("INSERT INTO vehiculos (inmueble_id, placa, tipo, marca, linea) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$inmueble_id, $placa, $tipo, $marca, $linea]);
    responseJSON('success', 'Vehículo registrado correctamente');
}
elseif ($action === 'mis_mascotas') {
    $inmueble_id = getInmuebleId($pdo, $user_id);
    if (!$inmueble_id) responseJSON('success', '', []);
    
    $stmt = $pdo->prepare("SELECT * FROM mascotas WHERE inmueble_id = ?");
    $stmt->execute([$inmueble_id]);
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'add_mascota') {
    $inmueble_id = getInmuebleId($pdo, $user_id);
    if (!$inmueble_id) responseJSON('error', 'No tienes un inmueble asignado');
    
    $descripcion = $_POST['descripcion'] ?? '';
    if (empty($descripcion)) responseJSON('error', 'La descripción es obligatoria');
    
    $stmt = $pdo->prepare("INSERT INTO mascotas (inmueble_id, descripcion) VALUES (?, ?)");
    $stmt->execute([$inmueble_id, $descripcion]);
    responseJSON('success', 'Mascota registrada correctamente');
}
?>
