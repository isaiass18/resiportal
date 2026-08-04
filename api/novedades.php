<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'], $_SESSION['conjunto_id'])) responseJSON('error', 'No autorizado');
$userId = (int) $_SESSION['user_id'];
$conjuntoId = (int) $_SESSION['conjunto_id'];
$rol = $_SESSION['user_rol'] ?? '';
if (!in_array($rol, ['admin', 'vigilante'], true)) responseJSON('error', 'Sin permisos');
$usuario = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? AND conjunto_id = ? AND activo = 1');
$usuario->execute([$userId, $conjuntoId]);
if (!$usuario->fetch()) responseJSON('error', 'La cuenta ya no está activa');
$action = $_POST['action'] ?? $_GET['action'] ?? '';

function adjuntosNovedad(PDO $pdo, int $minutaId): array
{
    $stmt = $pdo->prepare('SELECT id, nombre_original, mime, tamano, creado_en FROM minuta_adjuntos WHERE minuta_id = ? ORDER BY id');
    $stmt->execute([$minutaId]);
    return $stmt->fetchAll();
}

function obtenerNovedad(PDO $pdo, int $novedadId, int $conjuntoId, string $rol, int $userId, bool $bloquear = false): ?array
{
    $sql = 'SELECT m.*, u.nombre AS vigilante, u.contacto AS vigilante_contacto, pv.nombre AS primera_vista_por_nombre, rp.nombre AS resuelto_por_nombre, cp.nombre AS cerrado_por_nombre FROM minuta_porteria m JOIN usuarios u ON u.id = m.vigilante_id LEFT JOIN usuarios pv ON pv.id = m.primera_vista_por LEFT JOIN usuarios rp ON rp.id = m.resuelto_por LEFT JOIN usuarios cp ON cp.id = m.cerrado_por WHERE m.id = ? AND m.conjunto_id = ?';
    $params = [$novedadId, $conjuntoId];
    if ($rol === 'vigilante') {
        $sql .= ' AND m.vigilante_id = ?';
        $params[] = $userId;
    }
    if ($bloquear) $sql .= ' FOR UPDATE';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch() ?: null;
}

