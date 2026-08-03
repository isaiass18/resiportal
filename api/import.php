<?php

session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || ($_SESSION['user_rol'] ?? '') !== 'admin') responseJSON('error', 'No autorizado');

function configuracionImportacion(string $tipo): ?array
{
    $configuraciones = [
        'residentes' => ['etiqueta' => 'residentes', 'relacion' => 'residente', 'requeridos' => ['documento', 'nombre'], 'campos' => ['documento', 'nombre', 'email', 'contacto', 'inmueble_nomenclatura']],
        'propietarios' => ['etiqueta' => 'propietarios', 'relacion' => 'propietario', 'requeridos' => ['documento', 'nombre'], 'campos' => ['documento', 'nombre', 'email', 'contacto', 'inmueble_nomenclatura']],
        'inmuebles' => ['etiqueta' => 'inmuebles', 'requeridos' => ['nomenclatura'], 'campos' => ['nomenclatura', 'tipo_unidad', 'torre', 'apartamento', 'coeficiente', 'cuota_administracion', 'mora_actual']],
        'parqueaderos' => ['etiqueta' => 'parqueaderos', 'requeridos' => ['codigo'], 'campos' => ['codigo', 'tipo', 'estado', 'observaciones', 'inmueble_nomenclatura']],
    ];
    return $configuraciones[$tipo] ?? null;
}

function filasXlsx(string $ruta): array
{
    if (!class_exists('ZipArchive')) responseJSON('error', 'El servidor no tiene habilitada la extensión ZIP requerida para XLSX');
    $zip = new ZipArchive();
    if ($zip->open($ruta) !== true) responseJSON('error', 'El archivo XLSX no es un archivo ZIP válido');
    $shared = [];
    $xmlCompartido = $zip->getFromName('xl/sharedStrings.xml');
    if ($xmlCompartido !== false && ($strings = simplexml_load_string($xmlCompartido, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA))) {
        foreach ($strings->si as $item) $shared[] = trim((string) $item);
    }
    $xmlHoja = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();
    if ($xmlHoja === false || !($hoja = simplexml_load_string($xmlHoja, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA))) responseJSON('error', 'No fue posible leer la primera hoja del XLSX');
    $filas = [];
    foreach ($hoja->sheetData->row as $filaXml) {
        $fila = [];
        foreach ($filaXml->c as $celda) {
            preg_match('/[A-Z]+/', (string) $celda['r'], $coincidencia);
            $columna = 0;
            foreach (str_split($coincidencia[0] ?? 'A') as $letra) $columna = $columna * 26 + (ord($letra) - 64);
            $indice = max(0, $columna - 1);
            while (count($fila) < $indice) $fila[] = '';
            $tipo = (string) $celda['t'];
            if ($tipo === 's') $valor = $shared[(int) $celda->v] ?? '';
            elseif ($tipo === 'inlineStr') $valor = trim((string) $celda->is);
            else $valor = (string) $celda->v;
            $fila[$indice] = $valor;
        }
        $filas[] = $fila;
    }
    return $filas;
}

function archivoXlsx(): array
{
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) responseJSON('error', 'Selecciona un archivo XLSX válido');
    if ($file['size'] > 5 * 1024 * 1024) responseJSON('error', 'El archivo no puede superar 5 MB');
    if (strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) !== 'xlsx') responseJSON('error', 'Solo se admiten archivos .xlsx');
    $rows = filasXlsx($file['tmp_name']);
    if (count($rows) < 2) responseJSON('error', 'El archivo debe tener cabeceras y al menos una fila de datos');
    if (count($rows) > 5001) responseJSON('error', 'El límite es de 5.000 filas por importación');
    $headers = array_map(static fn($valor): string => trim((string) $valor), $rows[0]);
    if (count(array_filter($headers)) === 0) responseJSON('error', 'La primera fila debe contener nombres de columnas');
    return [$headers, array_slice($rows, 1)];
}

function valorFila(array $fila, array $mapeo, string $campo): string
{
    $indice = $mapeo[$campo] ?? '';
    if ($indice === '' || !ctype_digit((string) $indice)) return '';
    return trim((string) ($fila[(int) $indice] ?? ''));
}

