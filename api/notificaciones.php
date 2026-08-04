<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json; charset=utf-8');
if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$rol = (string) $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function agregarAlerta(array &$alertas, string $clave, string $tipo, string $titulo, string $detalle, string $fecha, string $vista, bool $requiereAcuse = false): void
{
    $alertas[] = compact('clave', 'tipo', 'titulo', 'detalle', 'fecha', 'vista', 'requiereAcuse');
}

function consignasPendientes(PDO $pdo, int $conjuntoId, int $vigilanteId): array
{
    $turno = $pdo->prepare('SELECT COALESCE(turno, "") FROM perfiles_vigilancia WHERE usuario_id = ?');
    $turno->execute([$vigilanteId]);
    $sql = 'SELECT c.id, c.titulo, c.contenido, c.creada_en FROM consignas_vigilancia c LEFT JOIN consigna_vistas cv ON cv.consigna_id = c.id AND cv.vigilante_id = ? WHERE c.conjunto_id = ? AND c.activa = 1 AND (c.vence_en IS NULL OR c.vence_en >= NOW()) AND cv.vista_en IS NULL AND (c.destino_tipo = "todos" OR (c.destino_tipo = "vigilante" AND c.vigilante_id = ?) OR (c.destino_tipo = "turno" AND c.turno = ?)) ORDER BY c.creada_en DESC LIMIT 20';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$vigilanteId, $conjuntoId, $vigilanteId, trim((string) $turno->fetchColumn())]);
    return $stmt->fetchAll();
}

