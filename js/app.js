document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch('api/auth.php?action=check');
        const data = await res.json();
        
        if (data.status === 'success') {
            currentUser = data.data;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('topbarName').innerText = currentUser.nombre;
            initApp();
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('app').classList.add('hidden');
        }
    } catch (e) {
        console.error(e);
    }
}

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('email', email);
    formData.append('password', password);

    const res = await fetch('api/auth.php', { method: 'POST', body: formData });
    const data = await res.json();
    
    if (data.status === 'success') {
        checkAuth();
    } else {
        document.getElementById('loginError').innerText = data.message;
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await fetch('api/auth.php?action=logout');
    window.location.reload();
});

function initApp() {
    setupNavigation();
    loadView('dashboard'); // Default view
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
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
        if (viewName === 'importar') initImportView();
        if (viewName === 'usuarios') loadUsuarios();
        if (viewName === 'inmuebles') loadInmuebles();
        if (viewName === 'zonas') loadZonas();
        if (viewName === 'reclamaciones') loadReclamaciones();
        if (viewName === 'porteria') loadPorteria();
    } else {
        container.innerHTML = `<div class="view card"><h2>En construcción</h2></div>`;
    }
}

// Data Loaders
async function loadPorteria() {
    // Cargar Visitantes
    const resV = await fetch('api/porteria.php?action=list_visitantes');
    const dataV = await resV.json();
    if(dataV.status === 'success') {
        const tb = document.getElementById('tb-visitantes');
        tb.innerHTML = dataV.data.length === 0 ? '<tr><td colspan="5">No hay visitas recientes</td></tr>' :
            dataV.data.map(v => `<tr><td>${v.nombre}</td><td>${v.apartamento || 'N/A'}</td><td>${v.vehiculo_placa || 'Ninguna'}</td><td>${v.fecha_ingreso}</td><td>${v.fecha_salida || '<span style="color:#16a34a">Adentro</span>'}</td></tr>`).join('');
    }

    // Cargar Paquetes
    const resP = await fetch('api/porteria.php?action=list_paquetes');
    const dataP = await resP.json();
    if(dataP.status === 'success') {
        const tb = document.getElementById('tb-paquetes');
        tb.innerHTML = dataP.data.length === 0 ? '<tr><td colspan="4">No hay paquetes pendientes</td></tr>' :
            dataP.data.map(p => `<tr><td>${p.transportadora}</td><td>${p.apartamento || 'N/A'}</td><td>${p.fecha_recepcion}</td><td>${p.estado}</td></tr>`).join('');
    }

    // Cargar Minuta
    const resM = await fetch('api/porteria.php?action=list_minuta');
    const dataM = await resM.json();
    if(dataM.status === 'success') {
        const tb = document.getElementById('tb-minuta');
        tb.innerHTML = dataM.data.length === 0 ? '<tr><td colspan="3">Minuta vacía</td></tr>' :
            dataM.data.map(m => `<tr><td>${m.fecha_registro}</td><td>${m.vigilante}</td><td>${m.asunto}</td></tr>`).join('');
    }
}

async function loadUsuarios() {
    const res = await fetch('api/users.php?action=list');
    const data = await res.json();
    const tbody = document.getElementById('tb-usuarios');
    if(data.status === 'success') {
        tbody.innerHTML = data.data.map(u => `<tr><td>${u.documento}</td><td>${u.nombre}</td><td>${u.email}</td><td><span style="padding:4px 8px; background:var(--primary-light); color:var(--primary); border-radius:12px; font-size:12px; text-transform:uppercase;">${u.rol}</span></td></tr>`).join('');
    }
}

async function loadInmuebles() {
    const res = await fetch('api/inmuebles.php?action=list');
    const data = await res.json();
    const tbody = document.getElementById('tb-inmuebles');
    if(data.status === 'success') {
        tbody.innerHTML = data.data.map(i => `<tr><td>${i.torre || 'N/A'}</td><td>${i.apartamento}</td><td><b>$${i.mora_actual}</b></td><td>${i.num_vehiculos}</td><td>${i.num_mascotas}</td></tr>`).join('');
    }
}

async function loadZonas() {
    const res = await fetch('api/zonas.php?action=list');
    const data = await res.json();
    const tbody = document.getElementById('tb-zonas');
    if(data.status === 'success') {
        if(data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4">No hay reservas</td></tr>`;
        } else {
            tbody.innerHTML = data.data.map(z => `<tr><td>${z.zona_nombre}</td><td>${z.usuario_nombre}</td><td>${z.fecha_reserva}</td><td>${z.estado}</td></tr>`).join('');
        }
    }
}

async function loadReclamaciones() {
    const res = await fetch('api/reclamaciones.php?action=list');
    const data = await res.json();
    const tbody = document.getElementById('tb-reclamaciones');
    if(data.status === 'success') {
        if(data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4">No hay reclamaciones</td></tr>`;
        } else {
            tbody.innerHTML = data.data.map(r => `<tr><td>${r.asunto}</td><td>${r.usuario_nombre}</td><td>${r.creado_en}</td><td>${r.estado}</td></tr>`).join('');
        }
    }
}

// Importar Excel (Logic unchanged)
function initImportView() {
    const fileInput = document.getElementById('excelFile');
    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('action', 'get_headers');

        try {
            const res = await fetch('api/import.php', { method: 'POST', body: formData });
            const data = await res.json();
            if(data.status === 'success') {
                showMappingInterface(data.data.headers);
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    });
}

function showMappingInterface(excelHeaders) {
    const mappingSection = document.getElementById('mappingSection');
    const mappingForm = document.getElementById('mappingForm');
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
            const selected = header.toLowerCase().includes(field.key.split('_')[0]) ? 'selected' : '';
            optionsHtml += `<option value="${index}" ${selected}>Columna: ${header}</option>`;
        });
        html += `<div class="mapping-item"><label>${field.label}</label><select name="map_${field.key}">${optionsHtml}</select></div>`;
    });

    mappingForm.innerHTML = html;
    mappingSection.classList.remove('hidden');

    document.getElementById('btnProcesarImportacion').onclick = async () => {
        alert('Integración Backend pendiente (demo).');
    };
}
