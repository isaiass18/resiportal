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

// Las APIs siempre deben responder JSON, incluso ante una excepción no controlada.
// Evita que la interfaz reciba una página HTML de PHP/Nginx y falle al parsearla.
ini_set('display_errors', '0');

function responseJSON($status, $message, $data = [])
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(static function (Throwable $error): void {
    error_log(sprintf('ResiPortal API error: %s in %s:%d', $error->getMessage(), $error->getFile(), $error->getLine()));
    if (!headers_sent()) http_response_code(500);
    responseJSON('error', 'No fue posible completar la operación. Intenta de nuevo o contacta a la administración.');
});

register_shutdown_function(static function (): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true) || headers_sent()) return;
    error_log(sprintf('ResiPortal fatal error: %s in %s:%d', $error['message'], $error['file'], $error['line']));
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'El servidor no pudo completar la operación.', 'data' => []], JSON_UNESCAPED_UNICODE);
});
