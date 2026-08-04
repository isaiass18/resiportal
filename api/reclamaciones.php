<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id'], $_SESSION['conjunto_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$conjuntoId = (int) $_SESSION['conjunto_id'];
$rol = $_SESSION['user_rol'] ?? '';

function archivosReclamacion(PDO $pdo, array $reclamaciones): array
{
    if (!$reclamaciones) return $reclamaciones;
    $adjuntos = $pdo->prepare('SELECT id, reclamacion_id, nota_id, nombre_original, mime, tamano, creado_en FROM reclamacion_adjuntos WHERE reclamacion_id = ? AND nota_id IS NULL ORDER BY id');
    foreach ($reclamaciones as &$reclamacion) {
        $adjuntos->execute([(int) $reclamacion['id']]);
        $reclamacion['adjuntos'] = $adjuntos->fetchAll();
    }
    return $reclamaciones;
}

function guardarAdjuntosReclamacion(array $archivos, int $conjuntoId): array
{
    if (!isset($archivos['name']) || !is_array($archivos['name'])) return [];
    $cantidad = count(array_filter($archivos['error'] ?? [], static fn($error): bool => $error !== UPLOAD_ERR_NO_FILE));
    if ($cantidad > 5) throw new RuntimeException('Puedes adjuntar máximo cinco archivos por PQRS');
    $permitidos = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'pdf' => 'application/pdf',
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'mov' => 'video/quicktime'
    ];
    $dir = __DIR__ . '/../../uploads_privados/reclamaciones';
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) throw new RuntimeException('No se pudo preparar el almacenamiento de adjuntos');
    $guardados = [];
    foreach ($archivos['name'] as $indice => $nombreOriginal) {
        $error = $archivos['error'][$indice] ?? UPLOAD_ERR_NO_FILE;
        if ($error === UPLOAD_ERR_NO_FILE) continue;
        if ($error !== UPLOAD_ERR_OK) throw new RuntimeException('No se pudo cargar uno de los adjuntos');
        $tamano = (int) ($archivos['size'][$indice] ?? 0);
        if ($tamano <= 0 || $tamano > 25 * 1024 * 1024) throw new RuntimeException('Cada adjunto puede pesar máximo 25 MB');
        $tmp = $archivos['tmp_name'][$indice] ?? '';
        $ext = strtolower(pathinfo((string) $nombreOriginal, PATHINFO_EXTENSION));
        $mime = is_file($tmp) ? (new finfo(FILEINFO_MIME_TYPE))->file($tmp) : '';
        if (!isset($permitidos[$ext]) || $mime !== $permitidos[$ext]) throw new RuntimeException('Solo se permiten imágenes, PDF o video MP4/WEBM/MOV válidos');
        $archivo = 'pqrs_' . $conjuntoId . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
        if (!move_uploaded_file($tmp, $dir . '/' . $archivo)) throw new RuntimeException('No se pudo guardar uno de los adjuntos');
        $guardados[] = ['nombre_original' => mb_substr(basename((string) $nombreOriginal), 0, 255), 'archivo' => $archivo, 'mime' => $mime, 'tamano' => $tamano];
    }
    if (count($guardados) > 5) throw new RuntimeException('Puedes adjuntar máximo cinco archivos por PQRS');
    return $guardados;
}

if ($action === 'ver_adjunto') {
    $adjuntoId = (int) ($_GET['adjunto_id'] ?? 0);
    $stmt = $pdo->prepare('SELECT a.archivo, a.nombre_original, a.mime FROM reclamacion_adjuntos a JOIN reclamaciones r ON r.id = a.reclamacion_id WHERE a.id = ? AND r.conjunto_id = ?');
    $stmt->execute([$adjuntoId, $conjuntoId]);
    $adjunto = $stmt->fetch();
    if (!$adjunto) responseJSON('error', 'Adjunto no encontrado');
    if ($rol !== 'admin') {
        $autor = $pdo->prepare('SELECT usuario_id FROM reclamaciones r JOIN reclamacion_adjuntos a ON a.reclamacion_id = r.id WHERE a.id = ? AND r.conjunto_id = ?');
        $autor->execute([$adjuntoId, $conjuntoId]);
        if ((int) $autor->fetchColumn() !== $userId) responseJSON('error', 'Sin permisos para ver este adjunto');
    }
    $path = __DIR__ . '/../../uploads_privados/reclamaciones/' . basename($adjunto['archivo']);
    if (!is_file($path)) responseJSON('error', 'El archivo ya no está disponible');
    header('Content-Type: ' . $adjunto['mime']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . rawurlencode($adjunto['nombre_original']) . '"');
    readfile($path);
    exit;
}

