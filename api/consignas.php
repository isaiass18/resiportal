<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json; charset=utf-8');
if (!isset($_SESSION['user_id']) || !in_array($_SESSION['user_rol'], ['admin', 'vigilante'], true)) responseJSON('error', 'Sin permisos');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$rol = (string) $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function turnoVigilante(PDO $pdo, int $userId): string
{
    $stmt = $pdo->prepare('SELECT COALESCE(turno, "") FROM perfiles_vigilancia WHERE usuario_id = ?');
    $stmt->execute([$userId]);
    return trim((string) $stmt->fetchColumn());
}

function consultaConsignasVigilante(PDO $pdo, int $conjuntoId, int $vigilanteId, bool $soloPendientes = false): array
{
    $turno = turnoVigilante($pdo, $vigilanteId);
    $sql = 'SELECT c.*, u.nombre AS creador, cv.vista_en FROM consignas_vigilancia c JOIN usuarios u ON u.id = c.creado_por LEFT JOIN consigna_vistas cv ON cv.consigna_id = c.id AND cv.vigilante_id = ? WHERE c.conjunto_id = ? AND c.activa = 1 AND (c.vence_en IS NULL OR c.vence_en >= NOW()) AND (c.destino_tipo = "todos" OR (c.destino_tipo = "vigilante" AND c.vigilante_id = ?) OR (c.destino_tipo = "turno" AND c.turno = ?))';
    if ($soloPendientes) $sql .= ' AND cv.vista_en IS NULL';
    $sql .= ' ORDER BY c.creada_en DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$vigilanteId, $conjuntoId, $vigilanteId, $turno]);
    return $stmt->fetchAll();
}

function validarDestino(PDO $pdo, int $conjuntoId, string $tipo, int $vigilanteId, string $turno): array
{
    if ($tipo === 'todos') return [null, null];
    if ($tipo === 'vigilante') {
        $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE id = ? AND conjunto_id = ? AND rol = 'vigilante' AND activo = 1");
        $stmt->execute([$vigilanteId, $conjuntoId]);
        if (!$stmt->fetch()) responseJSON('error', 'El vigilante seleccionado no está disponible');
        return [$vigilanteId, null];
    }
    if ($tipo === 'turno') {
        $stmt = $pdo->prepare("SELECT 1 FROM perfiles_vigilancia p JOIN usuarios u ON u.id = p.usuario_id WHERE u.conjunto_id = ? AND u.rol = 'vigilante' AND u.activo = 1 AND p.turno = ? LIMIT 1");
        $stmt->execute([$conjuntoId, $turno]);
        if ($turno === '' || !$stmt->fetch()) responseJSON('error', 'Selecciona un turno vigente');
        return [null, $turno];
    }
    responseJSON('error', 'Destino de la consigna inválido');
}

if ($action === 'destinatarios') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede consultar destinatarios');
    $usuarios = $pdo->prepare("SELECT u.id, u.nombre, COALESCE(p.turno, '') AS turno FROM usuarios u LEFT JOIN perfiles_vigilancia p ON p.usuario_id = u.id WHERE u.conjunto_id = ? AND u.rol = 'vigilante' AND u.activo = 1 ORDER BY u.nombre");
    $usuarios->execute([$conjuntoId]);
    $turnos = $pdo->prepare("SELECT DISTINCT p.turno FROM perfiles_vigilancia p JOIN usuarios u ON u.id = p.usuario_id WHERE u.conjunto_id = ? AND u.rol = 'vigilante' AND u.activo = 1 AND p.turno IS NOT NULL AND TRIM(p.turno) <> '' ORDER BY p.turno");
    $turnos->execute([$conjuntoId]);
    responseJSON('success', '', ['vigilantes' => $usuarios->fetchAll(), 'turnos' => array_column($turnos->fetchAll(), 'turno')]);
}

