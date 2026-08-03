<?php
session_start();
require_once 'config.php';
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    responseJSON('error', 'No autorizado');
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$userId = (int) $_SESSION['user_id'];
$rol = $_SESSION['user_rol'];
$conjuntoId = (int) $_SESSION['conjunto_id'];

function inmuebleUsuario(PDO $pdo, int $userId, int $conjuntoId): ?array
{
    $stmt = $pdo->prepare('SELECT i.id, i.mora_actual, i.torre, i.apartamento, i.nomenclatura FROM inmuebles i JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id WHERE r.usuario_id = ? AND i.conjunto_id = ? LIMIT 1');
    $stmt->execute([$userId, $conjuntoId]);
    return $stmt->fetch() ?: null;
}
function guardarSoporte(array $file, int $conjuntoId): string
{
    if ($file['error'] !== UPLOAD_ERR_OK) responseJSON('error', 'No se pudo cargar el soporte');
    if ($file['size'] > 5 * 1024 * 1024) responseJSON('error', 'El soporte no puede superar 5MB');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'pdf' => 'application/pdf'];
    if (!isset($mimes[$ext]) || (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) !== $mimes[$ext]) responseJSON('error', 'Formato de soporte no permitido');
    $dir = __DIR__ . '/../../uploads_privados/soportes';
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) responseJSON('error', 'No se pudo preparar el almacenamiento');
    $name = 'soporte_' . $conjuntoId . '_' . bin2hex(random_bytes(16)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) responseJSON('error', 'No se pudo guardar el soporte');
    return $name;
}

if ($action === 'mi_deuda') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Permiso denegado');
    $cuenta = inmuebleUsuario($pdo, $userId, $conjuntoId);
    if (!$cuenta) responseJSON('success', '', ['mora_actual' => 0, 'inmueble' => null]);
    responseJSON('success', '', ['mora_actual' => (float)$cuenta['mora_actual'], 'inmueble' => $cuenta]);
}