function alertasUsuario(PDO $pdo, int $conjuntoId, int $userId, string $rol): array
{
    $alertas = [];
    if (in_array($rol, ['admin', 'secretaria'], true)) {
        $stmt = $pdo->prepare("SELECT r.id, r.asunto, r.estado, r.creado_en, u.nombre AS autor, n.id AS nota_id, n.creado_en AS nota_en, n.autor_id AS nota_autor FROM reclamaciones r JOIN usuarios u ON u.id = r.usuario_id LEFT JOIN reclamacion_notas n ON n.id = (SELECT n2.id FROM reclamacion_notas n2 WHERE n2.reclamacion_id = r.id ORDER BY n2.creado_en DESC, n2.id DESC LIMIT 1) WHERE r.conjunto_id = ? AND ((n.id IS NULL AND r.usuario_id <> ?) OR (n.id IS NOT NULL AND n.creado_en >= COALESCE(r.actualizado_en, r.creado_en) AND n.autor_id <> ?)) ORDER BY COALESCE(n.creado_en, r.creado_en) DESC LIMIT 20");
        $stmt->execute([$conjuntoId, $userId, $userId]);
        foreach ($stmt->fetchAll() as $r) {
            $fecha = $r['nota_en'] ?: $r['creado_en'];
            $evento = $r['nota_id'] ? "nota-{$r['nota_id']}" : "radicada-{$r['id']}";
            agregarAlerta($alertas, "pqrs:{$r['id']}:{$evento}", 'pqrs', 'Nueva actividad en PQRS', "{$r['asunto']} · {$r['autor']} · {$r['estado']}", $fecha, 'reclamaciones');
        }
        $stmt = $pdo->prepare("SELECT p.id, p.valor, p.fecha_pago, i.torre, COALESCE(i.nomenclatura, i.apartamento) AS unidad FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE i.conjunto_id = ? AND p.estado = 'pendiente' ORDER BY p.fecha_pago DESC LIMIT 20");
        $stmt->execute([$conjuntoId]);
        foreach ($stmt->fetchAll() as $p) agregarAlerta($alertas, "pago:{$p['id']}:pendiente", 'pago', 'Pago pendiente de aprobación', "{$p['unidad']} · $" . number_format((float) $p['valor'], 0, ',', '.'), $p['fecha_pago'], 'finanzas');
        $stmt = $pdo->prepare("SELECT m.id, m.asunto, COALESCE(m.fecha_novedad, m.fecha_registro) AS fecha, u.nombre AS vigilante FROM minuta_porteria m JOIN usuarios u ON u.id = m.vigilante_id WHERE u.conjunto_id = ? AND u.rol = 'vigilante' ORDER BY fecha DESC LIMIT 20");
        $stmt->execute([$conjuntoId]);
        foreach ($stmt->fetchAll() as $m) agregarAlerta($alertas, "minuta:{$m['id']}", 'minuta', 'Nueva novedad de vigilancia', "{$m['asunto']} · {$m['vigilante']}", $m['fecha'], 'porteria');
    }
    if (in_array($rol, ['admin', 'secretaria', 'vigilante'], true)) {
        $stmt = $pdo->prepare("SELECT r.id, r.fecha_reserva, r.hora_inicio, r.estado, z.nombre AS zona FROM reservas r JOIN zonas_sociales z ON z.id = r.zona_id WHERE z.conjunto_id = ? AND r.fecha_reserva >= CURDATE() AND r.estado IN ('pendiente', 'aprobada') ORDER BY r.fecha_reserva, r.hora_inicio LIMIT 20");
        $stmt->execute([$conjuntoId]);
        foreach ($stmt->fetchAll() as $r) agregarAlerta($alertas, "reserva:{$r['id']}:{$r['estado']}", 'reserva', 'Reserva de zona programada', "{$r['zona']} · {$r['fecha_reserva']} {$r['hora_inicio']}", $r['fecha_reserva'] . ' ' . $r['hora_inicio'], 'zonas');
    }
    if ($rol === 'vigilante') {
        foreach (consignasPendientes($pdo, $conjuntoId, $userId) as $c) agregarAlerta($alertas, "consigna:{$c['id']}", 'consigna', 'Nueva consigna de administración', $c['titulo'], $c['creada_en'], 'consignas', true);
        $stmt = $pdo->prepare("SELECT p.id, p.transportadora, p.fecha_recepcion, COALESCE(i.nomenclatura, i.apartamento) AS unidad FROM paquetes p JOIN inmuebles i ON i.id = p.inmueble_id WHERE i.conjunto_id = ? AND p.estado = 'pendiente' ORDER BY p.fecha_recepcion DESC LIMIT 20");
        $stmt->execute([$conjuntoId]);
        foreach ($stmt->fetchAll() as $p) agregarAlerta($alertas, "paquete:{$p['id']}", 'paquete', 'Paquete pendiente de entrega', "{$p['transportadora']} · {$p['unidad']}", $p['fecha_recepcion'], 'porteria');
    }
    if (in_array($rol, ['residente', 'propietario'], true)) {
        $stmt = $pdo->prepare("SELECT DISTINCT p.id, p.estado, p.fecha_pago, p.valor FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id JOIN relacion_inmuebles_usuarios ri ON ri.inmueble_id = i.id WHERE i.conjunto_id = ? AND ri.usuario_id = ? ORDER BY p.fecha_pago DESC LIMIT 20");
        $stmt->execute([$conjuntoId, $userId]);
        foreach ($stmt->fetchAll() as $p) agregarAlerta($alertas, "mi-pago:{$p['id']}:{$p['estado']}", 'pago', 'Actualización de pago', 'Tu pago por $' . number_format((float) $p['valor'], 0, ',', '.') . " está {$p['estado']}", $p['fecha_pago'], 'mis-pagos');
        $stmt = $pdo->prepare("SELECT r.id, r.asunto, r.estado, r.creado_en, r.actualizado_en, n.id AS nota_id, n.creado_en AS nota_en, n.autor_id AS nota_autor, CASE WHEN n.id IS NOT NULL AND n.creado_en >= COALESCE(r.actualizado_en, r.creado_en) THEN n.creado_en ELSE r.actualizado_en END AS fecha FROM reclamaciones r LEFT JOIN reclamacion_notas n ON n.id = (SELECT n2.id FROM reclamacion_notas n2 WHERE n2.reclamacion_id = r.id ORDER BY n2.creado_en DESC, n2.id DESC LIMIT 1) WHERE r.conjunto_id = ? AND r.usuario_id = ? AND ((n.id IS NOT NULL AND n.creado_en >= COALESCE(r.actualizado_en, r.creado_en) AND n.autor_id <> ?) OR (r.actualizado_en > r.creado_en AND (n.id IS NULL OR n.creado_en < r.actualizado_en))) ORDER BY fecha DESC LIMIT 20");
        $stmt->execute([$conjuntoId, $userId, $userId]);
        foreach ($stmt->fetchAll() as $r) {
            $evento = $r['nota_id'] && $r['nota_en'] >= $r['actualizado_en'] ? "nota-{$r['nota_id']}" : "estado-{$r['estado']}-{$r['actualizado_en']}";
            agregarAlerta($alertas, "mi-pqrs:{$r['id']}:{$evento}", 'pqrs', 'Actualización de tu PQRS', "{$r['asunto']} · Estado: {$r['estado']}", $r['fecha'], 'reclamaciones');
        }
        $stmt = $pdo->prepare("SELECT DISTINCT r.id, r.fecha_reserva, r.hora_inicio, r.estado, z.nombre AS zona FROM reservas r JOIN zonas_sociales z ON z.id = r.zona_id LEFT JOIN relacion_inmuebles_usuarios ri ON ri.inmueble_id = r.inmueble_id WHERE z.conjunto_id = ? AND r.fecha_reserva >= CURDATE() AND r.estado IN ('pendiente', 'aprobada') AND (r.usuario_id = ? OR ri.usuario_id = ?) ORDER BY r.fecha_reserva, r.hora_inicio LIMIT 20");
        $stmt->execute([$conjuntoId, $userId, $userId]);
        foreach ($stmt->fetchAll() as $r) agregarAlerta($alertas, "mi-reserva:{$r['id']}:{$r['estado']}", 'reserva', 'Reserva programada', "{$r['zona']} · {$r['fecha_reserva']} {$r['hora_inicio']}", $r['fecha_reserva'] . ' ' . $r['hora_inicio'], 'zonas');
        $stmt = $pdo->prepare("SELECT DISTINCT p.id, p.transportadora, p.fecha_recepcion, COALESCE(i.nomenclatura, i.apartamento) AS unidad FROM paquetes p JOIN inmuebles i ON i.id = p.inmueble_id JOIN relacion_inmuebles_usuarios ri ON ri.inmueble_id = i.id WHERE i.conjunto_id = ? AND ri.usuario_id = ? AND p.estado = 'pendiente' ORDER BY p.fecha_recepcion DESC LIMIT 20");
        $stmt->execute([$conjuntoId, $userId]);
        foreach ($stmt->fetchAll() as $p) agregarAlerta($alertas, "mi-paquete:{$p['id']}", 'paquete', 'Tienes un paquete en portería', "{$p['transportadora']} · {$p['unidad']}", $p['fecha_recepcion'], 'home-residente');
    }
    usort($alertas, static fn(array $a, array $b): int => strcmp($b['fecha'], $a['fecha']));
    return array_slice($alertas, 0, 80);
}

