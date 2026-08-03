<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$user_id = $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];

if ($action === 'list_cartera') {
    $stmt = $pdo->query("SELECT id, torre, apartamento, mora_actual FROM inmuebles WHERE mora_actual > 0 ORDER BY mora_actual DESC");
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'list_pagos') {
    $stmt = $pdo->query("SELECT p.*, i.apartamento, u.nombre as registrador FROM pagos p JOIN inmuebles i ON p.inmueble_id = i.id LEFT JOIN usuarios u ON p.registrado_por = u.id ORDER BY p.fecha_pago DESC LIMIT 50");
    responseJSON('success', '', $stmt->fetchAll());
}
elseif ($action === 'generar_cobro') {
    if ($rol !== 'admin' && $rol !== 'secretaria') responseJSON('error', 'Sin permisos');
    $valor = floatval($_POST['valor'] ?? 0);
    $mes = intval($_POST['mes'] ?? date('m'));
    $anio = intval($_POST['anio'] ?? date('Y'));
    
    if ($valor <= 0) responseJSON('error', 'Valor inválido');

    try {
        $pdo->beginTransaction();
        
        $stmtInmuebles = $pdo->query("SELECT id FROM inmuebles");
        $inmuebles = $stmtInmuebles->fetchAll();
        
        $stmtInsert = $pdo->prepare("INSERT INTO cuotas_administracion (inmueble_id, mes, anio, valor) VALUES (?, ?, ?, ?)");
        $stmtUpdate = $pdo->prepare("UPDATE inmuebles SET mora_actual = mora_actual + ? WHERE id = ?");
        
        foreach ($inmuebles as $inmueble) {
            $stmtInsert->execute([$inmueble['id'], $mes, $anio, $valor]);
            $stmtUpdate->execute([$valor, $inmueble['id']]);
        }
        
        $pdo->commit();
        responseJSON('success', 'Cobro masivo generado a ' . count($inmuebles) . ' inmuebles.');
    } catch (Exception $e) {
        $pdo->rollBack();
        responseJSON('error', 'Error generando cobros: ' . $e->getMessage());
    }
}
elseif ($action === 'registrar_pago') {
    if ($rol !== 'admin' && $rol !== 'secretaria') responseJSON('error', 'Sin permisos');
    
    $inmueble_id = intval($_POST['inmueble_id'] ?? 0);
    $valor = floatval($_POST['valor'] ?? 0);
    $metodo = $_POST['metodo'] ?? 'transferencia';
    $referencia = $_POST['referencia'] ?? '';
    
    if ($inmueble_id <= 0 || $valor <= 0) responseJSON('error', 'Datos inválidos');

    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("INSERT INTO pagos (inmueble_id, valor, metodo_pago, referencia, registrado_por) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$inmueble_id, $valor, $metodo, $referencia, $user_id]);
        
        $stmtUpdate = $pdo->prepare("UPDATE inmuebles SET mora_actual = GREATEST(0, mora_actual - ?) WHERE id = ?");
        $stmtUpdate->execute([$valor, $inmueble_id]);
        
        $pdo->commit();
        responseJSON('success', 'Pago registrado exitosamente');
    } catch (Exception $e) {
        $pdo->rollBack();
        responseJSON('error', 'Error registrando pago: ' . $e->getMessage());
    }
}
?>
