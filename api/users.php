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
    if ($documento === '' || $nombre === '' || $rol === '') responseJSON('error', 'Documento, nombre y rol son obligatorios');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) responseJSON('error', 'El correo no es válido');
    if (in_array($rol, ['admin', 'vigilante'], true) && $email === '') responseJSON('error', 'El correo es obligatorio para administradores y vigilantes');
    if (!in_array($rol, $rolesPermitidos, true)) responseJSON('error', 'Rol no permitido');
}

function validarInmuebleUsuario(PDO $pdo, int $inmuebleId, int $conjuntoId): void
{
    if ($inmuebleId <= 0) responseJSON('error', 'Selecciona el apartamento o casa asociado');
    $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$inmuebleId, $conjuntoId]);
    if (!$stmt->fetch()) responseJSON('error', 'El apartamento o casa no pertenece a este conjunto');
}

function vincularUsuarioInmueble(PDO $pdo, int $usuarioId, int $inmuebleId, string $tipoRelacion): void
{
    $existe = $pdo->prepare('SELECT id FROM relacion_inmuebles_usuarios WHERE usuario_id = ? AND inmueble_id = ? AND tipo_relacion = ? LIMIT 1');
    $existe->execute([$usuarioId, $inmuebleId, $tipoRelacion]);
    if (!$existe->fetch()) {
        $pdo->prepare('INSERT INTO relacion_inmuebles_usuarios (usuario_id, inmueble_id, tipo_relacion) VALUES (?, ?, ?)')->execute([$usuarioId, $inmuebleId, $tipoRelacion]);
    }
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
    $stmt = $pdo->prepare("SELECT u.id, u.rol, u.documento, u.nombre, u.email, u.contacto, u.activo, u.desactivado_en, u.desactivado_por, u.motivo_desactivacion, CASE WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 0 ELSE 1 END AS tiene_cuenta, MIN(r.inmueble_id) AS inmueble_id, GROUP_CONCAT(DISTINCT CONCAT(COALESCE(i.torre, ''), ' ', COALESCE(i.nomenclatura, i.apartamento, '')) ORDER BY i.torre, i.nomenclatura SEPARATOR ' · ') AS inmuebles FROM usuarios u LEFT JOIN relacion_inmuebles_usuarios r ON r.usuario_id = u.id LEFT JOIN inmuebles i ON i.id = r.inmueble_id AND i.conjunto_id = u.conjunto_id WHERE u.conjunto_id = ? GROUP BY u.id, u.rol, u.documento, u.nombre, u.email, u.contacto, u.activo, u.desactivado_en, u.desactivado_por, u.motivo_desactivacion, u.password_hash ORDER BY u.nombre");
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
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $sinAcceso = filter_var($_POST['sin_acceso'] ?? false, FILTER_VALIDATE_BOOLEAN);
    if (in_array($rol, ['admin', 'vigilante'], true)) $sinAcceso = false;
    $requiereInmueble = in_array($rol, ['residente', 'propietario'], true);
    $requiereAcceso = !$sinAcceso;
    if ($requiereInmueble) validarInmuebleUsuario($pdo, $inmuebleId, $conjuntoId);
    if ($action === 'crear_usuario' && $requiereAcceso && strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres cuando se crea una cuenta de acceso');
    if ($password !== '' && strlen($password) < 8) responseJSON('error', 'La contraseña debe tener mínimo 8 caracteres');

    try {
        $pdo->beginTransaction();
        if ($action === 'crear_usuario') {
            $duplicado = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR (? <> "" AND email = ?)) LIMIT 1');
            $duplicado->execute([$conjuntoId, $documento, $email, $email]);
            if ($duplicado->fetch()) throw new Exception('Documento o correo ya existe en este conjunto');
            $hash = $sinAcceso ? null : password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare('INSERT INTO usuarios (conjunto_id, rol, documento, nombre, email, password_hash) VALUES (?, ?, ?, ?, NULLIF(?, ""), ?)');
            $stmt->execute([$conjuntoId, $rol, $documento, $nombre, $email, $hash]);
            $id = (int) $pdo->lastInsertId();
            if ($requiereInmueble) vincularUsuarioInmueble($pdo, $id, $inmuebleId, $rol);
            $pdo->commit();
            responseJSON('success', $sinAcceso ? 'Persona registrada y enlazada al inmueble sin acceso al portal' : 'Usuario registrado y enlazado correctamente');
        }

        if ($id <= 0) throw new Exception('Usuario inválido');
        $actual = $pdo->prepare('SELECT id, rol FROM usuarios WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $actual->execute([$id, $conjuntoId]);
        $usuarioActual = $actual->fetch();
        if (!$usuarioActual) throw new Exception('Usuario no encontrado');
        if ($usuarioActual['rol'] === 'admin' && $rol !== 'admin') {
            $administradores = $pdo->prepare("SELECT id FROM usuarios WHERE conjunto_id = ? AND rol = 'admin' AND activo = 1 FOR UPDATE");
            $administradores->execute([$conjuntoId]);
            if (count($administradores->fetchAll()) <= 1) throw new Exception('No se puede cambiar el rol del último administrador activo');
        }
        $duplicado = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND (documento = ? OR (? <> "" AND email = ?)) AND id <> ? LIMIT 1');
        $duplicado->execute([$conjuntoId, $documento, $email, $email, $id]);
        if ($duplicado->fetch()) throw new Exception('Documento o correo ya existe en este conjunto');
        $hash = $sinAcceso ? null : ($password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null);
        if ($sinAcceso) {
            $sql = 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = NULLIF(?, ""), password_hash = NULL WHERE id = ? AND conjunto_id = ?';
            $valores = [$rol, $documento, $nombre, $email, $id, $conjuntoId];
        } elseif ($password !== '') {
            $sql = 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = NULLIF(?, ""), password_hash = ? WHERE id = ? AND conjunto_id = ?';
            $valores = [$rol, $documento, $nombre, $email, $hash, $id, $conjuntoId];
        } else {
            $sql = 'UPDATE usuarios SET rol = ?, documento = ?, nombre = ?, email = NULLIF(?, "") WHERE id = ? AND conjunto_id = ?';
            $valores = [$rol, $documento, $nombre, $email, $id, $conjuntoId];
        }
        $pdo->prepare($sql)->execute($valores);
        if ($requiereInmueble) vincularUsuarioInmueble($pdo, $id, $inmuebleId, $rol);
        $pdo->commit();
        responseJSON('success', 'Usuario actualizado correctamente');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

responseJSON('error', 'Acción no válida');
