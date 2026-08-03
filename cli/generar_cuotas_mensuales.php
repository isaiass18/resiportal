<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Solo disponible por línea de comandos.');
}

require_once __DIR__ . '/../api/config.php';

$periodo = date('Y-m');
foreach ($argv as $argumento) {
    if (str_starts_with($argumento, '--periodo=')) $periodo = substr($argumento, 10);
}
if (!preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $periodo, $coincidencias)) {
    fwrite(STDERR, "Período inválido. Use --periodo=AAAA-MM\n");
    exit(2);
}
$anio = (int) $coincidencias[1];
$mes = (int) $coincidencias[2];

$conjuntos = $pdo->query('SELECT id FROM conjuntos')->fetchAll(PDO::FETCH_COLUMN);
$generadas = 0;
$omitidas = 0;

foreach ($conjuntos as $conjuntoId) {
    try {
        $pdo->beginTransaction();
        $inmuebles = $pdo->prepare('SELECT id, cuota_administracion FROM inmuebles WHERE conjunto_id = ? AND cuota_administracion > 0 FOR UPDATE');
        $inmuebles->execute([$conjuntoId]);
        $buscar = $pdo->prepare('SELECT id FROM cuotas_administracion WHERE inmueble_id = ? AND mes = ? AND anio = ? LIMIT 1 FOR UPDATE');
        $crear = $pdo->prepare("INSERT INTO cuotas_administracion (inmueble_id, mes, anio, valor, estado) VALUES (?, ?, ?, ?, 'pendiente')");
        $sumar = $pdo->prepare('UPDATE inmuebles SET mora_actual = mora_actual + ? WHERE id = ? AND conjunto_id = ?');
        foreach ($inmuebles->fetchAll() as $inmueble) {
            $buscar->execute([$inmueble['id'], $mes, $anio]);
            if ($buscar->fetch()) {
                $omitidas++;
                continue;
            }
            $crear->execute([$inmueble['id'], $mes, $anio, $inmueble['cuota_administracion']]);
            $sumar->execute([$inmueble['cuota_administracion'], $inmueble['id'], $conjuntoId]);
            $generadas++;
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        fwrite(STDERR, "Error en conjunto $conjuntoId: {$error->getMessage()}\n");
        exit(1);
    }
}

echo "Período $periodo: $generadas cuotas generadas, $omitidas omitidas por existir.\n";