function numeroImportado(string $valor): ?float
{
    $limpio = preg_replace('/[^0-9,.-]/', '', $valor);
    if ($limpio === '') return null;
    if (str_contains($limpio, ',') && str_contains($limpio, '.')) $limpio = str_replace('.', '', $limpio);
    elseif (substr_count($limpio, '.') > 1) $limpio = str_replace('.', '', $limpio);
    elseif (substr_count($limpio, ',') > 1) $limpio = str_replace(',', '', $limpio);
    $limpio = str_replace(',', '.', $limpio);
    return is_numeric($limpio) ? (float) $limpio : null;
}

function prepararFilas(string $tipo, array $mapeo): array
{
    $config = configuracionImportacion($tipo);
    if (!$config || !is_array($mapeo)) responseJSON('error', 'Tipo o mapeo de importación inválido');
    [$headers, $rows] = archivoXlsx();
    foreach ($mapeo as $indice) if ($indice !== '' && (!ctype_digit((string) $indice) || !isset($headers[(int) $indice]))) responseJSON('error', 'El mapeo contiene una columna no válida');
    foreach ($config['requeridos'] as $campo) if (($mapeo[$campo] ?? '') === '') responseJSON('error', "Debes asignar la columna obligatoria: $campo");

    $validas = [];
    $errores = [];
    $identidades = [];
    foreach ($rows as $posicion => $fila) {
        $datos = [];
        foreach ($config['campos'] as $campo) $datos[$campo] = valorFila($fila, $mapeo, $campo);
        if (count(array_filter($datos, static fn($valor) => $valor !== '')) === 0) continue;
        $faltantes = array_filter($config['requeridos'], static fn($campo) => $datos[$campo] === '');
        if ($faltantes) {
            $errores[] = ['fila' => $posicion + 2, 'mensaje' => 'Faltan: ' . implode(', ', $faltantes)];
            continue;
        }
        $identidad = $tipo === 'inmuebles' ? strtoupper($datos['nomenclatura']) : ($tipo === 'parqueaderos' ? strtoupper($datos['codigo']) : $datos['documento']);
        if (isset($identidades[$identidad])) {
            $errores[] = ['fila' => $posicion + 2, 'mensaje' => 'Duplicado en el archivo (también fila ' . $identidades[$identidad] . ')'];
            continue;
        }
        $identidades[$identidad] = $posicion + 2;
        if ($tipo === 'inmuebles' && $datos['tipo_unidad'] !== '' && !in_array(strtolower($datos['tipo_unidad']), ['apartamento', 'casa'], true)) {
            $errores[] = ['fila' => $posicion + 2, 'mensaje' => 'tipo_unidad debe ser apartamento o casa'];
            continue;
        }
        if ($tipo === 'parqueaderos') {
            if ($datos['tipo'] !== '' && !in_array(strtolower($datos['tipo']), ['privado', 'administracion', 'visitante', 'otro'], true)) {
                $errores[] = ['fila' => $posicion + 2, 'mensaje' => 'Tipo de parqueadero inválido'];
                continue;
            }
            if ($datos['estado'] !== '' && !in_array(strtolower($datos['estado']), ['disponible', 'asignado', 'inactivo'], true)) {
                $errores[] = ['fila' => $posicion + 2, 'mensaje' => 'Estado de parqueadero inválido'];
                continue;
            }
        }
        $datos['_fila'] = $posicion + 2;
        $validas[] = $datos;
    }
    return [$config, $headers, $validas, $errores];
}

function inmuebleId(PDO $pdo, int $conjuntoId, string $nomenclatura): ?int
{
    $stmt = $pdo->prepare('SELECT id FROM inmuebles WHERE conjunto_id = ? AND UPPER(TRIM(nomenclatura)) = UPPER(TRIM(?)) LIMIT 1');
    $stmt->execute([$conjuntoId, $nomenclatura]);
    $id = $stmt->fetchColumn();
    return $id ? (int) $id : null;
}

