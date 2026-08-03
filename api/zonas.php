<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$publicConjuntoId = 1;

function videoYoutubeId(?string $url): ?string
{
    if (!$url) return null;
    $parts = parse_url($url);
    $host = strtolower($parts['host'] ?? '');
    if (!in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'], true)) return null;
    if ($host === 'youtu.be' || $host === 'www.youtu.be') {
        $id = trim($parts['path'] ?? '', '/');
    } elseif (!empty($parts['query'])) {
        parse_str($parts['query'], $query);
        $id = $query['v'] ?? '';
    } else {
        $id = trim(str_replace('/embed/', '', $parts['path'] ?? ''), '/');
    }
    return preg_match('/^[A-Za-z0-9_-]{11}$/', $id) ? $id : null;
}

function cargarImagenZona(array $file): string
{
    if ($file['error'] !== UPLOAD_ERR_OK) responseJSON('error', 'No se pudo cargar la imagen');
    if ($file['size'] > 5 * 1024 * 1024) responseJSON('error', 'La imagen no puede superar 5 MB');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    if (!isset($mimes[$ext]) || (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) !== $mimes[$ext]) responseJSON('error', 'La imagen debe ser JPG, PNG o WEBP válida');
    $dir = __DIR__ . '/../uploads/zonas';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) responseJSON('error', 'No se pudo preparar el almacenamiento');
    $name = 'zona_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) responseJSON('error', 'No se pudo guardar la imagen');
    return 'uploads/zonas/' . $name;
}

function fechaValida(string $fecha): bool
{
    $date = DateTime::createFromFormat('!Y-m-d', $fecha);
    return $date && $date->format('Y-m-d') === $fecha;
}

function horaValida(string $hora): bool
{
    return (bool) preg_match('/^([01]\\d|2[0-3]):[0-5]\\d$/', $hora);
}

function idsZonaLogica(PDO $pdo, int $conjuntoId, string $nombre, bool $bloquear = false): array
{
    $stmt = $pdo->prepare('SELECT id FROM zonas_sociales WHERE conjunto_id = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))' . ($bloquear ? ' FOR UPDATE' : ''));
    $stmt->execute([$conjuntoId, $nombre]);
    return array_map(static fn(array $row): int => (int) $row['id'], $stmt->fetchAll());
}

