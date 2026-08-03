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
    if ($file['size'] > 5 * 1024 * 1024) responseJSON('error', 'La imagen no puede superar 5MB');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    if (!isset($mimes[$ext]) || (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) !== $mimes[$ext]) responseJSON('error', 'La imagen debe ser JPG, PNG o WEBP válida');
    $dir = __DIR__ . '/../uploads/zonas';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) responseJSON('error', 'No se pudo preparar el almacenamiento');
    $name = 'zona_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) responseJSON('error', 'No se pudo guardar la imagen');
    return 'uploads/zonas/' . $name;
}
function disponibilidadZona(PDO $pdo, int $zonaId): array
{
    $stmt = $pdo->prepare("SELECT fecha_reserva, estado FROM reservas WHERE zona_id = ? AND estado IN ('pendiente', 'aprobada') ORDER BY fecha_reserva");
    $stmt->execute([$zonaId]);
    return $stmt->fetchAll();
}

if ($action === 'public_zonas') {
    // Las instalaciones existentes contienen duplicados históricos. La tarjeta pública
    // representa la zona lógica canónica (el menor id por nombre normalizado).
    $stmt = $pdo->prepare("SELECT z.id, z.nombre, z.descripcion, z.tarifa, z.aforo, z.horarios, z.reglamento, z.imagen_url, z.youtube_url
                           FROM zonas_sociales z
                           INNER JOIN (
                               SELECT MIN(id) AS id FROM zonas_sociales
                               WHERE conjunto_id = ? GROUP BY LOWER(TRIM(nombre))
                           ) canonicas ON canonicas.id = z.id
                           ORDER BY z.nombre");
    $stmt->execute([$publicConjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'public_zona_detalle') {
    $id = (int) ($_GET['zona_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, nombre, descripcion, tarifa, aforo, horarios, reglamento, imagen_url, youtube_url FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $publicConjuntoId]);
    $zona = $stmt->fetch();
    if (!$zona) responseJSON('error', 'Zona no encontrada');
    responseJSON('success', '', ['zona' => $zona, 'reservas' => disponibilidadZona($pdo, $id)]);
}

if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');
$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

if ($action === 'zonas_list') {
    $stmt = $pdo->prepare("SELECT z.id, z.nombre, z.descripcion, z.tarifa, z.aforo, z.horarios, z.reglamento, z.imagen_url, z.youtube_url
                           FROM zonas_sociales z
                           INNER JOIN (
                               SELECT MIN(id) AS id FROM zonas_sociales
                               WHERE conjunto_id = ? GROUP BY LOWER(TRIM(nombre))
                           ) canonicas ON canonicas.id = z.id
                           ORDER BY z.nombre");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'zona_disponibilidad') {
    $zonaId = (int) ($_GET['zona_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT id, nombre FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$zonaId, $conjuntoId]);
    $zona = $stmt->fetch();
    if (!$zona) responseJSON('error', 'Zona no encontrada');
    responseJSON('success', '', ['zona' => $zona, 'reservas' => disponibilidadZona($pdo, $zonaId)]);
}
if ($action === 'list') {
    $sql = $rol === 'admin' ? 'SELECT r.*, z.nombre AS zona_nombre, u.nombre AS usuario_nombre FROM reservas r JOIN zonas_sociales z ON z.id = r.zona_id JOIN usuarios u ON u.id = r.usuario_id WHERE z.conjunto_id = ? ORDER BY r.fecha_reserva DESC' : 'SELECT r.*, z.nombre AS zona_nombre FROM reservas r JOIN zonas_sociales z ON z.id = r.zona_id WHERE r.usuario_id = ? AND z.conjunto_id = ? ORDER BY r.fecha_reserva DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($rol === 'admin' ? [$conjuntoId] : [$userId, $conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'crear_reserva') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Solo residentes o propietarios pueden solicitar reservas');
    $zonaId = (int) ($_POST['zona_id'] ?? 0);
    $fecha = $_POST['fecha_reserva'] ?? '';
    if (!$zonaId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) || $fecha <= date('Y-m-d')) responseJSON('error', 'Selecciona un día futuro disponible');
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id FROM zonas_sociales WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $stmt->execute([$zonaId, $conjuntoId]);
        if (!$stmt->fetch()) throw new Exception('Zona no disponible');
        $stmt = $pdo->prepare("SELECT id FROM reservas WHERE zona_id = ? AND fecha_reserva = ? AND estado IN ('pendiente', 'aprobada') FOR UPDATE");
        $stmt->execute([$zonaId, $fecha]);
        if ($stmt->fetch()) throw new Exception('La zona ya tiene una reserva activa ese día');
        $pdo->prepare("INSERT INTO reservas (zona_id, usuario_id, fecha_reserva, estado) VALUES (?, ?, ?, 'pendiente')")->execute([$zonaId, $userId, $fecha]);
        $pdo->commit();
        responseJSON('success', 'Solicitud enviada y pendiente de aprobación');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'crear_zona' || $action === 'actualizar_zona') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $id = (int) ($_POST['zona_id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $tarifa = (float) ($_POST['tarifa'] ?? 0);
    $aforo = (int) ($_POST['aforo'] ?? 0);
    $horarios = trim($_POST['horarios'] ?? '');
    $reglamento = trim($_POST['reglamento'] ?? '');
    $youtube = trim($_POST['youtube_url'] ?? '');
    if ($nombre === '' || $horarios === '' || $reglamento === '' || $aforo < 1 || $tarifa < 0) responseJSON('error', 'Completa nombre, aforo, horario, tarifa y normas válidas');
    if ($youtube !== '' && !videoYoutubeId($youtube)) responseJSON('error', 'La URL de YouTube no es válida');
    $imagen = null;
    if (isset($_FILES['imagen']) && $_FILES['imagen']['error'] !== UPLOAD_ERR_NO_FILE) $imagen = cargarImagenZona($_FILES['imagen']);
    if ($action === 'crear_zona') {
        $stmt = $pdo->prepare('SELECT id FROM zonas_sociales WHERE conjunto_id = ? AND LOWER(nombre) = LOWER(?)');
        $stmt->execute([$conjuntoId, $nombre]);
        if ($stmt->fetch()) responseJSON('error', 'Ya existe una zona con ese nombre');
        $pdo->prepare('INSERT INTO zonas_sociales (conjunto_id, nombre, descripcion, tarifa, aforo, horarios, reglamento, imagen_url, youtube_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$conjuntoId, $nombre, $descripcion, $tarifa, $aforo, $horarios, $reglamento, $imagen, $youtube ?: null]);
        responseJSON('success', 'Zona social creada');
    }
    $stmt = $pdo->prepare('SELECT nombre, imagen_url FROM zonas_sociales WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    $actual = $stmt->fetch();
    if (!$actual) responseJSON('error', 'Zona no encontrada');

    // Un nombre representa una sola zona lógica mientras se conservan los
    // registros duplicados históricos. Evita conflictos con otra zona lógica.
    $duplicado = $pdo->prepare("SELECT id FROM zonas_sociales
                                WHERE conjunto_id = ?
                                  AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))
                                  AND LOWER(TRIM(nombre)) <> LOWER(TRIM(?))");
    $duplicado->execute([$conjuntoId, $nombre, $actual['nombre']]);
    if ($duplicado->fetch()) responseJSON('error', 'Ya existe una zona con ese nombre');

    // Se actualiza todo el grupo histórico para que una tarjeta antigua no
    // reaparezca con datos previos después de renombrar o editar la zona.
    $stmt = $pdo->prepare("UPDATE zonas_sociales
                           SET nombre = ?, descripcion = ?, tarifa = ?, aforo = ?, horarios = ?, reglamento = ?, imagen_url = ?, youtube_url = ?
                           WHERE conjunto_id = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?))");
    $stmt->execute([$nombre, $descripcion, $tarifa, $aforo, $horarios, $reglamento, $imagen ?: $actual['imagen_url'], $youtube ?: null, $conjuntoId, $actual['nombre']]);
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
