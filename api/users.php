<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
if (!isset($_SESSION['user_id'], $_SESSION['conjunto_id'])) responseJSON('error', 'Sin permisos');

$conjuntoId = (int) $_SESSION['conjunto_id'];
$actorId = (int) $_SESSION['user_id'];
$sesion = $pdo->prepare('SELECT rol, activo FROM usuarios WHERE id = ? AND conjunto_id = ? LIMIT 1');
$sesion->execute([$actorId, $conjuntoId]);
$actor = $sesion->fetch();
if (!$actor || $actor['rol'] !== 'admin' || (int) $actor['activo'] !== 1) {
    $_SESSION = [];
    session_destroy();
    responseJSON('error', 'Sin permisos');
}

$rolesPermitidos = ['admin', 'vigilante', 'residente', 'propietario'];

function datosUsuario(): array
{
    return [
        trim($_POST['documento'] ?? ''),
        trim($_POST['nombre'] ?? ''),
        strtolower(trim($_POST['email'] ?? '')),
        trim($_POST['rol'] ?? '')
    ];
}

function validarUsuario(array $datos, array $rolesPermitidos): void
{
    [$documento, $nombre, $email, $rol] = $datos;
    if ($documento === '' || $nombre === '' || $email === '' || $rol === '') responseJSON('error', 'Documento, nombre, correo y rol son obligatorios');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) responseJSON('error', 'El correo no es válido');
    if (!in_array($rol, $rolesPermitidos, true)) responseJSON('error', 'Rol no permitido');
}

function guardarFotoVigilante(array $file, int $conjuntoId): string
{
    if ($file['error'] !== UPLOAD_ERR_OK) responseJSON('error', 'No se pudo cargar la foto');
    if ($file['size'] > 3 * 1024 * 1024) responseJSON('error', 'La foto no puede superar 3 MB');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    if (!isset($mimes[$ext]) || (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) !== $mimes[$ext]) responseJSON('error', 'La foto debe ser JPG, PNG o WEBP válida');
    $dir = __DIR__ . '/../../uploads_privados/vigilantes';
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) responseJSON('error', 'No se pudo preparar el almacenamiento de fotos');
    $name = 'vigilante_' . $conjuntoId . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) responseJSON('error', 'No se pudo guardar la foto');
    return $name;
}

