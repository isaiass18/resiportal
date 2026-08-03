document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

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
});

let currentUser = null;

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value ?? '';
    return element.innerHTML;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return 'Sin fecha';
    return new Date(value.replace(' ', 'T')).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

async function checkAuth() {
    try {
        const res = await fetch('api/auth.php?action=check');
        const data = await res.json();

        if (data.status === 'success') {
            currentUser = data.data;

            // Set topbar name
            const topbarNameEl = document.getElementById('topbarName');
            if (topbarNameEl) topbarNameEl.innerText = currentUser.nombre;

            // Set topbar role and avatar
            const topbarRoleEl = document.getElementById('topbarRole');
            if (topbarRoleEl) topbarRoleEl.innerText = (currentUser.rol.charAt(0).toUpperCase() + currentUser.rol.slice(1));

            const topbarAvatar = document.getElementById('topbarAvatar');
            if (topbarAvatar) topbarAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nombre)}&background=eff6ff&color=3b82f6`;

            document.getElementById('landing-screen')?.classList.add('hidden');
            document.getElementById('portal-selection')?.classList.add('hidden');
            document.getElementById('login-modal')?.classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('topbarName').innerText = currentUser.nombre;
            initApp();
        } else {
            document.getElementById('landing-screen').classList.remove('hidden');
            document.getElementById('app').classList.add('hidden');
            loadPublicEventos();
            loadPublicCartelera();
            loadPublicZonas();
        }
    } catch (e) {
        console.error('Error verificando sesión', e);
    }
}

async function loadPublicEventos() {
    try {
        const res = await fetch('api/eventos.php?action=list');
        const data = await res.json();
        const container = document.getElementById('listaEventosPublicos');

        if (data.status === 'success' && container) {
            if (data.data.length === 0) {
                container.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:var(--text-muted);">No hay eventos programados próximos.</div>';
                return;
            }
            container.innerHTML = data.data.map(ev => {
                const safeDate = ev.fecha_hora.replace(' ', 'T');
                const fechaStr = new Date(safeDate).toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `<div class="evento-card">
                            <div class="evento-fecha"><i class="fa-regular fa-calendar"></i> ${fechaStr}</div>
                            <h3 class="evento-titulo">${ev.titulo}</h3>
                            <div class="evento-lugar"><i class="fa-solid fa-location-dot"></i> ${ev.lugar}</div>
                            <p style="color:var(--text-muted); font-size:14px; line-height:1.5;">${ev.descripcion}</p>
                        </div>`;
            }).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadPublicCartelera() {
    try {
        const res = await fetch('api/comunicaciones.php?action=public_cartelera', { cache: 'no-store' });
        const data = await res.json();
        if (data.status === 'success') {
            const div = document.getElementById('public-cartelera-list');
            if (div) {
                div.innerHTML = data.data.length === 0 ? `
                    <div class="swiper-slide">
                        <div class="cartelera-slide-card public-cartelera-empty">
                            <i class="fa-regular fa-bell"></i>
                            <strong>Pronto habrá novedades</strong>
                            <span>La administración publicará aquí avisos, circulares e información importante.</span>
                        </div>
                    </div>` :
                    data.data.map(c => `
                        <div class="swiper-slide">
                            <article class="cartelera-slide-card">
                                <h4>${escapeHtml(c.titulo)}</h4>
                                <p>${escapeHtml(c.contenido)}</p>
                                <small>Publicado el ${formatDate(c.fecha_publicacion)} por ${escapeHtml(c.autor)}</small>
                            </article>
                        </div>
                    `).join('');

                // Initialize Swiper
                if (window.publicSwiper) window.publicSwiper.destroy();
                window.publicSwiper = new Swiper('.carteleraSwiper', {
                    slidesPerView: 1,
                    spaceBetween: 24,
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                    },
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev',
                    },
                    breakpoints: {
                        768: { slidesPerView: 2 },
                        1024: { slidesPerView: 3 }
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error loading public cartelera', e);
    }
}

function getZonaImagen(nombre) {
    const normalizado = (nombre || '').toLowerCase();
    if (normalizado.includes('piscina')) return 'img/piscina.jpg';
    if (normalizado.includes('gimnasio') || normalizado.includes('gym')) return 'img/gimnasio.jpg';
    return 'img/salon.jpg';
}

async function loadPublicZonas() {
    try {
        const res = await fetch('api/zonas.php?action=public_zonas');
        const data = await res.json();
        if (data.status === 'success') {
            const div = document.getElementById('public-zonas-grid');
            if (!div) return;

            // Protección adicional de interfaz frente a registros históricos duplicados.
            const zonas = [...new Map(data.data.map(zona => [zona.nombre.trim().toLowerCase(), zona])).values()];
            div.innerHTML = zonas.length === 0 ? '<p style="text-align:center;">No hay zonas configuradas aún.</p>' :
                zonas.map(zona => `
                    <button type="button" class="zona-card zona-card-action" onclick="abrirDetalleZona(${zona.id})">
                        <img src="${getZonaImagen(zona.nombre)}" alt="${escapeHtml(zona.nombre)}" class="zona-img">
                        <div class="zona-info">
                            <h3>${escapeHtml(zona.nombre)}</h3>
                            <p><i class="fa-solid fa-users"></i> Aforo: ${zona.aforo || 'No definido'} personas</p>
                            <p><i class="fa-solid fa-clock"></i> Horario: ${escapeHtml(zona.horarios || 'No definido')}</p>
                            <span class="zona-card-link">Ver especificaciones y disponibilidad <i class="fa-solid fa-arrow-right"></i></span>
                        </div>
                    </button>
                `).join('');
        }
    } catch (error) {
        console.error('Error loading public zonas', error);
    }
}

window.abrirDetalleZona = async function (zonaId) {
    const modal = document.getElementById('zona-detalle-modal');
    const title = document.getElementById('zona-detalle-titulo');
    modal.classList.remove('hidden');
    title.textContent = 'Cargando zona…';

    try {
        const response = await fetch(`api/zonas.php?action=public_zona_detalle&zona_id=${encodeURIComponent(zonaId)}`);
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message);

        const { zona, reservas } = data.data;
        document.getElementById('zona-detalle-imagen').style.backgroundImage = `linear-gradient(120deg, rgba(15,23,42,.2), rgba(15,23,42,.58)), url('${getZonaImagen(zona.nombre)}')`;
        title.textContent = zona.nombre;
        document.getElementById('zona-detalle-descripcion').textContent = zona.descripcion || 'Espacio disponible para el disfrute de la comunidad.';
        document.getElementById('zona-detalle-aforo').textContent = `${zona.aforo || 'No definido'} personas`;
        document.getElementById('zona-detalle-horario').textContent = zona.horarios || 'No definido';
        document.getElementById('zona-detalle-tarifa').textContent = Number(zona.tarifa || 0) > 0 ? formatCurrency(zona.tarifa) : 'Sin costo';
        document.getElementById('zona-detalle-reglamento').textContent = zona.reglamento || 'No hay normas adicionales registradas.';
        modal.dataset.zonaId = zona.id;

        if (window.publicZonaCalendar) window.publicZonaCalendar.destroy();
        const calendarEl = document.getElementById('public-zona-calendar');
        if (calendarEl && window.FullCalendar) {
            const fechaLocal = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            const hoy = fechaLocal(new Date());
            const estadosPorFecha = new Map(reservas.map(reserva => [reserva.fecha_reserva, reserva.estado]));

            window.publicZonaCalendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                height: 'auto',
                headerToolbar: { left: 'prev,next', center: 'title', right: '' },
                dayCellClassNames: (info) => {
                    if (info.isOther) return [];
                    const fecha = fechaLocal(info.date);
                    const estado = estadosPorFecha.get(fecha);
                    if (estado === 'aprobada') return ['zona-dia-reservado'];
                    if (estado === 'pendiente') return ['zona-dia-pendiente'];
                    return fecha < hoy ? ['zona-dia-pasado'] : ['zona-dia-disponible'];
                },
                events: reservas.map(reserva => ({
                    title: reserva.estado === 'aprobada' ? 'Reservado' : 'Solicitud pendiente',
                    start: reserva.fecha_reserva,
                    allDay: true,
                    classNames: [reserva.estado === 'aprobada' ? 'zona-calendar-reserva' : 'zona-calendar-pendiente']
                }))
            });
            window.publicZonaCalendar.render();
        }
    } catch (error) {
        console.error('Error cargando detalle de zona', error);
        title.textContent = 'No fue posible cargar esta zona';
    }
};

window.cerrarDetalleZona = function () {
    document.getElementById('zona-detalle-modal')?.classList.add('hidden');
};

window.abrirLoginParaReserva = function () {
    const zonaId = document.getElementById('zona-detalle-modal')?.dataset.zonaId;
    if (zonaId) sessionStorage.setItem('zonaPendienteReserva', zonaId);
    cerrarDetalleZona();
    openLoginModal('residente');
};

window.openLoginModal = function (role) {
    document.getElementById('portal-selection')?.classList.add('hidden');
    const title = document.getElementById('login-title');
    if (title) title.textContent = role === 'residente' ? 'Ingresa para reservar' : 'Iniciar sesión';
    document.getElementById('login-modal').classList.remove('hidden');
}

window.closeLoginModal = function () {
    document.getElementById('login-modal').classList.add('hidden');
}

// Login event listeners moved to DOMContentLoaded

function initApp() {
    setupNavigation();

    // Default view based on role
    if (currentUser.rol === 'vigilante') {
        loadView('porteria');
    } else if (currentUser.rol === 'residente') {
        loadView(sessionStorage.getItem('zonaPendienteReserva') ? 'zonas' : 'home-residente');
    } else {
        loadView('dashboard');
    }

    // Menu Toggle
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        const viewName = link.getAttribute('data-view');

        // Hide/Show links based on role
        if (currentUser.rol === 'vigilante') {
            if (viewName !== 'porteria' && viewName !== 'perfil') {
                link.style.display = 'none';
            } else if (viewName === 'porteria') {
                link.classList.add('active');
            }
        } else if (currentUser.rol === 'residente') {
            const allowed = ['home-residente', 'mis-pagos', 'zonas', 'reclamaciones', 'perfil'];
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
        if (viewName === 'dashboard') loadDashboard();
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
        if (viewName === 'configuracion') loadConfiguracion();
        if (viewName === 'perfil') loadPerfil();
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
    if (dataC.status === 'success') {
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
    if (data.status === 'success' && data.data) {
        document.getElementById('residente-mora').innerText = `$${data.data.mora_actual}`;
    } else {
        document.getElementById('residente-mora').innerText = `$0.00`;
    }

    // Vehículos
    const resV = await fetch('api/inmuebles.php?action=mis_vehiculos');
    const dataV = await resV.json();
    if (dataV.status === 'success') {
        const tb = document.getElementById('tb-mis-vehiculos');
        tb.innerHTML = dataV.data.length === 0 ? '<tr><td colspan="3">No tienes vehículos registrados</td></tr>' :
            dataV.data.map(v => `<tr><td>${v.placa}</td><td>${v.tipo}</td><td>${v.marca || ''} - ${v.linea || ''}</td></tr>`).join('');
    }

    const formV = document.getElementById('formNuevoVehiculo');
    if (formV) {
        formV.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(formV);
            formData.append('action', 'add_vehiculo');
            const res = await fetch('api/inmuebles.php', { method: 'POST', body: formData });
            const d = await res.json();
            alert(d.message);
            if (d.status === 'success') {
                formV.reset();
                formV.classList.add('hidden');
                loadHomeResidente();
            }
        };
    }

    // Mascotas
    const resM = await fetch('api/inmuebles.php?action=mis_mascotas');
    const dataM = await resM.json();
    if (dataM.status === 'success') {
        const tb = document.getElementById('tb-mis-mascotas');
        tb.innerHTML = dataM.data.length === 0 ? '<tr><td>No tienes mascotas registradas</td></tr>' :
            dataM.data.map(m => `<tr><td>${m.descripcion}</td></tr>`).join('');
    }

    const formM = document.getElementById('formNuevaMascota');
    if (formM) {
        formM.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(formM);
            formData.append('action', 'add_mascota');
            const res = await fetch('api/inmuebles.php', { method: 'POST', body: formData });
            const d = await res.json();
            alert(d.message);
            if (d.status === 'success') {
                formM.reset();
                formM.classList.add('hidden');
                loadHomeResidente();
            }
        };
    }
}

async function loadConfiguracion() {
    const res = await fetch('api/conjuntos.php?action=get_config');
    const data = await res.json();
    if (data.status === 'success' && data.data) {
        document.getElementById('config-nombre').value = data.data.nombre || '';
        document.getElementById('config-logo').value = data.data.logo_url || '';
    }

    const form = document.getElementById('formConfiguracion');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            formData.append('action', 'update_config');
            const res = await fetch('api/conjuntos.php', { method: 'POST', body: formData });
            const d = await res.json();
            alert(d.message);
            if (d.status === 'success') {
                document.querySelector('.logo span').innerText = formData.get('nombre');
            }
        };
    }
}

async function loadDashboard() {
    const novedadesEl = document.getElementById('admin-dashboard-novedades');
    const eventosEl = document.getElementById('admin-dashboard-eventos');

    try {
        const [resNovedades, resEventos, resFinanzas] = await Promise.all([
            fetch('api/comunicaciones.php?action=list_comunicados'),
            fetch('api/eventos.php?action=list'),
            fetch('api/finanzas.php?action=dashboard_financiero')
        ]);
        const [novedades, eventos, finanzas] = await Promise.all([
            resNovedades.json(), resEventos.json(), resFinanzas.json()
        ]);

        const listaNovedades = novedades.status === 'success' ? novedades.data : [];
        const listaEventos = eventos.status === 'success' ? eventos.data : [];
        const resumenFinanciero = finanzas.status === 'success' ? finanzas.data : {};

        document.getElementById('admin-total-novedades').textContent = listaNovedades.length;
        document.getElementById('admin-total-eventos').textContent = listaEventos.length;
        document.getElementById('admin-total-cartera').textContent = formatCurrency(resumenFinanciero.total_cartera);

        novedadesEl.innerHTML = listaNovedades.length === 0
            ? '<p class="admin-empty-state">Aún no hay novedades publicadas. Crea la primera para que aparezca en el inicio.</p>'
            : listaNovedades.slice(0, 4).map(novedad => `
                <article class="admin-feed-item">
                    <h4>${escapeHtml(novedad.titulo)}</h4>
                    <p>${escapeHtml(novedad.contenido)}</p>
                    <small><i class="fa-regular fa-clock"></i> ${formatDate(novedad.fecha_publicacion)}</small>
                </article>`).join('');

        eventosEl.innerHTML = listaEventos.length === 0
            ? '<p class="admin-empty-state">No hay eventos próximos. Crea uno para mostrarlo en el inicio.</p>'
            : listaEventos.slice(0, 4).map(evento => `
                <article class="admin-feed-item">
                    <h4>${escapeHtml(evento.titulo)}</h4>
                    <p><i class="fa-regular fa-calendar"></i> ${formatDate(evento.fecha_hora)} · ${escapeHtml(evento.lugar || 'Lugar por definir')}</p>
                    <small>${escapeHtml(evento.descripcion || '')}</small>
                </article>`).join('');
    } catch (error) {
        console.error('Error cargando el panel administrativo', error);
        if (novedadesEl) novedadesEl.innerHTML = '<p class="admin-empty-state">No fue posible cargar las novedades.</p>';
        if (eventosEl) eventosEl.innerHTML = '<p class="admin-empty-state">No fue posible cargar los eventos.</p>';
    }
}

window.abrirGestionContenido = function (tipo) {
    const link = document.querySelector('.nav-links li[data-view="comunicaciones"]');
    link?.click();

    window.setTimeout(() => {
        const modalId = tipo === 'evento' ? 'modalEvento' : 'modalComunicado';
        document.getElementById(modalId)?.classList.remove('hidden');
    }, 0);
};

async function loadComunicaciones() {
    // Comunicados
    const resC = await fetch('api/comunicaciones.php?action=list_comunicados');
    const dataC = await resC.json();
    if (dataC.status === 'success') {
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
    if (dataA.status === 'success') {
        const tb = document.getElementById('tb-auditoria');
        tb.innerHTML = dataA.data.length === 0 ? '<tr><td colspan="4">No hay logs</td></tr>' :
            dataA.data.map(a => `<tr><td>${a.fecha}</td><td>${a.usuario || 'Sistema'}</td><td>${a.accion} en ${a.entidad}</td><td>${a.detalles}</td></tr>`).join('');
    }

    // Eventos
    const resE = await fetch('api/eventos.php?action=list');
    const dataE = await resE.json();
    if (dataE.status === 'success') {
        const tbE = document.getElementById('tb-eventos-admin');
        if (tbE) {
            tbE.innerHTML = dataE.data.length === 0 ? '<tr><td colspan="4">No hay eventos</td></tr>' :
                dataE.data.map(e => `<tr>
                    <td>${new Date(e.fecha_hora).toLocaleString()}</td>
                    <td>${e.titulo}</td>
                    <td>${e.lugar}</td>
                    <td><button class="btn btn-ghost" style="color:red; padding:4px 8px;" onclick="eliminarEvento(${e.id})"><i class="fa-solid fa-trash"></i></button></td>
                </tr>`).join('');
        }
    }

    // Form Evento
    const formEv = document.getElementById('formEvento');
    if (formEv) {
        formEv.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'create');
            formData.append('titulo', document.getElementById('evTitulo').value);
            formData.append('fecha_hora', document.getElementById('evFecha').value);
            formData.append('lugar', document.getElementById('evLugar').value);
            formData.append('descripcion', document.getElementById('evDescripcion').value);

            const r = await fetch('api/eventos.php', { method: 'POST', body: formData });
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalEvento').classList.add('hidden');
                loadComunicaciones();
                // Opcional: Actualizar frontend publico si es necesario
                loadPublicEventos();
            }
        };
    }

    // Form Comunicado
    const form = document.getElementById('formComunicado');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'crear_comunicado');
            formData.append('titulo', document.getElementById('comTitulo').value);
            formData.append('contenido', document.getElementById('comContenido').value);

            const r = await fetch('api/comunicaciones.php', { method: 'POST', body: formData });
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                form.reset();
                document.getElementById('modalComunicado').classList.add('hidden');
                loadComunicaciones();
                loadPublicCartelera();
            }
        };
    }
}

window.eliminarEvento = async function (id) {
    if (!confirm('¿Eliminar evento?')) return;
    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('id', id);
    const r = await fetch('api/eventos.php', { method: 'POST', body: formData });
    const d = await r.json();
    alert(d.message);
    loadComunicaciones();
    loadPublicEventos();
};

async function loadFinanzas() {
    // Cargar Cartera
    const resC = await fetch('api/finanzas.php?action=cartera');
    const dataC = await resC.json();
    if (dataC.status === 'success') {
        const tb = document.getElementById('tb-cartera');
        tb.innerHTML = dataC.data.length === 0 ? '<tr><td colspan="3">No hay cartera pendiente</td></tr>' :
            dataC.data.map(c => `<tr><td>${c.torre || ''} ${c.apartamento}</td><td>${c.propietario_nombre || 'Sin Propietario'}</td><td><b>$${c.mora_actual}</b></td></tr>`).join('');
    }

    // Cargar Pagos Pendientes
    const resP = await fetch('api/finanzas.php?action=pagos_pendientes');
    const dataP = await resP.json();
    if (dataP.status === 'success') {
        const tb = document.getElementById('tb-pagos-pendientes');
        tb.innerHTML = dataP.data.length === 0 ? '<tr><td colspan="5">No hay pagos pendientes de aprobación</td></tr>' :
            dataP.data.map(p => `<tr>
                <td>${p.torre || ''} ${p.apartamento}</td>
                <td>${p.residente || 'Desconocido'}</td>
                <td><span style="color:#16a34a; font-weight:bold;">$${p.valor}</span></td>
                <td>${p.metodo_pago} (Ref: ${p.referencia})</td>
                <td>
                    <button class="btn btn-primary" style="background:#16a34a; padding:4px 8px;" onclick="aprobarPago(${p.id}, 'aprobado')"><i class="fa-solid fa-check"></i> Aprobar</button>
                    <button class="btn btn-ghost" style="color:#dc2626; padding:4px 8px;" onclick="aprobarPago(${p.id}, 'rechazado')"><i class="fa-solid fa-xmark"></i></button>
                </td>
            </tr>`).join('');
    }

    // Cargar Historial de Pagos (contabilidad)
    const resH = await fetch('api/finanzas.php?action=historial_pagos');
    const dataH = await resH.json();
    if (dataH.status === 'success') {
        const tb = document.getElementById('tb-historial-pagos');
        tb.innerHTML = dataH.data.length === 0 ? '<tr><td colspan="7">No hay pagos registrados</td></tr>' :
            dataH.data.map(p => `<tr>
                <td>${p.fecha_pago}</td>
                <td>${p.torre || ''} ${p.apartamento}</td>
                <td><b>$${p.valor}</b></td>
                <td>${p.metodo_pago}</td>
                <td>${p.descripcion || '<span style="color:var(--text-muted)">Sin descripción</span>'}</td>
                <td>${p.soporte_archivo ? `<a href="api/finanzas.php?action=ver_soporte&pago_id=${p.id}" target="_blank"><i class="fa-solid fa-paperclip"></i> Ver</a>` : '—'}</td>
                <td>${p.registrado_por_nombre || 'N/A'}</td>
            </tr>`).join('');
    }

    // Forms
    const formCobro = document.getElementById('formGenerarCobro');
    if (formCobro) {
        formCobro.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'generar_cobro');
            formData.append('valor', document.getElementById('cobroValor').value);

            const r = await fetch('api/finanzas.php', { method: 'POST', body: formData });
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalCobro').classList.add('hidden');
                loadFinanzas();
            }
        };
    }

    const formRegistrarPago = document.getElementById('formRegistrarPago');
    if (formRegistrarPago) {
        formRegistrarPago.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'registrar_pago');
            formData.append('inmueble_id', document.getElementById('pagoInmuebleId').value);
            formData.append('valor', document.getElementById('pagoValor').value);
            formData.append('metodo', document.getElementById('pagoMetodo').value);
            formData.append('referencia', document.getElementById('pagoReferencia').value);
            formData.append('descripcion', document.getElementById('pagoDescripcion').value);

            const soporteInput = document.getElementById('pagoSoporte');
            if (soporteInput.files[0]) {
                formData.append('soporte', soporteInput.files[0]);
            }

            const r = await fetch('api/finanzas.php', { method: 'POST', body: formData });
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                document.getElementById('modalRegistrarPago').classList.add('hidden');
                formRegistrarPago.reset();
                loadFinanzas();
            }
        };
    }
}

window.abrirModalRegistrarPago = async function () {
    const select = document.getElementById('pagoInmuebleId');
    select.innerHTML = '<option value="">Cargando inmuebles...</option>';
    document.getElementById('modalRegistrarPago').classList.remove('hidden');

    const res = await fetch('api/inmuebles.php?action=list');
    const data = await res.json();
    if (data.status === 'success') {
        select.innerHTML = '<option value="">Selecciona un inmueble...</option>' +
            data.data.map(i => `<option value="${i.id}">${i.torre || ''} Apto ${i.apartamento} (Debe: $${i.mora_actual})</option>`).join('');
    } else {
        select.innerHTML = '<option value="">Error cargando inmuebles</option>';
    }
};

window.aprobarPago = async function (pago_id, estado) {
    if (!confirm(`¿Estás seguro de que deseas marcar este pago como ${estado}?`)) return;
    const formData = new FormData();
    formData.append('action', 'aprobar_pago');
    formData.append('pago_id', pago_id);
    formData.append('estado', estado);

    const r = await fetch('api/finanzas.php', { method: 'POST', body: formData });
    const d = await r.json();
    alert(d.message);
    if (d.status === 'success') loadFinanzas();
};

async function loadMisPagos() {
    const res = await fetch('api/finanzas.php?action=mis_pagos');
    const data = await res.json();

    if (data.status === 'success') {
        // Actualizar Cuenta
        const cuenta = data.data.cuenta;
        if (cuenta) {
            document.getElementById('txtDeudaResidente').innerText = '$' + cuenta.mora_actual;
            document.getElementById('txtInmuebleResidente').innerHTML = `<i class="fa-solid fa-building"></i> ${cuenta.torre || ''} Apto ${cuenta.apartamento}`;
        }

        // Actualizar Historial
        const historial = data.data.historial;
        const tb = document.getElementById('tb-mis-pagos');
        tb.innerHTML = historial.length === 0 ? '<tr><td colspan="5">No has reportado ningún pago</td></tr>' :
            historial.map(p => `<tr>
                <td>${p.fecha_pago}</td>
                <td>$${p.valor}</td>
                <td>${p.metodo_pago}</td>
                <td>${p.referencia}</td>
                <td>
                    ${p.estado === 'pendiente' ? '<span class="badge" style="background:#fef08a; color:#854d0e;">Pendiente</span>' : ''}
                    ${p.estado === 'aprobado' ? '<span class="badge" style="background:#dcfce7; color:#166534;">Aprobado</span>' : ''}
                    ${p.estado === 'rechazado' ? '<span class="badge" style="background:#fee2e2; color:#991b1b;">Rechazado</span>' : ''}
                </td>
            </tr>`).join('');
    }

    const formReporte = document.getElementById('formReportarPago');
    if (formReporte) {
        formReporte.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('action', 'reportar_pago');
            formData.append('valor', document.getElementById('repPagoValor').value);
            formData.append('referencia', document.getElementById('repPagoRef').value);
            formData.append('metodo', document.getElementById('repPagoMetodo').value);

            const r = await fetch('api/finanzas.php', { method: 'POST', body: formData });
            const d = await r.json();
            alert(d.message);
            if (d.status === 'success') {
                formReporte.reset();
                loadMisPagos();
            }
        };
    }
}

async function loadPorteria() {
    try {
        const [resVis, resMin, resPaq, resDir] = await Promise.all([
            fetch('api/porteria.php?action=list_visitantes'),
            fetch('api/porteria.php?action=list_minuta'),
            fetch('api/porteria.php?action=list_paquetes'),
            fetch('api/porteria.php?action=list_directorio')
        ]);
        const dataV = await resVis.json();
        const dataM = await resMin.json();
        const dataP = await resPaq.json();
        const dataDir = await resDir.json();

        // Directorio
        const tbDir = document.getElementById('tb-directorio');
        const inputDir = document.getElementById('busquedaDirectorio');
        if (dataDir.status === 'success' && tbDir && inputDir) {
            const renderDir = (filterText) => {
                const text = filterText.toLowerCase();
                const filtered = dataDir.data.filter(u =>
                    (u.nombre || '').toLowerCase().includes(text) ||
                    (u.torre || '').toLowerCase().includes(text) ||
                    (u.apartamento || '').toLowerCase().includes(text)
                );
                if (filtered.length === 0) {
                    tbDir.innerHTML = `<tr><td colspan="4">No se encontraron residentes</td></tr>`;
                } else {
                    tbDir.innerHTML = filtered.map(u => `<tr>
                        <td><strong>${u.torre}</strong></td>
                        <td><strong>${u.apartamento}</strong></td>
                        <td>${u.nombre}</td>
                        <td><a href="mailto:${u.email}">${u.email}</a></td>
                    </tr>`).join('');
                }
            };

            renderDir('');
            inputDir.addEventListener('input', (e) => {
                renderDir(e.target.value);
            });
        }

        // Visitantes
        if (dataV.status === 'success') {
            const tb = document.getElementById('tb-visitantes');
            tb.innerHTML = dataV.data.length === 0 ? '<tr><td colspan="5">No hay visitas recientes</td></tr>' :
                dataV.data.map(v => `<tr><td>${v.nombre}</td><td>${v.apartamento || 'N/A'}</td><td>${v.vehiculo_placa || 'Ninguna'}</td><td>${v.fecha_ingreso}</td><td>${v.fecha_salida || '<span style="color:#16a34a">Adentro</span>'}</td></tr>`).join('');
        }

        // Paquetes
        if (dataP.status === 'success') {
            const tb = document.getElementById('tb-paquetes');
            tb.innerHTML = dataP.data.length === 0 ? '<tr><td colspan="4">No hay paquetes pendientes</td></tr>' :
                dataP.data.map(p => `<tr><td>${p.transportadora}</td><td>${p.apartamento || 'N/A'}</td><td>${p.fecha_recepcion}</td><td>${p.estado}</td></tr>`).join('');
        }

        // Minuta
        if (dataM.status === 'success') {
            const tb = document.getElementById('tb-minuta');
            tb.innerHTML = dataM.data.length === 0 ? '<tr><td colspan="3">Minuta vacía</td></tr>' :
                dataM.data.map(m => `<tr><td>${m.fecha_registro}</td><td>${m.vigilante}</td><td>${m.asunto}</td></tr>`).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

window.openUsuarioModal = function (id = null) {
    const form = document.getElementById('formCrearUsuario');
    if (form) form.reset();
    document.getElementById('usrId').value = '';
    document.getElementById('modalUsuarioTitle').innerText = 'Crear Usuario';

    if (id) {
        document.getElementById('modalUsuarioTitle').innerText = 'Editar Usuario';
        document.getElementById('usrId').value = id;
        const tr = document.querySelector(`tr[data-id="${id}"]`);
        if (tr) {
            document.getElementById('usrNombre').value = tr.children[0].innerText;
            document.getElementById('usrDoc').value = tr.children[1].innerText;
            document.getElementById('usrEmail').value = tr.children[3].innerText;
            const rolText = tr.children[2].innerText.toLowerCase();
            const rolSelect = document.getElementById('usrRol');
            if (rolText.includes('admin')) rolSelect.value = 'admin';
            else if (rolText.includes('vigi')) rolSelect.value = 'vigilante';
            else rolSelect.value = 'residente';
        }
    }

    document.getElementById('modalUsuario').classList.remove('hidden');
};

document.getElementById('formCrearUsuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const id = document.getElementById('usrId').value;
    formData.append('action', id ? 'update' : 'crear_usuario');
    if (id) formData.append('id', id);
    formData.append('documento', document.getElementById('usrDoc').value);
    formData.append('nombre', document.getElementById('usrNombre').value);
    formData.append('email', document.getElementById('usrEmail').value);
    formData.append('password', document.getElementById('usrPass').value);
    formData.append('rol', document.getElementById('usrRol').value);

    const res = await fetch('api/users.php', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.status === 'success') {
        document.getElementById('modalUsuario').classList.add('hidden');
        loadUsuarios();
    } else {
        alert('Error: ' + data.message);
    }
});

async function loadUsuarios() {
    const tbody = document.getElementById('listaUsuarios');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

    const res = await fetch('api/users.php?action=list');
    const data = await res.json();

    if (data.status === 'success') {
        tbody.innerHTML = data.data.map(u => `
            <tr data-id="${u.id}">
                <td>${u.nombre}</td>
                <td>${u.documento}</td>
                <td><span class="badge ${u.rol}">${u.rol}</span></td>
                <td>${u.email}</td>
                <td>
                    <button class="btn btn-ghost" onclick="window.openUsuarioModal(${u.id})" style="padding:4px 8px;"><i class="fa-solid fa-pen"></i> Editar</button>
                </td>
            </tr>
        `).join('');
    }
}

async function loadInmuebles() {
    const res = await fetch('api/inmuebles.php?action=list');
    const data = await res.json();
    const tbody = document.getElementById('tb-inmuebles');
    if (data.status === 'success') {
        tbody.innerHTML = data.data.map(i => `<tr><td>${i.torre || 'N/A'}</td><td>${i.apartamento}</td><td><b>$${i.mora_actual}</b></td><td>${i.num_vehiculos}</td><td>${i.num_mascotas}</td></tr>`).join('');
    }
}

let zonasActuales = [];

async function loadZonas() {
    const [reservasResponse, zonasResponse] = await Promise.all([
        fetch('api/zonas.php?action=list'),
        fetch('api/zonas.php?action=zonas_list')
    ]);
    const [reservasData, zonasData] = await Promise.all([reservasResponse.json(), zonasResponse.json()]);
    const esAdmin = currentUser.rol === 'admin';
    const reservas = reservasData.status === 'success' ? reservasData.data : [];
    zonasActuales = zonasData.status === 'success' ? zonasData.data : [];

    document.getElementById('btnNuevaZona')?.classList.toggle('hidden', !esAdmin);
    document.getElementById('panelGestionZonas')?.classList.toggle('hidden', !esAdmin);
    document.getElementById('panelReservarZona')?.classList.toggle('hidden', esAdmin);

    const zonasConfig = document.getElementById('tb-zonas-config');
    if (zonasConfig && esAdmin) {
        zonasConfig.innerHTML = zonasActuales.length === 0 ? '<tr><td colspan="5">No hay zonas configuradas</td></tr>' :
            zonasActuales.map(zona => `<tr>
                <td><strong>${escapeHtml(zona.nombre)}</strong><br><small>${escapeHtml(zona.descripcion || 'Sin descripción')}</small></td>
                <td>${zona.aforo}</td><td>${escapeHtml(zona.horarios)}</td>
                <td>${Number(zona.tarifa || 0) > 0 ? formatCurrency(zona.tarifa) : 'Sin costo'}</td>
                <td><button class="btn btn-ghost" style="width:auto; color:var(--primary); padding:4px 8px;" onclick="editarZona(${zona.id})"><i class="fa-solid fa-pen"></i> Editar</button></td>
            </tr>`).join('');
    }

    const selectZona = document.getElementById('reservaZonaId');
    if (selectZona && !esAdmin) {
        selectZona.innerHTML = '<option value="">Selecciona una zona…</option>' + zonasActuales.map(zona =>
            `<option value="${zona.id}">${escapeHtml(zona.nombre)} · ${escapeHtml(zona.horarios)}</option>`
        ).join('');
        const zonaPendiente = sessionStorage.getItem('zonaPendienteReserva');
        if (zonaPendiente && zonasActuales.some(zona => String(zona.id) === zonaPendiente)) selectZona.value = zonaPendiente;
        sessionStorage.removeItem('zonaPendienteReserva');
        const fecha = document.getElementById('reservaFecha');
        if (fecha) fecha.min = new Date().toISOString().split('T')[0];
    }

    const tbody = document.getElementById('tb-zonas');
    tbody.innerHTML = reservas.length === 0 ? '<tr><td colspan="5">No hay reservas registradas</td></tr>' :
        reservas.map(reserva => {
            const acciones = esAdmin && reserva.estado === 'pendiente'
                ? `<button class="btn" style="background:#16a34a; color:white; padding:4px 8px; font-size:12px; margin-right:4px;" onclick="cambiarEstadoReserva(${reserva.id}, 'aprobada')">Aprobar</button><button class="btn" style="background:#dc2626; color:white; padding:4px 8px; font-size:12px;" onclick="cambiarEstadoReserva(${reserva.id}, 'rechazada')">Rechazar</button>`
                : `<span style="font-size:12px; color:#888;">${esAdmin ? 'Procesada' : '—'}</span>`;
            const residente = esAdmin ? escapeHtml(reserva.usuario_nombre || 'Sin asignar') : 'Tú';
            const etiquetaEstado = reserva.estado.charAt(0).toUpperCase() + reserva.estado.slice(1);
            return `<tr><td>${escapeHtml(reserva.zona_nombre)}</td><td>${residente}</td><td>${formatDate(reserva.fecha_reserva)}</td><td><span class="reserva-estado estado-${reserva.estado}">${etiquetaEstado}</span></td><td>${acciones}</td></tr>`;
        }).join('');

    const calEl = document.getElementById('calendar');
    if (calEl && window.FullCalendar) {
        if (window.zonasCalendar) window.zonasCalendar.destroy();
        window.zonasCalendar = new FullCalendar.Calendar(calEl, {
            initialView: 'dayGridMonth', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth' },
            events: reservas.map(reserva => ({
                title: `${reserva.zona_nombre} · ${reserva.estado}`,
                start: reserva.fecha_reserva, allDay: true,
                color: reserva.estado === 'aprobada' ? '#16a34a' : (reserva.estado === 'pendiente' ? '#d97706' : '#dc2626')
            }))
        });
        window.zonasCalendar.render();
    }

    const formZona = document.getElementById('formCrearZona');
    if (formZona && esAdmin) {
        formZona.onsubmit = async (event) => {
            event.preventDefault();
            const zonaId = document.getElementById('zonaId').value;
            const formData = new FormData();
            formData.append('action', zonaId ? 'actualizar_zona' : 'crear_zona');
            formData.append('zona_id', zonaId);
            formData.append('nombre', document.getElementById('zonaNombre').value);
            formData.append('descripcion', document.getElementById('zonaDescripcion').value);
            formData.append('aforo', document.getElementById('zonaAforo').value);
            formData.append('tarifa', document.getElementById('zonaTarifa').value);
            formData.append('horarios', document.getElementById('zonaHorarios').value);
            formData.append('reglamento', document.getElementById('zonaReglamento').value);
            const response = await fetch('api/zonas.php', { method: 'POST', body: formData });
            const result = await response.json();
            alert(result.message);
            if (result.status === 'success') {
                cerrarFormularioZona();
                loadZonas();
                loadPublicZonas();
            }
        };
    }

    const formReserva = document.getElementById('formReservarZona');
    if (formReserva && !esAdmin) {
        formReserva.onsubmit = async (event) => {
            event.preventDefault();
            const formData = new FormData();
            formData.append('action', 'crear_reserva');
            formData.append('zona_id', document.getElementById('reservaZonaId').value);
            formData.append('fecha_reserva', document.getElementById('reservaFecha').value);
            const response = await fetch('api/zonas.php', { method: 'POST', body: formData });
            const result = await response.json();
            alert(result.message);
            if (result.status === 'success') {
                formReserva.reset();
                loadZonas();
            }
        };
    }
}

window.abrirFormularioZona = function (zona = null) {
    const form = document.getElementById('formCrearZona');
    form.reset();
    document.getElementById('zonaId').value = zona?.id || '';
    document.getElementById('tituloFormularioZona').textContent = zona ? 'Editar zona social' : 'Configurar zona social';
    document.getElementById('btnGuardarZona').textContent = zona ? 'Guardar cambios' : 'Crear zona';
    if (zona) {
        document.getElementById('zonaNombre').value = zona.nombre || '';
        document.getElementById('zonaDescripcion').value = zona.descripcion || '';
        document.getElementById('zonaAforo').value = zona.aforo || '';
        document.getElementById('zonaTarifa').value = zona.tarifa || 0;
        document.getElementById('zonaHorarios').value = zona.horarios || '';
        document.getElementById('zonaReglamento').value = zona.reglamento || '';
        document.getElementById('zonaYoutube').value = zona.youtube_url || '';
    }
    document.getElementById('modalZona').classList.remove('hidden');
};

window.cerrarFormularioZona = function () {
    document.getElementById('modalZona')?.classList.add('hidden');
};

window.editarZona = function (zonaId) {
    const zona = zonasActuales.find(item => Number(item.id) === Number(zonaId));
    if (zona) abrirFormularioZona(zona);
};

window.cambiarEstadoReserva = async function (id, estado) {
    if (!confirm(`¿Seguro que quieres marcar esta reserva como ${estado}?`)) return;
    const formData = new FormData();
    formData.append('action', 'estado_reserva');
    formData.append('reserva_id', id);
    formData.append('estado', estado);
    const response = await fetch('api/zonas.php', { method: 'POST', body: formData });
    const result = await response.json();
    if (result.status === 'success') loadZonas();
    else alert(result.message);
}

async function loadReclamaciones() {
    const res = await fetch('api/reclamaciones.php?action=list');
    const data = await res.json();
    const tbody = document.getElementById('tb-reclamaciones');
    if (data.status === 'success') {
        if (data.data.length === 0) {
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
            if (data.status === 'success') {
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
        const fileInput = document.getElementById('excelFile');
        const file = fileInput?.files[0];
        if (!file) {
            alert('Selecciona nuevamente el archivo antes de procesar.');
            return;
        }

        const mapping = {};
        systemFields.forEach(field => {
            const select = mappingForm.querySelector(`select[name="map_${field.key}"]`);
            mapping[field.key] = select ? select.value : '';
        });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('action', 'process');
        formData.append('mapping', JSON.stringify(mapping));

        const btn = document.getElementById('btnProcesarImportacion');
        btn.disabled = true;
        btn.innerText = 'Procesando...';

        try {
            const res = await fetch('api/import.php', { method: 'POST', body: formData });
            const data = await res.json();
            alert(data.message);
            if (data.status === 'success') {
                mappingSection.classList.add('hidden');
                fileInput.value = '';
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar la importación.');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Procesar Importación';
        }
    };
}


/* Mejoras integradas 2026-08-03: vistas seguras y flujos operativos */
function imagenZona(zona) {
    const ruta = String(zona?.imagen_url || '').trim();
    return /^(uploads\/zonas\/[A-Za-z0-9_.-]+|img\/[A-Za-z0-9_.-]+)$/.test(ruta) ? ruta : getZonaImagen(zona?.nombre || '');
}
function youtubeId(url) {
    try {
        const parsed = new URL(url); const host = parsed.hostname.toLowerCase();
        const id = host === 'youtu.be' || host === 'www.youtu.be' ? parsed.pathname.slice(1) : (parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop());
        return /^[\w-]{11}$/.test(id || '') ? id : null;
    } catch (_) { return null; }
}
function estadoReservaClase(estado) { return estado === 'aprobada' ? 'zona-dia-reservado' : estado === 'pendiente' ? 'zona-dia-pendiente' : 'zona-dia-disponible'; }
function fechaLocal(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

loadPublicZonas = async function () {
    try {
        const response = await fetch('api/zonas.php?action=public_zonas', { cache: 'no-store' }); const data = await response.json();
        const target = document.getElementById('public-zonas-grid'); if (!target || data.status !== 'success') return;
        target.innerHTML = data.data.length ? data.data.map(zona => `<button type="button" class="zona-card zona-card-action" onclick="abrirDetalleZona(${Number(zona.id)})"><img src="${escapeHtml(imagenZona(zona))}" alt="${escapeHtml(zona.nombre)}" class="zona-img"><div class="zona-info"><h3>${escapeHtml(zona.nombre)}</h3><p><i class="fa-solid fa-users"></i> Aforo: ${Number(zona.aforo) || 'No definido'} personas</p><p><i class="fa-solid fa-clock"></i> Horario: ${escapeHtml(zona.horarios || 'No definido')}</p><span class="zona-card-link">Ver especificaciones y disponibilidad <i class="fa-solid fa-arrow-right"></i></span></div></button>`).join('') : '<p class="muted">No hay zonas configuradas aún.</p>';
    } catch (error) { console.error('Error cargando zonas públicas', error); }
};
window.abrirDetalleZona = async function (zonaId) {
    const modal = document.getElementById('zona-detalle-modal'); const title = document.getElementById('zona-detalle-titulo');
    if (!modal || !title) return; modal.classList.remove('hidden'); title.textContent = 'Cargando zona…';
    try {
        const response = await fetch(`api/zonas.php?action=public_zona_detalle&zona_id=${encodeURIComponent(zonaId)}`); const data = await response.json(); if (data.status !== 'success') throw new Error(data.message);
        const { zona, reservas } = data.data; document.getElementById('zona-detalle-imagen').style.backgroundImage = `linear-gradient(120deg, rgba(15,23,42,.2), rgba(15,23,42,.58)), url("${imagenZona(zona)}")`;
        title.textContent = zona.nombre; document.getElementById('zona-detalle-descripcion').textContent = zona.descripcion || 'Espacio disponible para el disfrute de la comunidad.';
        document.getElementById('zona-detalle-aforo').textContent = `${zona.aforo || 'No definido'} personas`; document.getElementById('zona-detalle-horario').textContent = zona.horarios || 'No definido'; document.getElementById('zona-detalle-tarifa').textContent = Number(zona.tarifa) ? formatCurrency(zona.tarifa) : 'Sin costo'; document.getElementById('zona-detalle-reglamento').textContent = zona.reglamento || 'No hay normas adicionales registradas.'; modal.dataset.zonaId = zona.id;
        let video = document.getElementById('zona-detalle-video'); if (!video) { video = document.createElement('div'); video.id = 'zona-detalle-video'; video.className = 'zona-video'; document.querySelector('.zona-detalle-rules').insertAdjacentElement('afterend', video); }
        const id = youtubeId(zona.youtube_url); video.innerHTML = id ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video de ${escapeHtml(zona.nombre)}" loading="lazy" allowfullscreen></iframe>` : '';
        if (window.publicZonaCalendar) window.publicZonaCalendar.destroy(); const calendar = document.getElementById('public-zona-calendar'); const hoy = fechaLocal(new Date()); const estados = new Map(reservas.map(item => [item.fecha_reserva, item.estado]));
        window.publicZonaCalendar = new FullCalendar.Calendar(calendar, { initialView: 'dayGridMonth', locale: 'es', height: 'auto', headerToolbar: { left: 'prev,next', center: 'title', right: '' }, dayCellClassNames: info => info.isOther ? [] : [estados.has(fechaLocal(info.date)) ? estadoReservaClase(estados.get(fechaLocal(info.date))) : (fechaLocal(info.date) < hoy ? 'zona-dia-pasado' : 'zona-dia-disponible')], events: reservas.map(item => ({ title: item.estado === 'aprobada' ? 'Reservado' : 'Solicitud pendiente', start: item.fecha_reserva, allDay: true, classNames: [item.estado === 'aprobada' ? 'zona-calendar-reserva' : 'zona-calendar-pendiente'] })) }); window.publicZonaCalendar.render();
    } catch (error) { console.error(error); title.textContent = 'No fue posible cargar esta zona'; }
};

