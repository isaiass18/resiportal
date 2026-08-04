<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// La portada pública solo expone las diapositivas activas del conjunto actual.
if ($action === 'public_config') {
    $conjuntoPublicoId = (int) ($_SESSION['conjunto_id'] ?? 1);
    $stmt = $pdo->prepare('SELECT nombre, logo_url FROM conjuntos WHERE id = ?');
    $stmt->execute([$conjuntoPublicoId]);
    responseJSON('success', '', $stmt->fetch() ?: ['nombre' => 'ResiPortal', 'logo_url' => null]);
}
if ($action === 'public_hero') {
    $conjuntoPublicoId = (int) ($_SESSION['conjunto_id'] ?? 1);
    $stmt = $pdo->prepare('SELECT id, titulo, texto, etiqueta_boton, url_boton, imagen_url, orden FROM hero_slides WHERE conjunto_id = ? AND activo = 1 ORDER BY orden, id');
    $stmt->execute([$conjuntoPublicoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if (!isset($_SESSION['user_id'], $_SESSION['conjunto_id']) || ($_SESSION['user_rol'] ?? '') !== 'admin') responseJSON('error', 'Sin permisos');
$conjuntoId = (int) $_SESSION['conjunto_id'];

function guardarImagenPortal(array $file, string $prefijo, string $carpeta, string $etiqueta): string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) responseJSON('error', 'No se pudo cargar ' . $etiqueta);
    if (($file['size'] ?? 0) > 3 * 1024 * 1024) responseJSON('error', ucfirst($etiqueta) . ' no puede superar 3 MB');
    $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
    $permitidos = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    if (!isset($permitidos[$ext])) responseJSON('error', 'Formato de ' . $etiqueta . ' no permitido');
    $mime = is_file($file['tmp_name'] ?? '') ? (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) : '';
    if ($mime !== $permitidos[$ext]) responseJSON('error', 'El contenido de ' . $etiqueta . ' no coincide con su formato');
    $directorio = __DIR__ . '/../uploads/' . $carpeta;
    if (!is_dir($directorio) && !mkdir($directorio, 0755, true)) responseJSON('error', 'No se pudo preparar el almacenamiento');
    $nombre = $prefijo . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $directorio . '/' . $nombre)) responseJSON('error', 'No se pudo guardar ' . $etiqueta);
    return 'uploads/' . $carpeta . '/' . $nombre;
}

function guardarLogo(array $file): string
{
    return guardarImagenPortal($file, 'logo', 'logos', 'el logo');
}

function guardarImagenHero(array $file): string
{
    return guardarImagenPortal($file, 'hero', 'heroes', 'la imagen de portada');
}

function validarUrlHero(string $url, bool $esImagen = false): string
{
    if ($url === '') return '';
    if ($esImagen && preg_match('#^(?:uploads/heroes/[a-zA-Z0-9_.-]+|img/hero_bg\.jpg)$#', $url)) return $url;
    if (!$esImagen && preg_match('#^#[a-zA-Z][a-zA-Z0-9_-]*$#', $url)) return $url;
    if (!$esImagen && preg_match('#^/(?!/)[a-zA-Z0-9_./?&=,%#-]*$#', $url)) return $url;
    if (filter_var($url, FILTER_VALIDATE_URL) && strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https') return $url;
    responseJSON('error', $esImagen ? 'La URL de imagen no es válida' : 'El enlace del botón debe ser una ancla, ruta local o URL HTTPS');
}

function normalizarOrdenHero(PDO $pdo, int $conjuntoId): void
{
    $stmt = $pdo->prepare('SELECT id FROM hero_slides WHERE conjunto_id = ? ORDER BY orden, id');
    $stmt->execute([$conjuntoId]);
    $actualizar = $pdo->prepare('UPDATE hero_slides SET orden = ? WHERE id = ? AND conjunto_id = ?');
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $orden => $id) $actualizar->execute([$orden, $id, $conjuntoId]);
}

function eliminarArchivoHeroSinReferencias(PDO $pdo, string $imagen): void
{
    if (!preg_match('#^uploads/heroes/[a-zA-Z0-9_.-]+$#', $imagen)) return;
    $referencias = $pdo->prepare('SELECT COUNT(*) FROM hero_slides WHERE imagen_url = ?');
    $referencias->execute([$imagen]);
    $ruta = __DIR__ . '/../' . $imagen;
    if ((int) $referencias->fetchColumn() === 0 && is_file($ruta)) @unlink($ruta);
}

if ($action === 'get_config') {
    $stmt = $pdo->prepare('SELECT nombre, logo_url FROM conjuntos WHERE id = ?');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetch());
}

if ($action === 'update_config') {
    $nombre = trim($_POST['nombre'] ?? '');
    $logoUrl = trim($_POST['logo_url'] ?? '');
    if ($nombre === '') responseJSON('error', 'El nombre es obligatorio');
    if ($logoUrl !== '' && !filter_var($logoUrl, FILTER_VALIDATE_URL) && !preg_match('#^uploads/logos/[a-zA-Z0-9_.-]+$#', $logoUrl)) responseJSON('error', 'La URL del logo no es válida');
    if (isset($_FILES['logo_archivo']) && $_FILES['logo_archivo']['error'] !== UPLOAD_ERR_NO_FILE) $logoUrl = guardarLogo($_FILES['logo_archivo']);
    $stmt = $pdo->prepare('UPDATE conjuntos SET nombre = ?, logo_url = ? WHERE id = ?');
    $stmt->execute([$nombre, $logoUrl ?: null, $conjuntoId]);
    responseJSON('success', 'Configuración actualizada correctamente', ['logo_url' => $logoUrl]);
}

