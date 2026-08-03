<?php
require_once 'config.php';
require_once 'SimpleXLSX.php';

header('Content-Type: application/json');

$action = $_POST['action'] ?? '';

if ($action === 'get_headers') {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        responseJSON('error', 'Error al subir el archivo.');
    }

    $tmpName = $_FILES['file']['tmp_name'];
    
    if ( $xlsx = SimpleXLSX::parse($tmpName) ) {
        $headers = $xlsx->rows()[0];
        responseJSON('success', 'Cabeceras leídas', ['headers' => $headers]);
    } else {
        responseJSON('error', SimpleXLSX::parseError());
    }
} 
elseif ($action === 'process') {
    // Aquí procesamos el mapeo que envió el frontend
    // Ejemplo de JSON mapping: {"torre": 0, "apartamento": 2, "nombre": 5, ...}
    
    $mapping = json_decode($_POST['mapping'], true);
    
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        responseJSON('error', 'Error al subir el archivo para procesar.');
    }

    $tmpName = $_FILES['file']['tmp_name'];
    
    if ( $xlsx = SimpleXLSX::parse($tmpName) ) {
        $rows = $xlsx->rows();
        $importedCount = 0;
        
        // Empezamos desde 1 para omitir cabeceras
        for ($i = 1; $i < count($rows); $i++) {
            $row = $rows[$i];
            
            // Extraer datos usando el mapeo definido por el usuario
            $torre = isset($mapping['torre']) && $mapping['torre'] !== '' ? $row[$mapping['torre']] : null;
            $apartamento = isset($mapping['apartamento']) && $mapping['apartamento'] !== '' ? $row[$mapping['apartamento']] : null;
            $nombre = isset($mapping['nombre']) && $mapping['nombre'] !== '' ? $row[$mapping['nombre']] : null;
            $documento = isset($mapping['documento']) && $mapping['documento'] !== '' ? $row[$mapping['documento']] : null;
            
            if ($nombre && $apartamento) {
                // Aquí iría la lógica SQL para insertar Inmueble y Usuario en la DB.
                // Simulamos inserción:
                $importedCount++;
            }
        }
        
        responseJSON('success', "Importación completada. $importedCount registros insertados.");
    } else {
        responseJSON('error', SimpleXLSX::parseError());
    }
} else {
    responseJSON('error', 'Acción no válida');
}
?>
