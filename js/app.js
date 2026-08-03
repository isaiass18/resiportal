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
    
    // Default view based on role
    if (currentUser.rol === 'vigilante') {
        loadView('porteria');
    } else if (currentUser.rol === 'residente') {
        loadView('home-residente');
    } else {
        loadView('dashboard');
    }

    // Mobile Menu Toggle
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        const viewName = link.getAttribute('data-view');
        
        // Hide/Show links based on role
        if (currentUser.rol === 'vigilante') {
            if (viewName !== 'porteria') {
                link.style.display = 'none';
            } else {
                link.classList.add('active');
            }
        } else if (currentUser.rol === 'residente') {
            const allowed = ['home-residente', 'mis-pagos', 'zonas', 'reclamaciones'];
            if (!allowed.includes(viewName)) {
                link.style.display = 'none';
            }
        } else {
            // Admin sees all except resident specific views
            if (['home-residente', 'mis-pagos'].includes(viewName)) {
                link.style.display = 'none';
            }
        }

        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            loadView(viewName);
            
            // Close sidebar on mobile after clicking
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
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
        if (viewName === 'finanzas') loadFinanzas();
        if (viewName === 'comunicaciones') loadComunicaciones();
        if (viewName === 'home-residente') loadHomeResidente();
        if (viewName === 'mis-pagos') loadMisPagos();
    } else {
        container.innerHTML = `<div class="view card"><h2>En construcción</h2></div>`;
    }
}

// Global Export Function
function exportCSV() {
    alert('Exportando datos básicos a CSV...');
    let csv = "ID,Nombre,Apartamento\n1,Juan Perez,101\n2,Maria Lopez,102";
    let blob = new Blob([csv], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_conjunto.csv';
    a.click();
}

// Data Loaders
async function loadHomeResidente() {
    // Comunicados (Cartelera)
    const resC = await fetch('api/comunicaciones.php?action=list_comunicados');
    const dataC = await resC.json();
    if(dataC.status === 'success') {
        const div = document.getElementById('residente-comunicados');
        div.innerHTML = dataC.data.length === 0 ? '<p>No hay comunicados recientes.</p>' :
            dataC.data.map(c => `
                <div style="border-left: 4px solid var(--primary); padding-left: 12px; margin-bottom: 12px;">
                    <h4 style="margin:0">${c.titulo}</h4>
                    <p style="margin:4px 0; font-size:14px; color:#555;">${c.contenido}</p>
                    <small style="color:#888;">${c.fecha_publicacion}</small>
                </div>
            `).join('');
    }

    // Deuda
    const res = await fetch('api/finanzas.php?action=mi_deuda');
    const data = await res.json();
    if(data.status === 'success' && data.data) {
        document.getElementById('residente-mora').innerText = `$${data.data.mora_actual}`;
    } else {
        document.getElementById('residente-mora').innerText = `$0.00`;
    }
}

async function loadMisPagos() {
    // Pagos del residente
    const res = await fetch('api/finanzas.php?action=mis_pagos');
    const data = await res.json();
    if(data.status === 'success') {
        const tb = document.getElementById('tb-mis-pagos');
        tb.innerHTML = data.data.length === 0 ? '<tr><td colspan="5">No tienes pagos registrados</td></tr>' :
            data.data.map(p => `<tr><td>${p.fecha_pago}</td><td><b>$${p.valor}</b></td><td>${p.metodo_pago}</td><td>${p.referencia || 'N/A'}</td><td>${p.estado || 'Aprobado'}</td></tr>`).join('');
    }

    const form = document.getElementById('formReportarPago');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'reportar_pago');
            formData.append('valor', document.getElementById('repPagoValor').value);
            formData.append('referencia', document.getElementById('repPagoRef').value);
            formData.append('metodo', document.getElementById('repPagoMetodo').value);
            
            const r = await fetch('api/finanzas.php', {method: 'POST', body: formData});
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalReportarPago').classList.add('hidden');
                loadMisPagos();
            }
        };
    }
}

async function loadComunicaciones() {
    // Comunicados
    const resC = await fetch('api/comunicaciones.php?action=list_comunicados');
    const dataC = await resC.json();
    if(dataC.status === 'success') {
        const div = document.getElementById('list-comunicados');
        div.innerHTML = dataC.data.length === 0 ? '<p>No hay comunicados</p>' :
            dataC.data.map(c => `
                <div style="border-left: 4px solid var(--primary); padding-left: 12px; margin-bottom: 12px;">
                    <h4 style="margin:0">${c.titulo}</h4>
                    <p style="margin:4px 0; font-size:14px; color:#555;">${c.contenido}</p>
                    <small style="color:#888;">Por ${c.autor} el ${c.fecha_publicacion}</small>
                </div>
            `).join('');
    }

    // Auditoria
    const resA = await fetch('api/comunicaciones.php?action=list_auditoria');
    const dataA = await resA.json();
    if(dataA.status === 'success') {
        const tb = document.getElementById('tb-auditoria');
        tb.innerHTML = dataA.data.length === 0 ? '<tr><td colspan="4">No hay logs</td></tr>' :
            dataA.data.map(a => `<tr><td>${a.fecha}</td><td>${a.usuario || 'Sistema'}</td><td>${a.accion} en ${a.entidad}</td><td>${a.detalles}</td></tr>`).join('');
    }

    // Form
    const form = document.getElementById('formComunicado');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'crear_comunicado');
            formData.append('titulo', document.getElementById('comTitulo').value);
            formData.append('contenido', document.getElementById('comContenido').value);
            
            const r = await fetch('api/comunicaciones.php', {method: 'POST', body: formData});
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalComunicado').classList.add('hidden');
                loadComunicaciones();
            }
        };
    }
}

