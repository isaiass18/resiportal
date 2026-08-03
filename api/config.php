<?php
// Configuración de la base de datos.
// Prioridad: variables de entorno (recomendado en producción, configurables en el
// panel de IONOS o en el vhost) > api/config.local.php (archivo NO versionado en
// git, ver .gitignore, para desarrollo local).
$dbHost = getenv('DB_HOST') ?: null;
$dbUser = getenv('DB_USER') ?: null;
$dbPass = getenv('DB_PASS') ?: null;
$dbName = getenv('DB_NAME') ?: null;

$localConfig = __DIR__ . '/config.local.php';
if ((!$dbUser || !$dbPass) && file_exists($localConfig)) {
    require $localConfig; // debe definir $dbHost, $dbUser, $dbPass, $dbName
}

define('DB_HOST', $dbHost ?: 'localhost');
define('DB_USER', $dbUser);
define('DB_PASS', $dbPass);
define('DB_NAME', $dbName ?: 'conjunto_residencial');

if (!DB_USER || !DB_PASS) {
    die(json_encode([
        'status' => 'error',
        'message' => 'Faltan credenciales de base de datos. Configure DB_USER y DB_PASS como variables de entorno o en api/config.local.php.'
    ]));
}

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    // Configurar PDO para que lance excepciones en caso de error
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die(json_encode([
        'status' => 'error',
        'message' => 'Error de conexión a la base de datos: ' . $e->getMessage()
    ]));
}

// Funciones de utilidad globales
function responseJSON($status, $message, $data = [])
{
    header('Content-Type: application/json');
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}