if ($action === 'detalle') {
    $reclamacionId = (int) ($_GET['reclamacion_id'] ?? 0);
    $sql = 'SELECT r.*, u.nombre AS usuario_nombre, u.email AS usuario_email, ru.nombre AS resuelto_por_nombre FROM reclamaciones r JOIN usuarios u ON u.id = r.usuario_id LEFT JOIN usuarios ru ON ru.id = r.resuelto_por WHERE r.id = ? AND r.conjunto_id = ?';
    $params = [$reclamacionId, $conjuntoId];
    if ($rol !== 'admin') {
        $sql .= ' AND r.usuario_id = ?';
        $params[] = $userId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $reclamacion = $stmt->fetch();
    if (!$reclamacion) responseJSON('error', 'PQRS no encontrada o sin permisos');
    $inicial = archivosReclamacion($pdo, [$reclamacion])[0]['adjuntos'] ?? [];
    $notas = $pdo->prepare('SELECT n.id, n.contenido, n.es_solucion, n.creado_en, u.nombre AS autor, u.rol AS autor_rol FROM reclamacion_notas n JOIN usuarios u ON u.id = n.autor_id WHERE n.reclamacion_id = ? ORDER BY n.creado_en ASC, n.id ASC');
    $notas->execute([$reclamacionId]);
    $cronologia = $notas->fetchAll();
    $adjuntosNota = $pdo->prepare('SELECT id, nota_id, nombre_original, mime, tamano, creado_en FROM reclamacion_adjuntos WHERE nota_id = ? ORDER BY id');
    foreach ($cronologia as &$nota) {
        $adjuntosNota->execute([(int) $nota['id']]);
        $nota['adjuntos'] = $adjuntosNota->fetchAll();
    }
    responseJSON('success', '', ['reclamacion' => $reclamacion, 'adjuntos' => $inicial, 'notas' => $cronologia]);
}

if ($action === 'agregar_nota') {
    if (!in_array($rol, ['admin', 'residente', 'propietario'], true)) responseJSON('error', 'Sin permisos');
    $reclamacionId = (int) ($_POST['reclamacion_id'] ?? 0);
    $contenido = trim($_POST['contenido'] ?? '');
    if ($contenido === '') responseJSON('error', 'Escribe una nota para continuar');
    if (mb_strlen($contenido) > 10000) responseJSON('error', 'La nota supera el tamaño permitido');
    $sql = 'SELECT id FROM reclamaciones WHERE id = ? AND conjunto_id = ?';
    $params = [$reclamacionId, $conjuntoId];
    if ($rol !== 'admin') {
        $sql .= ' AND usuario_id = ?';
        $params[] = $userId;
    }
    $verificar = $pdo->prepare($sql);
    $verificar->execute($params);
    if (!$verificar->fetch()) responseJSON('error', 'PQRS no encontrada o sin permisos');
    try {
        $adjuntos = guardarAdjuntosReclamacion($_FILES['adjuntos'] ?? [], $conjuntoId);
        $pdo->beginTransaction();
        $guardarNota = $pdo->prepare('INSERT INTO reclamacion_notas (reclamacion_id, autor_id, contenido) VALUES (?, ?, ?)');
        $guardarNota->execute([$reclamacionId, $userId, $contenido]);
        $notaId = (int) $pdo->lastInsertId();
        if ($adjuntos) {
            $guardarAdjunto = $pdo->prepare('INSERT INTO reclamacion_adjuntos (reclamacion_id, nota_id, nombre_original, archivo, mime, tamano, subido_por) VALUES (?, ?, ?, ?, ?, ?, ?)');
            foreach ($adjuntos as $adjunto) $guardarAdjunto->execute([$reclamacionId, $notaId, $adjunto['nombre_original'], $adjunto['archivo'], $adjunto['mime'], $adjunto['tamano'], $userId]);
        }
        $pdo->commit();
        responseJSON('success', 'Seguimiento agregado correctamente');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($adjuntos ?? [] as $adjunto) {
            $ruta = __DIR__ . '/../../uploads_privados/reclamaciones/' . basename((string) $adjunto['archivo']);
            if (is_file($ruta)) @unlink($ruta);
        }
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'actualizar_estado') {
    if ($rol !== 'admin') responseJSON('error', 'Solo administración puede actualizar el estado');
    $reclamacionId = (int) ($_POST['reclamacion_id'] ?? 0);
    $estado = $_POST['estado'] ?? '';
    $solucion = trim($_POST['solucion'] ?? '');
    if (!in_array($estado, ['abierto', 'en_progreso', 'cerrado'], true)) responseJSON('error', 'Estado inválido');
    if (mb_strlen($solucion) > 10000) responseJSON('error', 'La solución supera el tamaño permitido');
    if ($estado === 'cerrado' && $solucion === '') responseJSON('error', 'Describe la solución antes de cerrar la PQRS');
    $existe = $pdo->prepare('SELECT id FROM reclamaciones WHERE id = ? AND conjunto_id = ?');
    $existe->execute([$reclamacionId, $conjuntoId]);
    if (!$existe->fetch()) responseJSON('error', 'PQRS no encontrada');
    if ($estado === 'cerrado') {
        $pdo->prepare("UPDATE reclamaciones SET estado = 'cerrado', solucion = ?, resuelto_por = ?, resuelto_en = NOW() WHERE id = ? AND conjunto_id = ?")->execute([$solucion, $userId, $reclamacionId, $conjuntoId]);
        $pdo->prepare('INSERT INTO reclamacion_notas (reclamacion_id, autor_id, contenido, es_solucion) VALUES (?, ?, ?, 1)')->execute([$reclamacionId, $userId, $solucion]);
    } else {
        $pdo->prepare('UPDATE reclamaciones SET estado = ?, solucion = NULL, resuelto_por = NULL, resuelto_en = NULL WHERE id = ? AND conjunto_id = ?')->execute([$estado, $reclamacionId, $conjuntoId]);
    }
    responseJSON('success', $estado === 'cerrado' ? 'PQRS solucionada y cerrada' : 'Estado de la PQRS actualizado');
}

if ($action === 'list') {
    if ($rol === 'admin') {
        $stmt = $pdo->prepare('SELECT r.id, r.asunto, r.descripcion, r.categoria, r.estado, r.creado_en, u.nombre AS usuario_nombre FROM reclamaciones r JOIN usuarios u ON u.id = r.usuario_id WHERE r.conjunto_id = ? ORDER BY r.creado_en DESC');
        $stmt->execute([$conjuntoId]);
    } else {
        $stmt = $pdo->prepare('SELECT id, asunto, descripcion, categoria, estado, creado_en FROM reclamaciones WHERE conjunto_id = ? AND usuario_id = ? ORDER BY creado_en DESC');
        $stmt->execute([$conjuntoId, $userId]);
    }
    responseJSON('success', '', archivosReclamacion($pdo, $stmt->fetchAll()));
}

if ($action === 'crear') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Solo residentes o propietarios pueden radicar PQRS');
    $asunto = trim($_POST['asunto'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $categoria = trim($_POST['categoria'] ?? 'General');
    if ($asunto === '' || $descripcion === '') responseJSON('error', 'Asunto y descripción son obligatorios');
    if (mb_strlen($asunto) > 150 || mb_strlen($categoria) > 80) responseJSON('error', 'La información excede la longitud permitida');
    try {
        $adjuntos = guardarAdjuntosReclamacion($_FILES['adjuntos'] ?? [], $conjuntoId);
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("INSERT INTO reclamaciones (conjunto_id, usuario_id, asunto, descripcion, categoria, estado) VALUES (?, ?, ?, ?, ?, 'abierto')");
        $stmt->execute([$conjuntoId, $userId, $asunto, $descripcion, $categoria ?: 'General']);
        $reclamacionId = (int) $pdo->lastInsertId();
        if ($adjuntos) {
            $guardar = $pdo->prepare('INSERT INTO reclamacion_adjuntos (reclamacion_id, nombre_original, archivo, mime, tamano, subido_por) VALUES (?, ?, ?, ?, ?, ?)');
            foreach ($adjuntos as $adjunto) $guardar->execute([$reclamacionId, $adjunto['nombre_original'], $adjunto['archivo'], $adjunto['mime'], $adjunto['tamano'], $userId]);
        }
        $pdo->commit();
        responseJSON('success', 'PQRS radicada correctamente' . ($adjuntos ? ' con adjuntos.' : '.') . ' Quedó en estado abierto.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        foreach ($adjuntos ?? [] as $adjunto) {
            $ruta = __DIR__ . '/../../uploads_privados/reclamaciones/' . basename((string) ($adjunto['archivo'] ?? ''));
            if (is_file($ruta)) @unlink($ruta);
        }
        responseJSON('error', $e->getMessage());
    }
}

responseJSON('error', 'Acción no válida');