const cargarZonasBase = loadZonas;
loadZonas = async function () {
    await cargarZonasBase();
    const esAdmin = currentUser?.rol === 'admin';
    if (esAdmin) {
        const form = document.getElementById('formCrearZona');
        if (form) form.onsubmit = async event => { event.preventDefault(); const data = new FormData(); const id = document.getElementById('zonaId').value; data.append('action', id ? 'actualizar_zona' : 'crear_zona');['zonaId', 'zonaNombre', 'zonaDescripcion', 'zonaAforo', 'zonaTarifa', 'zonaHorarios', 'zonaReglamento'].forEach(key => data.append({ zonaId: 'zona_id', zonaNombre: 'nombre', zonaDescripcion: 'descripcion', zonaAforo: 'aforo', zonaTarifa: 'tarifa', zonaHorarios: 'horarios', zonaReglamento: 'reglamento' }[key], document.getElementById(key).value)); data.append('youtube_url', document.getElementById('zonaYoutube').value); const file = document.getElementById('zonaImagen').files[0]; if (file) data.append('imagen', file); const response = await fetch('api/zonas.php', { method: 'POST', body: data }); const result = await response.json(); alert(result.message); if (result.status === 'success') { cerrarFormularioZona(); loadZonas(); loadPublicZonas(); } };
        return;
    }
    const select = document.getElementById('reservaZonaId'); if (!select) return;
    let calendar = document.getElementById('calendar-disponibilidad-residente'); if (!calendar) { calendar = document.createElement('div'); calendar.id = 'calendar-disponibilidad-residente'; calendar.className = 'resident-zone-calendar'; document.getElementById('calendar').insertAdjacentElement('beforebegin', calendar); }
    const render = async () => { if (!select.value) { calendar.innerHTML = '<p class="muted">Selecciona una zona para consultar disponibilidad.</p>'; return; } const response = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(select.value)}`); const result = await response.json(); if (result.status !== 'success') { calendar.textContent = result.message; return; } const estados = new Map(result.data.reservas.map(item => [item.fecha_reserva, item.estado])); const hoy = fechaLocal(new Date()); if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy(); window.residentAvailabilityCalendar = new FullCalendar.Calendar(calendar, { initialView: 'dayGridMonth', locale: 'es', height: 'auto', headerToolbar: { left: 'prev,next today', center: 'title', right: '' }, dayCellClassNames: info => { const fecha = fechaLocal(info.date); return [estados.has(fecha) ? estadoReservaClase(estados.get(fecha)) : (fecha <= hoy ? 'zona-dia-pasado' : 'zona-dia-disponible')]; }, dateClick: async info => { const fecha = info.dateStr; if (fecha <= hoy || estados.has(fecha)) return; if (!confirm(`¿Solicitar reserva para el ${formatDate(fecha)}?`)) return; const data = new FormData(); data.append('action', 'crear_reserva'); data.append('zona_id', select.value); data.append('fecha_reserva', fecha); const r = await fetch('api/zonas.php', { method: 'POST', body: data }); const d = await r.json(); alert(d.message); if (d.status === 'success') loadZonas(); } }); window.residentAvailabilityCalendar.render(); };
    select.onchange = render; render();
};

const cargarMisPagosBase = loadMisPagos;
loadMisPagos = async function () {
    const [response, deudaResponse] = await Promise.all([fetch('api/finanzas.php?action=mis_pagos'), fetch('api/finanzas.php?action=mi_deuda')]); const [data, deuda] = await Promise.all([response.json(), deudaResponse.json()]);
    if (data.status === 'success') { const cuenta = deuda.status === 'success' && deuda.data.inmueble ? deuda.data.inmueble : data.data.cuenta; document.getElementById('txtDeudaResidente').textContent = deuda.status === 'success' ? formatCurrency(deuda.data.mora_actual) : formatCurrency(cuenta.mora_actual); document.getElementById('txtInmuebleResidente').innerHTML = `<i class="fa-solid fa-building"></i> ${escapeHtml(cuenta.torre || '')} ${escapeHtml(cuenta.nomenclatura || cuenta.apartamento || '')}`; const tbody = document.getElementById('tb-mis-pagos'); tbody.innerHTML = data.data.historial.length ? data.data.historial.map(p => `<tr><td>${escapeHtml(p.fecha_pago)}</td><td>${formatCurrency(p.valor)}</td><td>${escapeHtml(p.metodo_pago)}</td><td>${escapeHtml(p.referencia || '')}<br><small>${escapeHtml(p.descripcion || 'Sin descripción')}</small></td><td>${p.soporte_archivo ? `<a href="api/finanzas.php?action=ver_soporte&pago_id=${Number(p.id)}" target="_blank" rel="noopener">Ver soporte</a>` : '—'}</td><td><span class="reserva-estado estado-${escapeHtml(p.estado)}">${escapeHtml(p.estado)}</span></td></tr>`).join('') : '<tr><td colspan="6">No has reportado pagos.</td></tr>'; }
    const form = document.getElementById('formReportarPago'); if (form) form.onsubmit = async event => { event.preventDefault(); const fd = new FormData(); fd.append('action', 'reportar_pago'); fd.append('valor', document.getElementById('repPagoValor').value); fd.append('referencia', document.getElementById('repPagoRef').value); fd.append('metodo', document.getElementById('repPagoMetodo').value); fd.append('descripcion', document.getElementById('repPagoDescripcion').value); const file = document.getElementById('repPagoSoporte').files[0]; if (file) fd.append('soporte', file); const r = await fetch('api/finanzas.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') loadMisPagos(); };
};

loadHomeResidente = async function () {
    const [comRes, deudaRes, vehRes, masRes] = await Promise.all([fetch('api/comunicaciones.php?action=list_comunicados'), fetch('api/finanzas.php?action=mi_deuda'), fetch('api/inmuebles.php?action=mis_vehiculos'), fetch('api/inmuebles.php?action=mis_mascotas')]);
    const [com, deuda, veh, mas] = await Promise.all([comRes.json(), deudaRes.json(), vehRes.json(), masRes.json()]);
    const comunicados = document.getElementById('residente-comunicados'); if (com.status === 'success' && comunicados) comunicados.innerHTML = com.data.length ? com.data.map(c => `<article class="notice-item"><h4>${escapeHtml(c.titulo)}</h4><p>${escapeHtml(c.contenido)}</p><small>${escapeHtml(c.fecha_publicacion)}</small></article>`).join('') : '<p class="empty-state">No hay comunicados recientes.</p>';
    document.getElementById('residente-mora').textContent = deuda.status === 'success' ? formatCurrency(deuda.data.mora_actual) : formatCurrency(0);
    const vehiculos = document.getElementById('tb-mis-vehiculos'); if (vehiculos) vehiculos.innerHTML = veh.status === 'success' && veh.data.length ? veh.data.map(v => `<tr><td><strong>${escapeHtml(v.placa)}</strong></td><td>${escapeHtml(v.tipo)}</td><td>${escapeHtml([v.marca, v.linea].filter(Boolean).join(' · ') || 'No informado')}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-state">Aún no tienes vehículos registrados.</td></tr>';
    const mascotas = document.getElementById('tb-mis-mascotas'); if (mascotas) mascotas.innerHTML = mas.status === 'success' && mas.data.length ? mas.data.map(m => `<tr><td>${escapeHtml(m.descripcion)}</td></tr>`).join('') : '<tr><td class="empty-state">Aún no tienes mascotas registradas.</td></tr>';
    ['formNuevoVehiculo', 'formNuevaMascota'].forEach(id => { const form = document.getElementById(id); if (form) form.classList.add('resident-asset-form'); });
};