function registrarVista(PDO $pdo, int $novedadId, int $conjuntoId, int $userId): void
{
    $pdo->beginTransaction();
    try {
        $novedad = obtenerNovedad($pdo, $novedadId, $conjuntoId, 'admin', $userId, true);
        if (!$novedad) throw new RuntimeException('Novedad no encontrada');
        $lectura = $pdo->prepare('SELECT minuta_id FROM minuta_lecturas WHERE minuta_id = ? AND usuario_id = ? FOR UPDATE');
        $lectura->execute([$novedadId, $userId]);
        if (!$lectura->fetch()) {
            $pdo->prepare('INSERT INTO minuta_lecturas (minuta_id, usuario_id) VALUES (?, ?)')->execute([$novedadId, $userId]);
            $pdo->prepare("INSERT INTO minuta_seguimientos (minuta_id, autor_id, tipo, contenido) VALUES (?, ?, 'vista', ?)")->execute([$novedadId, $userId, 'Novedad revisada por Administración']);
        }
        $pdo->prepare('UPDATE minuta_porteria SET primera_vista_por = COALESCE(primera_vista_por, ?), primera_vista_en = COALESCE(primera_vista_en, NOW()) WHERE id = ?')->execute([$userId, $novedadId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function auditarNovedad(PDO $pdo, int $userId, string $accion, int $novedadId): void
{
    $pdo->prepare('INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, ?, ?, ?)')->execute([$userId, $accion, 'minuta_porteria', 'Novedad ID: ' . $novedadId]);
}

if ($action === 'list') {
    if ($rol === 'vigilante') {
        $stmt = $pdo->prepare("SELECT m.id, m.asunto, m.novedad, m.estado, m.fecha_novedad, m.fecha_registro, COALESCE(m.fecha_novedad, m.fecha_registro) AS fecha_operativa FROM minuta_porteria m WHERE m.conjunto_id = ? AND m.vigilante_id = ? ORDER BY COALESCE(m.fecha_novedad, m.fecha_registro) DESC LIMIT 100");
        $stmt->execute([$conjuntoId, $userId]);
        responseJSON('success', '', $stmt->fetchAll());
    }
    $estado = $_GET['estado'] ?? '';
    $soloNoVistas = ($_GET['solo_no_vistas'] ?? '') === '1';
    $buscar = trim($_GET['buscar'] ?? '');
    if ($estado !== '' && !in_array($estado, ['pendiente', 'en_progreso', 'resuelta', 'cerrada'], true)) responseJSON('error', 'Estado inválido');
    $sql = "SELECT m.id, m.asunto, m.novedad, m.estado, m.fecha_novedad, m.fecha_registro, m.primera_vista_en, m.resuelto_en, m.cerrado_en, u.nombre AS vigilante, l.vista_en AS mi_vista_en, (SELECT MAX(s.creado_en) FROM minuta_seguimientos s WHERE s.minuta_id = m.id) AS ultimo_seguimiento FROM minuta_porteria m JOIN usuarios u ON u.id = m.vigilante_id LEFT JOIN minuta_lecturas l ON l.minuta_id = m.id AND l.usuario_id = ? WHERE m.conjunto_id = ?";
    $params = [$userId, $conjuntoId];
    if ($estado !== '') {
        $sql .= ' AND m.estado = ?';
        $params[] = $estado;
    }
    if ($soloNoVistas) $sql .= ' AND l.vista_en IS NULL';
    if ($buscar !== '') {
        $sql .= ' AND (m.asunto LIKE ? OR m.novedad LIKE ? OR u.nombre LIKE ?)';
        $termino = '%' . $buscar . '%';
        array_push($params, $termino, $termino, $termino);
    }
    $sql .= ' ORDER BY FIELD(m.estado, "pendiente", "en_progreso", "resuelta", "cerrada"), COALESCE(m.fecha_novedad, m.fecha_registro) DESC LIMIT 200';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'marcar_vista') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede marcar novedades como vistas');
    $novedadId = (int) ($_POST['novedad_id'] ?? 0);
    if (!$novedadId) responseJSON('error', 'Novedad inválida');
    try {
        registrarVista($pdo, $novedadId, $conjuntoId, $userId);
        auditarNovedad($pdo, $userId, 'marcar_vista', $novedadId);
        responseJSON('success', 'Novedad marcada como vista');
    } catch (Throwable $e) {
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'detalle') {
    $novedadId = (int) ($_GET['novedad_id'] ?? 0);
    if (!$novedadId) responseJSON('error', 'Novedad inválida');
    try {
        if ($rol === 'admin') registrarVista($pdo, $novedadId, $conjuntoId, $userId);
        $novedad = obtenerNovedad($pdo, $novedadId, $conjuntoId, $rol, $userId);
        if (!$novedad) responseJSON('error', 'Novedad no encontrada o sin permisos');
        $seguimientos = $pdo->prepare('SELECT s.*, u.nombre AS autor, u.rol AS autor_rol FROM minuta_seguimientos s LEFT JOIN usuarios u ON u.id = s.autor_id WHERE s.minuta_id = ? ORDER BY s.creado_en, s.id');
        $seguimientos->execute([$novedadId]);
        responseJSON('success', '', ['novedad' => $novedad, 'adjuntos' => adjuntosNovedad($pdo, $novedadId), 'seguimientos' => $seguimientos->fetchAll()]);
    } catch (Throwable $e) {
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'agregar_seguimiento') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede responder novedades');
    $novedadId = (int) ($_POST['novedad_id'] ?? 0);
    $contenido = trim($_POST['contenido'] ?? '');
    if (!$novedadId || $contenido === '') responseJSON('error', 'Escribe una respuesta para continuar');
    if (mb_strlen($contenido) > 10000) responseJSON('error', 'La respuesta supera el tamaño permitido');
    try {
        $pdo->beginTransaction();
        if (!obtenerNovedad($pdo, $novedadId, $conjuntoId, 'admin', $userId, true)) throw new RuntimeException('Novedad no encontrada');
        $pdo->prepare("INSERT INTO minuta_seguimientos (minuta_id, autor_id, tipo, contenido) VALUES (?, ?, 'respuesta', ?)")->execute([$novedadId, $userId, $contenido]);
        auditarNovedad($pdo, $userId, 'responder_novedad', $novedadId);
        $pdo->commit();
        responseJSON('success', 'Respuesta de seguimiento agregada');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'actualizar_estado') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede cambiar el estado');
    $novedadId = (int) ($_POST['novedad_id'] ?? 0);
    $estado = $_POST['estado'] ?? '';
    $comentario = trim($_POST['comentario'] ?? '');
    if (!$novedadId || !in_array($estado, ['pendiente', 'en_progreso', 'resuelta', 'cerrada'], true)) responseJSON('error', 'Estado inválido');
    if (mb_strlen($comentario) > 10000) responseJSON('error', 'El comentario supera el tamaño permitido');
    if (in_array($estado, ['resuelta', 'cerrada'], true) && $comentario === '') responseJSON('error', 'Describe la solución antes de resolver o cerrar la novedad');
    try {
        $pdo->beginTransaction();
        $novedad = obtenerNovedad($pdo, $novedadId, $conjuntoId, 'admin', $userId, true);
        if (!$novedad) throw new RuntimeException('Novedad no encontrada');
        $anterior = $novedad['estado'];
        $tipo = $estado === 'cerrada' ? 'cierre' : ($estado === 'resuelta' ? 'resolucion' : (($anterior === 'resuelta' || $anterior === 'cerrada') && $estado === 'pendiente' ? 'reapertura' : 'cambio_estado'));
        $actualizar = $pdo->prepare("UPDATE minuta_porteria SET estado = ?, resuelto_por = CASE WHEN ? = 'resuelta' THEN ? WHEN ? IN ('pendiente', 'en_progreso') THEN NULL ELSE resuelto_por END, resuelto_en = CASE WHEN ? = 'resuelta' THEN NOW() WHEN ? IN ('pendiente', 'en_progreso') THEN NULL ELSE resuelto_en END, cerrado_por = CASE WHEN ? = 'cerrada' THEN ? ELSE NULL END, cerrado_en = CASE WHEN ? = 'cerrada' THEN NOW() ELSE NULL END WHERE id = ?");
        $actualizar->execute([$estado, $estado, $userId, $estado, $estado, $estado, $estado, $userId, $estado, $novedadId]);
        $texto = $comentario ?: ('Estado actualizado a ' . str_replace('_', ' ', $estado));
        $pdo->prepare('INSERT INTO minuta_seguimientos (minuta_id, autor_id, tipo, contenido, estado_anterior, estado_nuevo) VALUES (?, ?, ?, ?, ?, ?)')->execute([$novedadId, $userId, $tipo, $texto, $anterior, $estado]);
        auditarNovedad($pdo, $userId, 'actualizar_estado_novedad', $novedadId);
        $pdo->commit();
        responseJSON('success', 'Estado y seguimiento actualizados');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

responseJSON('error', 'Acción no válida');