async function loadFinanzas() {
    // Cargar Cartera
    const resC = await fetch('api/finanzas.php?action=list_cartera');
    const dataC = await resC.json();
    if(dataC.status === 'success') {
        const tb = document.getElementById('tb-cartera');
        tb.innerHTML = dataC.data.length === 0 ? '<tr><td colspan="3">No hay cartera pendiente</td></tr>' :
            dataC.data.map(c => `<tr><td>${c.id}</td><td>${c.torre || ''} ${c.apartamento}</td><td><b>$${c.mora_actual}</b></td></tr>`).join('');
    }

    // Cargar Pagos
    const resP = await fetch('api/finanzas.php?action=list_pagos');
    const dataP = await resP.json();
    if(dataP.status === 'success') {
        const tb = document.getElementById('tb-pagos');
        tb.innerHTML = dataP.data.length === 0 ? '<tr><td colspan="4">No hay pagos recientes</td></tr>' :
            dataP.data.map(p => `<tr><td>${p.apartamento}</td><td><span style="color:#16a34a">+$${p.valor}</span></td><td>${p.metodo_pago}</td><td>${p.fecha_pago}</td></tr>`).join('');
    }

    // Forms
    const formCobro = document.getElementById('formGenerarCobro');
    if (formCobro) {
        formCobro.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'generar_cobro');
            formData.append('valor', document.getElementById('cobroValor').value);
            formData.append('mes', document.getElementById('cobroMes').value);
            formData.append('anio', document.getElementById('cobroAnio').value);
            
            const r = await fetch('api/finanzas.php', {method: 'POST', body: formData});
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') loadFinanzas();
        };
    }

    const formPago = document.getElementById('formRegistrarPago');
    if (formPago) {
        formPago.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'registrar_pago');
            formData.append('inmueble_id', document.getElementById('pagoInmuebleId').value);
            formData.append('valor', document.getElementById('pagoValor').value);
            formData.append('metodo', document.getElementById('pagoMetodo').value);
            
            const r = await fetch('api/finanzas.php', {method: 'POST', body: formData});
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') loadFinanzas();
        };
    }
}

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

    const form = document.getElementById('formCrearUsuario');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'crear_usuario');
            formData.append('documento', document.getElementById('usrDoc').value);
            formData.append('nombre', document.getElementById('usrNombre').value);
            formData.append('email', document.getElementById('usrEmail').value);
            formData.append('password', document.getElementById('usrPass').value);
            formData.append('rol', document.getElementById('usrRol').value);
            
            const r = await fetch('api/users.php', {method: 'POST', body: formData});
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalUsuario').classList.add('hidden');
                loadUsuarios();
            }
        };
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
            tbody.innerHTML = `<tr><td colspan="5">No hay reservas</td></tr>`;
        } else {
            tbody.innerHTML = data.data.map(z => {
                let acciones = '';
                if (currentUser.rol === 'admin' && z.estado === 'Pendiente') {
                    acciones = `<button class="btn" style="background:#16a34a; color:white; padding:4px 8px; font-size:12px; margin-right:4px;" onclick="cambiarEstadoReserva(${z.id}, 'Aprobada')">Aprobar</button>
                                <button class="btn" style="background:#dc2626; color:white; padding:4px 8px; font-size:12px;" onclick="cambiarEstadoReserva(${z.id}, 'Rechazada')">Rechazar</button>`;
                } else if (currentUser.rol === 'admin') {
                    acciones = `<span style="font-size:12px; color:#888;">Resuelta</span>`;
                } else {
                    acciones = `<span style="font-size:12px; color:#888;">-</span>`;
                }
                
                return `<tr><td>${z.zona_nombre}</td><td>${z.usuario_nombre || 'Tú'}</td><td>${z.fecha_reserva}</td><td>${z.estado}</td><td>${acciones}</td></tr>`;
            }).join('');
        }
    }

    const form = document.getElementById('formCrearZona');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'crear_zona');
            formData.append('nombre', document.getElementById('zonaNombre').value);
            formData.append('aforo', document.getElementById('zonaAforo').value);
            formData.append('horarios', document.getElementById('zonaHorarios').value);
            formData.append('reglamento', document.getElementById('zonaReglamento').value);
            
            const r = await fetch('api/zonas.php', {method: 'POST', body: formData});
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalZona').classList.add('hidden');
                loadZonas();
            }
        };
    }
}

window.cambiarEstadoReserva = async function(id, estado) {
    if(!confirm(`¿Seguro que quieres marcar esta reserva como ${estado}?`)) return;
    const formData = new FormData();
    formData.append('action', 'estado_reserva');
    formData.append('reserva_id', id);
    formData.append('estado', estado);
    
    const r = await fetch('api/zonas.php', {method: 'POST', body: formData});
    const d = await r.json();
    if(d.status === 'success') {
        loadZonas();
    } else {
        alert(d.message);
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
