<?php

use Shuchkin\SimpleXLSX;

session_start();
require_once 'config.php';
require_once 'SimpleXLSX.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id']) || $_SESSION['user_rol'] !== 'admin') {
    responseJSON('error', 'No autorizado');
}

$action = $_POST['action'] ?? '';

if ($action === 'get_headers') {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        responseJSON('error', 'Error al subir el archivo.');
    }

    $tmpName = $_FILES['file']['tmp_name'];

    $xlsxClass = SimpleXLSX::class;
    if ($xlsx = call_user_func([$xlsxClass, 'parse'], $tmpName)) {
        $headers = $xlsx->rows()[0];
        responseJSON('success', 'Cabeceras leídas', ['headers' => $headers]);
    } else {
        responseJSON('error', call_user_func([$xlsxClass, 'parseError']));
    }
} elseif ($action === 'process') {
    // Procesamos el mapeo que envió el frontend
    // Ejemplo de JSON mapping: {"torre": "0", "apartamento": "2", "nombre": "5", ...}

    $mapping = json_decode($_POST['mapping'] ?? '', true);
    if (!is_array($mapping)) {
        responseJSON('error', 'Mapeo de columnas inválido.');
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        responseJSON('error', 'Error al subir el archivo para procesar.');
    }

    $conjunto_id = $_SESSION['conjunto_id'];
    $tmpName = $_FILES['file']['tmp_name'];

    $xlsxClass = SimpleXLSX::class;
    if ($xlsx = call_user_func([$xlsxClass, 'parse'], $tmpName)) {
        $rows = $xlsx->rows();
        $importedCount = 0;
        $skippedCount = 0;

        try {
            $pdo->beginTransaction();

            // Empezamos desde 1 para omitir cabeceras
            for ($i = 1; $i < count($rows); $i++) {
                $row = $rows[$i];

                // Extraer datos usando el mapeo definido por el usuario
                $torre = isset($mapping['torre']) && $mapping['torre'] !== '' ? trim($row[$mapping['torre']] ?? '') : null;
                $apartamento = isset($mapping['apartamento']) && $mapping['apartamento'] !== '' ? trim($row[$mapping['apartamento']] ?? '') : null;
                $nombre = isset($mapping['nombre']) && $mapping['nombre'] !== '' ? trim($row[$mapping['nombre']] ?? '') : null;
                $documento = isset($mapping['documento']) && $mapping['documento'] !== '' ? trim($row[$mapping['documento']] ?? '') : null;
                $vehiculo_placa = isset($mapping['vehiculo_placa']) && $mapping['vehiculo_placa'] !== '' ? trim($row[$mapping['vehiculo_placa']] ?? '') : null;

                // Requerimos al menos nombre, apartamento y documento para crear/vincular el registro
                if (!$nombre || !$apartamento || !$documento) {
                    $skippedCount++;
                    continue;
                }

                // Upsert del inmueble (por torre + apartamento dentro del conjunto)
                $stmt = $pdo->prepare("SELECT id FROM inmuebles WHERE conjunto_id = ? AND torre <=> ? AND apartamento = ? LIMIT 1");
                $stmt->execute([$conjunto_id, $torre, $apartamento]);
                $inmueble = $stmt->fetch();

                if ($inmueble) {
                    $inmueble_id = $inmueble['id'];
                } else {
                    $stmt = $pdo->prepare("INSERT INTO inmuebles (conjunto_id, torre, apartamento, nomenclatura) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$conjunto_id, $torre, $apartamento, $apartamento]);
                    $inmueble_id = $pdo->lastInsertId();
                }

                // Upsert del usuario (por documento dentro del conjunto)
                $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE conjunto_id = ? AND documento = ? LIMIT 1");
                $stmt->execute([$conjunto_id, $documento]);
                $usuario = $stmt->fetch();

                if ($usuario) {
                    $usuario_id = $usuario['id'];
                    $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ? WHERE id = ?");
                    $stmt->execute([$nombre, $usuario_id]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO usuarios (conjunto_id, rol, documento, nombre) VALUES (?, 'residente', ?, ?)");
                    $stmt->execute([$conjunto_id, $documento, $nombre]);
                    $usuario_id = $pdo->lastInsertId();
                }

                // Vincular usuario e inmueble como residente, si no existe ya la relación
                $stmt = $pdo->prepare("SELECT id FROM relacion_inmuebles_usuarios WHERE inmueble_id = ? AND usuario_id = ? LIMIT 1");
                $stmt->execute([$inmueble_id, $usuario_id]);
                if (!$stmt->fetch()) {
                    $stmt = $pdo->prepare("INSERT INTO relacion_inmuebles_usuarios (inmueble_id, usuario_id, tipo_relacion) VALUES (?, ?, 'residente')");
                    $stmt->execute([$inmueble_id, $usuario_id]);
                }

                // Vehículo, si se mapeó y hay placa
                if ($vehiculo_placa) {
                    $stmt = $pdo->prepare("SELECT id FROM vehiculos WHERE inmueble_id = ? AND placa = ? LIMIT 1");
                    $stmt->execute([$inmueble_id, $vehiculo_placa]);
                    if (!$stmt->fetch()) {
                        $stmt = $pdo->prepare("INSERT INTO vehiculos (inmueble_id, placa, tipo) VALUES (?, ?, 'No especificado')");
                        $stmt->execute([$inmueble_id, $vehiculo_placa]);
                    }
                }

                $importedCount++;
            }

            $pdo->commit();

            $stmtLog = $pdo->prepare("INSERT INTO auditoria_logs (usuario_id, accion, entidad, detalles) VALUES (?, 'importar', 'inmuebles/usuarios', ?)");
            $stmtLog->execute([$_SESSION['user_id'], "Importados: $importedCount, omitidos: $skippedCount"]);

            responseJSON('success', "Importación completada. $importedCount registros procesados, $skippedCount omitidos por datos incompletos.");
        } catch (Exception $e) {
            $pdo->rollBack();
            responseJSON('error', 'Error durante la importación: ' . $e->getMessage());
        }
    } else {
        responseJSON('error', call_user_func([$xlsxClass, 'parseError']));
    }
} else {
    responseJSON('error', 'Acción no válida');
}