if ($action === 'crear') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede crear consignas');
    $titulo = trim($_POST['titulo'] ?? '');
    $contenido = trim($_POST['contenido'] ?? '');
    $destino = $_POST['destino_tipo'] ?? '';
    $vigilanteId = (int) ($_POST['vigilante_id'] ?? 0);
    $turno = trim($_POST['turno'] ?? '');
    $venceEn = trim($_POST['vence_en'] ?? '');
    if ($titulo === '' || $contenido === '') responseJSON('error', 'Título y contenido son obligatorios');
    if (mb_strlen($titulo) > 150 || mb_strlen($contenido) > 5000) responseJSON('error', 'El texto excede el tamaño permitido');
    [$destinoVigilante, $destinoTurno] = validarDestino($pdo, $conjuntoId, $destino, $vigilanteId, $turno);
    $vence = null;
    if ($venceEn !== '') {
        $fecha = DateTime::createFromFormat('Y-m-d\\TH:i', $venceEn);
        if (!$fecha || $fecha->format('Y-m-d\\TH:i') !== $venceEn || $fecha <= new DateTime()) responseJSON('error', 'La fecha de vencimiento debe ser futura y válida');
        $vence = $fecha->format('Y-m-d H:i:s');
    }
    $stmt = $pdo->prepare('INSERT INTO consignas_vigilancia (conjunto_id, destino_tipo, vigilante_id, turno, titulo, contenido, creado_por, vence_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$conjuntoId, $destino, $destinoVigilante, $destinoTurno, $titulo, $contenido, $userId, $vence]);
    responseJSON('success', 'Consigna enviada a vigilancia');
}

if ($action === 'list') {
    if ($rol === 'vigilante') responseJSON('success', '', consultaConsignasVigilante($pdo, $conjuntoId, $userId));
    $stmt = $pdo->prepare('SELECT c.*, u.nombre AS creador, d.nombre AS vigilante_nombre FROM consignas_vigilancia c JOIN usuarios u ON u.id = c.creado_por LEFT JOIN usuarios d ON d.id = c.vigilante_id WHERE c.conjunto_id = ? ORDER BY c.activa DESC, c.creada_en DESC LIMIT 100');
    $stmt->execute([$conjuntoId]);
    $consignas = $stmt->fetchAll();
    $cuentaVistas = $pdo->prepare('SELECT COUNT(*) FROM consigna_vistas WHERE consigna_id = ?');
    $cuentaDestino = $pdo->prepare("SELECT COUNT(*) FROM usuarios u LEFT JOIN perfiles_vigilancia p ON p.usuario_id = u.id WHERE u.conjunto_id = ? AND u.rol = 'vigilante' AND u.activo = 1 AND (? = 'todos' OR (? = 'vigilante' AND u.id = ?) OR (? = 'turno' AND p.turno = ?))");
    foreach ($consignas as &$consigna) {
        $cuentaVistas->execute([(int) $consigna['id']]);
        $consigna['vistas'] = (int) $cuentaVistas->fetchColumn();
        $cuentaDestino->execute([$conjuntoId, $consigna['destino_tipo'], $consigna['destino_tipo'], $consigna['vigilante_id'], $consigna['destino_tipo'], $consigna['turno']]);
        $consigna['destinatarios'] = (int) $cuentaDestino->fetchColumn();
    }
    responseJSON('success', '', $consignas);
}

if ($action === 'marcar_vista') {
    if ($rol !== 'vigilante') responseJSON('error', 'Solo un vigilante puede confirmar lectura');
    $consignaId = (int) ($_POST['consigna_id'] ?? 0);
    $turno = turnoVigilante($pdo, $userId);
    $stmt = $pdo->prepare('SELECT id FROM consignas_vigilancia WHERE id = ? AND conjunto_id = ? AND activa = 1 AND (vence_en IS NULL OR vence_en >= NOW()) AND (destino_tipo = "todos" OR (destino_tipo = "vigilante" AND vigilante_id = ?) OR (destino_tipo = "turno" AND turno = ?))');
    $stmt->execute([$consignaId, $conjuntoId, $userId, $turno]);
    if (!$stmt->fetch()) responseJSON('error', 'La consigna no está disponible para tu cuenta');
    $pdo->prepare('INSERT IGNORE INTO consigna_vistas (consigna_id, vigilante_id) VALUES (?, ?)')->execute([$consignaId, $userId]);
    responseJSON('success', 'Consigna marcada como vista');
}

if ($action === 'cerrar') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede cerrar consignas');
    $consignaId = (int) ($_POST['consigna_id'] ?? 0);
    $stmt = $pdo->prepare('UPDATE consignas_vigilancia SET activa = 0, cerrada_en = NOW() WHERE id = ? AND conjunto_id = ? AND activa = 1');
    $stmt->execute([$consignaId, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'La consigna no existe o ya está cerrada');
    responseJSON('success', 'Consigna cerrada');
}

responseJSON('error', 'Acción no válida');
