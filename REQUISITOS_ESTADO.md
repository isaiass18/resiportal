# Estado de requisitos — ResiPortal

**Última actualización:** 2026-08-03
**Alcance:** estado real del MVP desplegado de ResiPortal y de la validación técnica posterior al despliegue.

> Este documento separa la funcionalidad comprobada de las entregas parciales y del backlog. No certifica el cumplimiento integral del documento maestro de requisitos.

## Criterio de estado

- `[x]` Implementado en el código actual y desplegado.
- `[~]` Implementación parcial o limitada; no debe considerarse requisito completo.
- `[ ]` Pendiente.

## [x] Plataforma, acceso y administración

- Inicio de sesión con sesiones PHP, roles y aislamiento de datos autenticados por `conjunto_id`.
- Administración de usuarios: creación y edición de administradores, vigilantes, residentes y propietarios.
- Desactivación y reactivación reversible de usuarios y vigilantes, sin borrado físico ni pérdida de historial; se protege la propia sesión y el último administrador activo.
- Módulo administrativo de vigilantes con ficha operativa: documento, contacto, turno, horario, observaciones, contraseña y foto privada JPG/PNG/WEBP de hasta 3 MB.
- Validación en aplicación de documento y correo por conjunto; contraseña con mínimo de ocho caracteres.
- Cambio de contraseña para usuarios autenticados, validando contraseña actual y confirmación.
- Configuración visual del conjunto: nombre, URL o carga validada de logo JPG/PNG/WEBP (máximo 3 MB), vista previa y panel informativo de automatización de cuotas; el cron de sistema no se edita desde el navegador.
- Configuración de base de datos desde variables de entorno o `api/config.local.php`; las credenciales locales están ignoradas por Git.

## [x] Inmuebles, parqueaderos y portal residente

- Consulta, creación y edición administrativa de apartamentos y casas, con torre/bloque, nomenclatura, parqueadero legado, coeficiente y mora inicial.
- Catálogo de parqueaderos propio del conjunto, con tipo privado, de administración, visitante u otro; creación, asignación a inmuebles, retiro e historial persistente de asignaciones.
- El formulario de unidades selecciona un parqueadero disponible, conserva el asignado al editar y permite retirarlo sin perder el historial.
- Relación de propietarios/residentes con inmuebles y consulta del estado de cuenta.
- Registro básico de vehículos y mascotas en el portal residente.
- Inicio residente y “Mis pagos” consumen la misma fuente de deuda (`mi_deuda`), evitando valores inconsistentes entre ambas vistas.

## [x] Zonas sociales y reservas

- Catálogo público de zonas que oculta duplicados históricos sin borrar datos existentes.
- Modal público con descripción, normas, aforo, horario, tarifa, imagen o video de YouTube y agenda por horas que solo indica franjas no disponibles; nunca expone el inmueble ni la identidad de quien reserva.
- Reservas nuevas por franja horaria, asociadas a un apartamento o casa; el usuario queda solamente como actor de auditoría de la solicitud.
- Residentes y propietarios solo pueden seleccionar inmuebles vinculados a su cuenta; administración y vigilancia pueden seleccionar cualquier inmueble del mismo conjunto.
- Política configurable en cada zona: máximo de horas por reserva y máximo de reservas activas al día para el mismo inmueble, validada en servidor dentro de una transacción.
- La validación impide franjas solapadas y conserva las reservas históricas sin inmueble/horas como bloqueos de día completo, sin asignarlas por inferencia.
- Administración y vigilancia ven la agenda interna por horas con inmueble y horario, pueden crear reservas internas aprobadas y cancelarlas lógicamente; administración también puede aprobar o rechazar solicitudes pendientes.
- El editor administrativo fue rediseñado en secciones de información básica, política de reservas y contenido visible; conserva carga validada de imagen JPG/PNG/WEBP hasta 5 MB y enlace de YouTube validado.

## [x] Finanzas operativas y cuotas

- Consulta de cartera, métricas de recaudo, inmuebles en mora, pagos pendientes/aprobados y cuotas generadas en el período actual.
- Configuración de cuota de administración por selección explícita de apartamentos, con búsqueda por unidad, filtros por torre y estado, paginación de 50 resultados y selección acumulada entre páginas; los apartamentos de una misma torre pueden tener valores distintos.
- Generación manual de cuotas por período `AAAA-MM`, evitando crear nuevamente un cobro ya existente para el inmueble y período.
- Cron mensual instalado para ejecutar el generador el día 1 a las 00:05 como `www-data`; solo incluye inmuebles con cuota configurada mayor a cero.
- Estado de cuenta del residente con deuda actual, próxima cuota configurada, cuotas generadas, movimientos, pagos pendientes/aprobados y descarga de resumen CSV.
- Reporte de pago por residente/propietario con referencia, descripción y soporte JPG/PNG/PDF hasta 5 MB; queda pendiente de aprobación.
- Registro directo de pago por administración, con descripción y soporte opcional; se aprueba de inmediato y disminuye la mora.
- Aprobación o rechazo administrativo de pagos reportados, con actualización transaccional de la deuda al aprobar.
- Soportes y fotos se guardan fuera de la ruta pública; solo usuarios autorizados del conjunto pueden abrirlos.
- No se implementó ni se debe interpretar como implementada una pasarela de pago, simulación de PSE/tarjeta o checkout en línea. “PSE” es únicamente una referencia manual del medio reportado.

## [x] PQRS, comunicaciones y página pública

