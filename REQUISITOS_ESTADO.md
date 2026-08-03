# Estado de Requisitos - MVP (ResiPortal)

Este documento rastrea el progreso de implementación basado en el documento original `requisitos.rtf` (Sección 43 - Versión inicial recomendada MVP).

## 🟢 1. Implementado (Fase Base)
- [x] **Configuración de la copropiedad**: Base de datos estructurada para multi-tenant (múltiples conjuntos).
- [x] **Torres, unidades, parqueaderos y depósitos**: Módulo de Inmuebles activo.
- [x] **Propietarios y residentes**: CRUD de Usuarios y Propietarios.
- [x] **Usuarios, roles y permisos**: Sistema de Login, sesiones y seguridad por roles (Admin, Residente, etc).
- [x] **Vehículos**: Integrados a la vista de Inmuebles.
- [x] **Zonas sociales**: Tabla y gestión de zonas.
- [x] **Reservas**: Lógica para solicitar y ver estado de reservas.
- [x] **PQRS**: Reclamaciones con asignación de fechas y estados.
- [x] **Estados de cuenta**: Visualización de la deuda (mora_actual) por apartamento.
- [x] **Aplicación o portal para residentes**: SPA (Single Page Application) responsiva.

## 🟢 2. Implementado (Sprint 1 - Portería)
- [x] **Control de visitantes**: Registro de entradas, salidas y autorizaciones.
- [x] **Minuta de portería**: Bitácora digital de novedades del turno.
- [x] **Paquetes y correspondencia**: Casillero virtual con notificaciones.

## 🔴 3. Pendiente (Sprints 2 y 3)
- [ ] **Cuotas de administración**: Motor de liquidación mensual.
- [ ] **Registro de pagos**: Ingreso de recibos de caja.
- [ ] **Cartera**: Trazabilidad y cruce contable.
- [ ] **Comunicados**: Cartelera digital para enviar circulares.
- [ ] **Documentos**: Gestor documental para actas y manuales.
- [ ] **Reportes básicos**: Exportación a Excel/PDF de las diferentes tablas.
- [ ] **Auditoría**: Logs invisibles de todas las transacciones.
