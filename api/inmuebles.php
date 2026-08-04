<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');
if (!isset($_SESSION['user_id'])) responseJSON('error', 'No autorizado');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function getInmuebleId(PDO $pdo, int $userId, int $conjuntoId, int $solicitado = 0): ?int
{
    if ($solicitado > 0) {
        $stmt = $pdo->prepare('SELECT r.inmueble_id FROM relacion_inmuebles_usuarios r JOIN inmuebles i ON i.id = r.inmueble_id WHERE r.usuario_id = ? AND r.inmueble_id = ? AND i.conjunto_id = ? LIMIT 1');
        $stmt->execute([$userId, $solicitado, $conjuntoId]);
    } else {
        $stmt = $pdo->prepare('SELECT r.inmueble_id FROM relacion_inmuebles_usuarios r JOIN inmuebles i ON i.id = r.inmueble_id WHERE r.usuario_id = ? AND i.conjunto_id = ? ORDER BY r.inmueble_id LIMIT 1');
        $stmt->execute([$userId, $conjuntoId]);
    }
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function inmuebleDelConjunto(PDO $pdo, int $inmuebleId, int $conjuntoId): bool
{
    $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $stmt->execute([$inmuebleId, $conjuntoId]);
    return (bool) $stmt->fetch();
}

function validarMascota(array $entrada): array
{
    $tipo = trim($entrada['tipo'] ?? '');
    $nombre = trim($entrada['nombre'] ?? '');
    $raza = trim($entrada['raza'] ?? '');
    $descripcion = trim($entrada['descripcion'] ?? '');
    if ($tipo === '' || $nombre === '') responseJSON('error', 'El tipo y el nombre de la mascota son obligatorios');
    if (mb_strlen($tipo) > 50 || mb_strlen($nombre) > 100 || mb_strlen($raza) > 100 || mb_strlen($descripcion) > 5000) responseJSON('error', 'La información de la mascota excede la longitud permitida');
    return [$tipo, $nombre, $raza ?: null, $descripcion ?: null];
}

function espaciosActivosInmueble(PDO $pdo, int $inmuebleId): array
{
    $stmt = $pdo->prepare("SELECT a.id AS asignacion_id, p.id, p.codigo, p.tipo, p.clase_espacio, p.sotano, p.ubicacion, p.observaciones FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id WHERE a.inmueble_id = ? AND a.retirado_en IS NULL ORDER BY FIELD(p.clase_espacio, 'carro', 'moto', 'bodega'), p.codigo");
    $stmt->execute([$inmuebleId]);
    return $stmt->fetchAll();
}

if ($action === 'list') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $stmt = $pdo->prepare("SELECT i.*, (SELECT COUNT(*) FROM vehiculos v WHERE v.inmueble_id = i.id) AS num_vehiculos, (SELECT COUNT(*) FROM mascotas m WHERE m.inmueble_id = i.id) AS num_mascotas, (SELECT COUNT(DISTINCT r.usuario_id) FROM relacion_inmuebles_usuarios r WHERE r.inmueble_id = i.id) AS num_personas, (SELECT COUNT(DISTINCT r.usuario_id) FROM relacion_inmuebles_usuarios r WHERE r.inmueble_id = i.id AND r.tipo_relacion = 'residente') AS num_residentes, (SELECT COUNT(DISTINCT r.usuario_id) FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.inmueble_id = i.id AND u.password_hash IS NOT NULL AND u.password_hash <> '') AS num_cuentas, (SELECT GROUP_CONCAT(CONCAT(p.codigo, '|', p.clase_espacio) ORDER BY FIELD(p.clase_espacio, 'carro', 'moto', 'bodega'), p.codigo SEPARATOR '||') FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id WHERE a.inmueble_id = i.id AND a.retirado_en IS NULL) AS espacios_asignados FROM inmuebles i WHERE i.conjunto_id = ? ORDER BY COALESCE(i.torre, i.nomenclatura), i.apartamento");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'detalle') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $inmuebleId = (int) ($_GET['inmueble_id'] ?? 0);
    if (!inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Inmueble no encontrado');
    $inmueble = $pdo->prepare('SELECT * FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $inmueble->execute([$inmuebleId, $conjuntoId]);
    $personas = $pdo->prepare("SELECT r.id AS relacion_id, r.tipo_relacion, u.id, u.nombre, u.documento, u.email, u.contacto, u.activo, CASE WHEN u.password_hash IS NULL OR u.password_hash = '' THEN 0 ELSE 1 END AS tiene_cuenta FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.inmueble_id = ? AND u.conjunto_id = ? ORDER BY FIELD(r.tipo_relacion, 'propietario', 'residente'), u.nombre");
    $personas->execute([$inmuebleId, $conjuntoId]);
    $vehiculos = $pdo->prepare('SELECT id, inmueble_id, placa, tipo, marca, linea FROM vehiculos WHERE inmueble_id = ? ORDER BY placa');
    $vehiculos->execute([$inmuebleId]);
    $mascotas = $pdo->prepare('SELECT id, inmueble_id, tipo, nombre, raza, descripcion FROM mascotas WHERE inmueble_id = ? ORDER BY nombre, id DESC');
    $mascotas->execute([$inmuebleId]);
    responseJSON('success', '', ['inmueble' => $inmueble->fetch(), 'espacios' => espaciosActivosInmueble($pdo, $inmuebleId), 'personas' => $personas->fetchAll(), 'vehiculos' => $vehiculos->fetchAll(), 'mascotas' => $mascotas->fetchAll()]);
}

if ($action === 'vincular_usuario') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $usuarioId = (int) ($_POST['usuario_id'] ?? 0);
    $tipoRelacion = $_POST['tipo_relacion'] ?? '';
    if (!$usuarioId || !in_array($tipoRelacion, ['residente', 'propietario'], true) || !inmuebleDelConjunto($pdo, $inmuebleId, $conjuntoId)) responseJSON('error', 'Selecciona una persona, una relación y un inmueble válidos');
    $usuario = $pdo->prepare('SELECT id, rol FROM usuarios WHERE id = ? AND conjunto_id = ?');
    $usuario->execute([$usuarioId, $conjuntoId]);
    $persona = $usuario->fetch();
    if (!$persona || $persona['rol'] !== $tipoRelacion) responseJSON('error', 'La persona debe tener el mismo rol que la relación seleccionada');
    $existe = $pdo->prepare('SELECT id FROM relacion_inmuebles_usuarios WHERE inmueble_id = ? AND usuario_id = ? AND tipo_relacion = ? LIMIT 1');
    $existe->execute([$inmuebleId, $usuarioId, $tipoRelacion]);
    if (!$existe->fetch()) $pdo->prepare('INSERT INTO relacion_inmuebles_usuarios (inmueble_id, usuario_id, tipo_relacion) VALUES (?, ?, ?)')->execute([$inmuebleId, $usuarioId, $tipoRelacion]);
    responseJSON('success', 'Persona enlazada al inmueble');
}

