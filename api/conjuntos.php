<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id']) || $_SESSION['user_rol'] !== 'admin') responseJSON('error', 'Sin permisos');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$conjuntoId = (int) $_SESSION['conjunto_id'];

function guardarLogo(array $file): string
{
    if ($file['error'] !== UPLOAD_ERR_OK) responseJSON('error', 'No se pudo cargar el logo');
    if ($file['size'] > 3 * 1024 * 1024) responseJSON('error', 'El logo no puede superar 3MB');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $permitidos = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    if (!isset($permitidos[$ext])) responseJSON('error', 'Formato de logo no permitido');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if ($mime !== $permitidos[$ext]) responseJSON('error', 'El contenido del logo no coincide con su formato');
    $directorio = __DIR__ . '/../uploads/logos';
    if (!is_dir($directorio) && !mkdir($directorio, 0755, true)) responseJSON('error', 'No se pudo preparar el almacenamiento');
    $nombre = 'logo_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $directorio . '/' . $nombre)) responseJSON('error', 'No se pudo guardar el logo');
    return 'uploads/logos/' . $nombre;
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

responseJSON('error', 'Acción no válida');
