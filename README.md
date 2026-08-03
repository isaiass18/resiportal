# ResiPortal - Software Premium de Administración de Conjuntos

Portal web súper novedoso y ligero diseñado para correr en servidores compartidos económicos (como IONOS) sin perder la estética y experiencia de usuario de una aplicación moderna de alta gama.

## Características

- **Diseño Premium**: Interfaz limpia, clara y familiar (Glassmorphism, animaciones fluidas, paleta de colores suave).
- **Single Page Application (SPA)**: Navegación instantánea utilizando Vanilla JS sin recargar la página.
- **Backend Súper Ligero**: API REST desarrollada en PHP puro. No requiere frameworks pesados.
- **Base de Datos Multi-tenant**: Arquitectura MySQL lista para escalar a múltiples conjuntos residenciales.
- **Importador Inteligente de Excel**: Permite subir cualquier archivo Excel de residentes o propietarios y mapear dinámicamente las columnas en la interfaz gráfica antes de insertarlas en la base de datos.
- **Control Total**: Gestión de Residentes, Inmuebles, Vehículos, Zonas Sociales y Reclamaciones.

## Tecnologías Utilizadas

- **Frontend**: HTML5, Vanilla CSS3 (Variables, Grid, Flexbox), Vanilla JavaScript.
- **Backend**: PHP 8+ (PDO para base de datos).
- **Base de Datos**: MySQL.
- **Librerías Adicionales**: FontAwesome (Iconos), SimpleXLSX (Lectura rápida de Excel sin Composer).

## Estructura del Proyecto

```text
/
├── index.html           # Estructura principal SPA y plantillas
├── css/
│   └── style.css        # Sistema de diseño global
├── js/
│   └── app.js           # Lógica de ruteo e interacciones de UI
├── api/
│   ├── config.php       # Conexión PDO a la base de datos
│   ├── import.php       # Lógica del importador dinámico de Excel
│   └── SimpleXLSX.php   # Parser ligero de Excel
└── database.sql         # Esquema de base de datos relacional
```

## Instrucciones de Instalación (IONOS u otros)

1. **Base de Datos**: Entra a phpMyAdmin en tu panel de control, crea una base de datos y ejecuta el contenido del archivo `database.sql`.
2. **Configuración**: Edita `api/config.php` e ingresa los datos de conexión (usuario, contraseña, nombre de la DB).
3. **Despliegue**: Sube todos los archivos (por FTP) a la carpeta pública de tu servidor (ej. `public_html` o `htdocs`).
4. **Listo**: Accede a la URL de tu dominio y el sistema estará funcional.

## Importación de Datos (Excel)

Dirígete a la sección **"Importar Datos"** en el portal.
1. Selecciona tu archivo `.xlsx`.
2. El sistema leerá las cabeceras de tu archivo.
3. Utiliza los menús desplegables para indicar qué columna de tu Excel corresponde a qué dato en el sistema (Torre, Apartamento, Nombre, etc).
4. Haz clic en Procesar y los datos se poblarán automáticamente en MySQL.