if ($action === 'actualizar_vinculo') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $relacionId = (int) ($_POST['relacion_id'] ?? 0);
    $nuevoInmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $tipoRelacion = $_POST['tipo_relacion'] ?? '';
    if (!$relacionId || !$nuevoInmuebleId || !in_array($tipoRelacion, ['residente', 'propietario'], true)) responseJSON('error', 'Selecciona una unidad y una relación válidas');
    try {
        $pdo->beginTransaction();
        $origen = $pdo->prepare('SELECT r.id, r.usuario_id, u.rol FROM relacion_inmuebles_usuarios r JOIN usuarios u ON u.id = r.usuario_id WHERE r.id = ? AND u.conjunto_id = ? FOR UPDATE');
        $origen->execute([$relacionId, $conjuntoId]);
        $vinculo = $origen->fetch();
        if (!$vinculo) throw new RuntimeException('Vínculo no encontrado');
        if ($vinculo['rol'] !== $tipoRelacion) throw new RuntimeException('El tipo de relación debe coincidir con el rol actual de la persona');
        if (!inmuebleDelConjunto($pdo, $nuevoInmuebleId, $conjuntoId)) throw new RuntimeException('La unidad seleccionada no pertenece al conjunto');
        $duplicado = $pdo->prepare('SELECT id FROM relacion_inmuebles_usuarios WHERE inmueble_id = ? AND usuario_id = ? AND tipo_relacion = ? AND id <> ? LIMIT 1');
        $duplicado->execute([$nuevoInmuebleId, $vinculo['usuario_id'], $tipoRelacion, $relacionId]);
        if ($duplicado->fetch()) throw new RuntimeException('La persona ya tiene este vínculo con la unidad seleccionada');
        $pdo->prepare('UPDATE relacion_inmuebles_usuarios SET inmueble_id = ?, tipo_relacion = ? WHERE id = ?')->execute([$nuevoInmuebleId, $tipoRelacion, $relacionId]);
        $pdo->prepare('INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, ?, ?, ?)')->execute([$userId, 'actualizar_vinculo', 'inmueble_usuario', 'Vínculo ' . $relacionId . ' trasladado a inmueble ' . $nuevoInmuebleId]);
        $pdo->commit();
        responseJSON('success', 'Vínculo actualizado correctamente');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}