function importarUsuario(PDO $pdo, int $conjuntoId, array $fila, string $relacion): void
{
    $buscar = $pdo->prepare('SELECT id FROM usuarios WHERE conjunto_id = ? AND documento = ? LIMIT 1');
    $buscar->execute([$conjuntoId, $fila['documento']]);
    $usuarioId = (int) $buscar->fetchColumn();
    if ($usuarioId) {
        $actualizar = $pdo->prepare('UPDATE usuarios SET nombre = ?, email = COALESCE(NULLIF(?, ""), email), contacto = COALESCE(NULLIF(?, ""), contacto) WHERE id = ?');
        $actualizar->execute([$fila['nombre'], $fila['email'], $fila['contacto'], $usuarioId]);
    } else {
        $crear = $pdo->prepare('INSERT INTO usuarios (conjunto_id, rol, documento, nombre, email, contacto) VALUES (?, ?, ?, ?, NULLIF(?, ""), NULLIF(?, ""))');
        $crear->execute([$conjuntoId, $relacion, $fila['documento'], $fila['nombre'], $fila['email'], $fila['contacto']]);
        $usuarioId = (int) $pdo->lastInsertId();
    }
    if ($fila['inmueble_nomenclatura'] !== '') {
        $inmuebleId = inmuebleId($pdo, $conjuntoId, $fila['inmueble_nomenclatura']);
        if (!$inmuebleId) throw new RuntimeException("Fila {$fila['_fila']}: no existe el inmueble {$fila['inmueble_nomenclatura']}");
        $existe = $pdo->prepare('SELECT id FROM relacion_inmuebles_usuarios WHERE inmueble_id = ? AND usuario_id = ? AND tipo_relacion = ? LIMIT 1');
        $existe->execute([$inmuebleId, $usuarioId, $relacion]);
        if (!$existe->fetch()) $pdo->prepare('INSERT INTO relacion_inmuebles_usuarios (inmueble_id, usuario_id, tipo_relacion) VALUES (?, ?, ?)')->execute([$inmuebleId, $usuarioId, $relacion]);
    }
}

