# Estado de requisitos — ResiPortal

**Última actualización:** 2026-08-03
**Alcance:** estado real del MVP desplegado de ResiPortal.

> Este documento separa la funcionalidad comprobada de las entregas parciales y del backlog. No certifica el cumplimiento integral del documento maestro de requisitos.

## Criterio de estado

- `[x]` Implementado en el código actual y desplegado.
- `[~]` Implementación parcial o limitada; no debe considerarse requisito completo.
- `[ ]` Pendiente.

## [x] Plataforma, acceso y administración

- Inicio de sesión con sesiones PHP, roles y aislamiento de datos autenticados por `conjunto_id`.
- Administración de usuarios: creación y edición de administradores, vigilantes, residentes y propietarios.
- Validación en aplicación de documento y correo por conjunto; contraseña con mínimo de ocho caracteres.
- Cambio de contraseña para usuarios autenticados, validando contraseña actual y confirmación.
- Configuración del conjunto: nombre y logo por URL o carga validada de JPG/PNG/WEBP (máximo 3 MB), con vista previa.
- Configuración de base de datos desde variables de entorno o `api/config.local.php`; las credenciales locales están ignoradas por Git.

## [x] Inmuebles y portal residente

- Consulta, creación y edición administrativa de apartamentos y casas, con torre/bloque, nomenclatura, parqueadero, coeficiente y mora inicial.
- Relación de propietarios/residentes con inmuebles y consulta del estado de cuenta.
- Registro básico de vehículos y mascotas en el portal residente.
- Inicio residente y “Mis pagos” consumen la misma fuente de deuda (`mi_deuda`), evitando valores inconsistentes entre ambas vistas.

## [x] Zonas sociales y reservas

- Catálogo público de zonas que oculta duplicados históricos sin borrar datos existentes.
- Modal público con descripción, normas, aforo, horario, tarifa, imagen o video de YouTube y calendario de disponibilidad sin exponer la identidad de quien reservó.
- Calendario del residente con estados disponible, solicitud pendiente, reservada y fecha pasada.
- Solicitud de reserva al hacer clic en un día futuro disponible, con confirmación y transacción que impide reservas activas duplicadas para la misma zona y fecha.
- Administración de zonas: creación/edición de datos operativos, imagen validada JPG/PNG/WEBP hasta 5 MB y enlace de YouTube validado.
- Las reservas quedan pendientes y administración puede aprobarlas o rechazarlas.

## [x] Finanzas operativas

- Consulta de cartera y generación administrativa de cobro masivo.
- Reporte de pago por residente/propietario con referencia, descripción y soporte JPG/PNG/PDF hasta 5 MB; queda pendiente de aprobación.
- Registro directo de pago por administración, con descripción y soporte opcional; se aprueba de inmediato y disminuye la mora.
- Aprobación o rechazo administrativo de pagos reportados, con actualización transaccional de la deuda al aprobar.
- Soportes guardados fuera de la ruta pública; solo el reportante o la administración del conjunto pueden abrirlos.
- No se implementó ni se debe interpretar como implementada una pasarela de pago, simulación de PSE/tarjeta o checkout en línea.

## [x] PQRS, comunicaciones y página pública

- Radicación de PQRS por residentes/propietarios con categoría, asunto y descripción; el radicante ve sus casos y administración ve los del conjunto.
- Cartelera de comunicados administrable y visible en la página pública.
- Eventos administrables y visibles en el inicio público; se cargaron tres novedades de prueba en producción.
- El inicio público consume novedades, eventos y zonas configuradas por administración.

## [x] Núcleo operativo de portería

- Registro de visitantes y marcación de salida.
- Recepción y entrega de paquetes.
- Registro y consulta de novedades en minuta digital.
- Directorio básico de residentes/propietarios para operación de portería.

## [x] Despliegue, datos y validación operativa

- Despliegue documentado con respaldo previo de código y base de datos, copia controlada y reinicio solo de PHP-FPM/Nginx; PLACSP/Docker no se modifica.
- En producción se agregaron las columnas `zonas_sociales.imagen_url`, `zonas_sociales.youtube_url`, `reclamaciones.categoria`, `inmuebles.tipo_unidad` e `inmuebles.nomenclatura`.
- No se eliminaron duplicados históricos. Los índices únicos de usuarios no se añadieron en producción porque existe un documento demo duplicado (`111111`); las validaciones de la aplicación siguen activas.
- Se verificaron Nginx, PHP-FPM, MySQL, ResiPortal y PLACSP activos después del despliegue.

## [~] Entregas parciales y límites conocidos

- **Portería/vigilancia:** solo está cubierto el núcleo operativo anterior. Las brechas detalladas están en `VIGILANCIA_BRECHAS.md`.
- **PQRS:** no tiene asignación responsable, respuestas, adjuntos, SLA, notificaciones ni ciclo completo de estados.
- **Finanzas:** no existe contabilidad de doble partida, conciliación bancaria, facturación, intereses, recibos fiscales ni recaudo electrónico.
- **Auditoría y reportes:** existen registros puntuales para comunicados/importaciones y exportación básica; no hay una auditoría integral ni reportes PDF/Excel completos de todas las áreas.
- **Comunicaciones/documentos:** el comunicado y los eventos funcionan; el gestor documental integral de actas/manuales no está completado.
- **Portal público multi-conjunto:** las rutas públicas se comportan como instalación de un solo conjunto; falta seleccionar/identificar el conjunto por dominio o URL para un multi-tenant público real.

## [ ] Pendientes prioritarios

- Reemplazar `api/SimpleXLSX.php`, que está truncado, y validar el importador de Excel de extremo a extremo.
- Completar portería: QR/PIN/biometría, preautorizaciones, invitados recurrentes, turnos, puestos, checklist, entrega/recibo formal de minuta, restricciones trazables, firmas/evidencias, alertas, cámaras y operación offline.
- Completar el ciclo de PQRS y sus notificaciones.
- Diseñar el módulo financiero/contable integral y, si se aprueba, integrar un proveedor real de pagos.
- Normalizar los datos históricos antes de crear índices únicos en producción.
- Ampliar auditoría, seguridad operativa, gestión documental y reportes conforme a los requisitos maestros.

## Notas de migración

La migración `MIGRACION_20260803_MEJORAS_PORTAL.sql` aplica los cambios de esquema para instalaciones existentes. La primera ejecución en producción falló porque MySQL 8.4.10 no acepta `ADD COLUMN IF NOT EXISTS`; se aplicaron después los `ALTER TABLE` compatibles. La parte de índices únicos se dejó fuera deliberadamente para no eliminar ni alterar datos históricos.