- Radicación de PQRS por residentes/propietarios con categoría, asunto y descripción; el radicante ve sus casos y administración ve los del conjunto.
- Modal de PQRS ampliado para facilitar la descripción de la solicitud.
- Cartelera de comunicados administrable y visible en la página pública.
- Eventos administrables y visibles en el inicio público; se cargaron tres novedades de prueba en producción.
- El inicio público consume novedades, eventos y zonas configuradas por administración.

## [x] Núcleo operativo de portería

- Menú operativo separado para Directorio, Visitas, Paquetes y Novedades; el Directorio es la vista inicial de vigilancia.
- Directorio de residentes/propietarios con búsqueda, sin multiplicar registros por relaciones históricas duplicadas.
- Registro de visitantes y marcación de salida desde su propia vista.
- Recepción y entrega de paquetes desde su propia vista.
- Registro y consulta de novedades en minuta digital con fecha y hora operativa obligatoria; se conserva la fecha de auditoría y se presenta la fecha/hora seleccionada.
- Acciones de Portería compactas en una sola fila con desplazamiento horizontal en móvil.
- Menú lateral y contenido principal con desplazamiento vertical independiente, incluidos los paneles de administración, residente y vigilancia.

## [x] Despliegue, datos y validación operativa

- Despliegue documentado con respaldo previo de código y base de datos, copia controlada y reinicio solo de PHP-FPM/Nginx; PLACSP/Docker no se modifica.
- Se aplicaron una vez las migraciones de cuotas/perfiles de vigilancia, parqueaderos, usuarios activos, navegación de portería y reservas horarias por inmueble; la última añade límites por zona, inmueble y franjas horarias sin alterar ni asignar las reservas históricas.
- El cron está instalado en `/etc/cron.d/resiportal-cuotas` y escribe en `/var/log/resiportal-cuotas.log`.
- Se verificaron activos Nginx, PHP-FPM, MySQL y cron; ResiPortal (`localhost:80`) y PLACSP (`localhost:8501`) respondieron HTTP 200 tras el despliegue de Portería.
- Se validó la sintaxis de `api/porteria.php` con PHP en el servidor, la sintaxis de `js/app.js` localmente y los diagnósticos de PHP/HTML/CSS/SQL sin incidencias.
- Se comprobó con sesión de vigilante la consulta de Directorio, Visitas, Paquetes y Novedades. No se insertaron datos de prueba durante esa validación.
- No se eliminaron duplicados históricos. Los índices únicos de usuarios no se añadieron en producción porque existe un documento demo duplicado (`111111`); las validaciones de la aplicación siguen activas.

## [~] Entregas parciales y límites conocidos

- **Aplicación de pagos a cuotas:** un pago aprobado disminuye `mora_actual`, pero aún no se concilia contra cuotas individuales ni pagos parciales/FIFO. Por eso las cuotas se presentan como “Cobro generado”, no como pagadas.
- **Portería/vigilancia:** se cubren Directorio, visitas, paquetes y minuta con fecha/hora operativa; permanecen pendientes las capacidades avanzadas detalladas en `VIGILANCIA_BRECHAS.md`.
- **PQRS:** no tiene asignación responsable, respuestas, adjuntos, SLA, notificaciones ni ciclo completo de estados.
- **Finanzas:** no existe contabilidad de doble partida, conciliación bancaria, facturación, intereses, recibos fiscales ni recaudo electrónico.
- **Auditoría y reportes:** existen registros puntuales para comunicados/importaciones y exportación básica; no hay una auditoría integral ni reportes PDF/Excel completos de todas las áreas.
- **Comunicaciones/documentos:** el comunicado y los eventos funcionan; el gestor documental integral de actas/manuales no está completado.
- **Portal público multi-conjunto:** las rutas públicas se comportan como instalación de un solo conjunto; falta seleccionar/identificar el conjunto por dominio o URL para un multi-tenant público real.

## [ ] Pendientes prioritarios

- Configurar las tarifas iniciales por bloque o inmueble y ejecutar una prueba controlada del generador de cuotas antes del siguiente día 1.
- Crear una tabla de aplicaciones pago-cuota si se requiere conciliación real, pagos parciales/FIFO y actualización del estado individual de cada cuota.
- Definir una fecha de vencimiento configurable por conjunto y evaluar un índice único `(inmueble_id, mes, anio)` tras revisar duplicados históricos.
- Reemplazar `api/SimpleXLSX.php`, que está truncado, y validar el importador de Excel de extremo a extremo.
- Completar portería: QR/PIN/biometría, preautorizaciones, invitados recurrentes, turnos, puestos, checklist, entrega/recibo formal de minuta, restricciones trazables, firmas/evidencias, alertas, cámaras y operación offline.
- Completar el ciclo de PQRS y sus notificaciones.
- Normalizar los datos históricos antes de crear índices únicos en producción.
- Ampliar auditoría, seguridad operativa, gestión documental y reportes conforme a los requisitos maestros.

## Notas de migración

La migración `MIGRACION_20260803_MEJORAS_PORTAL.sql` aplica los cambios previos de esquema para instalaciones existentes. La primera ejecución en producción falló porque MySQL 8.4.10 no acepta `ADD COLUMN IF NOT EXISTS`; se aplicaron después los `ALTER TABLE` compatibles. Las migraciones `MIGRACION_20260804_CUOTAS_VIGILANTES.sql` y `MIGRACION_20260805_PARQUEADEROS.sql` se ejecutan una sola vez después de respaldo; no añaden índices de cuotas sobre datos históricos para no alterar registros existentes.