loadConfiguracion = async function () {
    const response = await fetch('api/conjuntos.php?action=get_config'); const data = await response.json(); const logo = document.getElementById('config-logo'); const preview = document.getElementById('config-logo-preview'); if (data.status === 'success') { document.getElementById('config-nombre').value = data.data.nombre || ''; logo.value = data.data.logo_url || ''; if (data.data.logo_url) { preview.src = data.data.logo_url; preview.classList.remove('hidden'); } }
    const updatePreview = () => { const file = document.getElementById('config-logo-archivo').files[0]; const url = file ? URL.createObjectURL(file) : logo.value; if (url) { preview.src = url; preview.classList.remove('hidden'); } }; logo.oninput = updatePreview; document.getElementById('config-logo-archivo').onchange = updatePreview;
    document.getElementById('formConfiguracion').onsubmit = async event => { event.preventDefault(); const fd = new FormData(event.currentTarget); fd.append('action', 'update_config'); const r = await fetch('api/conjuntos.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') { document.querySelectorAll('.logo span').forEach(el => el.textContent = document.getElementById('config-nombre').value); if (d.data.logo_url) { preview.src = d.data.logo_url; preview.classList.remove('hidden'); } } };
};
function loadPerfil() { const form = document.getElementById('formCambiarPassword'); form.onsubmit = async event => { event.preventDefault(); const fd = new FormData(); fd.append('action', 'cambiar_password'); fd.append('password_actual', document.getElementById('passwordActual').value); fd.append('password_nueva', document.getElementById('passwordNueva').value); fd.append('password_confirmacion', document.getElementById('passwordConfirmacion').value); const r = await fetch('api/auth.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') form.reset(); }; }