if ($action === 'list_hero') {
    $stmt = $pdo->prepare('SELECT id, titulo, texto, etiqueta_boton, url_boton, imagen_url, orden, activo FROM hero_slides WHERE conjunto_id = ? ORDER BY orden, id');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'save_hero') {
    $id = (int) ($_POST['id'] ?? 0);
    $titulo = trim($_POST['titulo'] ?? '');
    $texto = trim($_POST['texto'] ?? '');
    $etiqueta = trim($_POST['etiqueta_boton'] ?? '');
    $urlBoton = validarUrlHero(trim($_POST['url_boton'] ?? ''));
    $imagen = validarUrlHero(trim($_POST['imagen_url'] ?? ''), true);
    $activo = filter_var($_POST['activo'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    if ($titulo === '' || mb_strlen($titulo) > 180) responseJSON('error', 'El título es obligatorio y puede tener máximo 180 caracteres');
    if (mb_strlen($texto) > 2000 || mb_strlen($etiqueta) > 80 || mb_strlen($urlBoton) > 500) responseJSON('error', 'El texto, botón o enlace supera el tamaño permitido');
    $actual = null;
    if ($id > 0) {
        $consulta = $pdo->prepare('SELECT id, imagen_url FROM hero_slides WHERE id = ? AND conjunto_id = ?');
        $consulta->execute([$id, $conjuntoId]);
        $actual = $consulta->fetch();
        if (!$actual) responseJSON('error', 'La diapositiva no pertenece a este conjunto');
    }
    if (isset($_FILES['imagen_archivo']) && $_FILES['imagen_archivo']['error'] !== UPLOAD_ERR_NO_FILE) $imagen = guardarImagenHero($_FILES['imagen_archivo']);
    if ($imagen === '') $imagen = $actual['imagen_url'] ?? '';
    if ($imagen === '') responseJSON('error', 'Carga una imagen o indica una URL de imagen válida');

    try {
        $pdo->beginTransaction();
        if ($actual) {
            $stmt = $pdo->prepare('UPDATE hero_slides SET titulo = ?, texto = ?, etiqueta_boton = ?, url_boton = ?, imagen_url = ?, activo = ? WHERE id = ? AND conjunto_id = ?');
            $stmt->execute([$titulo, $texto ?: null, $etiqueta ?: null, $urlBoton ?: null, $imagen, $activo, $id, $conjuntoId]);
        } else {
            $orden = (int) $pdo->query('SELECT COALESCE(MAX(orden), -1) + 1 FROM hero_slides WHERE conjunto_id = ' . $conjuntoId)->fetchColumn();
            $stmt = $pdo->prepare('INSERT INTO hero_slides (conjunto_id, titulo, texto, etiqueta_boton, url_boton, imagen_url, orden, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$conjuntoId, $titulo, $texto ?: null, $etiqueta ?: null, $urlBoton ?: null, $imagen, $orden, $activo]);
            $id = (int) $pdo->lastInsertId();
        }
        $pdo->commit();
        if ($actual && $actual['imagen_url'] !== $imagen) eliminarArchivoHeroSinReferencias($pdo, $actual['imagen_url']);
        responseJSON('success', 'Diapositiva guardada correctamente', ['id' => $id]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'delete_hero') {
    $id = (int) ($_POST['id'] ?? 0);
    $stmt = $pdo->prepare('SELECT imagen_url FROM hero_slides WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    $slide = $stmt->fetch();
    if (!$slide) responseJSON('error', 'Diapositiva no encontrada');
    try {
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM hero_slides WHERE id = ? AND conjunto_id = ?')->execute([$id, $conjuntoId]);
        normalizarOrdenHero($pdo, $conjuntoId);
        $pdo->commit();
        eliminarArchivoHeroSinReferencias($pdo, $slide['imagen_url']);
        responseJSON('success', 'Diapositiva eliminada. Si no quedan activas, se mostrará la portada predeterminada.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'reorder_hero') {
    $ids = json_decode($_POST['ids'] ?? '', true);
    if (!is_array($ids) || !$ids || count($ids) !== count(array_unique(array_map('intval', $ids)))) responseJSON('error', 'El orden de diapositivas no es válido');
    $ids = array_map('intval', $ids);
    $existentes = $pdo->prepare('SELECT id FROM hero_slides WHERE conjunto_id = ? ORDER BY id');
    $existentes->execute([$conjuntoId]);
    $actuales = array_map('intval', $existentes->fetchAll(PDO::FETCH_COLUMN));
    sort($ids);
    if ($ids !== $actuales) responseJSON('error', 'Debes enviar todas las diapositivas del conjunto');
    $ids = json_decode($_POST['ids'], true);
    try {
        $pdo->beginTransaction();
        $actualizar = $pdo->prepare('UPDATE hero_slides SET orden = ? WHERE id = ? AND conjunto_id = ?');
        foreach ($ids as $orden => $id) $actualizar->execute([$orden, (int) $id, $conjuntoId]);
        $pdo->commit();
        responseJSON('success', 'Orden de diapositivas actualizado');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

responseJSON('error', 'Acción no válida');