if ($action === 'list') {
    $stmt = $pdo->prepare('SELECT id, rol, documento, nombre, email, activo, desactivado_en, desactivado_por, motivo_desactivacion FROM usuarios WHERE conjunto_id = ? ORDER BY nombre');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'list_vigilantes') {
    $stmt = $pdo->prepare("SELECT u.id, u.documento, u.nombre, u.email, u.contacto, u.activo, u.desactivado_en, u.desactivado_por, u.motivo_desactivacion, p.turno, p.horario, p.observaciones, CASE WHEN p.foto_archivo IS NULL OR p.foto_archivo = '' THEN 0 ELSE 1 END AS tiene_foto FROM usuarios u LEFT JOIN perfiles_vigilancia p ON p.usuario_id = u.id WHERE u.conjunto_id = ? AND u.rol = 'vigilante' ORDER BY u.nombre");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'desactivar_usuario') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') responseJSON('error', 'Método no permitido');
    $usuarioId = (int) ($_POST['usuario_id'] ?? $_POST['id'] ?? 0);
    $motivo = trim($_POST['motivo_desactivacion'] ?? '');
    if ($usuarioId <= 0) responseJSON('error', 'Usuario inválido');
    if ($usuarioId === $actorId) responseJSON('error', 'No puedes desactivarte a ti mismo');
    if (strlen($motivo) > 255) responseJSON('error', 'El motivo no puede superar 255 caracteres');

    try {
        $pdo->beginTransaction();
        $objetivo = $pdo->prepare('SELECT id, rol, activo FROM usuarios WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $objetivo->execute([$usuarioId, $conjuntoId]);
        $usuario = $objetivo->fetch();
        if (!$usuario) throw new Exception('Usuario no encontrado');
        if ((int) $usuario['activo'] !== 1) throw new Exception('El usuario ya está desactivado');
        if ($usuario['rol'] === 'admin') {
            $administradores = $pdo->prepare("SELECT id FROM usuarios WHERE conjunto_id = ? AND rol = 'admin' AND activo = 1 FOR UPDATE");
            $administradores->execute([$conjuntoId]);
            if (count($administradores->fetchAll()) <= 1) throw new Exception('No se puede desactivar el último administrador activo');
        }
        $stmt = $pdo->prepare('UPDATE usuarios SET activo = 0, desactivado_en = NOW(), desactivado_por = ?, motivo_desactivacion = ? WHERE id = ? AND conjunto_id = ? AND activo = 1');
        $stmt->execute([$actorId, $motivo === '' ? null : $motivo, $usuarioId, $conjuntoId]);
        if ($stmt->rowCount() !== 1) throw new Exception('No se pudo desactivar el usuario');
        $pdo->commit();
        responseJSON('success', 'Usuario desactivado correctamente');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'reactivar_usuario') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') responseJSON('error', 'Método no permitido');
    $usuarioId = (int) ($_POST['usuario_id'] ?? $_POST['id'] ?? 0);
    if ($usuarioId <= 0) responseJSON('error', 'Usuario inválido');

    try {
        $pdo->beginTransaction();
        $objetivo = $pdo->prepare('SELECT id, activo FROM usuarios WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $objetivo->execute([$usuarioId, $conjuntoId]);
        $usuario = $objetivo->fetch();
        if (!$usuario) throw new Exception('Usuario no encontrado');
        if ((int) $usuario['activo'] === 1) throw new Exception('El usuario ya está activo');
        $stmt = $pdo->prepare('UPDATE usuarios SET activo = 1, desactivado_en = NULL, desactivado_por = NULL, motivo_desactivacion = NULL WHERE id = ? AND conjunto_id = ? AND activo = 0');
        $stmt->execute([$usuarioId, $conjuntoId]);
        if ($stmt->rowCount() !== 1) throw new Exception('No se pudo reactivar el usuario');
        $pdo->commit();
        responseJSON('success', 'Usuario reactivado correctamente');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'ver_foto_vigilante') {
    $vigilanteId = (int) ($_GET['vigilante_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT p.foto_archivo FROM perfiles_vigilancia p JOIN usuarios u ON u.id = p.usuario_id WHERE p.usuario_id = ? AND u.conjunto_id = ? AND u.rol = 'vigilante'");
    $stmt->execute([$vigilanteId, $conjuntoId]);
    $perfil = $stmt->fetch();
    $path = $perfil ? __DIR__ . '/../../uploads_privados/vigilantes/' . basename($perfil['foto_archivo'] ?? '') : '';
    if (!$perfil || !$perfil['foto_archivo'] || !is_file($path)) {
        http_response_code(404);
        exit('Foto no encontrada');
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Content-Disposition: inline; filename="foto-vigilante.' . $ext . '"');
    readfile($path);
    exit;
}
if ($action === 'guardar_vigilante') {
    $id = (int) ($_POST['id'] ?? 0);
    $documento = trim($_POST['documento'] ?? '');
    $nombre = trim($_POST['nombre'] ?? '');
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';
    $telefono = trim($_POST['telefono'] ?? '');
    $turno = trim($_POST['turno'] ?? '');
    $horario = trim($_POST['horario'] ?? '');
    $observaciones = trim($_POST['observaciones'] ?? '');
    if ($documento === '' || $nombre === '' || $email === '') responseJSON('error', 'Documento, nombre y correo son obligatorios');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) responseJSON('error', 'El correo no es válido');
    if ($id === 0 && strlen($password) < 8) responseJSON('error', 'La contraseña inicial debe tener mínimo 8 caracteres');
    if ($id > 0 && $password !== '' && strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres');
    if (mb_strlen($telefono) > 50 || mb_strlen($turno) > 50 || mb_strlen($horario) > 150 || mb_strlen($observaciones) > 1000) responseJSON('error', 'La información del perfil excede la longitud permitida');
    $foto = isset($_FILES['foto']) && $_FILES['foto']['error'] !== UPLOAD_ERR_NO_FILE ? guardarFotoVigilante($_FILES['foto'], $conjuntoId) : null;

    try {
        $pdo->beginTransaction();
        if ($id === 0) {
            $duplicado = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR email = ?) LIMIT 1');
            $duplicado->execute([$conjuntoId, $documento, $email]);
            if ($duplicado->fetch()) throw new Exception('Documento o correo ya existe en este conjunto');
            $stmt = $pdo->prepare("INSERT INTO usuarios (conjunto_id, rol, documento, nombre, email, contacto, password_hash) VALUES (?, 'vigilante', ?, ?, ?, ?, ?)");
            $stmt->execute([$conjuntoId, $documento, $nombre, $email, $telefono ?: null, password_hash($password, PASSWORD_DEFAULT)]);
            $id = (int) $pdo->lastInsertId();
        } else {
            $existe = $pdo->prepare("SELECT id FROM usuarios WHERE id = ? AND conjunto_id = ? AND rol = 'vigilante'");
            $existe->execute([$id, $conjuntoId]);
            if (!$existe->fetch()) throw new Exception('Vigilante no encontrado');
            $duplicado = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR email = ?) AND id <> ? LIMIT 1');
            $duplicado->execute([$conjuntoId, $documento, $email, $id]);
            if ($duplicado->fetch()) throw new Exception('Documento o correo ya existe en este conjunto');
            $sql = $password === '' ? 'UPDATE usuarios SET documento = ?, nombre = ?, email = ?, contacto = ? WHERE id = ? AND conjunto_id = ?' : 'UPDATE usuarios SET documento = ?, nombre = ?, email = ?, contacto = ?, password_hash = ? WHERE id = ? AND conjunto_id = ?';
            $params = $password === '' ? [$documento, $nombre, $email, $telefono ?: null, $id, $conjuntoId] : [$documento, $nombre, $email, $telefono ?: null, password_hash($password, PASSWORD_DEFAULT), $id, $conjuntoId];
            $pdo->prepare($sql)->execute($params);
        }
        $perfil = $pdo->prepare('INSERT INTO perfiles_vigilancia (usuario_id, turno, horario, observaciones, foto_archivo) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE turno = ?, horario = ?, observaciones = ?, foto_archivo = COALESCE(?, foto_archivo)');
        $perfil->execute([$id, $turno ?: null, $horario ?: null, $observaciones ?: null, $foto, $turno ?: null, $horario ?: null, $observaciones ?: null, $foto]);
        $pdo->commit();
        responseJSON('success', $id ? 'Perfil de vigilante guardado correctamente' : 'Vigilante creado correctamente');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'crear_usuario' || $action === 'update') {
    [$documento, $nombre, $email, $rol] = datosUsuario();
    validarUsuario([$documento, $nombre, $email, $rol], $rolesPermitidos);
    $password = $_POST['password'] ?? '';
    $id = (int) ($_POST['id'] ?? 0);
    if ($action === 'crear_usuario') {
        if (strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres');
        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR email = ?) LIMIT 1');
        $stmt->execute([$conjuntoId, $documento, $email]);
        if ($stmt->fetch()) responseJSON('error', 'Documento o correo ya existe en este conjunto');
        $stmt = $pdo->prepare('INSERT INTO usuarios (conjunto_id, rol, documento, nombre, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$conjuntoId, $rol, $documento, $nombre, $email, password_hash($password, PASSWORD_DEFAULT)]);
        responseJSON('success', 'Usuario registrado correctamente');
    }
    if ($id <= 0) responseJSON('error', 'Usuario inválido');
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$id, $conjuntoId]);
    if (!$stmt->fetch()) responseJSON('error', 'Usuario no encontrado');
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR email = ?) AND id <> ? LIMIT 1');
    $stmt->execute([$conjuntoId, $documento, $email, $id]);
    if ($stmt->fetch()) responseJSON('error', 'Documento o correo ya existe en este conjunto');
    if ($password !== '' && strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres');
    $sql = $password === '' ? 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = ? WHERE id = ? AND conjunto_id = ?' : 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = ?, password_hash = ? WHERE id = ? AND conjunto_id = ?';
    $valores = $password === '' ? [$rol, $documento, $nombre, $email, $id, $conjuntoId] : [$rol, $documento, $nombre, $email, password_hash($password, PASSWORD_DEFAULT), $id, $conjuntoId];
    $pdo->prepare($sql)->execute($valores);
    responseJSON('success', 'Usuario actualizado correctamente');
}

responseJSON('error', 'Acción no válida');