if ($action === 'mis_pagos') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Permiso denegado');
    $cuenta = inmuebleUsuario($pdo, $userId, $conjuntoId);
    if (!$cuenta) responseJSON('error', 'No tienes un inmueble asignado');
    $pagos = $pdo->prepare('SELECT p.id, p.valor, p.metodo_pago, p.referencia, p.descripcion, p.soporte_archivo, p.estado, p.fecha_pago, u.nombre AS registrado_por_nombre FROM pagos p LEFT JOIN usuarios u ON u.id = p.registrado_por WHERE p.inmueble_id = ? ORDER BY p.fecha_pago DESC');
    $pagos->execute([$cuenta['id']]);
    $cuotas = $pdo->prepare('SELECT mes, anio, valor, estado, fecha_generacion FROM cuotas_administracion WHERE inmueble_id = ? ORDER BY anio DESC, mes DESC LIMIT 12');
    $cuotas->execute([$cuenta['id']]);
    $proxima = $pdo->prepare('SELECT cuota_administracion FROM inmuebles WHERE id = ? AND conjunto_id = ?');
    $proxima->execute([$cuenta['id'], $conjuntoId]);
    responseJSON('success', '', ['cuenta' => $cuenta, 'historial' => $pagos->fetchAll(), 'cuotas' => $cuotas->fetchAll(), 'proxima_cuota' => (float) (($proxima->fetch()['cuota_administracion'] ?? 0))]);
}
if ($action === 'reportar_pago') {
    if (!in_array($rol, ['residente', 'propietario'], true)) responseJSON('error', 'Permiso denegado');
    $valor = (float) ($_POST['valor'] ?? 0);
    $metodo = $_POST['metodo'] ?? '';
    $referencia = trim($_POST['referencia'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    if ($valor <= 0 || $referencia === '') responseJSON('error', 'Valor y referencia son obligatorios');
    if (!in_array($metodo, ['transferencia', 'consignacion', 'pse'], true)) responseJSON('error', 'Método de pago inválido');
    $cuenta = inmuebleUsuario($pdo, $userId, $conjuntoId);
    if (!$cuenta) responseJSON('error', 'No tienes un inmueble asignado');
    $soporte = isset($_FILES['soporte']) && $_FILES['soporte']['error'] !== UPLOAD_ERR_NO_FILE ? guardarSoporte($_FILES['soporte'], $conjuntoId) : null;
    $stmt = $pdo->prepare("INSERT INTO pagos (inmueble_id, valor, metodo_pago, referencia, descripcion, soporte_archivo, registrado_por, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')");
    $stmt->execute([$cuenta['id'], $valor, $metodo, $referencia, $descripcion ?: null, $soporte, $userId]);
    responseJSON('success', 'Pago reportado. Está pendiente de aprobación');
}
if ($action === 'ver_soporte') {
    $pagoId = (int) ($_GET['pago_id'] ?? 0);
    $sql = $rol === 'admin' ? 'SELECT p.soporte_archivo FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE p.id = ? AND i.conjunto_id = ?' : 'SELECT p.soporte_archivo FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id WHERE p.id = ? AND r.usuario_id = ? AND i.conjunto_id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($rol === 'admin' ? [$pagoId, $conjuntoId] : [$pagoId, $userId, $conjuntoId]);
    $row = $stmt->fetch();
    $path = $row ? __DIR__ . '/../../uploads_privados/soportes/' . basename($row['soporte_archivo'] ?? '') : '';
    if (!$row || !$row['soporte_archivo'] || !is_file($path)) {
        http_response_code(404);
        exit('Soporte no encontrado');
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'pdf' => 'application/pdf'];
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('Content-Disposition: inline; filename="soporte.' . $ext . '"');
    readfile($path);
    exit;
}

if ($rol !== 'admin') responseJSON('error', 'Permiso denegado');
if ($action === 'resumen_cartera') {
    $general = $pdo->prepare('SELECT COALESCE(SUM(mora_actual), 0) AS total_cartera, SUM(mora_actual > 0) AS inmuebles_en_mora, COALESCE(SUM(cuota_administracion), 0) AS proximo_recaudo FROM inmuebles WHERE conjunto_id = ?');
    $general->execute([$conjuntoId]);
    $pagos = $pdo->prepare("SELECT SUM(estado = 'pendiente') AS pagos_pendientes, SUM(estado = 'aprobado') AS pagos_aprobados FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE i.conjunto_id = ?");
    $pagos->execute([$conjuntoId]);
    $cuotas = $pdo->prepare("SELECT COUNT(*) AS cuotas_generadas, COALESCE(SUM(valor), 0) AS valor_cuotas FROM cuotas_administracion c JOIN inmuebles i ON i.id = c.inmueble_id WHERE i.conjunto_id = ? AND c.mes = MONTH(CURRENT_DATE) AND c.anio = YEAR(CURRENT_DATE)");
    $cuotas->execute([$conjuntoId]);
    responseJSON('success', '', array_merge($general->fetch() ?: [], $pagos->fetch() ?: [], $cuotas->fetch() ?: []));
}
if ($action === 'cartera') {
    $stmt = $pdo->prepare("SELECT i.id, i.torre, i.apartamento, i.nomenclatura, i.mora_actual, GROUP_CONCAT(DISTINCT u.nombre ORDER BY u.nombre SEPARATOR ', ') AS propietario_nombre FROM inmuebles i LEFT JOIN relacion_inmuebles_usuarios r ON r.inmueble_id = i.id AND r.tipo_relacion = 'propietario' LEFT JOIN usuarios u ON u.id = r.usuario_id WHERE i.conjunto_id = ? AND i.mora_actual > 0 GROUP BY i.id, i.torre, i.apartamento, i.nomenclatura, i.mora_actual ORDER BY i.mora_actual DESC");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'pagos_pendientes') {
    $stmt = $pdo->prepare("SELECT p.id, p.valor, p.metodo_pago, p.referencia, p.descripcion, p.soporte_archivo, p.fecha_pago, i.torre, i.apartamento, i.nomenclatura, u.nombre AS residente FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id LEFT JOIN usuarios u ON u.id = p.registrado_por WHERE p.estado = 'pendiente' AND i.conjunto_id = ? ORDER BY p.fecha_pago");
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'historial_pagos') {
    $stmt = $pdo->prepare('SELECT p.*, i.torre, i.apartamento, i.nomenclatura, u.nombre AS registrado_por_nombre FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id LEFT JOIN usuarios u ON u.id = p.registrado_por WHERE i.conjunto_id = ? ORDER BY p.fecha_pago DESC LIMIT 100');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetchAll());
}
if ($action === 'aprobar_pago') {
    $id = (int) ($_POST['pago_id'] ?? 0);
    $estado = $_POST['estado'] ?? '';
    if (!in_array($estado, ['aprobado', 'rechazado'], true)) responseJSON('error', 'Estado inválido');
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT p.inmueble_id, p.valor FROM pagos p JOIN inmuebles i ON i.id = p.inmueble_id WHERE p.id = ? AND i.conjunto_id = ? AND p.estado = ? FOR UPDATE');
        $stmt->execute([$id, $conjuntoId, 'pendiente']);
        $pago = $stmt->fetch();
        if (!$pago) throw new Exception('Pago no encontrado o ya procesado');
        $pdo->prepare('UPDATE pagos SET estado = ? WHERE id = ?')->execute([$estado, $id]);
        if ($estado === 'aprobado') $pdo->prepare('UPDATE inmuebles SET mora_actual = GREATEST(0, mora_actual - ?) WHERE id = ?')->execute([$pago['valor'], $pago['inmueble_id']]);
        $pdo->commit();
        responseJSON('success', 'Pago procesado');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'registrar_pago') {
    $inmuebleId = (int) ($_POST['inmueble_id'] ?? 0);
    $valor = (float) ($_POST['valor'] ?? 0);
    $metodo = $_POST['metodo'] ?? 'transferencia';
    $referencia = trim($_POST['referencia'] ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    if ($inmuebleId <= 0 || $valor <= 0 || !in_array($metodo, ['transferencia', 'efectivo', 'pse', 'consignacion'], true)) responseJSON('error', 'Datos de pago inválidos');
    $soporte = isset($_FILES['soporte']) && $_FILES['soporte']['error'] !== UPLOAD_ERR_NO_FILE ? guardarSoporte($_FILES['soporte'], $conjuntoId) : null;
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE id = ? AND conjunto_id = ? FOR UPDATE');
        $stmt->execute([$inmuebleId, $conjuntoId]);
        if (!$stmt->fetch()) throw new Exception('Inmueble no encontrado');
        $pdo->prepare("INSERT INTO pagos (inmueble_id, valor, metodo_pago, referencia, descripcion, soporte_archivo, registrado_por, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado')")->execute([$inmuebleId, $valor, $metodo, $referencia ?: null, $descripcion ?: null, $soporte, $userId]);
        $pdo->prepare('UPDATE inmuebles SET mora_actual = GREATEST(0, mora_actual - ?) WHERE id = ?')->execute([$valor, $inmuebleId]);
        $pdo->commit();
        responseJSON('success', 'Pago registrado');
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'cuotas_configuradas') {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 50)));
    $busqueda = trim($_GET['q'] ?? '');
    $bloque = trim($_GET['bloque'] ?? '');
    $estadoCuota = $_GET['estado_cuota'] ?? 'todas';
    if (strlen($busqueda) > 100 || !in_array($estadoCuota, ['todas', 'configurada', 'sin_configurar'], true)) responseJSON('error', 'Filtros inválidos');

    $bloqueSql = "COALESCE(NULLIF(i.torre, ''), 'Sin torre')";
    $condiciones = ['i.conjunto_id = ?'];
    $parametros = [$conjuntoId];
    if ($busqueda !== '') {
        $condiciones[] = "CONCAT_WS(' ', $bloqueSql, i.nomenclatura, COALESCE(i.apartamento, '')) LIKE ?";
        $parametros[] = '%' . $busqueda . '%';
    }
    if ($bloque !== '') {
        $condiciones[] = "$bloqueSql = ?";
        $parametros[] = $bloque;
    }
    if ($estadoCuota === 'configurada') $condiciones[] = 'COALESCE(i.cuota_administracion, 0) > 0';
    if ($estadoCuota === 'sin_configurar') $condiciones[] = 'COALESCE(i.cuota_administracion, 0) <= 0';
    $where = implode(' AND ', $condiciones);

    $totalStmt = $pdo->prepare("SELECT COUNT(*) FROM inmuebles i WHERE $where");
    $totalStmt->execute($parametros);
    $total = (int) $totalStmt->fetchColumn();
    $totalPages = max(1, (int) ceil($total / $perPage));
    $page = min($page, $totalPages);
    $offset = ($page - 1) * $perPage;

    $stmt = $pdo->prepare("SELECT i.id, $bloqueSql AS bloque, i.apartamento, i.nomenclatura, i.cuota_administracion FROM inmuebles i WHERE $where ORDER BY bloque, i.nomenclatura, i.id LIMIT $perPage OFFSET $offset");
    $stmt->execute($parametros);
    $bloques = $pdo->prepare("SELECT DISTINCT $bloqueSql AS bloque FROM inmuebles i WHERE i.conjunto_id = ? ORDER BY bloque");
    $bloques->execute([$conjuntoId]);
    $resumen = $pdo->prepare('SELECT COUNT(*) AS total, SUM(COALESCE(cuota_administracion, 0) > 0) AS configuradas FROM inmuebles WHERE conjunto_id = ?');
    $resumen->execute([$conjuntoId]);
    $totales = $resumen->fetch() ?: ['total' => 0, 'configuradas' => 0];

    responseJSON('success', '', [
        'inmuebles' => $stmt->fetchAll(),
        'pagination' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'total_pages' => $totalPages],
        'filters' => ['bloques' => array_column($bloques->fetchAll(), 'bloque')],
        'summary' => ['total' => (int) $totales['total'], 'configuradas' => (int) $totales['configuradas']]
    ]);
}
if ($action === 'configurar_cuota') {
    $alcance = $_POST['alcance'] ?? '';
    $valor = (float) ($_POST['valor'] ?? 0);
    $idsRecibidos = $_POST['inmueble_ids'] ?? [];
    $idsJson = trim($_POST['inmueble_ids_json'] ?? '');
    if ($idsJson !== '') {
        $decodificados = json_decode($idsJson, true);
        if (!is_array($decodificados)) responseJSON('error', 'La selección de apartamentos no es válida');
        $idsRecibidos = $decodificados;
    }
    if ($alcance !== 'inmuebles' || $valor <= 0 || !is_array($idsRecibidos)) responseJSON('error', 'Selecciona uno o más apartamentos y un valor mayor a cero');

    $inmuebleIds = array_values(array_unique(array_filter(array_map('intval', $idsRecibidos), fn($id) => $id > 0)));
    if (!$inmuebleIds) responseJSON('error', 'Selecciona al menos un apartamento');
    if (count($inmuebleIds) > 5000) responseJSON('error', 'La selección supera el límite de 5000 apartamentos por operación');

    $marcadores = implode(', ', array_fill(0, count($inmuebleIds), '?'));
    $verificar = $pdo->prepare("SELECT COUNT(*) FROM inmuebles WHERE conjunto_id = ? AND id IN ($marcadores)");
    $verificar->execute(array_merge([$conjuntoId], $inmuebleIds));
    if ((int) $verificar->fetchColumn() !== count($inmuebleIds)) responseJSON('error', 'Uno o más apartamentos no pertenecen a este conjunto');

    $actualizar = $pdo->prepare("UPDATE inmuebles SET cuota_administracion = ? WHERE conjunto_id = ? AND id IN ($marcadores)");
    $actualizar->execute(array_merge([$valor, $conjuntoId], $inmuebleIds));
    responseJSON('success', 'Cuota configurada para ' . count($inmuebleIds) . ' apartamento(s).');
}
if ($action === 'generar_cobro') {
    $periodo = $_POST['periodo'] ?? '';
    if (!preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $periodo, $coincidencias)) responseJSON('error', 'Selecciona un período válido');
    $anio = (int) $coincidencias[1];
    $mes = (int) $coincidencias[2];

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id, cuota_administracion FROM inmuebles WHERE conjunto_id = ? AND cuota_administracion > 0 FOR UPDATE');
        $stmt->execute([$conjuntoId]);
        $inmuebles = $stmt->fetchAll();
        if (!$inmuebles) throw new Exception('No hay cuotas configuradas. Asigna primero una tarifa por bloque o inmueble.');

        $buscarCuota = $pdo->prepare('SELECT id FROM cuotas_administracion WHERE inmueble_id = ? AND mes = ? AND anio = ? LIMIT 1 FOR UPDATE');
        $crearCuota = $pdo->prepare("INSERT INTO cuotas_administracion (inmueble_id, mes, anio, valor, estado) VALUES (?, ?, ?, ?, 'pendiente')");
        $sumarMora = $pdo->prepare('UPDATE inmuebles SET mora_actual = mora_actual + ? WHERE id = ? AND conjunto_id = ?');
        $generadas = 0;
        $omitidas = 0;
        foreach ($inmuebles as $inmueble) {
            $buscarCuota->execute([$inmueble['id'], $mes, $anio]);
            if ($buscarCuota->fetch()) {
                $omitidas++;
                continue;
            }
            $crearCuota->execute([$inmueble['id'], $mes, $anio, $inmueble['cuota_administracion']]);
            $sumarMora->execute([$inmueble['cuota_administracion'], $inmueble['id'], $conjuntoId]);
            $generadas++;
        }
        $pdo->commit();
        responseJSON('success', "Cuotas de $periodo generadas: $generadas. Omitidas por existir previamente: $omitidas.");
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        responseJSON('error', $e->getMessage());
    }
}
if ($action === 'dashboard_financiero') {
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(mora_actual),0) AS total_cartera FROM inmuebles WHERE conjunto_id=?');
    $stmt->execute([$conjuntoId]);
    responseJSON('success', '', $stmt->fetch());
}
responseJSON('error', 'Acción no válida');
