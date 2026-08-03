document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    loadView('dashboard'); // Default view
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Load view
            const viewName = e.currentTarget.getAttribute('data-view');
            loadView(viewName);
        });
    });
}

function loadView(viewName) {
    const container = document.getElementById('view-container');
    const template = document.getElementById(`tpl-${viewName}`);
    
    if (template) {
        container.innerHTML = template.innerHTML;
        // Initialize view specific logic
        if (viewName === 'importar') {
            initImportView();
        }
    } else {
        container.innerHTML = `
            <div class="view card">
                <h2>Vista no encontrada</h2>
                <p>La vista "${viewName}" está en construcción.</p>
            </div>
        `;
    }
}

function initImportView() {
    const fileInput = document.getElementById('excelFile');
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('action', 'get_headers');

        try {
            // Simulating API call to read headers
            // In a real environment: await fetch('api/import.php', { method: 'POST', body: formData })
            
            alert('En producción esto subirá el archivo a api/import.php y leerá las cabeceras.');
            
            // Simularemos unas cabeceras leidas del Excel:
            const excelHeaders = ['TORRE', 'INMUEBLE', 'NOMBRE', 'DOCUMENTO DE IDENTIDAD', 'PLACA'];
            
            showMappingInterface(excelHeaders);
            
        } catch (error) {
            console.error('Error al subir archivo', error);
        }
    });
}

function showMappingInterface(excelHeaders) {
    const mappingSection = document.getElementById('mappingSection');
    const mappingForm = document.getElementById('mappingForm');
    
    // Campos requeridos en nuestra base de datos para crear un inmueble/usuario
    const systemFields = [
        { key: 'torre', label: 'Torre / Bloque' },
        { key: 'apartamento', label: 'Apartamento / Inmueble' },
        { key: 'nombre', label: 'Nombre del Residente/Propietario' },
        { key: 'documento', label: 'Documento de Identidad' },
        { key: 'vehiculo_placa', label: 'Placa del Vehículo' }
    ];

    let html = '';
    
    systemFields.forEach(field => {
        let optionsHtml = '<option value="">-- No mapear --</option>';
        excelHeaders.forEach((header, index) => {
            // Intentar auto-seleccionar por nombre
            const selected = header.toLowerCase().includes(field.key.split('_')[0]) ? 'selected' : '';
            optionsHtml += `<option value="${index}" ${selected}>Columna: ${header}</option>`;
        });

        html += `
            <div class="mapping-item">
                <label>${field.label}</label>
                <select name="map_${field.key}">
                    ${optionsHtml}
                </select>
            </div>
        `;
    });

    mappingForm.innerHTML = html;
    mappingSection.classList.remove('hidden');

    document.getElementById('btnProcesarImportacion').onclick = () => {
        alert('Se enviará el mapeo a api/import.php para procesar las filas e insertarlas en MySQL.');
        // fetch('api/import.php', { action: 'process', mapping: ... })
    };
}
