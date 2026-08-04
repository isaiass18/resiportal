<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json; charset=utf-8');
if (!isset($_SESSION['user_id'], $_SESSION['conjunto_id']) || !in_array($_SESSION['user_rol'] ?? '', ['admin', 'vigilante'], true)) responseJSON('error', 'Sin permisos');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$conjuntoId = (int) $_SESSION['conjunto_id'];
$rol = $_SESSION['user_rol'];
$cuenta = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? AND conjunto_id = ? AND activo = 1');
$cuenta->execute([$userId, $conjuntoId]);
if (!$cuenta->fetch()) responseJSON('error', 'La cuenta ya no está activa');

function inmuebleDelConjunto(PDO $pdo, int $inmuebleId, int $conjuntoId): bool
{
    $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$inmuebleId, $conjuntoId]);
    return (bool) $stmt->fetch();
}

function guardarAdjuntoNovedad(array $file): ?array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_INI_SIZE) {
        throw new RuntimeException('El adjunto supera el límite permitido por el servidor');
    }
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo cargar el adjunto de la novedad');
    }
    if ((int) ($file['size'] ?? 0) <= 0 || (int) $file['size'] > 5 * 1024 * 1024) {
        throw new RuntimeException('El adjunto puede pesar máximo 5 MB');
    }
    $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
    $permitidos = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];
    $tmp = (string) ($file['tmp_name'] ?? '');
    $mime = is_file($tmp) ? (new finfo(FILEINFO_MIME_TYPE))->file($tmp) : '';
    if (!isset($permitidos[$ext]) || $mime !== $permitidos[$ext]) {
        throw new RuntimeException('El adjunto debe ser una imagen JPG, PNG, WEBP o un PDF válido');
    }
    $dir = __DIR__ . '/../../uploads_privados/novedades';
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) throw new RuntimeException('No se pudo preparar el almacenamiento del adjunto');
    $archivo = 'novedad_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($tmp, $dir . '/' . $archivo)) throw new RuntimeException('No se pudo guardar el adjunto');
    return ['nombre_original' => mb_substr(basename((string) $file['name']), 0, 255), 'archivo' => $archivo, 'mime' => $mime, 'tamano' => (int) $file['size']];
}

function adjuntosMinuta(PDO $pdo, array $minutas): array
{
    if (!$minutas) return $minutas;
    $stmt = $pdo->prepare('SELECT id, minuta_id, nombre_original, mime, tamano, creado_en FROM minuta_adjuntos WHERE minuta_id = ? ORDER BY id');
    foreach ($minutas as &$minuta) {
        $stmt->execute([(int) $minuta['id']]);
        $minuta['adjuntos'] = $stmt->fetchAll();
    }
    return $minutas;
}