let usuariosActuales = [];
loadUsuarios = async function () {
    const tbody = document.getElementById('listaUsuarios'); const response = await fetch('api/users.php?action=list'); const data = await response.json(); if (data.status !== 'success') return; usuariosActuales = data.data; const vigilantes = data.data.filter(u => u.rol === 'vigilante').length; const note = document.getElementById('usuarios-contador'); if (note) note.textContent = `${data.data.length} usuarios · ${vigilantes} vigilante${vigilantes === 1 ? '' : 's'} gestionados aquí`;
    tbody.innerHTML = data.data.map(u => `<tr><td>${escapeHtml(u.nombre)}</td><td>${escapeHtml(u.documento)}</td><td><span class="reserva-estado">${escapeHtml(u.rol)}</span></td><td>${escapeHtml(u.email)}</td><td><button class="btn btn-ghost" style="width:auto" onclick="openUsuarioModal(${Number(u.id)})"><i class="fa-solid fa-pen"></i> Editar</button></td></tr>`).join('') || '<tr><td colspan="5">No hay usuarios.</td></tr>';
};
window.openUsuarioModal = function (id = null) { const form = document.getElementById('formCrearUsuario'); form.reset(); const user = usuariosActuales.find(item => Number(item.id) === Number(id)); document.getElementById('usrId').value = user?.id || ''; document.getElementById('modalUsuarioTitle').textContent = user ? 'Editar usuario' : 'Crear usuario'; if (user) { document.getElementById('usrDoc').value = user.documento; document.getElementById('usrNombre').value = user.nombre; document.getElementById('usrEmail').value = user.email; document.getElementById('usrRol').value = user.rol; } document.getElementById('modalUsuario').classList.remove('hidden'); };