function importarInmueble(PDO $pdo, int $conjuntoId, array $fila): void
{
    $id = inmuebleId($pdo, $conjuntoId, $fila['nomenclatura']);
    $tipo = strtolower($fila['tipo_unidad'] ?: 'apartamento');
    $coeficiente = numeroImportado($fila['coeficiente']);
    $cuota = numeroImportado($fila['cuota_administracion']);
    $mora = numeroImportado($fila['mora_actual']);
    if ($id) {
        $stmt = $pdo->prepare('UPDATE inmuebles SET tipo_unidad = ?, torre = COALESCE(NULLIF(?, ""), torre), apartamento = COALESCE(NULLIF(?, ""), apartamento), coeficiente = COALESCE(?, coeficiente), cuota_administracion = COALESCE(?, cuota_administracion), mora_actual = COALESCE(?, mora_actual) WHERE id = ?');
        $stmt->execute([$tipo, $fila['torre'], $fila['apartamento'], $coeficiente, $cuota, $mora, $id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO inmuebles (conjunto_id, tipo_unidad, torre, apartamento, nomenclatura, coeficiente, cuota_administracion, mora_actual) VALUES (?, ?, NULLIF(?, ""), NULLIF(?, ""), ?, ?, ?, COALESCE(?, 0))');
        $stmt->execute([$conjuntoId, $tipo, $fila['torre'], $fila['apartamento'], $fila['nomenclatura'], $coeficiente, $cuota, $mora]);
    }
}

function importarParqueadero(PDO $pdo, int $conjuntoId, int $usuarioId, array $fila): void
{
    $buscar = $pdo->prepare('SELECT id FROM parqueaderos WHERE conjunto_id = ? AND codigo = ? LIMIT 1');
    $buscar->execute([$conjuntoId, $fila['codigo']]);
    $parqueaderoId = (int) $buscar->fetchColumn();
    $tipo = strtolower($fila['tipo'] ?: 'administracion');
    $estado = strtolower($fila['estado'] ?: 'disponible');
    if ($parqueaderoId) $pdo->prepare('UPDATE parqueaderos SET tipo = ?, estado = ?, observaciones = NULLIF(?, "") WHERE id = ?')->execute([$tipo, $estado, $fila['observaciones'], $parqueaderoId]);
    else {
        $pdo->prepare('INSERT INTO parqueaderos (conjunto_id, codigo, tipo, estado, observaciones) VALUES (?, ?, ?, ?, NULLIF(?, ""))')->execute([$conjuntoId, $fila['codigo'], $tipo, $estado, $fila['observaciones']]);
        $parqueaderoId = (int) $pdo->lastInsertId();
    }
    if ($fila['inmueble_nomenclatura'] === '') return;
    $inmuebleId = inmuebleId($pdo, $conjuntoId, $fila['inmueble_nomenclatura']);
    if (!$inmuebleId) throw new RuntimeException("Fila {$fila['_fila']}: no existe el inmueble {$fila['inmueble_nomenclatura']}");
    $asignacion = $pdo->prepare('SELECT inmueble_id FROM asignaciones_parqueadero WHERE parqueadero_id = ? AND retirado_en IS NULL LIMIT 1');
    $asignacion->execute([$parqueaderoId]);
    $actual = $asignacion->fetchColumn();
    if ($actual && (int) $actual !== $inmuebleId) throw new RuntimeException("Fila {$fila['_fila']}: el parqueadero {$fila['codigo']} ya está asignado");
    if (!$actual) $pdo->prepare('INSERT INTO asignaciones_parqueadero (parqueadero_id, inmueble_id, asignado_por) VALUES (?, ?, ?)')->execute([$parqueaderoId, $inmuebleId, $usuarioId]);
    $pdo->prepare("UPDATE parqueaderos SET estado = 'asignado' WHERE id = ?")->execute([$parqueaderoId]);
}

$action = $_POST['action'] ?? '';
$tipo = $_POST['tipo'] ?? '';
if (!configuracionImportacion($tipo)) responseJSON('error', 'Selecciona qué información deseas importar');

if ($action === 'get_headers') {
    [$headers, $rows] = archivoXlsx();
    responseJSON('success', 'Cabeceras leídas', ['headers' => $headers, 'rows' => count($rows)]);
}

$mapeo = json_decode($_POST['mapping'] ?? '', true);
if (!is_array($mapeo)) responseJSON('error', 'Mapeo de columnas inválido');
[$config, $headers, $validas, $errores] = prepararFilas($tipo, $mapeo);

if ($action === 'preview') {
    responseJSON('success', 'Vista previa generada', ['summary' => ['validas' => count($validas), 'errores' => count($errores)], 'sample' => array_slice($validas, 0, 10), 'errors' => array_slice($errores, 0, 30)]);
}

if ($action !== 'process') responseJSON('error', 'Acción no válida');
if ($errores) responseJSON('error', 'Corrige los errores de la vista previa antes de importar', ['errors' => array_slice($errores, 0, 30)]);

$conjuntoId = (int) $_SESSION['conjunto_id'];
$usuarioId = (int) $_SESSION['user_id'];
try {
    $pdo->beginTransaction();
    foreach ($validas as $fila) {
        if ($tipo === 'residentes' || $tipo === 'propietarios') importarUsuario($pdo, $conjuntoId, $fila, $config['relacion']);
        elseif ($tipo === 'inmuebles') importarInmueble($pdo, $conjuntoId, $fila);
        else importarParqueadero($pdo, $conjuntoId, $usuarioId, $fila);
    }
    $pdo->prepare('INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, "importar", ?, ?)')->execute([$usuarioId, $config['etiqueta'], 'Filas procesadas: ' . count($validas)]);
    $pdo->commit();
    responseJSON('success', 'Importación completada: ' . count($validas) . ' fila(s) de ' . $config['etiqueta'] . ' procesadas.');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    responseJSON('error', 'No se importó ningún dato: ' . $e->getMessage());
}