function disponibilidadZona(PDO $pdo, int $zonaId, int $conjuntoId): array
{
    $zona = $pdo->prepare('SELECT nombre FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $zona->execute([$zonaId, $conjuntoId]);
    $nombre = $zona->fetchColumn();
    if ($nombre === false) return [];
    $ids = idsZonaLogica($pdo, $conjuntoId, $nombre);
    if (!$ids) return [];
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT fecha_reserva, hora_inicio, hora_fin, estado FROM reservas WHERE zona_id IN ($marcas) AND estado IN ('pendiente', 'aprobada') ORDER BY fecha_reserva, hora_inicio");
    $stmt->execute($ids);
    return $stmt->fetchAll();
}

function inmuebleEtiqueta(array $inmueble): string
{
    $tipo = ucfirst((string) ($inmueble['tipo_unidad'] ?? 'inmueble'));
    $torre = trim((string) ($inmueble['torre'] ?? ''));
    $nomenclatura = trim((string) ($inmueble['nomenclatura'] ?? ''));
    return trim("$tipo $torre $nomenclatura");
}

function crearReservaHoraria(PDO $pdo, int $conjuntoId, int $actorId, string $rol, bool $interna): void
{
    $zonaId = (int) ($_POST['zona_id'] ?? 0);
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $fecha = trim($_POST['fecha_reserva'] ?? '');
    $horaInicio = trim($_POST['hora_inicio'] ?? '');
    $horaFin = trim($_POST['hora_fin'] ?? '');
    $hoy = date('Y-m-d');

    if (!$zonaId || !$inmuebleId || !fechaValida($fecha) || !horaValida($horaInicio) || !horaValida($horaFin) || $horaFin <= $horaInicio) {
        responseJSON('error', 'Selecciona zona, inmueble, fecha y una franja horaria válida');
    }
    if (($interna && $fecha < $hoy) || (!$interna && $fecha <= $hoy)) {
        responseJSON('error', $interna ? 'Selecciona una fecha actual o futura' : 'Selecciona una fecha futura');
    }

    try {
        $pdo->beginTransaction();
        $zonaStmt = $pdo->prepare('SELECT id, nombre, max_horas_reserva, max_reservas_diarias_inmueble FROM zonas_sociales WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $zonaStmt->execute([$zonaId, $conjuntoId]);
        $zona = $zonaStmt->fetch();
        if (!$zona) throw new Exception('Zona no disponible');

        $inmuebleSql = 'SELECT i.id, i.tipo_unidad, i.torre, i.nomenclatura FROM inmuebles i WHERE i.id = ? AND i.conjunto_id = ?';
        $params = [$inmuebleId, $conjuntoId];
        if (!$interna) {
            $inmuebleSql .= ' AND EXISTS (SELECT 1 FROM relacion_inmuebles_usuarios r WHERE r.inmueble_id = i.id AND r.usuario_id = ?)';
            $params[] = $actorId;
        }
        $inmuebleSql .= ' FOR UPDATE';
        $inmuebleStmt = $pdo->prepare($inmuebleSql);
        $inmuebleStmt->execute($params);
        if (!$inmuebleStmt->fetch()) throw new Exception($interna ? 'El apartamento o casa no pertenece a este conjunto' : 'Solo puedes reservar con un apartamento o casa asociado a tu cuenta');

        $duracionHoras = (strtotime("1970-01-01 $horaFin") - strtotime("1970-01-01 $horaInicio")) / 3600;
        if ($duracionHoras > (int) $zona['max_horas_reserva']) {
            throw new Exception("La zona permite máximo {$zona['max_horas_reserva']} hora(s) por reserva");
        }

        $idsZona = idsZonaLogica($pdo, $conjuntoId, $zona['nombre'], true);
        $marcas = implode(',', array_fill(0, count($idsZona), '?'));
        $historica = $pdo->prepare("SELECT id FROM reservas WHERE zona_id IN ($marcas) AND fecha_reserva = ? AND estado IN ('pendiente', 'aprobada') AND (hora_inicio IS NULL OR hora_fin IS NULL) FOR UPDATE");
        $historica->execute([...$idsZona, $fecha]);
        if ($historica->fetch()) throw new Exception('La zona tiene una reserva histórica que bloquea todo ese día');

        $solapada = $pdo->prepare("SELECT id FROM reservas WHERE zona_id IN ($marcas) AND fecha_reserva = ? AND estado IN ('pendiente', 'aprobada') AND hora_inicio < ? AND hora_fin > ? FOR UPDATE");
        $solapada->execute([...$idsZona, $fecha, $horaFin, $horaInicio]);
        if ($solapada->fetch()) throw new Exception('La franja seleccionada se cruza con una reserva activa');

        $limite = $pdo->prepare("SELECT COUNT(*) FROM reservas WHERE zona_id IN ($marcas) AND inmueble_id = ? AND fecha_reserva = ? AND estado IN ('pendiente', 'aprobada')");
        $limite->execute([...$idsZona, $inmuebleId, $fecha]);
        if ((int) $limite->fetchColumn() >= (int) $zona['max_reservas_diarias_inmueble']) {
            throw new Exception("Este inmueble ya alcanzó el máximo diario de {$zona['max_reservas_diarias_inmueble']} reserva(s) para esta zona");
        }

        $estado = $interna ? 'aprobada' : 'pendiente';
        $insertar = $pdo->prepare('INSERT INTO reservas (zona_id, usuario_id, inmueble_id, fecha_reserva, hora_inicio, hora_fin, estado) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $insertar->execute([$zonaId, $actorId, $inmuebleId, $fecha, $horaInicio, $horaFin, $estado]);
        $pdo->commit();
        responseJSON('success', $interna ? 'Reserva creada y aprobada' : 'Solicitud enviada y pendiente de aprobación');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'public_zonas') {
    $stmt = $pdo->prepare("SELECT z.id, z.nombre, z.descripcion, z.tarifa, z.aforo, z.horarios, z.max_horas_reserva, z.max_reservas_diarias_inmueble, z.reglamento, z.imagen_url, z.youtube_url FROM zonas_sociales z INNER JOIN (SELECT MIN(id) AS id FROM zonas_sociales WHERE conjunto_id = ? GROUP BY LOWER(TRIM(nombre))) canonicas ON canonicas.id = z.id ORDER BY z.nombre");
    $stmt->execute([$publicConjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'public_zona_detalle') {
    $id = (int) ($_GET['zona_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, nombre, descripcion, tarifa, aforo, horarios, max_horas_reserva, max_reservas_diarias_inmueble, reglamento, imagen_url, youtube_url FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $publicConjuntoId]);
    $zona = $stmt->fetch();
    if (!$zona) responseJSON('error', 'Zona no encontrada');
    responseJSON('success', '', ['zona' => $zona, 'reservas' => disponibilidadZona($pdo, $id, $publicConjuntoId)]);
}

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');
$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

if ($action === 'zonas_list') {
    $stmt = $pdo->prepare("SELECT z.id, z.nombre, z.descripcion, z.tarifa, z.aforo, z.horarios, z.max_horas_reserva, z.max_reservas_diarias_inmueble, z.reglamento, z.imagen_url, z.youtube_url FROM zonas_sociales z INNER JOIN (SELECT MIN(id) AS id FROM zonas_sociales WHERE conjunto_id = ? GROUP BY LOWER(TRIM(nombre))) canonicas ON canonicas.id = z.id ORDER BY z.nombre");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'zona_disponibilidad') {
    $zonaId = (int) ($_GET['zona_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, nombre, max_horas_reserva, max_reservas_diarias_inmueble FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$zonaId, $conjuntoId]);
    $zona = $stmt->fetch();
    if (!$zona) responseJSON('error', 'Zona no encontrada');
    responseJSON('success', '', ['zona' => $zona, 'reservas' => disponibilidadZona($pdo, $zonaId, $conjuntoId)]);
}

if ($action === 'inmuebles_reservas') {
    $interno = in_array($rol, ['admin', 'vigilante'], true);
    $sql = 'SELECT DISTINCT i.id, i.tipo_unidad, i.torre, i.nomenclatura FROM inmuebles i';
    $params = [$conjuntoId];
    if (!$interno) {
        $sql .= ' INNER JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id AND r.usuario_id = ?';
        $params[] = $userId;
    }
    $sql .= ' WHERE i.conjunto_id = ? ORDER BY i.tipo_unidad, i.torre, i.nomenclatura';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($interno ? [$conjuntoId] : [$userId, $conjuntoId]);
    $inmuebles = $stmt->fetchAll();
    foreach ($inmuebles as &$inmueble) $inmueble['etiqueta'] = inmuebleEtiqueta($inmueble);
    responseJSON('success', '', $inmuebles);
}

if ($action === 'list') {
    $interno = in_array($rol, ['admin', 'vigilante'], true);
    $base = 'SELECT r.*, z.nombre AS zona_nombre, i.tipo_unidad, i.torre, i.nomenclatura FROM reservas r JOIN zonas_sociales z ON z.id = r.zona_id LEFT JOIN inmuebles i ON i.id = r.inmueble_id WHERE z.conjunto_id = ?';
    if ($interno) {
        $stmt = $pdo->prepare("$base ORDER BY r.fecha_reserva DESC, r.hora_inicio DESC, r.id DESC");
        $stmt->execute([$conjuntoId]);
    } else {
        $stmt = $pdo->prepare("$base AND (r.usuario_id = ? OR EXISTS (SELECT 1 FROM relacion_inmuebles_usuarios ri WHERE ri.inmueble_id = r.inmueble_id AND ri.usuario_id = ?)) ORDER BY r.fecha_reserva DESC, r.hora_inicio DESC, r.id DESC");
        $stmt->execute([$conjuntoId, $userId, $userId]);
    }
    $reservas = $stmt->fetchAll();
    foreach ($reservas as &$reserva) $reserva['inmueble_etiqueta'] = $reserva['inmueble_id'] ? inmuebleEtiqueta($reserva) : 'Histórico sin inmueble asignado';
    responseJSON('success', '', $reservas);
}

if ($action === 'crear_reserva') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Solo residentes o propietarios pueden solicitar reservas');
    crearReservaHoraria($pdo, $conjuntoId, $userId, $rol, false);
}

if ($action === 'crear_reserva_interna') {
    if (!in_array($rol, ['admin', 'vigilante'], true)) responseJSON('error', 'Sin permisos');
    crearReservaHoraria($pdo, $conjuntoId, $userId, $rol, true);
}

if ($action === 'cancelar_reserva') {
    if (!in_array($rol, ['admin', 'vigilante'], true)) responseJSON('error', 'Sin permisos');
    $reservaId = (int) ($_POST['reserva_id'] ?? 0);
    if ($reservaId <= 0) responseJSON('error', 'Reserva inválida');
    $stmt = $pdo->prepare("UPDATE reservas r JOIN zonas_sociales z ON z.id = r.zona_id SET r.estado = 'rechazada' WHERE r.id = ? AND z.conjunto_id = ? AND r.estado IN ('pendiente', 'aprobada')");
    $stmt->execute([$reservaId, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'Reserva no encontrada o ya cancelada');
    responseJSON('success', 'Reserva cancelada; se conserva en el historial');
}

if ($action === 'crear_zona' || $action === 'actualizar_zona') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $id = (int) ($_POST['zona_id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $tarifa = (float) ($_POST['tarifa'] ?? 0);
    $aforo = (int) ($_POST['aforo'] ?? 0);
    $horarios = trim($_POST['horarios'] ?? '');
    $maxHoras = (int) ($_POST['max_horas_reserva'] ?? 0);
    $maxReservas = (int) ($_POST['max_reservas_diarias_inmueble'] ?? 0);
    $reglamento = trim($_POST['reglamento'] ?? '');
    $youtube = trim($_POST['youtube_url'] ?? '');
    if ($nombre === '' || $descripcion === '' || $horarios === '' || $reglamento === '' || $aforo < 1 || $tarifa < 0 || $maxHoras < 1 || $maxHoras > 24 || $maxReservas < 1 || $maxReservas > 20) responseJSON('error', 'Completa la información y define límites de reserva válidos');
    if ($youtube !== '' && !videoYoutubeId($youtube)) responseJSON('error', 'La URL de YouTube no es válida');
    $imagen = null;
    if (isset($_FILES['imagen']) && $_FILES['imagen']['error'] !== UPLOAD_ERR_NO_FILE) $imagen = cargarImagenZona($_FILES['imagen']);
    if ($action === 'crear_zona') {
        $stmt = $pdo->prepare('SELECT id FROM zonas_sociales WHERE conjunto_id = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))');
        $stmt->execute([$conjuntoId, $nombre]);
        if ($stmt->fetch()) responseJSON('error', 'Ya existe una zona con ese nombre');
        $pdo->prepare('INSERT INTO zonas_sociales (conjunto_id, nombre, descripcion, tarifa, aforo, horarios, max_horas_reserva, max_reservas_diarias_inmueble, reglamento, imagen_url, youtube_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$conjuntoId, $nombre, $descripcion, $tarifa, $aforo, $horarios, $maxHoras, $maxReservas, $reglamento, $imagen, $youtube ?: null]);
        responseJSON('success', 'Zona social creada');
    }

    $stmt = $pdo->prepare('SELECT nombre, imagen_url FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    $actual = $stmt->fetch();
    if (!$actual) responseJSON('error', 'Zona no encontrada');
    $duplicado = $pdo->prepare('SELECT id FROM zonas_sociales WHERE conjunto_id = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?)) AND LOWER(TRIM(nombre)) <> LOWER(TRIM(?))');
    $duplicado->execute([$conjuntoId, $nombre, $actual['nombre']]);
    if ($duplicado->fetch()) responseJSON('error', 'Ya existe una zona con ese nombre');

    $actualizar = $pdo->prepare('UPDATE zonas_sociales SET nombre = ?, descripcion = ?, tarifa = ?, aforo = ?, horarios = ?, max_horas_reserva = ?, max_reservas_diarias_inmueble = ?, reglamento = ?, imagen_url = ?, youtube_url = ? WHERE conjunto_id = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))');
    $actualizar->execute([$nombre, $descripcion, $tarifa, $aforo, $horarios, $maxHoras, $maxReservas, $reglamento, $imagen ?: $actual['imagen_url'], $youtube ?: null, $conjuntoId, $actual['nombre']]);
    responseJSON('success', 'Zona actualizada');
}

if ($action === 'estado_reserva') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $id = (int) ($_POST['reserva_id'] ?? 0);
    $estado = $_POST['estado'] ?? '';
    if (!in_array($estado, ['aprobada', 'rechazada'], true)) responseJSON('error', 'Estado inválido');
    $stmt = $pdo->prepare("UPDATE reservas r JOIN zonas_sociales z ON z.id = r.zona_id SET r.estado = ? WHERE r.id = ? AND z.conjunto_id = ? AND r.estado = 'pendiente'");
    $stmt->execute([$estado, $id, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'Reserva no encontrada o ya procesada');
    responseJSON('success', 'Reserva actualizada');
}

responseJSON('error', 'Acción no válida');