let inmueblesActuales = [];
loadInmuebles = async function () { const r = await fetch('api/inmuebles.php?action=list'); const d = await r.json(); if (d.status !== 'success') return; inmueblesActuales = d.data; document.getElementById('tb-inmuebles').innerHTML = d.data.length ? d.data.map(i => `<tr><td>${escapeHtml(i.tipo_unidad || 'apartamento')}</td><td>${escapeHtml(i.torre || '—')}</td><td><strong>${escapeHtml(i.nomenclatura || i.apartamento)}</strong></td><td>${escapeHtml(i.parqueadero || '—')}</td><td>${escapeHtml(i.coeficiente || '0')}</td><td>${formatCurrency(i.mora_actual)}</td><td><button class="btn btn-ghost" style="width:auto" onclick="abrirModalInmueble(${Number(i.id)})">Editar</button></td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">No hay unidades registradas.</td></tr>'; const form = document.getElementById('formInmueble'); form.onsubmit = guardarInmueble; };
window.abrirModalInmueble = function (id = null) { const item = inmueblesActuales.find(row => Number(row.id) === Number(id)); document.getElementById('formInmueble').reset(); document.getElementById('inmuebleId').value = item?.id || ''; document.getElementById('inmuebleTitulo').textContent = item ? 'Editar unidad' : 'Nueva unidad'; if (item) { document.getElementById('inmuebleTipo').value = item.tipo_unidad || 'apartamento'; document.getElementById('inmuebleTorre').value = item.torre || ''; document.getElementById('inmuebleNomenclatura').value = item.nomenclatura || item.apartamento || ''; document.getElementById('inmuebleParqueadero').value = item.parqueadero || ''; document.getElementById('inmuebleCoeficiente').value = item.coeficiente || 0; document.getElementById('inmuebleMora').value = item.mora_actual || 0; } document.getElementById('modalInmueble').classList.remove('hidden'); }; window.cerrarModalInmueble = () => document.getElementById('modalInmueble').classList.add('hidden');
async function guardarInmueble(event) { event.preventDefault(); const fd = new FormData(); fd.append('action', 'guardar_inmueble');[['id', 'inmuebleId'], ['tipo_unidad', 'inmuebleTipo'], ['torre', 'inmuebleTorre'], ['nomenclatura', 'inmuebleNomenclatura'], ['parqueadero', 'inmuebleParqueadero'], ['coeficiente', 'inmuebleCoeficiente'], ['mora_actual', 'inmuebleMora']].forEach(([key, id]) => fd.append(key, document.getElementById(id).value)); const r = await fetch('api/inmuebles.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') { cerrarModalInmueble(); loadInmuebles(); } }

loadPorteria = async function () {
    try {
        const [vis, min, paq, dir, unidades] = await Promise.all(['list_visitantes', 'list_minuta', 'list_paquetes', 'list_directorio', 'list_inmuebles'].map(action => fetch(`api/porteria.php?action=${action}`).then(r => r.json()))); const destino = unidades.status === 'success' ? unidades.data : []; const opciones = destino.map(i => `<option value="${Number(i.id)}">${escapeHtml([i.torre, i.nomenclatura || i.apartamento].filter(Boolean).join(' · '))}</option>`).join('');
        document.getElementById('tb-directorio').innerHTML = dir.data?.length ? dir.data.map(u => `<tr><td>${escapeHtml(u.torre)}</td><td>${escapeHtml(u.apartamento)}</td><td>${escapeHtml(u.nombre)}</td><td>${escapeHtml(u.email)}</td></tr>`).join('') : '<tr><td colspan="4">No hay residentes.</td></tr>';
        document.getElementById('tb-visitantes').innerHTML = vis.data?.length ? vis.data.map(v => `<tr><td>${escapeHtml(v.nombre)}</td><td>${escapeHtml(v.apartamento || v.nomenclatura || '—')}</td><td>${escapeHtml(v.vehiculo_placa || '—')}</td><td>${escapeHtml(v.fecha_ingreso)}</td><td>${v.fecha_salida ? escapeHtml(v.fecha_salida) : `<button class="btn btn-primary" style="padding:4px 8px" onclick="cerrarVisita(${Number(v.id)})">Marcar salida</button>`}</td></tr>`).join('') : '<tr><td colspan="5">No hay visitas.</td></tr>';
        document.getElementById('tb-paquetes').innerHTML = paq.data?.length ? paq.data.map(p => `<tr><td>${escapeHtml(p.transportadora)}</td><td>${escapeHtml(p.apartamento || p.nomenclatura || '—')}</td><td>${escapeHtml(p.fecha_recepcion)}</td><td>${p.estado === 'pendiente' ? `<button class="btn btn-primary" style="padding:4px 8px" onclick="entregarPaquete(${Number(p.id)})">Entregar</button>` : 'Entregado'}</td></tr>`).join('') : '<tr><td colspan="4">No hay paquetes.</td></tr>';
        document.getElementById('tb-minuta').innerHTML = min.data?.length ? min.data.map(m => `<tr><td>${escapeHtml(m.fecha_registro)}</td><td>${escapeHtml(m.vigilante)}</td><td>${escapeHtml(m.asunto)}</td></tr>`).join('') : '<tr><td colspan="3">Minuta vacía.</td></tr>';
        let modal = document.getElementById('modalPorteria'); if (!modal) { document.getElementById('view-container').insertAdjacentHTML('beforeend', `<div id="modalPorteria" class="login-modal hidden"><div class="login-box"><button type="button" class="close-btn" onclick="document.getElementById('modalPorteria').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><h2 id="porteriaModalTitle"></h2><form id="formPorteria" class="stack-form"></form></div></div>`); modal = document.getElementById('modalPorteria'); } modal.dataset.opciones = opciones;
    } catch (error) { console.error(error); }
};
window.abrirModalPorteria = function (tipo) { const modal = document.getElementById('modalPorteria'); if (!modal) return; const form = document.getElementById('formPorteria'); const opciones = modal.dataset.opciones || ''; const estructuras = { visita: ['Registrar visita', `<input name="nombre" placeholder="Nombre del visitante" required><input name="documento" placeholder="Documento (opcional)"><input name="vehiculo_placa" placeholder="Placa (opcional)"><select name="inmueble_id" required><option value="">Unidad visitada…</option>${opciones}</select>`], paquete: ['Recibir paquete', `<select name="inmueble_id" required><option value="">Unidad destino…</option>${opciones}</select><input name="transportadora" placeholder="Transportadora" required><textarea name="descripcion" placeholder="Descripción (opcional)"></textarea>`], minuta: ['Registrar novedad', `<input name="asunto" placeholder="Asunto" required><textarea name="novedad" placeholder="Detalle de la novedad" required></textarea>`] }; const [title, fields] = estructuras[tipo]; document.getElementById('porteriaModalTitle').textContent = title; form.innerHTML = `<input type="hidden" name="action" value="${tipo === 'visita' ? 'registrar_visita' : tipo === 'paquete' ? 'recibir_paquete' : 'registrar_novedad'}">${fields}<button class="btn btn-primary" type="submit">Guardar</button>`; modal.classList.remove('hidden'); };
window.cerrarVisita = id => operacionPorteria('marcar_salida', { visitante_id: id }); window.entregarPaquete = id => operacionPorteria('entregar_paquete', { paquete_id: id }); async function operacionPorteria(action, values) { const fd = new FormData(); fd.append('action', action); Object.entries(values).forEach(([key, value]) => fd.append(key, value)); const r = await fetch('api/porteria.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') loadPorteria(); }