function aplicarLecturas(PDO $pdo, int $userId, array $alertas): array
{
    $claves = array_column($alertas, 'clave');
    $leidas = [];
    if ($claves) {
        $marcas = implode(',', array_fill(0, count($claves), '?'));
        $stmt = $pdo->prepare("SELECT clave FROM notificacion_lecturas WHERE usuario_id = ? AND clave IN ($marcas)");
        $stmt->execute(array_merge([$userId], $claves));
        $leidas = array_flip(array_column($stmt->fetchAll(), 'clave'));
    }
    foreach ($alertas as &$alerta) $alerta['leida'] = !$alerta['requiereAcuse'] && isset($leidas[$alerta['clave']]);
    return $alertas;
}

function marcarConsignaVista(PDO $pdo, int $conjuntoId, int $vigilanteId, string $clave): bool
{
    if (!preg_match('/^consigna:(\\d+)$/', $clave, $coincidencias)) return false;
    $turno = $pdo->prepare('SELECT COALESCE(turno, "") FROM perfiles_vigilancia WHERE usuario_id = ?');
    $turno->execute([$vigilanteId]);
    $stmt = $pdo->prepare('SELECT id FROM consignas_vigilancia WHERE id = ? AND conjunto_id = ? AND activa = 1 AND (vence_en IS NULL OR vence_en >= NOW()) AND (destino_tipo = "todos" OR (destino_tipo = "vigilante" AND vigilante_id = ?) OR (destino_tipo = "turno" AND turno = ?))');
    $stmt->execute([(int) $coincidencias[1], $conjuntoId, $vigilanteId, trim((string) $turno->fetchColumn())]);
    if (!$stmt->fetch()) return false;
    $pdo->prepare('INSERT IGNORE INTO consigna_vistas (consigna_id, vigilante_id) VALUES (?, ?)')->execute([(int) $coincidencias[1], $vigilanteId]);
    return true;
}

$alertas = aplicarLecturas($pdo, $userId, alertasUsuario($pdo, $conjuntoId, $userId, $rol));
if ($action === 'list' || $action === 'contador') {
    $pendientes = count(array_filter($alertas, static fn(array $alerta): bool => !$alerta['leida']));
    responseJSON('success', '', $action === 'contador' ? ['pendientes' => $pendientes] : ['items' => $alertas, 'pendientes' => $pendientes]);
}
if ($action === 'marcar_leida') {
    $clave = trim($_POST['clave'] ?? '');
    if ($clave === '') responseJSON('error', 'La alerta no es válida');
    if (str_starts_with($clave, 'consigna:')) {
        if ($rol !== 'vigilante' || !marcarConsignaVista($pdo, $conjuntoId, $userId, $clave)) responseJSON('error', 'No puedes confirmar esta consigna');
        responseJSON('success', 'Consigna marcada como vista');
    }
    $validas = array_column(array_filter($alertas, static fn(array $alerta): bool => !$alerta['requiereAcuse']), 'clave');
    if (!in_array($clave, $validas, true)) responseJSON('error', 'La alerta ya no está disponible');
    $stmt = $pdo->prepare('INSERT INTO notificacion_lecturas (usuario_id, clave) VALUES (?, ?) ON DUPLICATE KEY UPDATE leida_en = VALUES(leida_en)');
    $stmt->execute([$userId, $clave]);
    responseJSON('success', 'Notificación marcada como leída');
}
if ($action === 'marcar_todas') {
    $stmt = $pdo->prepare('INSERT INTO notificacion_lecturas (usuario_id, clave) VALUES (?, ?) ON DUPLICATE KEY UPDATE leida_en = VALUES(leida_en)');
    foreach ($alertas as $alerta) if (!$alerta['leida'] && !$alerta['requiereAcuse']) $stmt->execute([$userId, $alerta['clave']]);
    responseJSON('success', 'Notificaciones marcadas como leídas');
}
responseJSON('error', 'Acción no válida');
