<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['user_rol'] !== 'admin') responseJSON('error', 'Sin permisos');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$conjuntoId = (int) $_SESSION['conjunto_id'];
$userId = (int) $_SESSION['user_id'];

function parqueaderoDelConjunto(PDO $pdo, int $id, int $conjuntoId): ?array
{
    $stmt = $pdo->prepare('SELECT id, estado, clase_espacio, sotano, ubicacion FROM parqueaderos WHERE id = ? AND conjunto_id = ? FOR UPDATE');
    $stmt->execute([$id, $conjuntoId]);
    return $stmt->fetch() ?: null;
}

if ($action === 'list') {
    $stmt = $pdo->prepare("SELECT p.*, a.id AS asignacion_id, a.asignado_en, i.torre, i.nomenclatura, i.apartamento FROM parqueaderos p LEFT JOIN asignaciones_parqueadero a ON a.parqueadero_id = p.id AND a.retirado_en IS NULL LEFT JOIN inmuebles i ON i.id = a.inmueble_id WHERE p.conjunto_id = ? ORDER BY p.codigo");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'inmuebles') {
    $stmt = $pdo->prepare("SELECT id, COALESCE(NULLIF(torre, ''), 'Sin bloque') AS bloque, nomenclatura, apartamento FROM inmuebles WHERE conjunto_id = ? ORDER BY bloque, nomenclatura");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'historial') {
    $parqueaderoId = (int) ($_GET['parqueadero_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT p.codigo, p.tipo, p.clase_espacio, p.sotano, p.ubicacion, a.asignado_en, a.retirado_en, a.motivo_retiro, i.torre, i.nomenclatura, i.apartamento, ua.nombre AS asignado_por_nombre, ur.nombre AS retirado_por_nombre FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id JOIN inmuebles i ON i.id = a.inmueble_id LEFT JOIN usuarios ua ON ua.id = a.asignado_por LEFT JOIN usuarios ur ON ur.id = a.retirado_por WHERE a.parqueadero_id = ? AND p.conjunto_id = ? ORDER BY a.asignado_en DESC");
    $stmt->execute([$parqueaderoId, $conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'historial_inmueble') {
    $inmuebleId = (int) ($_GET['inmueble_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT p.codigo, p.tipo, p.clase_espacio, p.sotano, p.ubicacion, a.asignado_en, a.retirado_en, a.motivo_retiro, ua.nombre AS asignado_por_nombre, ur.nombre AS retirado_por_nombre FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id JOIN inmuebles i ON i.id = a.inmueble_id LEFT JOIN usuarios ua ON ua.id = a.asignado_por LEFT JOIN usuarios ur ON ur.id = a.retirado_por WHERE a.inmueble_id = ? AND i.conjunto_id = ? ORDER BY a.asignado_en DESC");
    $stmt->execute([$inmuebleId, $conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'guardar') {
    $id = (int) ($_POST['id'] ?? 0);
    $codigo = strtoupper(trim($_POST['codigo'] ?? ''));
    $tipo = $_POST['tipo'] ?? 'administracion';
    $clase = $_POST['clase_espacio'] ?? 'carro';
    $sotano = trim($_POST['sotano'] ?? '');
    $ubicacion = trim($_POST['ubicacion'] ?? '');
    $estado = $_POST['estado'] ?? 'disponible';
    $observaciones = trim($_POST['observaciones'] ?? '');
    if ($codigo === '' || !in_array($tipo, ['privado', 'administracion', 'visitante', 'otro'], true) || !in_array($clase, ['carro', 'moto', 'bodega'], true) || !in_array($estado, ['disponible', 'inactivo'], true)) responseJSON('error', 'Completa código, clase, tipo administrativo y estado válidos');
    if (mb_strlen($codigo) > 50 || mb_strlen($sotano) > 50 || mb_strlen($ubicacion) > 100 || mb_strlen($observaciones) > 255) responseJSON('error', 'La información excede la longitud permitida');
    if ($id) {
        $duplicado = $pdo->prepare('SELECT id FROM parqueaderos WHERE conjunto_id = ? AND codigo = ? AND id <> ?');
        $duplicado->execute([$conjuntoId, $codigo, $id]);
        if ($duplicado->fetch()) responseJSON('error', 'Ya existe un espacio con ese código');
        $stmt = $pdo->prepare("UPDATE parqueaderos SET codigo = ?, tipo = ?, clase_espacio = ?, sotano = ?, ubicacion = ?, estado = CASE WHEN estado = 'asignado' THEN 'asignado' ELSE ? END, observaciones = ? WHERE id = ? AND conjunto_id = ?");
        $stmt->execute([$codigo, $tipo, $clase, $sotano ?: null, $ubicacion ?: null, $estado, $observaciones ?: null, $id, $conjuntoId]);
        responseJSON('success', 'Espacio actualizado');
    }
    $duplicado = $pdo->prepare('SELECT id FROM parqueaderos WHERE conjunto_id = ? AND codigo = ?');
    $duplicado->execute([$conjuntoId, $codigo]);
    if ($duplicado->fetch()) responseJSON('error', 'Ya existe un espacio con ese código');
    $stmt = $pdo->prepare('INSERT INTO parqueaderos (conjunto_id, codigo, tipo, clase_espacio, sotano, ubicacion, estado, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$conjuntoId, $codigo, $tipo, $clase, $sotano ?: null, $ubicacion ?: null, $estado, $observaciones ?: null]);
    responseJSON('success', 'Espacio creado');
}
if ($action === 'asignar') {
    $parqueaderoId = (int) ($_POST['parqueadero_id'] ?? 0);
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    if ($parqueaderoId <= 0 || $inmuebleId <= 0) responseJSON('error', 'Selecciona parqueadero e inmueble');
    try {
        $pdo->beginTransaction();
        $parqueadero = parqueaderoDelConjunto($pdo, $parqueaderoId, $conjuntoId);
        if (!$parqueadero || $parqueadero['estado'] === 'inactivo') throw new Exception('Parqueadero no disponible');
        $inmueble = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $inmueble->execute([$inmuebleId, $conjuntoId]);
        if (!$inmueble->fetch()) throw new Exception('Inmueble no encontrado');
        $activa = $pdo->prepare('SELECT id FROM asignaciones_parqueadero WHERE parqueadero_id = ? AND retirado_en IS NULL FOR UPDATE');
        $activa->execute([$parqueaderoId]);
        if ($activa->fetch()) throw new Exception('Este parqueadero ya está asignado');
        $pdo->prepare('INSERT INTO asignaciones_parqueadero (parqueadero_id, inmueble_id, asignado_por) VALUES (?, ?, ?)')->execute([$parqueaderoId, $inmuebleId, $userId]);
        $pdo->prepare("UPDATE parqueaderos SET estado = 'asignado' WHERE id = ? AND conjunto_id = ?")->execute([$parqueaderoId, $conjuntoId]);
        $pdo->commit();
        responseJSON('success', 'Parqueadero asignado al inmueble');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'retirar') {
    $asignacionId = (int) ($_POST['asignacion_id'] ?? 0);
    $motivo = trim($_POST['motivo_retiro'] ?? '');
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT a.id, a.parqueadero_id FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id WHERE a.id = ? AND p.conjunto_id = ? AND a.retirado_en IS NULL FOR UPDATE');
        $stmt->execute([$asignacionId, $conjuntoId]);
        $asignacion = $stmt->fetch();
        if (!$asignacion) throw new Exception('Asignación activa no encontrada');
        $pdo->prepare('UPDATE asignaciones_parqueadero SET retirado_en = NOW(), retirado_por = ?, motivo_retiro = ? WHERE id = ?')->execute([$userId, $motivo ?: null, $asignacionId]);
        $pdo->prepare("UPDATE parqueaderos SET estado = 'disponible' WHERE id = ? AND conjunto_id = ?")->execute([$asignacion['parqueadero_id'], $conjuntoId]);
        $pdo->commit();
        responseJSON('success', 'Asignación retirada y conservada en el historial');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'cambiar_asignacion') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $parqueaderoId = (int) ($_POST['parqueadero_id'] ?? 0);
    if ($inmuebleId <= 0 || $parqueaderoId < 0) responseJSON('error', 'Datos de parqueadero inválidos');
    try {
        $pdo->beginTransaction();
        $inmueble = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $inmueble->execute([$inmuebleId, $conjuntoId]);
        if (!$inmueble->fetch()) throw new Exception('Inmueble no encontrado');
        $actualStmt = $pdo->prepare('SELECT a.id, a.parqueadero_id FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id WHERE a.inmueble_id = ? AND p.conjunto_id = ? AND a.retirado_en IS NULL FOR UPDATE');
        $actualStmt->execute([$inmuebleId, $conjuntoId]);
        $actual = $actualStmt->fetch();
        if ($actual && (int) $actual['parqueadero_id'] === $parqueaderoId) {
            $pdo->commit();
            responseJSON('success', 'El parqueadero ya está asignado a este inmueble');
        }
        if ($actual) {
            $pdo->prepare('UPDATE asignaciones_parqueadero SET retirado_en = NOW(), retirado_por = ?, motivo_retiro = ? WHERE id = ?')->execute([$userId, 'Cambio desde inmuebles', $actual['id']]);
            $pdo->prepare("UPDATE parqueaderos SET estado = 'disponible' WHERE id = ? AND conjunto_id = ?")->execute([$actual['parqueadero_id'], $conjuntoId]);
        }
        if ($parqueaderoId > 0) {
            $parqueadero = parqueaderoDelConjunto($pdo, $parqueaderoId, $conjuntoId);
            if (!$parqueadero || $parqueadero['estado'] !== 'disponible') throw new Exception('El parqueadero seleccionado ya no está disponible');
            $pdo->prepare('INSERT INTO asignaciones_parqueadero (parqueadero_id, inmueble_id, asignado_por) VALUES (?, ?, ?)')->execute([$parqueaderoId, $inmuebleId, $userId]);
            $pdo->prepare("UPDATE parqueaderos SET estado = 'asignado' WHERE id = ? AND conjunto_id = ?")->execute([$parqueaderoId, $conjuntoId]);
        }
        $pdo->commit();
        responseJSON('success', $parqueaderoId > 0 ? 'Parqueadero actualizado para el inmueble' : 'Parqueadero retirado del inmueble');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
responseJSON('error', 'Acción no válida');