window.abrirFormularioPQRS = function () { let modal = document.getElementById('modalPQRS'); if (!modal) { document.getElementById('view-container').insertAdjacentHTML('beforeend', '<div id="modalPQRS" class="login-modal"><div class="login-box"><button class="close-btn" type="button" onclick="document.getElementById(\'modalPQRS\').classList.add(\'hidden\')"><i class="fa-solid fa-xmark"></i></button><h2>Radicar PQRS</h2><form id="formPQRS" class="stack-form"><input name="asunto" maxlength="150" placeholder="Asunto" required><select name="categoria"><option>Queja</option><option>Petición</option><option>Reclamo</option><option>Sugerencia</option><option>General</option></select><textarea name="descripcion" placeholder="Describe tu solicitud" required></textarea><button class="btn btn-primary" type="submit">Radicar</button></form></div></div>'); modal = document.getElementById('modalPQRS'); } modal.classList.remove('hidden'); };
loadReclamaciones = async function () { const r = await fetch('api/reclamaciones.php?action=list'); const d = await r.json(); const body = document.getElementById('tb-reclamaciones'); if (d.status === 'success') body.innerHTML = d.data.length ? d.data.map(item => `<tr><td><strong>${escapeHtml(item.asunto)}</strong><br><small>${escapeHtml(item.categoria || 'General')}</small></td><td>${escapeHtml(item.usuario_nombre || 'Tú')}</td><td>${escapeHtml(item.creado_en)}</td><td><span class="reserva-estado">${escapeHtml(item.estado)}</span></td></tr>`).join('') : '<tr><td colspan="4">No hay PQRS radicadas.</td></tr>'; };