if ($action === 'list_visitantes') {
    $stmt = $pdo->prepare('SELECT v.*, i.torre, i.apartamento FROM visitantes v JOIN inmuebles i ON i.id = v.inmueble_id WHERE i.conjunto_id = ? ORDER BY v.fecha_ingreso DESC LIMIT 50');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'list_minuta') {
    $sql = 'SELECT m.*, u.nombre AS vigilante, COALESCE(m.fecha_novedad, m.fecha_registro) AS fecha_operativa FROM minuta_porteria m JOIN usuarios u ON u.id = m.vigilante_id WHERE u.conjunto_id = ?';
    $params = [$conjuntoId];
    if ($rol === 'vigilante') {
        $sql .= ' AND m.vigilante_id = ?';
        $params[] = $userId;
    }
    $sql .= ' ORDER BY COALESCE(m.fecha_novedad, m.fecha_registro) DESC LIMIT 50';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    responseJSON('success', '', adjuntosMinuta($pdo, $stmt->fetchAll()));
}
if ($action === 'list_paquetes') {
    $stmt = $pdo->prepare('SELECT p.*, i.torre, i.apartamento, u.nombre AS receptor FROM paquetes p JOIN inmuebles i ON i.id = p.inmueble_id LEFT JOIN usuarios u ON u.id = p.recibido_por WHERE i.conjunto_id = ? ORDER BY p.fecha_recepcion DESC LIMIT 50');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'list_directorio') {
    $stmt = $pdo->prepare("SELECT r.id AS relacion_id, u.id, u.nombre, u.email, u.contacto, r.tipo_relacion, CASE WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 0 ELSE 1 END AS tiene_cuenta, COALESCE(i.torre, 'N/A') AS torre, COALESCE(i.apartamento, i.nomenclatura, 'N/A') AS apartamento FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id AND u.conjunto_id = ? JOIN inmuebles i ON i.id = r.inmueble_id AND i.conjunto_id = ? WHERE r.tipo_relacion IN ('residente', 'propietario') ORDER BY i.torre, i.nomenclatura, u.nombre");
    $stmt->execute([$conjuntoId, $conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'registrar_visita') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $nombre = trim($_POST['nombre'] ?? '');
    $documento = trim($_POST['documento'] ?? '');
    $placa = strtoupper(trim($_POST['vehiculo_placa'] ?? ''));
    if (!$inmuebleId || $nombre === '' || !inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Visitante e inmueble válido son obligatorios');
    $stmt = $pdo->prepare('INSERT INTO visitantes (inmueble_id, nombre, documento, vehiculo_placa, autorizado_por) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$inmuebleId, $nombre, $documento ?: null, $placa ?: null, $userId]);
    responseJSON('success', 'Visita registrada');
}
if ($action === 'marcar_salida') {
    $id = (int) ($_POST['visitante_id'] ?? 0);
    $stmt = $pdo->prepare('UPDATE visitantes v JOIN inmuebles i ON i.id = v.inmueble_id SET v.fecha_salida = NOW() WHERE v.id = ? AND i.conjunto_id = ? AND v.fecha_salida IS NULL');
    $stmt->execute([$id, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'Visita no encontrada o ya cerrada');
    responseJSON('success', 'Salida registrada');
}
if ($action === 'recibir_paquete') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $transportadora = trim($_POST['transportadora'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    if (!$inmuebleId || $transportadora === '' || !inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Inmueble y transportadora son obligatorios');
    $stmt = $pdo->prepare("INSERT INTO paquetes (inmueble_id, transportadora, descripcion, estado, recibido_por) VALUES (?, ?, ?, 'pendiente', ?)");
    $stmt->execute([$inmuebleId, $transportadora, $descripcion ?: null, $userId]);
    responseJSON('success', 'Paquete recibido');
}
if ($action === 'entregar_paquete') {
    $id = (int) ($_POST['paquete_id'] ?? 0);
    $stmt = $pdo->prepare("UPDATE paquetes p JOIN inmuebles i ON i.id = p.inmueble_id SET p.estado = 'entregado', p.fecha_entrega = NOW() WHERE p.id = ? AND i.conjunto_id = ? AND p.estado = 'pendiente'");
    $stmt->execute([$id, $conjuntoId]);
    if (!$stmt->rowCount()) responseJSON('error', 'Paquete no encontrado o ya entregado');
    responseJSON('success', 'Entrega registrada');
}
if ($action === 'registrar_novedad') {
    $asunto = trim($_POST['asunto'] ?? '');
    $novedad = trim($_POST['novedad'] ?? '');
    $fechaNovedad = trim($_POST['fecha_novedad'] ?? '');
    $fecha = DateTime::createFromFormat('Y-m-d\\TH:i', $fechaNovedad);
    if ($asunto === '' || mb_strlen($asunto) > 150 || $novedad === '' || !$fecha || $fecha->format('Y-m-d\\TH:i') !== $fechaNovedad) responseJSON('error', 'Asunto (máximo 150 caracteres), novedad y fecha/hora válidos son obligatorios');

    $adjunto = null;
    try {
        $adjunto = guardarAdjuntoNovedad($_FILES['adjunto'] ?? []);
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO minuta_porteria (conjunto_id, vigilante_id, asunto, novedad, fecha_novedad, estado) VALUES (?, ?, ?, ?, ?, "pendiente")');
        $stmt->execute([$conjuntoId, $userId, $asunto, $novedad, $fecha->format('Y-m-d H:i:s')]);
        $minutaId = (int) $pdo->lastInsertId();
        $pdo->prepare("INSERT INTO minuta_seguimientos (minuta_id, autor_id, tipo, contenido) VALUES (?, ?, 'creacion', ?)")->execute([$minutaId, $userId, $novedad]);
        if ($adjunto) {
            $guardar = $pdo->prepare('INSERT INTO minuta_adjuntos (minuta_id, nombre_original, archivo, mime, tamano) VALUES (?, ?, ?, ?, ?)');
            $guardar->execute([$minutaId, $adjunto['nombre_original'], $adjunto['archivo'], $adjunto['mime'], $adjunto['tamano']]);
        }
        $pdo->commit();
        responseJSON('success', 'Novedad registrada en minuta' . ($adjunto ? ' con adjunto.' : '.'));
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($adjunto && is_file(__DIR__ . '/../../uploads_privados/novedades/' . basename($adjunto['archivo']))) @unlink(__DIR__ . '/../../uploads_privados/novedades/' . basename($adjunto['archivo']));
        error_log('Error al guardar novedad: ' . $error->getMessage());
        responseJSON('error', $error->getMessage());
    }
}
if ($action === 'ver_adjunto_novedad') {
    $adjuntoId = (int) ($_GET['adjunto_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT a.archivo, a.nombre_original, a.mime FROM minuta_adjuntos a JOIN minuta_porteria m ON m.id = a.minuta_id JOIN usuarios u ON u.id = m.vigilante_id WHERE a.id = ? AND u.conjunto_id = ?');
    $stmt->execute([$adjuntoId, $conjuntoId]);
    $adjunto = $stmt->fetch();
    $ruta = $adjunto ? __DIR__ . '/../../uploads_privados/novedades/' . basename($adjunto['archivo']) : '';
    if (!$adjunto || !is_file($ruta)) responseJSON('error', 'Adjunto no encontrado');
    header('Content-Type: ' . $adjunto['mime']);
    header('Content-Length: ' . filesize($ruta));
    header('Content-Disposition: inline; filename="' . rawurlencode($adjunto['nombre_original']) . '"');
    readfile($ruta);
    exit;
}
if ($action === 'list_inmuebles') {
    $stmt = $pdo->prepare('SELECT id, torre, apartamento, nomenclatura FROM inmuebles WHERE conjunto_id = ? ORDER BY torre, apartamento');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
responseJSON('error', 'Acción no válida');