if ($action === 'desvincular_usuario') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $relacionId = (int) ($_POST['relacion_id'] ?? 0);
    if (!$relacionId) responseJSON('error', 'Vínculo no válido');
    $vinculo = $pdo->prepare('SELECT r.id FROM relacion_inmuebles_usuarios r JOIN inmuebles i ON i.id = r.inmueble_id WHERE r.id = ? AND i.conjunto_id = ?');
    $vinculo->execute([$relacionId, $conjuntoId]);
    if (!$vinculo->fetch()) responseJSON('error', 'Vínculo no encontrado');
    $pdo->prepare('DELETE FROM relacion_inmuebles_usuarios WHERE id = ?')->execute([$relacionId]);
    $pdo->prepare('INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, ?, ?, ?)')->execute([$userId, 'desvincular', 'inmueble_usuario', 'Vínculo ' . $relacionId . ' eliminado sin borrar la persona']);
    responseJSON('success', 'Persona desvinculada de la unidad. Su ficha y acceso se conservaron.');
}

if ($action === 'guardar_inmueble') {
    if ($rol !== 'admin') responseJSON('error', 'Sin permisos');
    $id = (int) ($_POST['id'] ?? 0);
    $tipo = $_POST['tipo_unidad'] ?? 'apartamento';
    $torre = trim($_POST['torre'] ?? '');
    $nomenclatura = trim($_POST['nomenclatura'] ?? '');
    $parqueadero = trim($_POST['parqueadero'] ?? '');
    $coeficiente = (float) ($_POST['coeficiente'] ?? 0);
    $mora = (float) ($_POST['mora_actual'] ?? 0);
    if (!in_array($tipo, ['apartamento', 'casa'], true) || $nomenclatura === '') responseJSON('error', 'Tipo y nomenclatura son obligatorios');
    if ($coeficiente < 0 || $mora < 0) responseJSON('error', 'Coeficiente y mora deben ser positivos');
    if ($id) {
        if (!inmuebleDelConjunto($pdo, $id, $conjuntoId)) responseJSON('error', 'Inmueble no encontrado');
        $duplicado = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND nomenclatura = ? AND id <> ?');
        $duplicado->execute([$conjuntoId, $nomenclatura, $id]);
        if ($duplicado->fetch()) responseJSON('error', 'La nomenclatura ya existe');
        $pdo->prepare('UPDATE inmuebles SET tipo_unidad = ?, torre = ?, apartamento = ?, nomenclatura = ?, parqueadero = ?, coeficiente = ?, mora_actual = ? WHERE id = ? AND conjunto_id = ?')->execute([$tipo, $torre ?: null, $nomenclatura, $nomenclatura, $parqueadero ?: null, $coeficiente, $mora, $id, $conjuntoId]);
        responseJSON('success', 'Inmueble actualizado', ['id' => $id]);
    }
    $duplicado = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND nomenclatura = ?');
    $duplicado->execute([$conjuntoId, $nomenclatura]);
    if ($duplicado->fetch()) responseJSON('error', 'La nomenclatura ya existe');
    $pdo->prepare('INSERT INTO inmuebles (conjunto_id, tipo_unidad, torre, apartamento, nomenclatura, parqueadero, coeficiente, mora_actual) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$conjuntoId, $tipo, $torre ?: null, $nomenclatura, $nomenclatura, $parqueadero ?: null, $coeficiente, $mora]);
    responseJSON('success', 'Inmueble creado', ['id' => (int) $pdo->lastInsertId()]);
}

function activoGestionable(PDO $pdo, string $tabla, int $activoId, int $conjuntoId, int $userId, string $rol): ?array
{
    if (!in_array($tabla, ['vehiculos', 'mascotas'], true)) return null;
    $sql = "SELECT a.*, i.id AS inmueble_id FROM $tabla a JOIN inmuebles i ON i.id = a.inmueble_id WHERE a.id = ? AND i.conjunto_id = ?";
    $params = [$activoId, $conjuntoId];
    if ($rol !== 'admin') {
        if (!in_array($rol, ['residente', 'propietario'], true)) return null;
        $sql .= ' AND EXISTS (SELECT 1 FROM relacion_inmuebles_usuarios r WHERE r.inmueble_id = i.id AND r.usuario_id = ?)';
        $params[] = $userId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch() ?: null;
}

if ($action === 'actualizar_vehiculo') {
    $id = (int) ($_POST['vehiculo_id'] ?? 0);
    $vehiculo = activoGestionable($pdo, 'vehiculos', $id, $conjuntoId, $userId, $rol);
    $placa = strtoupper(trim($_POST['placa'] ?? ''));
    $tipo = trim($_POST['tipo'] ?? '');
    if (!$vehiculo || $placa === '' || $tipo === '') responseJSON('error', 'Vehículo no encontrado o datos incompletos');
    if (mb_strlen($placa) > 20 || mb_strlen($tipo) > 50 || mb_strlen(trim($_POST['marca'] ?? '')) > 50 || mb_strlen(trim($_POST['linea'] ?? '')) > 50) responseJSON('error', 'La información del vehículo excede la longitud permitida');
    $pdo->prepare('UPDATE vehiculos SET placa = ?, tipo = ?, marca = ?, linea = ? WHERE id = ?')->execute([$placa, $tipo, trim($_POST['marca'] ?? '') ?: null, trim($_POST['linea'] ?? '') ?: null, $id]);
    responseJSON('success', 'Vehículo actualizado correctamente');
}
if ($action === 'eliminar_vehiculo') {
    $id = (int) ($_POST['vehiculo_id'] ?? 0);
    if (!activoGestionable($pdo, 'vehiculos', $id, $conjuntoId, $userId, $rol)) responseJSON('error', 'Vehículo no encontrado o sin permisos');
    $pdo->prepare('DELETE FROM vehiculos WHERE id = ?')->execute([$id]);
    responseJSON('success', 'Vehículo eliminado correctamente');
}
if ($action === 'actualizar_mascota') {
    $id = (int) ($_POST['mascota_id'] ?? 0);
    if (!activoGestionable($pdo, 'mascotas', $id, $conjuntoId, $userId, $rol)) responseJSON('error', 'Mascota no encontrada o sin permisos');
    [$tipo, $nombre, $raza, $descripcion] = validarMascota($_POST);
    $pdo->prepare('UPDATE mascotas SET tipo = ?, nombre = ?, raza = ?, descripcion = ? WHERE id = ?')->execute([$tipo, $nombre, $raza, $descripcion, $id]);
    responseJSON('success', 'Mascota actualizada correctamente');
}
if ($action === 'eliminar_mascota') {
    $id = (int) ($_POST['mascota_id'] ?? 0);
    if (!activoGestionable($pdo, 'mascotas', $id, $conjuntoId, $userId, $rol)) responseJSON('error', 'Mascota no encontrada o sin permisos');
    $pdo->prepare('DELETE FROM mascotas WHERE id = ?')->execute([$id]);
    responseJSON('success', 'Mascota eliminada correctamente');
}

if ($action === 'mis_inmuebles') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Sin permisos');
    $stmt = $pdo->prepare('SELECT DISTINCT i.id, i.tipo_unidad, i.torre, i.nomenclatura, i.apartamento FROM inmuebles i JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id WHERE r.usuario_id = ? AND i.conjunto_id = ? ORDER BY i.torre, i.nomenclatura');
    $stmt->execute([$userId, $conjuntoId]);
    $inmuebles = $stmt->fetchAll();
    foreach ($inmuebles as &$inmueble) $inmueble['espacios'] = espaciosActivosInmueble($pdo, (int) $inmueble['id']);
    unset($inmueble);
    responseJSON('success', '', $inmuebles);
}

if ($action === 'mis_espacios') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Sin permisos');
    $stmt = $pdo->prepare("SELECT DISTINCT p.id, p.codigo, p.tipo, p.clase_espacio, p.sotano, p.ubicacion, p.observaciones, i.torre, i.nomenclatura, i.apartamento FROM asignaciones_parqueadero a JOIN parqueaderos p ON p.id = a.parqueadero_id JOIN inmuebles i ON i.id = a.inmueble_id JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id WHERE r.usuario_id = ? AND i.conjunto_id = ? AND a.retirado_en IS NULL ORDER BY FIELD(p.clase_espacio, 'carro', 'moto', 'bodega'), p.sotano, p.codigo");
    $stmt->execute([$userId, $conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}

if ($action === 'mis_vehiculos' || $action === 'mis_mascotas') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Sin permisos');
    $tabla = $action === 'mis_vehiculos' ? 'vehiculos' : 'mascotas';
    $stmt = $pdo->prepare("SELECT a.*, i.torre, i.nomenclatura, i.apartamento FROM $tabla a JOIN inmuebles i ON i.id = a.inmueble_id WHERE i.conjunto_id = ? AND EXISTS (SELECT 1 FROM relacion_inmuebles_usuarios r WHERE r.inmueble_id = i.id AND r.usuario_id = ?) ORDER BY a.id DESC");
    $stmt->execute([$conjuntoId, $userId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'add_vehiculo') {
    $inmuebleId = getInmuebleId($pdo, $userId, $conjuntoId, (int) ($_POST['inmueble_id'] ?? 0));
    $placa = strtoupper(trim($_POST['placa'] ?? ''));
    $tipo = trim($_POST['tipo'] ?? '');
    if (!$inmuebleId || $placa === '' || $tipo === '') responseJSON('error', 'Selecciona una unidad, placa y tipo válidos');
    if (mb_strlen($placa) > 20 || mb_strlen($tipo) > 50 || mb_strlen(trim($_POST['marca'] ?? '')) > 50 || mb_strlen(trim($_POST['linea'] ?? '')) > 50) responseJSON('error', 'La información del vehículo excede la longitud permitida');
    $pdo->prepare('INSERT INTO vehiculos (inmueble_id, placa, tipo, marca, linea) VALUES (?, ?, ?, ?, ?)')->execute([$inmuebleId, $placa, $tipo, trim($_POST['marca'] ?? '') ?: null, trim($_POST['linea'] ?? '') ?: null]);
    responseJSON('success', 'Vehículo registrado');
}
if ($action === 'add_mascota') {
    $inmuebleId = getInmuebleId($pdo, $userId, $conjuntoId, (int) ($_POST['inmueble_id'] ?? 0));
    if (!$inmuebleId) responseJSON('error', 'Selecciona una unidad válida');
    [$tipo, $nombre, $raza, $descripcion] = validarMascota($_POST);
    $pdo->prepare('INSERT INTO mascotas (inmueble_id, tipo, nombre, raza, descripcion) VALUES (?, ?, ?, ?, ?)')->execute([$inmuebleId, $tipo, $nombre, $raza, $descripcion]);
    responseJSON('success', 'Mascota registrada');
}
responseJSON('error', 'Acción no válida');