document.addEventListener('submit', async event => { const form = event.target; if (form.id === 'formCrearUsuario') { event.preventDefault(); const fd = new FormData(); fd.append('action', document.getElementById('usrId').value ? 'update' : 'crear_usuario');['usrId', 'usrDoc', 'usrNombre', 'usrEmail', 'usrPass', 'usrRol'].forEach(id => fd.append({ usrId: 'id', usrDoc: 'documento', usrNombre: 'nombre', usrEmail: 'email', usrPass: 'password', usrRol: 'rol' }[id], document.getElementById(id).value)); const r = await fetch('api/users.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') { document.getElementById('modalUsuario').classList.add('hidden'); loadUsuarios(); } } if (form.id === 'formPorteria') { event.preventDefault(); const r = await fetch('api/porteria.php', { method: 'POST', body: new FormData(form) }); const d = await r.json(); alert(d.message); if (d.status === 'success') { document.getElementById('modalPorteria').classList.add('hidden'); loadPorteria(); } } if (form.id === 'formPQRS') { event.preventDefault(); const fd = new FormData(form); fd.append('action', 'crear'); const r = await fetch('api/reclamaciones.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') { document.getElementById('modalPQRS').classList.add('hidden'); loadReclamaciones(); } } if (form.id === 'formNuevoVehiculo' || form.id === 'formNuevaMascota') { event.preventDefault(); const fd = new FormData(form); fd.append('action', form.id === 'formNuevoVehiculo' ? 'add_vehiculo' : 'add_mascota'); const r = await fetch('api/inmuebles.php', { method: 'POST', body: fd }); const d = await r.json(); alert(d.message); if (d.status === 'success') { form.reset(); form.classList.add('hidden'); loadHomeResidente(); } } });
