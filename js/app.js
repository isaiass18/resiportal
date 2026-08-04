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

function formatDateTime(value) {
    if (!value) return 'Sin fecha';
    return new Date(value.replace(' ', 'T')).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
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
    const navLinks = [...document.querySelectorAll('.nav-links li[data-view]')];
    const submenuVigilancia = document.querySelector('.nav-admin-vigilancia');
    const toggleVigilancia = submenuVigilancia?.querySelector('.nav-submenu-toggle');
    const role = currentUser?.rol;
    const allowedForVigilante = ['porteria', 'zonas', 'perfil'];
    const allowedForResident = ['home-residente', 'mis-pagos', 'zonas', 'reclamaciones', 'perfil'];

    navLinks.forEach(link => {
        const viewName = link.dataset.view;
        const visible = role === 'vigilante'
            ? allowedForVigilante.includes(viewName)
            : role === 'residente'
                ? allowedForResident.includes(viewName)
                : !['home-residente', 'mis-pagos', 'porteria'].includes(viewName);
        link.style.display = visible ? 'flex' : 'none';
        link.addEventListener('click', event => {
            navLinks.forEach(item => item.classList.remove('active'));
            event.currentTarget.classList.add('active');
            submenuVigilancia?.classList.toggle('has-active-child', submenuVigilancia.contains(event.currentTarget));
            loadView(viewName);
            if (window.innerWidth <= 768) document.getElementById('sidebar')?.classList.remove('open');
        });
    });

    if (submenuVigilancia) {
        const showSubmenu = role === 'admin';
        submenuVigilancia.style.display = showSubmenu ? 'block' : 'none';
        if (showSubmenu) {
            submenuVigilancia.classList.remove('is-collapsed');
            toggleVigilancia?.addEventListener('click', event => {
                event.stopPropagation();
                const collapsed = submenuVigilancia.classList.toggle('is-collapsed');
                toggleVigilancia.setAttribute('aria-expanded', String(!collapsed));
            });
        }
    }
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
        tbody.innerHTML = data.data.map(i => `<tr><td>${i.torre || 'N/A'}</td><td>${i.apartamento}</td><td><b>${formatCurrency(i.mora_actual)}</b></td><td>${i.num_vehiculos}</td><td>${i.num_mascotas}</td></tr>`).join('');
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


// Mejoras de experiencia para estado de cuenta, disponibilidad de zonas y PQRS.
let estadoCuentaResidente = { cuenta: null, historial: [] };

function prepararResumenCuenta() {
    const deuda = document.getElementById('txtDeudaResidente');
    const card = deuda?.closest('.card');
    if (!card) return;

    card.classList.add('account-summary-card');
    card.querySelector('h3')?.classList.add('account-summary-title');
    document.getElementById('tb-mis-pagos')?.closest('.card')?.setAttribute('id', 'historial-pagos');

    if (!card.querySelector('.account-summary-actions')) {
        card.insertAdjacentHTML('beforeend', `
            <div class="account-summary-actions">
                <button type="button" class="account-summary-action" onclick="window.verHistorialPagos()">
                    <i class="fa-solid fa-clock-rotate-left"></i> Ver movimientos
                </button>
                <button type="button" class="account-summary-action" onclick="window.descargarEstadoCuenta()">
                    <i class="fa-solid fa-file-arrow-down"></i> Descargar resumen
                </button>
            </div>
        `);
    }
}

window.verHistorialPagos = function () {
    document.getElementById('historial-pagos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.descargarEstadoCuenta = function () {
    const { cuenta, historial } = estadoCuentaResidente;
    if (!cuenta) {
        alert('Aún no se pudo cargar el estado de cuenta. Inténtalo de nuevo.');
        return;
    }

    const unidad = [cuenta.torre, cuenta.nomenclatura || cuenta.apartamento].filter(Boolean).join(' · ');
    const celdaCsv = value => {
        const text = String(value ?? '').replace(/"/g, '""');
        return `"${/^[=+\-@]/.test(text) ? `'${text}` : text}"`;
    };
    const filas = [
        ['Estado de cuenta ResiPortal'],
        ['Inmueble', unidad || 'Sin inmueble asignado'],
        ['Deuda actual', Number(cuenta.mora_actual || 0).toFixed(2)],
        [],
        ['Fecha', 'Valor', 'Método', 'Referencia', 'Descripción', 'Estado']
    ];
    historial.forEach(pago => filas.push([
        pago.fecha_pago,
        Number(pago.valor || 0).toFixed(2),
        pago.metodo_pago,
        pago.referencia,
        pago.descripcion,
        pago.estado
    ]));

    const csv = filas.map(fila => fila.map(celdaCsv).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = 'estado-de-cuenta-resiportal.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(enlace.href);
};

loadMisPagos = async function () {
    try {
        const response = await fetch('api/finanzas.php?action=mis_pagos');
        const result = await response.json();
        if (result.status !== 'success') {
            alert(result.message || 'No fue posible cargar los pagos.');
            return;
        }

        const cuenta = result.data.cuenta;
        const historial = result.data.historial || [];
        estadoCuentaResidente = { cuenta, historial };
        prepararResumenCuenta();

        if (cuenta) {
            document.getElementById('txtDeudaResidente').textContent = formatCurrency(cuenta.mora_actual);
            const unidad = [cuenta.torre, cuenta.nomenclatura || cuenta.apartamento].filter(Boolean).join(' · ');
            document.getElementById('txtInmuebleResidente').innerHTML = `<i class="fa-solid fa-building"></i> ${escapeHtml(unidad || 'Inmueble asignado')}`;
        }

        const tbody = document.getElementById('tb-mis-pagos');
        if (tbody) {
            tbody.innerHTML = historial.length === 0
                ? '<tr><td colspan="6">No has reportado pagos todavía.</td></tr>'
                : historial.map(pago => {
                    const estado = pago.estado === 'aprobado' ? 'Aprobado' : pago.estado === 'rechazado' ? 'Rechazado' : 'Pendiente';
                    const clase = pago.estado === 'aprobado' ? 'estado-aprobada' : pago.estado === 'rechazado' ? 'estado-rechazada' : 'estado-pendiente';
                    const soporte = pago.soporte_archivo
                        ? `<a class="payment-support-link" href="api/finanzas.php?action=ver_soporte&pago_id=${Number(pago.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> Ver soporte</a>`
                        : '—';
                    return `<tr>
                        <td>${formatDate(pago.fecha_pago)}</td>
                        <td>${formatCurrency(pago.valor)}</td>
                        <td>${escapeHtml(pago.metodo_pago)}</td>
                        <td><strong>${escapeHtml(pago.referencia || 'Sin referencia')}</strong><br><small>${escapeHtml(pago.descripcion || 'Sin descripción')}</small></td>
                        <td>${soporte}</td>
                        <td><span class="reserva-estado ${clase}">${estado}</span></td>
                    </tr>`;
                }).join('');
        }

        const form = document.getElementById('formReportarPago');
        if (form) {
            form.onsubmit = async event => {
                event.preventDefault();
                const data = new FormData();
                data.append('action', 'reportar_pago');
                data.append('valor', document.getElementById('repPagoValor').value);
                data.append('referencia', document.getElementById('repPagoRef').value);
                data.append('descripcion', document.getElementById('repPagoDescripcion').value);
                data.append('metodo', document.getElementById('repPagoMetodo').value);
                const soporte = document.getElementById('repPagoSoporte').files[0];
                if (soporte) data.append('soporte', soporte);

                const pagoResponse = await fetch('api/finanzas.php', { method: 'POST', body: data });
                const pagoResult = await pagoResponse.json();
                alert(pagoResult.message);
                if (pagoResult.status === 'success') {
                    form.reset();
                    loadMisPagos();
                }
            };
        }
    } catch (error) {
        console.error('Error cargando pagos', error);
        alert('No fue posible cargar el estado de cuenta. Inténtalo nuevamente.');
    }
};

const cargarZonasConDisponibilidad = loadZonas;
loadZonas = async function () {
    await cargarZonasConDisponibilidad();

    const esAdmin = currentUser?.rol === 'admin';
    const select = document.getElementById('reservaZonaId');
    const calendarioPersonal = document.getElementById('calendar');
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!select || !calendarioPersonal || !calendario) return;

    let panel = document.getElementById('resident-availability-panel');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'resident-availability-panel';
        panel.className = 'resident-availability-panel';
        panel.innerHTML = `
            <div class="resident-availability-header">
                <div>
                    <p class="resident-availability-kicker">Reserva por calendario</p>
                    <h3 id="resident-availability-title">Disponibilidad de la zona</h3>
                    <p>Verde: libre y reservable. Naranja: solicitud pendiente. Rojo: reservado.</p>
                </div>
                <div class="zona-availability-legends" aria-label="Estados de disponibilidad">
                    <span class="zona-availability-legend is-available"><i></i> Disponible</span>
                    <span class="zona-availability-legend is-pending"><i></i> Pendiente</span>
                    <span class="zona-availability-legend is-reserved"><i></i> Reservado</span>
                </div>
            </div>
        `;
        calendarioPersonal.closest('.card').insertAdjacentElement('beforebegin', panel);
        panel.appendChild(calendario);
    }
    panel.classList.toggle('hidden', esAdmin);
    if (esAdmin) return;

    if (!select.value && select.options.length > 1) select.selectedIndex = 1;
    if (!select.value || !window.FullCalendar) return;

    const renderDisponibilidad = async () => {
        const response = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(select.value)}`);
        const result = await response.json();
        if (result.status !== 'success') {
            calendario.innerHTML = `<p class="muted">${escapeHtml(result.message || 'No fue posible cargar la disponibilidad.')}</p>`;
            return;
        }

        const reservas = result.data.reservas || [];
        const estados = new Map(reservas.map(item => [item.fecha_reserva, item.estado]));
        const hoy = fechaLocal(new Date());
        const titulo = document.getElementById('resident-availability-title');
        if (titulo) titulo.textContent = `Disponibilidad: ${result.data.zona.nombre}`;
        if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();

        window.residentAvailabilityCalendar = new FullCalendar.Calendar(calendario, {
            initialView: 'dayGridMonth',
            locale: 'es',
            height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
            dayCellClassNames: info => {
                if (info.isOther) return [];
                const fecha = fechaLocal(info.date);
                return [estados.has(fecha) ? estadoReservaClase(estados.get(fecha)) : (fecha <= hoy ? 'zona-dia-pasado' : 'zona-dia-disponible')];
            },
            dayCellDidMount: info => {
                if (info.isOther) return;
                const fecha = fechaLocal(info.date);
                const estado = estados.get(fecha);
                info.el.setAttribute('aria-label', estado === 'aprobada' ? `${fecha}: reservado` : estado === 'pendiente' ? `${fecha}: solicitud pendiente` : fecha <= hoy ? `${fecha}: fecha no disponible` : `${fecha}: disponible para reservar`);
            },
            events: reservas.map(item => ({
                title: item.estado === 'aprobada' ? 'Reservado' : 'Solicitud pendiente',
                start: item.fecha_reserva,
                allDay: true,
                classNames: [item.estado === 'aprobada' ? 'zona-calendar-reserva' : 'zona-calendar-pendiente']
            })),
            dateClick: async info => {
                const fecha = info.dateStr;
                if (fecha <= hoy || estados.has(fecha)) return;
                if (!confirm(`¿Solicitar reserva para el ${formatDate(fecha)}?`)) return;
                const data = new FormData();
                data.append('action', 'crear_reserva');
                data.append('zona_id', select.value);
                data.append('fecha_reserva', fecha);
                const reservaResponse = await fetch('api/zonas.php', { method: 'POST', body: data });
                const reservaResult = await reservaResponse.json();
                alert(reservaResult.message);
                if (reservaResult.status === 'success') loadZonas();
            }
        });
        window.residentAvailabilityCalendar.render();
    };

    select.onchange = renderDisponibilidad;
    await renderDisponibilidad();
};

window.cerrarFormularioPQRS = function () {
    document.getElementById('modalPQRS')?.classList.add('hidden');
};

window.abrirFormularioPQRS = function () {
    let modal = document.getElementById('modalPQRS');
    if (!modal) {
        document.getElementById('view-container').insertAdjacentHTML('beforeend', '<div id="modalPQRS" class="login-modal pqrs-modal hidden"></div>');
        modal = document.getElementById('modalPQRS');
    }

    modal.className = 'login-modal pqrs-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pqrs-modal-title');
    modal.innerHTML = `
        <div class="login-box pqrs-dialog">
            <button class="close-btn" type="button" onclick="window.cerrarFormularioPQRS()" aria-label="Cerrar formulario"><i class="fa-solid fa-xmark"></i></button>
            <div class="pqrs-modal-heading">
                <span class="pqrs-modal-icon"><i class="fa-regular fa-message"></i></span>
                <div>
                    <p>Atención al residente</p>
                    <h2 id="pqrs-modal-title">Radicar PQRS</h2>
                    <span>Cuéntanos tu solicitud; quedará registrada para que administración pueda gestionarla.</span>
                </div>
            </div>
            <form id="formPQRS" class="pqrs-form">
                <label>Tipo de solicitud
                    <select name="categoria" required>
                        <option value="Queja">Queja</option>
                        <option value="Petición">Petición</option>
                        <option value="Reclamo">Reclamo</option>
                        <option value="Sugerencia">Sugerencia</option>
                        <option value="General">General</option>
                    </select>
                </label>
                <label>Asunto
                    <input name="asunto" maxlength="150" placeholder="Resume tu solicitud" required>
                </label>
                <label>Descripción
                    <textarea name="descripcion" rows="8" placeholder="Incluye los detalles necesarios para atender tu caso…" required></textarea>
                </label>
                <p class="pqrs-form-note"><i class="fa-solid fa-circle-info"></i> Recibirás el radicado con estado abierto en tu listado de PQRS.</p>
                <button class="btn btn-primary pqrs-submit" type="submit"><i class="fa-solid fa-paper-plane"></i> Radicar solicitud</button>
            </form>
        </div>
    `;
    modal.querySelector('[name="asunto"]')?.focus();
};


// Cuotas diferenciadas por bloque/inmueble y administración de vigilantes.
let vigilantesActuales = [];

const cargarVistaResiPortalBase = loadView;
loadView = function (viewName) {
    if (viewName !== 'vigilantes') {
        cargarVistaResiPortalBase(viewName);
        return;
    }
    const container = document.getElementById('view-container');
    container.innerHTML = `
        <div class="view vigilantes-view">
            <div class="section-toolbar">
                <div>
                    <p class="section-kicker">Administración · Seguridad</p>
                    <h1 class="page-title">Vigilantes</h1>
                    <p class="muted">Crea y administra las fichas operativas del personal de portería.</p>
                </div>
                <button class="btn btn-primary" type="button" onclick="window.abrirModalVigilante()"><i class="fa-solid fa-user-plus"></i> Nuevo vigilante</button>
            </div>
            <div id="vigilantes-grid" class="vigilantes-grid" aria-live="polite"><p class="muted">Cargando vigilantes…</p></div>
        </div>
    `;
    loadVigilantes();
};

async function loadVigilantes() {
    const grid = document.getElementById('vigilantes-grid');
    if (!grid) return;
    try {
        const response = await fetch('api/users.php?action=list_vigilantes');
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        vigilantesActuales = result.data || [];
        grid.innerHTML = vigilantesActuales.length ? vigilantesActuales.map(vigilante => {
            const nombre = escapeHtml(vigilante.nombre);
            const iniciales = nombre.split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
            const foto = Number(vigilante.tiene_foto) ? `<img src="api/users.php?action=ver_foto_vigilante&vigilante_id=${Number(vigilante.id)}" alt="Foto de ${nombre}">` : `<span>${iniciales || 'VG'}</span>`;
            return `<article class="vigilante-card">
                <div class="vigilante-photo">${foto}</div>
                <div class="vigilante-card-body">
                    <h3>${nombre}</h3>
                    <p class="vigilante-documento"><i class="fa-regular fa-id-card"></i> ${escapeHtml(vigilante.documento)}</p>
                    <dl>
                        <div><dt>Teléfono</dt><dd>${escapeHtml(vigilante.contacto || 'No registrado')}</dd></div>
                        <div><dt>Turno</dt><dd>${escapeHtml(vigilante.turno || 'Sin definir')}</dd></div>
                        <div><dt>Horario</dt><dd>${escapeHtml(vigilante.horario || 'Sin definir')}</dd></div>
                    </dl>
                    ${vigilante.observaciones ? `<p class="vigilante-notas">${escapeHtml(vigilante.observaciones)}</p>` : ''}
                    <button class="btn btn-ghost vigilante-edit" type="button" onclick="window.abrirModalVigilante(${Number(vigilante.id)})"><i class="fa-solid fa-pen"></i> Editar ficha</button>
                </div>
            </article>`;
        }).join('') : `<div class="empty-state"><i class="fa-solid fa-shield-halved"></i><h3>Aún no hay vigilantes registrados</h3><p>Crea la primera ficha de vigilancia para asignar sus datos y horario.</p><button class="btn btn-primary" type="button" onclick="window.abrirModalVigilante()">Crear vigilante</button></div>`;
    } catch (error) {
        console.error('Error cargando vigilantes', error);
        grid.innerHTML = '<p class="muted">No fue posible cargar los vigilantes.</p>';
    }
}

window.abrirModalVigilante = function (id = 0) {
    const vigilante = vigilantesActuales.find(item => Number(item.id) === Number(id)) || {};
    let modal = document.getElementById('modalVigilante');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', '<div id="modalVigilante" class="login-modal vigilante-modal hidden"></div>');
        modal = document.getElementById('modalVigilante');
    }
    modal.className = 'login-modal vigilante-modal';
    modal.innerHTML = `
        <div class="login-box vigilante-dialog">
            <button class="close-btn" type="button" onclick="document.getElementById('modalVigilante').classList.add('hidden')" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
            <div class="vigilante-modal-heading"><span><i class="fa-solid fa-shield-halved"></i></span><div><p>Personal de portería</p><h2>${id ? 'Editar vigilante' : 'Crear vigilante'}</h2><small>La foto es opcional y se almacena de forma privada.</small></div></div>
            <form id="formVigilante" class="vigilante-form" enctype="multipart/form-data">
                <input type="hidden" name="id" value="${Number(id) || ''}">
                <label>Nombre completo<input name="nombre" maxlength="150" value="${escapeHtml(vigilante.nombre || '')}" required></label>
                <label>Documento<input name="documento" maxlength="50" value="${escapeHtml(vigilante.documento || '')}" required></label>
                <label>Correo electrónico<input type="email" name="email" maxlength="150" value="${escapeHtml(vigilante.email || '')}" required></label>
                <label>Teléfono<input name="telefono" maxlength="50" value="${escapeHtml(vigilante.contacto || '')}" placeholder="Opcional"></label>
                <label>Contraseña ${id ? '<small>(dejar vacía para mantenerla)</small>' : ''}<input type="password" name="password" minlength="8" ${id ? '' : 'required'} placeholder="Mínimo 8 caracteres"></label>
                <label>Turno<select name="turno"><option value="">Sin definir</option>${['Diurno', 'Nocturno', 'Rotativo', 'Otro'].map(turno => `<option value="${turno}" ${vigilante.turno === turno ? 'selected' : ''}>${turno}</option>`).join('')}</select></label>
                <label>Horario<input name="horario" maxlength="150" value="${escapeHtml(vigilante.horario || '')}" placeholder="Ej. Lun–Vie, 06:00–14:00"></label>
                <label class="vigilante-full-field">Foto opcional<input type="file" name="foto" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><small>JPG, PNG o WEBP, máximo 3 MB.</small></label>
                <label class="vigilante-full-field">Observaciones<textarea name="observaciones" maxlength="1000" rows="4" placeholder="Información operativa opcional">${escapeHtml(vigilante.observaciones || '')}</textarea></label>
                <button class="btn btn-primary vigilante-full-field" type="submit"><i class="fa-solid fa-floppy-disk"></i> Guardar vigilante</button>
            </form>
        </div>
    `;
    modal.querySelector('[name="nombre"]')?.focus();
};

document.addEventListener('submit', async event => {
    if (event.target.id !== 'formVigilante') return;
    event.preventDefault();
    const response = await fetch('api/users.php', { method: 'POST', body: new FormData(event.target) });
    const result = await response.json();
    alert(result.message);
    if (result.status === 'success') {
        document.getElementById('modalVigilante').classList.add('hidden');
        loadVigilantes();
    }
});

const cargarFinanzasConfiguracionBase = loadFinanzas;
loadFinanzas = async function () {
    await cargarFinanzasConfiguracionBase();
    const modal = document.getElementById('modalCobro');
    if (!modal) return;

    const periodoActual = new Date();
    const periodo = `${periodoActual.getFullYear()}-${String(periodoActual.getMonth() + 1).padStart(2, '0')}`;
    modal.innerHTML = `
        <div class="login-box cuota-periodo-dialog">
            <button class="close-btn" type="button" onclick="document.getElementById('modalCobro').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button>
            <h2>Generar cuotas configuradas</h2>
            <p>Solo se cobrarán los valores previamente asignados a cada apartamento. El período no se duplica.</p>
            <form id="formGenerarCobro" class="stack-form">
                <label>Período<input id="cobroPeriodo" type="month" value="${periodo}" required></label>
                <button type="submit" class="btn btn-primary"><i class="fa-solid fa-file-invoice-dollar"></i> Generar cuotas del período</button>
            </form>
        </div>`;

    document.getElementById('panel-cuotas-configuradas')?.remove();
    modal.insertAdjacentHTML('afterend', `
        <section id="panel-cuotas-configuradas" class="card cuotas-configuradas-card">
            <div class="section-toolbar"><div><p class="section-kicker">Configuración de administración</p><h3>Cuotas por apartamentos seleccionados</h3><p class="muted">Busca, filtra y selecciona unidades. La selección se conserva al cambiar de página.</p></div></div>
            <div class="cuota-selector-summary" aria-live="polite"><span><strong id="cuotaTotalInmuebles">—</strong> unidades registradas</span><span><strong id="cuotaTotalConfiguradas">—</strong> con cuota configurada</span></div>
            <form id="formCuotaApartamentos" class="cuota-config-form">
                <div class="cuota-selector-heading"><div><h4><i class="fa-solid fa-building"></i> Seleccionar apartamentos o casas</h4><p>Se muestran hasta 50 resultados por página para mantener la búsqueda rápida.</p></div><button id="btnLimpiarSeleccionCuotas" class="btn btn-ghost" type="button">Limpiar selección</button></div>
                <div class="cuota-selector-filters">
                    <label>Buscar unidad<input id="cuotaBusqueda" type="search" autocomplete="off" placeholder="Torre, apartamento o nomenclatura"></label>
                    <label>Torre o bloque<select id="cuotaBloque"><option value="">Todas las torres</option></select></label>
                    <label>Estado de cuota<select id="cuotaEstado"><option value="todas">Todas</option><option value="sin_configurar">Sin cuota</option><option value="configurada">Con cuota</option></select></label>
                </div>
                <div class="cuota-selector-results" aria-live="polite"><span id="cuotaResultadosTexto">Cargando unidades…</span><span id="cuotaSeleccionTexto" class="cuota-selection-count">0 seleccionadas</span></div>
                <div class="cuota-selector-table-wrap"><table class="data-table cuota-selector-table"><thead><tr><th><label class="cuota-select-page" title="Seleccionar resultados de esta página"><input id="cuotaSeleccionarPagina" type="checkbox"><span>Esta página</span></label></th><th>Unidad</th><th>Torre / bloque</th><th>Cuota actual</th></tr></thead><tbody id="cuotaInmueblesResultados"><tr><td colspan="4">Cargando…</td></tr></tbody></table></div>
                <div class="cuota-selector-pagination"><button id="cuotaPaginaAnterior" class="btn btn-ghost" type="button"><i class="fa-solid fa-chevron-left"></i> Anterior</button><span id="cuotaPaginacionTexto">Página —</span><button id="cuotaPaginaSiguiente" class="btn btn-ghost" type="button">Siguiente <i class="fa-solid fa-chevron-right"></i></button></div>
                <div class="cuota-apply-bar"><label for="cuotaValorApartamentos">Valor mensual de administración<input id="cuotaValorApartamentos" type="number" min="1" step="1" placeholder="Ej. 150000" required></label><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Aplicar a unidades seleccionadas</button></div>
            </form>
        </section>`);

    const panel = document.getElementById('panel-cuotas-configuradas');
    const seleccionados = new Set();
    const estado = { page: 1, perPage: 50, q: '', bloque: '', estadoCuota: 'todas', paginaActual: [], totalPages: 1 };
    let temporizadorBusqueda;

    const actualizarSeleccion = () => {
        const seleccionadosEnPagina = estado.paginaActual.filter(inmueble => seleccionados.has(String(inmueble.id))).length;
        const seleccionarPagina = panel.querySelector('#cuotaSeleccionarPagina');
        if (seleccionarPagina) {
            seleccionarPagina.checked = estado.paginaActual.length > 0 && seleccionadosEnPagina === estado.paginaActual.length;
            seleccionarPagina.indeterminate = seleccionadosEnPagina > 0 && seleccionadosEnPagina < estado.paginaActual.length;
        }
        panel.querySelector('#cuotaSeleccionTexto').textContent = `${seleccionados.size} ${seleccionados.size === 1 ? 'unidad seleccionada' : 'unidades seleccionadas'}`;
        panel.querySelector('#btnLimpiarSeleccionCuotas').disabled = seleccionados.size === 0;
    };

    const cargarPagina = async () => {
        const parametros = new URLSearchParams({ page: String(estado.page), per_page: String(estado.perPage), estado_cuota: estado.estadoCuota });
        if (estado.q) parametros.set('q', estado.q);
        if (estado.bloque) parametros.set('bloque', estado.bloque);
        const cuerpo = panel.querySelector('#cuotaInmueblesResultados');
        cuerpo.innerHTML = '<tr><td colspan="4">Cargando unidades…</td></tr>';
        try {
            const response = await fetch(`api/finanzas.php?action=cuotas_configuradas&${parametros.toString()}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            const { inmuebles = [], pagination, filters, summary } = result.data;
            estado.page = pagination.page;
            estado.totalPages = pagination.total_pages;
            estado.paginaActual = inmuebles;
            panel.querySelector('#cuotaTotalInmuebles').textContent = summary.total;
            panel.querySelector('#cuotaTotalConfiguradas').textContent = summary.configuradas;
            const bloqueSelect = panel.querySelector('#cuotaBloque');
            const bloqueActual = estado.bloque;
            bloqueSelect.innerHTML = '<option value="">Todas las torres</option>' + (filters.bloques || []).map(bloque => `<option value="${escapeHtml(bloque)}">${escapeHtml(bloque)}</option>`).join('');
            bloqueSelect.value = bloqueActual;
            panel.querySelector('#cuotaResultadosTexto').textContent = pagination.total ? `Mostrando ${((pagination.page - 1) * pagination.per_page) + 1}–${Math.min(pagination.page * pagination.per_page, pagination.total)} de ${pagination.total} unidades` : 'No hay unidades que coincidan con los filtros.';
            cuerpo.innerHTML = inmuebles.length ? inmuebles.map(inmueble => {
                const id = String(inmueble.id);
                const cuota = Number(inmueble.cuota_administracion) > 0 ? formatCurrency(inmueble.cuota_administracion) : '<span class="cuota-empty">Sin configurar</span>';
                return `<tr><td><input class="cuota-unidad-check" type="checkbox" value="${Number(inmueble.id)}" aria-label="Seleccionar ${escapeHtml(inmueble.nomenclatura || inmueble.apartamento)}" ${seleccionados.has(id) ? 'checked' : ''}></td><td><strong>${escapeHtml(inmueble.nomenclatura || inmueble.apartamento || 'Sin nomenclatura')}</strong></td><td>${escapeHtml(inmueble.bloque)}</td><td>${cuota}</td></tr>`;
            }).join('') : '<tr><td colspan="4" class="empty-state">No hay unidades para los filtros seleccionados.</td></tr>';
            panel.querySelector('#cuotaPaginacionTexto').textContent = `Página ${pagination.page} de ${pagination.total_pages}`;
            panel.querySelector('#cuotaPaginaAnterior').disabled = pagination.page <= 1;
            panel.querySelector('#cuotaPaginaSiguiente').disabled = pagination.page >= pagination.total_pages;
            actualizarSeleccion();
        } catch (error) {
            console.error('Error cargando unidades para cuota', error);
            cuerpo.innerHTML = `<tr><td colspan="4" class="empty-state">${escapeHtml(error.message || 'No fue posible cargar las unidades.')}</td></tr>`;
        }
    };

    panel.addEventListener('change', event => {
        if (event.target.classList.contains('cuota-unidad-check')) {
            const id = event.target.value;
            event.target.checked ? seleccionados.add(id) : seleccionados.delete(id);
            actualizarSeleccion();
        }
        if (event.target.id === 'cuotaSeleccionarPagina') {
            estado.paginaActual.forEach(inmueble => event.target.checked ? seleccionados.add(String(inmueble.id)) : seleccionados.delete(String(inmueble.id)));
            panel.querySelectorAll('.cuota-unidad-check').forEach(check => { check.checked = event.target.checked; });
            actualizarSeleccion();
        }
        if (event.target.id === 'cuotaBloque' || event.target.id === 'cuotaEstado') {
            estado.bloque = panel.querySelector('#cuotaBloque').value;
            estado.estadoCuota = panel.querySelector('#cuotaEstado').value;
            estado.page = 1;
            cargarPagina();
        }
    });
    panel.querySelector('#cuotaBusqueda').addEventListener('input', event => {
        clearTimeout(temporizadorBusqueda);
        temporizadorBusqueda = setTimeout(() => { estado.q = event.target.value.trim(); estado.page = 1; cargarPagina(); }, 300);
    });
    panel.querySelector('#cuotaPaginaAnterior').onclick = () => { if (estado.page > 1) { estado.page--; cargarPagina(); } };
    panel.querySelector('#cuotaPaginaSiguiente').onclick = () => { if (estado.page < estado.totalPages) { estado.page++; cargarPagina(); } };
    panel.querySelector('#btnLimpiarSeleccionCuotas').onclick = () => { seleccionados.clear(); actualizarSeleccion(); panel.querySelectorAll('.cuota-unidad-check').forEach(check => { check.checked = false; }); };
    panel.querySelector('#formCuotaApartamentos').onsubmit = async event => {
        event.preventDefault();
        if (!seleccionados.size) return alert('Selecciona al menos una unidad.');
        const data = new FormData();
        data.append('action', 'configurar_cuota');
        data.append('alcance', 'inmuebles');
        data.append('valor', panel.querySelector('#cuotaValorApartamentos').value);
        data.append('inmueble_ids_json', JSON.stringify([...seleccionados]));
        const response = await fetch('api/finanzas.php', { method: 'POST', body: data });
        const result = await response.json();
        alert(result.message);
        if (result.status === 'success') { seleccionados.clear(); panel.querySelector('#cuotaValorApartamentos').value = ''; await cargarPagina(); }
    };
    document.getElementById('formGenerarCobro').onsubmit = async event => { event.preventDefault(); const data = new FormData(); data.append('action', 'generar_cobro'); data.append('periodo', document.getElementById('cobroPeriodo').value); const chargeResponse = await fetch('api/finanzas.php', { method: 'POST', body: data }); const chargeResult = await chargeResponse.json(); alert(chargeResult.message); if (chargeResult.status === 'success') { modal.classList.add('hidden'); loadFinanzas(); } };
    await cargarPagina();
};

const etiquetasCamposFormulario = {
    loginEmail: 'Correo electrónico', loginPassword: 'Contraseña', repPagoValor: 'Valor pagado', repPagoRef: 'Referencia o comprobante', repPagoDescripcion: 'Descripción', repPagoSoporte: 'Soporte del pago', repPagoMetodo: 'Medio de pago', evTitulo: 'Título del evento', evFecha: 'Fecha y hora', evLugar: 'Lugar', evDescripcion: 'Descripción', comTitulo: 'Título de la novedad', comContenido: 'Contenido de la novedad', cobroPeriodo: 'Período de cobro', pagoInmuebleId: 'Inmueble', pagoValor: 'Valor pagado', pagoMetodo: 'Medio de pago', pagoReferencia: 'Referencia o comprobante', pagoDescripcion: 'Descripción', pagoSoporte: 'Soporte del pago', reservaZonaId: 'Zona social', reservaFecha: 'Fecha de reserva', passwordActual: 'Contraseña actual', passwordNueva: 'Nueva contraseña', passwordConfirmacion: 'Confirmación de contraseña'
};
let consecutivoEtiquetaFormulario = 0;

function rotularFormularios(root = document) {
    const formularios = root.matches?.('form') ? [root] : [...root.querySelectorAll?.('form') || []];
    formularios.forEach(formulario => formulario.querySelectorAll('input, select, textarea').forEach(campo => {
        if (campo.dataset.etiquetado === 'si' || ['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(campo.type) || campo.labels?.length) return;
        const texto = etiquetasCamposFormulario[campo.id] || campo.dataset.label || (campo.placeholder || '').replace(/\s*\([^)]*\)/g, '') || campo.querySelector?.('option')?.textContent?.replace(/[.….]+$/, '').trim();
        campo.dataset.etiquetado = 'si';
        if (!texto) return;
        if (!campo.id) campo.id = `campo-formulario-${++consecutivoEtiquetaFormulario}`;
        const etiqueta = document.createElement('label');
        etiqueta.className = 'form-field-label';
        etiqueta.htmlFor = campo.id;
        etiqueta.textContent = texto;
        campo.before(etiqueta);
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    rotularFormularios();
    new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) rotularFormularios(node);
    }))).observe(document.body, { childList: true, subtree: true });
});


// Estado financiero ampliado, cron y parqueaderos.
const cargarMisPagosConEstadoBase = loadMisPagos;
loadMisPagos = async function () {
    await cargarMisPagosConEstadoBase();
    const response = await fetch('api/finanzas.php?action=mis_pagos');
    const result = await response.json();
    if (result.status !== 'success') return;
    const { cuotas = [], proxima_cuota: proximaCuota = 0, historial = [] } = result.data;
    const view = document.querySelector('#tb-mis-pagos')?.closest('.view');
    if (!view) return;
    const anterior = document.getElementById('resident-finance-status');
    if (anterior) anterior.remove();
    const pendientes = historial.filter(pago => pago.estado === 'pendiente').length;
    const aprobados = historial.filter(pago => pago.estado === 'aprobado').length;
    const tablaCuotas = cuotas.length ? cuotas.map(cuota => `<tr><td>${String(cuota.mes).padStart(2, '0')}/${cuota.anio}</td><td>${formatCurrency(cuota.valor)}</td><td><span class="reserva-estado estado-pendiente">Cobro generado</span></td></tr>`).join('') : '<tr><td colspan="3">Aún no hay cuotas generadas para este inmueble.</td></tr>';
    const panel = document.createElement('section');
    panel.id = 'resident-finance-status';
    panel.className = 'resident-finance-status';
    panel.innerHTML = `
        <div class="finance-status-cards">
            <div><span>Próxima cuota configurada</span><strong>${formatCurrency(proximaCuota)}</strong></div>
            <div><span>Pagos por aprobar</span><strong>${pendientes}</strong></div>
            <div><span>Pagos aprobados</span><strong>${aprobados}</strong></div>
        </div>
        <div class="card finance-generated-charges"><div class="finance-section-heading"><div><h3>Cuotas generadas</h3><p>Consulta los cobros que administración ha generado para tu inmueble.</p></div></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Período</th><th>Valor</th><th>Estado</th></tr></thead><tbody>${tablaCuotas}</tbody></table></div></div>`;
    document.getElementById('historial-pagos')?.insertAdjacentElement('beforebegin', panel);
};

const cargarFinanzasConResumenBase = loadFinanzas;
loadFinanzas = async function () {
    await cargarFinanzasConResumenBase();
    try {
        const response = await fetch('api/finanzas.php?action=resumen_cartera');
        const result = await response.json();
        if (result.status !== 'success') return;
        const data = result.data;
        const view = document.getElementById('modalCobro')?.closest('.view');
        if (!view || document.getElementById('finance-operational-summary')) return;
        const panel = document.createElement('section');
        panel.id = 'finance-operational-summary';
        panel.className = 'finance-operational-summary';
        panel.innerHTML = `
            <div class="finance-admin-metric"><span>Cartera total</span><strong>${formatCurrency(data.total_cartera)}</strong></div>
            <div class="finance-admin-metric"><span>Inmuebles en mora</span><strong>${Number(data.inmuebles_en_mora || 0)}</strong></div>
            <div class="finance-admin-metric"><span>Cuotas generadas este mes</span><strong>${Number(data.cuotas_generadas || 0)}</strong><small>${formatCurrency(data.valor_cuotas)}</small></div>
            <div class="finance-admin-metric"><span>Próximo recaudo configurado</span><strong>${formatCurrency(data.proximo_recaudo)}</strong></div>
            <div class="finance-admin-metric"><span>Pagos por aprobar</span><strong>${Number(data.pagos_pendientes || 0)}</strong><small>${Number(data.pagos_aprobados || 0)} aprobados</small></div>`;
        document.getElementById('panel-cuotas-configuradas')?.insertAdjacentElement('beforebegin', panel);
    } catch (error) {
        console.error('Error cargando resumen de cartera', error);
    }
};

let parqueaderosActuales = [];
let inmueblesParqueaderos = [];
const cargarVistaConParqueaderosBase = loadView;
loadView = function (viewName) {
    if (viewName !== 'parqueaderos') {
        cargarVistaConParqueaderosBase(viewName);
        return;
    }
    document.getElementById('view-container').innerHTML = `
        <div class="view parqueaderos-view">
            <div class="section-toolbar"><div><p class="section-kicker">Administración · Inmuebles</p><h1 class="page-title">Parqueaderos</h1><p class="muted">Crea cupos y conserva el historial al asignarlos o retirarlos de una unidad.</p></div></div>
            <div class="parking-forms-grid">
                <form id="formParqueadero" class="card parking-form"><h3><i class="fa-solid fa-square-parking"></i> Crear parqueadero</h3><input name="codigo" maxlength="50" placeholder="Código, ej. P-101" required><select name="tipo"><option value="administracion">Administración</option><option value="privado">Privado</option><option value="visitante">Visitante</option><option value="otro">Otro</option></select><select name="estado"><option value="disponible">Disponible</option><option value="inactivo">Inactivo</option></select><textarea name="observaciones" maxlength="255" rows="2" placeholder="Observaciones opcionales"></textarea><button class="btn btn-primary" type="submit">Crear parqueadero</button></form>
                <form id="formAsignarParqueadero" class="card parking-form"><h3><i class="fa-solid fa-link"></i> Asignar a inmueble</h3><select id="asignarParqueadero" name="parqueadero_id" required><option value="">Cargando parqueaderos…</option></select><select id="asignarInmueble" name="inmueble_id" required><option value="">Cargando inmuebles…</option></select><button class="btn btn-primary" type="submit">Asignar parqueadero</button><p class="muted">Puedes retirarlo después; la asignación no se borra del historial.</p></form>
            </div>
            <div class="card table-responsive"><h3>Catálogo y asignaciones actuales</h3><table class="data-table"><thead><tr><th>Código</th><th>Tipo</th><th>Estado</th><th>Asignado a</th><th>Acciones</th></tr></thead><tbody id="tb-parqueaderos"><tr><td colspan="5">Cargando…</td></tr></tbody></table></div>
        </div>`;
    loadParqueaderos();
};

async function loadParqueaderos() {
    const [parkingResponse, inmuebleResponse] = await Promise.all([fetch('api/parqueaderos.php?action=list'), fetch('api/parqueaderos.php?action=inmuebles')]);
    const [parkingResult, inmuebleResult] = await Promise.all([parkingResponse.json(), inmuebleResponse.json()]);
    if (parkingResult.status !== 'success' || inmuebleResult.status !== 'success') return;
    parqueaderosActuales = parkingResult.data || [];
    inmueblesParqueaderos = inmuebleResult.data || [];
    const disponibles = parqueaderosActuales.filter(parqueadero => parqueadero.estado === 'disponible');
    document.getElementById('asignarParqueadero').innerHTML = '<option value="">Selecciona un parqueadero…</option>' + disponibles.map(parqueadero => `<option value="${Number(parqueadero.id)}">${escapeHtml(parqueadero.codigo)} · ${escapeHtml(parqueadero.tipo)}</option>`).join('');
    document.getElementById('asignarInmueble').innerHTML = '<option value="">Selecciona un inmueble…</option>' + inmueblesParqueaderos.map(inmueble => `<option value="${Number(inmueble.id)}">${escapeHtml(inmueble.bloque)} · ${escapeHtml(inmueble.nomenclatura || inmueble.apartamento)}</option>`).join('');
    const table = document.getElementById('tb-parqueaderos');
    table.innerHTML = parqueaderosActuales.length ? parqueaderosActuales.map(parqueadero => {
        const unidad = parqueadero.asignacion_id ? `${parqueadero.torre || 'Sin bloque'} · ${parqueadero.nomenclatura || parqueadero.apartamento}` : '—';
        const acciones = parqueadero.asignacion_id ? `<button class="btn btn-ghost parking-action" onclick="window.retirarParqueadero(${Number(parqueadero.asignacion_id)})">Retirar</button>` : '—';
        return `<tr><td><strong>${escapeHtml(parqueadero.codigo)}</strong></td><td>${escapeHtml(parqueadero.tipo)}</td><td><span class="reserva-estado ${parqueadero.estado === 'asignado' ? 'estado-aprobada' : parqueadero.estado === 'inactivo' ? 'estado-rechazada' : 'estado-pendiente'}">${escapeHtml(parqueadero.estado)}</span></td><td>${escapeHtml(unidad)}</td><td>${acciones} <button class="btn btn-ghost parking-action" onclick="window.verHistorialParqueadero(${Number(parqueadero.id)}, '${escapeHtml(parqueadero.codigo)}')">Historial</button></td></tr>`;
    }).join('') : '<tr><td colspan="5">No hay parqueaderos creados.</td></tr>';

    document.getElementById('formParqueadero').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.target); data.append('action', 'guardar'); const response = await fetch('api/parqueaderos.php', { method: 'POST', body: data }); const result = await response.json(); alert(result.message); if (result.status === 'success') { event.target.reset(); loadParqueaderos(); } };
    document.getElementById('formAsignarParqueadero').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.target); data.append('action', 'asignar'); const response = await fetch('api/parqueaderos.php', { method: 'POST', body: data }); const result = await response.json(); alert(result.message); if (result.status === 'success') { event.target.reset(); loadParqueaderos(); } };
}

window.retirarParqueadero = async function (asignacionId) {
    const motivo = prompt('Motivo del retiro (opcional):') ?? '';
    if (!confirm('¿Retirar este parqueadero de la unidad? El historial se conservará.')) return;
    const data = new FormData(); data.append('action', 'retirar'); data.append('asignacion_id', asignacionId); data.append('motivo_retiro', motivo);
    const response = await fetch('api/parqueaderos.php', { method: 'POST', body: data }); const result = await response.json(); alert(result.message); if (result.status === 'success') loadParqueaderos();
};
window.verHistorialParqueadero = async function (parqueaderoId, codigo) {
    const response = await fetch(`api/parqueaderos.php?action=historial&parqueadero_id=${encodeURIComponent(parqueaderoId)}`); const result = await response.json();
    if (result.status !== 'success') return alert(result.message);
    const historial = result.data.length ? result.data.map(item => `${item.torre || 'Sin bloque'} · ${item.nomenclatura || item.apartamento}: ${formatDate(item.asignado_en)}${item.retirado_en ? ` → ${formatDate(item.retirado_en)}` : ' (asignación vigente)'}${item.motivo_retiro ? ` · ${item.motivo_retiro}` : ''}`).join('\n') : 'No hay asignaciones registradas.';
    alert(`Historial ${codigo}\n\n${historial}`);
};


// Operación administrativa: usuarios, parqueaderos, reservas internas y configuración.
const iniciarAppOperativoBase = initApp;
initApp = function () {
    iniciarAppOperativoBase();
    if (currentUser?.rol === 'vigilante') {
        const zonasLink = document.querySelector('.nav-links li[data-view="zonas"]');
        if (zonasLink) zonasLink.style.display = 'flex';
    }
};

loadUsuarios = async function () {
    const tbody = document.getElementById('listaUsuarios');
    if (!tbody) return;
    const response = await fetch('api/users.php?action=list');
    const result = await response.json();
    if (result.status !== 'success') return alert(result.message);
    usuariosActuales = result.data || [];
    const contador = document.getElementById('usuarios-contador');
    if (contador) contador.textContent = `${usuariosActuales.filter(usuario => Number(usuario.activo)).length} activos · ${usuariosActuales.filter(usuario => !Number(usuario.activo)).length} desactivados`;
    tbody.innerHTML = usuariosActuales.length ? usuariosActuales.map(usuario => {
        const activo = Number(usuario.activo) === 1;
        const estado = activo ? '<span class="user-state user-state-active">Activo</span>' : `<span class="user-state user-state-disabled" title="${escapeHtml(usuario.motivo_desactivacion || 'Sin motivo')}">Desactivado</span>`;
        const accion = Number(usuario.id) === Number(currentUser?.id) ? '<span class="muted">Sesión actual</span>' : `<button class="btn btn-ghost user-status-action" onclick="window.cambiarEstadoUsuario(${Number(usuario.id)}, ${activo ? 0 : 1})">${activo ? '<i class="fa-solid fa-user-slash"></i> Deshabilitar' : '<i class="fa-solid fa-user-check"></i> Reactivar'}</button>`;
        return `<tr class="${activo ? '' : 'user-row-disabled'}"><td><strong>${escapeHtml(usuario.nombre)}</strong><br><small>${estado}</small></td><td>${escapeHtml(usuario.documento)}</td><td><span class="reserva-estado">${escapeHtml(usuario.rol)}</span></td><td>${escapeHtml(usuario.email)}</td><td class="user-actions"><button class="btn btn-ghost user-status-action" onclick="window.openUsuarioModal(${Number(usuario.id)})"><i class="fa-solid fa-pen"></i> Editar</button>${accion}</td></tr>`;
    }).join('') : '<tr><td colspan="5">No hay usuarios registrados.</td></tr>';
};

window.cambiarEstadoUsuario = async function (usuarioId, activar) {
    let motivo = '';
    if (!activar) {
        motivo = prompt('Motivo de la deshabilitación (opcional):');
        if (motivo === null) return;
        if (!confirm('La cuenta no podrá iniciar sesión. Su historial se conservará. ¿Continuar?')) return;
    }
    const data = new FormData();
    data.append('action', activar ? 'reactivar_usuario' : 'desactivar_usuario');
    data.append('usuario_id', usuarioId);
    if (!activar) data.append('motivo_desactivacion', motivo);
    const response = await fetch('api/users.php', { method: 'POST', body: data });
    const result = await response.json();
    alert(result.message);
    if (result.status === 'success') document.getElementById('vigilantes-grid') ? loadVigilantes() : loadUsuarios();
};

loadVigilantes = async function () {
    const grid = document.getElementById('vigilantes-grid');
    if (!grid) return;
    const response = await fetch('api/users.php?action=list_vigilantes');
    const result = await response.json();
    if (result.status !== 'success') return alert(result.message);
    vigilantesActuales = result.data || [];
    grid.innerHTML = vigilantesActuales.length ? vigilantesActuales.map(vigilante => {
        const activo = Number(vigilante.activo) === 1;
        const iniciales = escapeHtml(vigilante.nombre || 'VG').split(/\s+/).map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
        const foto = Number(vigilante.tiene_foto) ? `<img src="api/users.php?action=ver_foto_vigilante&vigilante_id=${Number(vigilante.id)}" alt="Foto de ${escapeHtml(vigilante.nombre)}">` : `<span>${iniciales}</span>`;
        return `<article class="vigilante-card ${activo ? '' : 'vigilante-card-disabled'}"><div class="vigilante-photo">${foto}</div><div class="vigilante-card-body"><div class="vigilante-card-title"><h3>${escapeHtml(vigilante.nombre)}</h3><span class="user-state ${activo ? 'user-state-active' : 'user-state-disabled'}">${activo ? 'Activo' : 'Desactivado'}</span></div><p class="vigilante-documento"><i class="fa-regular fa-id-card"></i> ${escapeHtml(vigilante.documento)}</p><dl><div><dt>Teléfono</dt><dd>${escapeHtml(vigilante.contacto || 'No registrado')}</dd></div><div><dt>Turno</dt><dd>${escapeHtml(vigilante.turno || 'Sin definir')}</dd></div><div><dt>Horario</dt><dd>${escapeHtml(vigilante.horario || 'Sin definir')}</dd></div></dl>${vigilante.observaciones ? `<p class="vigilante-notas">${escapeHtml(vigilante.observaciones)}</p>` : ''}<div class="vigilante-card-actions"><button class="btn btn-ghost vigilante-edit" type="button" onclick="window.abrirModalVigilante(${Number(vigilante.id)})"><i class="fa-solid fa-pen"></i> Editar ficha</button><button class="btn btn-ghost vigilante-edit" type="button" onclick="window.cambiarEstadoUsuario(${Number(vigilante.id)}, ${activo ? 0 : 1})">${activo ? '<i class="fa-solid fa-user-slash"></i> Deshabilitar' : '<i class="fa-solid fa-user-check"></i> Reactivar'}</button></div></div></article>`;
    }).join('') : '<div class="empty-state"><i class="fa-solid fa-shield-halved"></i><h3>Aún no hay vigilantes registrados</h3><p>Crea la primera ficha de vigilancia para asignar sus datos y horario.</p><button class="btn btn-primary" type="button" onclick="window.abrirModalVigilante()">Crear vigilante</button></div>';
};

const abrirInmuebleOperativoBase = window.abrirModalInmueble;
window.abrirModalInmueble = function (id = null) {
    abrirInmuebleOperativoBase(id);
    const inmueble = inmueblesActuales.find(item => Number(item.id) === Number(id));
    const label = document.querySelector('label[for="inmuebleParqueadero"]');
    if (!label) return;
    const disponibles = (window.parqueaderosEnInmuebles || []).filter(parqueadero => parqueadero.estado === 'disponible' || Number(parqueadero.id) === Number(inmueble?.parqueadero_id));
    label.innerHTML = `Parqueadero del catálogo <small>(opcional)</small><select id="inmuebleParqueadero"><option value="">Sin parqueadero asignado</option>${disponibles.map(parqueadero => `<option value="${Number(parqueadero.id)}" ${Number(parqueadero.id) === Number(inmueble?.parqueadero_id) ? 'selected' : ''}>${escapeHtml(parqueadero.codigo)} · ${escapeHtml(parqueadero.tipo)} · ${parqueadero.estado === 'disponible' ? 'Libre' : 'Asignado a esta unidad'}</option>`).join('')}</select><small class="field-help">Los cupos ocupados por otras unidades no aparecen; al elegir “sin parqueadero” se conserva el retiro en el historial.</small>`;
};

loadInmuebles = async function () {
    const [inmueblesResponse, parqueaderosResponse] = await Promise.all([fetch('api/inmuebles.php?action=list'), fetch('api/parqueaderos.php?action=list')]);
    const [inmueblesResult, parqueaderosResult] = await Promise.all([inmueblesResponse.json(), parqueaderosResponse.json()]);
    if (inmueblesResult.status !== 'success') return alert(inmueblesResult.message);
    inmueblesActuales = inmueblesResult.data || [];
    window.parqueaderosEnInmuebles = parqueaderosResult.status === 'success' ? parqueaderosResult.data : [];
    const tabla = document.getElementById('tb-inmuebles');
    if (tabla) tabla.innerHTML = inmueblesActuales.length ? inmueblesActuales.map(inmueble => {
        const parqueadero = inmueble.parqueadero_codigo ? `<strong>${escapeHtml(inmueble.parqueadero_codigo)}</strong><br><small>${escapeHtml(inmueble.parqueadero_tipo)}</small>` : '<span class="parking-free">Sin parqueadero</span>';
        return `<tr><td>${escapeHtml(inmueble.tipo_unidad || 'apartamento')}</td><td>${escapeHtml(inmueble.torre || '—')}</td><td><strong>${escapeHtml(inmueble.nomenclatura || inmueble.apartamento)}</strong></td><td>${parqueadero}</td><td>${escapeHtml(inmueble.coeficiente || '0')}</td><td>${formatCurrency(inmueble.mora_actual)}</td><td><button class="btn btn-ghost" style="width:auto" onclick="window.abrirModalInmueble(${Number(inmueble.id)})">Editar</button></td></tr>`;
    }).join('') : '<tr><td colspan="7">No hay unidades registradas.</td></tr>';
    const form = document.getElementById('formInmueble');
    if (form) form.onsubmit = guardarInmueble;
};

guardarInmueble = async function (event) {
    event.preventDefault();
    const data = new FormData();
    const inmuebleId = Number(document.getElementById('inmuebleId').value || 0);
    [['id', 'inmuebleId'], ['tipo_unidad', 'inmuebleTipo'], ['torre', 'inmuebleTorre'], ['nomenclatura', 'inmuebleNomenclatura'], ['coeficiente', 'inmuebleCoeficiente'], ['mora_actual', 'inmuebleMora']].forEach(([nombre, id]) => data.append(nombre, document.getElementById(id).value));
    data.append('parqueadero', '');
    data.append('action', 'guardar_inmueble');
    const response = await fetch('api/inmuebles.php', { method: 'POST', body: data });
    const result = await response.json();
    if (result.status !== 'success') return alert(result.message);
    const id = Number(result.data?.id || inmuebleId);
    const parqueaderoId = Number(document.getElementById('inmuebleParqueadero')?.value || 0);
    if (id) {
        const cambio = new FormData();
        cambio.append('action', 'cambiar_asignacion');
        cambio.append('inmueble_id', id);
        cambio.append('parqueadero_id', parqueaderoId);
        const cambioResponse = await fetch('api/parqueaderos.php', { method: 'POST', body: cambio });
        const cambioResult = await cambioResponse.json();
        if (cambioResult.status !== 'success') return alert(`La unidad se guardó, pero no fue posible actualizar el parqueadero: ${cambioResult.message}`);
    }
    alert(result.message);
    cerrarModalInmueble();
    loadInmuebles();
};

const cargarConfiguracionOperativaBase = loadConfiguracion;
loadConfiguracion = async function () {
    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = `<div class="view settings-view"><div class="settings-hero"><div><p class="section-kicker">Administración del conjunto</p><h1 class="page-title">Configuración</h1><p>Define la identidad del portal y consulta la automatización de cuotas.</p></div><span class="settings-hero-icon"><i class="fa-solid fa-sliders"></i></span></div><div class="settings-grid"><section class="card settings-card"><div class="settings-card-heading"><span class="settings-icon"><i class="fa-solid fa-building"></i></span><div><h2>Identidad del portal</h2><p>Los cambios se reflejan en la cabecera y en el acceso público.</p></div></div><form id="formConfiguracion" class="settings-form" enctype="multipart/form-data"><label for="config-nombre">Nombre de la copropiedad<input id="config-nombre" name="nombre" required></label><label for="config-logo">URL del logo <small>(opcional)</small><input id="config-logo" name="logo_url" type="url" placeholder="https://ejemplo.com/logo.png"></label><label for="config-logo-archivo">O carga un logo <small>JPG, PNG o WEBP · máximo 3 MB</small><input id="config-logo-archivo" name="logo_archivo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label><img id="config-logo-preview" class="logo-preview hidden" alt="Vista previa del logo"><button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Guardar configuración</button></form></section><aside class="card settings-card automation-card"><div class="settings-card-heading"><span class="settings-icon settings-icon-automation"><i class="fa-solid fa-clock-rotate-left"></i></span><div><h2>Automatización de cuotas</h2><p>Estado de la tarea mensual instalada en el servidor.</p></div></div><div class="automation-status"><span class="automation-dot"></span><div><strong>Activa</strong><small>Se ejecuta con el usuario seguro del servidor.</small></div></div><dl class="automation-details"><div><dt>Frecuencia</dt><dd>Día 1 de cada mes</dd></div><div><dt>Hora</dt><dd>00:05</dd></div><div><dt>Qué genera</dt><dd>Cuotas de apartamentos con valor configurado</dd></div><div><dt>Configuración de valores</dt><dd>Finanzas → Cuotas por apartamentos</dd></div></dl><p class="automation-note"><i class="fa-solid fa-shield-halved"></i> El cron se instala en el servidor y no se edita desde el navegador para evitar cambios de seguridad. Las tarifas se administran en Finanzas.</p></aside></div></div>`;
    const response = await fetch('api/conjuntos.php?action=get_config');
    const result = await response.json();
    if (result.status === 'success') {
        document.getElementById('config-nombre').value = result.data?.nombre || '';
        document.getElementById('config-logo').value = result.data?.logo_url || '';
        if (result.data?.logo_url) { const preview = document.getElementById('config-logo-preview'); preview.src = result.data.logo_url; preview.classList.remove('hidden'); }
    }
    const form = document.getElementById('formConfiguracion');
    const actualizarVista = () => { const archivo = document.getElementById('config-logo-archivo').files[0]; const url = archivo ? URL.createObjectURL(archivo) : document.getElementById('config-logo').value; const preview = document.getElementById('config-logo-preview'); if (url) { preview.src = url; preview.classList.remove('hidden'); } };
    document.getElementById('config-logo').oninput = actualizarVista;
    document.getElementById('config-logo-archivo').onchange = actualizarVista;
    form.onsubmit = async event => { event.preventDefault(); const data = new FormData(form); data.append('action', 'update_config'); const saveResponse = await fetch('api/conjuntos.php', { method: 'POST', body: data }); const saveResult = await saveResponse.json(); alert(saveResult.message); if (saveResult.status === 'success') document.querySelectorAll('.logo span').forEach(element => element.textContent = document.getElementById('config-nombre').value); };
};

let reservasZonasActuales = [];
let zonasReservaActuales = [];
let inmueblesReservaActuales = [];

function horaCorta(hora) {
    return hora ? String(hora).slice(0, 5) : '';
}

function etiquetaHorarioReserva(reserva) {
    const inicio = horaCorta(reserva.hora_inicio);
    const fin = horaCorta(reserva.hora_fin);
    return inicio && fin ? `${inicio} – ${fin}` : 'Bloque histórico: día completo';
}

function etiquetaPoliticaZona(zona) {
    return `Máx. ${Number(zona.max_horas_reserva) || 1} h · ${Number(zona.max_reservas_diarias_inmueble) || 1} reserva(s)/día/inmueble`;
}

function eventoReserva(reserva, interno = false) {
    const historica = !reserva.hora_inicio || !reserva.hora_fin;
    const titulo = interno
        ? `${reserva.inmueble_etiqueta || 'Inmueble no asignado'} · ${etiquetaHorarioReserva(reserva)}`
        : (reserva.estado === 'aprobada' ? 'No disponible' : 'Solicitud pendiente');
    return {
        id: String(reserva.id || ''),
        title: titulo,
        start: historica ? reserva.fecha_reserva : `${reserva.fecha_reserva}T${horaCorta(reserva.hora_inicio)}`,
        end: historica ? undefined : `${reserva.fecha_reserva}T${horaCorta(reserva.hora_fin)}`,
        allDay: historica,
        classNames: [reserva.estado === 'aprobada' ? 'zona-calendar-reserva' : 'zona-calendar-pendiente']
    };
}

function fechaMinimaReserva(interna = false) {
    const fecha = new Date();
    if (!interna) fecha.setDate(fecha.getDate() + 1);
    return fechaLocal(fecha);
}

function rellenarSelect(select, items, placeholder, etiqueta) {
    if (!select) return;
    const seleccionado = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>${items.map(item => `<option value="${Number(item.id)}">${escapeHtml(etiqueta(item))}</option>`).join('')}`;
    if (items.some(item => String(item.id) === seleccionado)) select.value = seleccionado;
}

function configurarFormularioZona() {
    const form = document.getElementById('formCrearZona');
    if (!form || currentUser?.rol !== 'admin') return;
    form.onsubmit = async event => {
        event.preventDefault();
        const data = new FormData();
        const zonaId = document.getElementById('zonaId').value;
        data.append('action', zonaId ? 'actualizar_zona' : 'crear_zona');
        [['zona_id', 'zonaId'], ['nombre', 'zonaNombre'], ['descripcion', 'zonaDescripcion'], ['aforo', 'zonaAforo'], ['tarifa', 'zonaTarifa'], ['horarios', 'zonaHorarios'], ['max_horas_reserva', 'zonaMaxHorasReserva'], ['max_reservas_diarias_inmueble', 'zonaMaxReservasDiarias'], ['reglamento', 'zonaReglamento'], ['youtube_url', 'zonaYoutube']].forEach(([nombre, id]) => data.append(nombre, document.getElementById(id).value));
        const imagen = document.getElementById('zonaImagen').files[0];
        if (imagen) data.append('imagen', imagen);
        const response = await fetch('api/zonas.php', { method: 'POST', body: data });
        const result = await response.json();
        alert(result.message);
        if (result.status === 'success') { cerrarFormularioZona(); await loadZonas(); loadPublicZonas(); }
    };
}

window.abrirFormularioZona = function (zona = null) {
    const form = document.getElementById('formCrearZona');
    if (!form) return;
    form.reset();
    document.getElementById('zonaId').value = zona?.id || '';
    document.getElementById('tituloFormularioZona').textContent = zona ? 'Editar zona social' : 'Configurar zona social';
    document.getElementById('btnGuardarZona').innerHTML = zona ? '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios' : '<i class="fa-solid fa-plus"></i> Crear zona';
    if (zona) {
        document.getElementById('zonaNombre').value = zona.nombre || '';
        document.getElementById('zonaDescripcion').value = zona.descripcion || '';
        document.getElementById('zonaAforo').value = zona.aforo || '';
        document.getElementById('zonaTarifa').value = zona.tarifa || 0;
        document.getElementById('zonaHorarios').value = zona.horarios || '';
        document.getElementById('zonaMaxHorasReserva').value = zona.max_horas_reserva || 1;
        document.getElementById('zonaMaxReservasDiarias').value = zona.max_reservas_diarias_inmueble || 1;
        document.getElementById('zonaReglamento').value = zona.reglamento || '';
        document.getElementById('zonaYoutube').value = zona.youtube_url || '';
    }
    document.getElementById('modalZona').classList.remove('hidden');
    document.getElementById('zonaNombre').focus();
};

window.editarZona = function (zonaId) {
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(zonaId));
    if (zona) window.abrirFormularioZona(zona);
};

function renderTablaReservas(esInterno) {
    const tabla = document.getElementById('tb-zonas');
    if (!tabla) return;
    tabla.innerHTML = reservasZonasActuales.length ? reservasZonasActuales.map(reserva => {
        const estado = escapeHtml(reserva.estado);
        const acciones = esInterno
            ? `<button class="btn btn-ghost internal-reservation-action" onclick="window.abrirReservaInterna(${Number(reserva.id)})">Ver / gestionar</button>`
            : '—';
        return `<tr><td>${escapeHtml(reserva.zona_nombre)}</td><td><strong>${escapeHtml(reserva.inmueble_etiqueta || 'Histórico sin inmueble')}</strong></td><td>${formatDate(reserva.fecha_reserva)}</td><td>${escapeHtml(etiquetaHorarioReserva(reserva))}</td><td><span class="reserva-estado estado-${estado}">${estado}</span></td><td>${acciones}</td></tr>`;
    }).join('') : '<tr><td colspan="6">No hay reservas registradas.</td></tr>';
}

function renderCalendarioPersonal() {
    const contenedor = document.getElementById('calendar');
    if (!contenedor || !window.FullCalendar) return;
    if (window.zonasCalendar) window.zonasCalendar.destroy();
    window.zonasCalendar = new FullCalendar.Calendar(contenedor, {
        initialView: 'timeGridWeek', locale: 'es', height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
        events: reservasZonasActuales.map(reserva => eventoReserva(reserva, false))
    });
    window.zonasCalendar.render();
}

async function renderDisponibilidadResidente() {
    const selectZona = document.getElementById('reservaZonaId');
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!selectZona || !window.FullCalendar) return;
    if (!calendario) {
        calendario = document.createElement('section');
        calendario.id = 'calendar-disponibilidad-residente';
        calendario.className = 'resident-zone-calendar';
        calendario.innerHTML = '<div class="resident-availability-header"><div><p class="section-kicker">Disponibilidad por horas</p><h3>Agenda de la zona</h3><p>Las franjas ocupadas no exponen el inmueble ni la persona que las solicitó.</p></div></div><div class="resident-zone-calendar-body"></div>';
        document.getElementById('calendar')?.closest('.card')?.insertAdjacentElement('beforebegin', calendario);
    }
    const cuerpo = calendario.querySelector('.resident-zone-calendar-body');
    if (!selectZona.value) { cuerpo.innerHTML = '<p class="muted">Selecciona una zona para consultar sus horarios disponibles.</p>'; return; }
    const response = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(selectZona.value)}`);
    const result = await response.json();
    if (result.status !== 'success') { cuerpo.innerHTML = `<p class="muted">${escapeHtml(result.message || 'No fue posible cargar la disponibilidad.')}</p>`; return; }
    cuerpo.innerHTML = '';
    if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();
    window.residentAvailabilityCalendar = new FullCalendar.Calendar(cuerpo, {
        initialView: 'timeGridWeek', locale: 'es', height: 'auto', slotMinTime: '00:00:00', slotMaxTime: '24:00:00',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
        events: (result.data.reservas || []).map(reserva => eventoReserva(reserva, false)),
        dateClick: info => {
            const fecha = fechaLocal(info.date);
            if (fecha < fechaMinimaReserva()) return;
            document.getElementById('reservaFecha').value = fecha;
            document.getElementById('reservaHoraInicio').value = info.allDay ? '08:00' : horaCorta(`${String(info.date.getHours()).padStart(2, '0')}:${String(info.date.getMinutes()).padStart(2, '0')}`);
            document.getElementById('reservaHoraFin').focus();
        }
    });
    window.residentAvailabilityCalendar.render();
}

function configurarReservaResidente() {
    const form = document.getElementById('formReservarZona');
    const selectZona = document.getElementById('reservaZonaId');
    if (!form || !selectZona) return;
    selectZona.onchange = renderDisponibilidadResidente;
    form.onsubmit = async event => {
        event.preventDefault();
        const data = new FormData();
        data.append('action', 'crear_reserva');
        [['zona_id', 'reservaZonaId'], ['inmueble_id', 'reservaInmuebleId'], ['fecha_reserva', 'reservaFecha'], ['hora_inicio', 'reservaHoraInicio'], ['hora_fin', 'reservaHoraFin']].forEach(([nombre, id]) => data.append(nombre, document.getElementById(id).value));
        const response = await fetch('api/zonas.php', { method: 'POST', body: data });
        const result = await response.json();
        alert(result.message);
        if (result.status === 'success') { form.reset(); await loadZonas(); }
    };
}

function renderCalendarioInterno() {
    const contenedor = document.getElementById('calendar');
    if (!contenedor || !window.FullCalendar) return;
    if (!zonasReservaActuales.length) { contenedor.innerHTML = '<p class="empty-state">No hay zonas configuradas para consultar disponibilidad.</p>'; return; }
    const previo = Number(document.getElementById('calendarioZonaInterna')?.value || zonasReservaActuales[0].id);
    contenedor.innerHTML = `<div class="internal-calendar-heading"><div><p class="section-kicker">Disponibilidad por inmueble</p><h3>Agenda operativa por horas</h3><p class="muted">Selecciona una zona para ver sus franjas. Haz clic en un horario libre para crear una reserva interna.</p></div><label for="calendarioZonaInterna">Zona social<select id="calendarioZonaInterna">${zonasReservaActuales.map(zona => `<option value="${Number(zona.id)}" ${Number(zona.id) === previo ? 'selected' : ''}>${escapeHtml(zona.nombre)}</option>`).join('')}</select></label></div><div id="calendar-interno" class="internal-zone-calendar"></div>`;
    const selector = document.getElementById('calendarioZonaInterna');
    const render = () => {
        const zonaId = Number(selector.value);
        const reservas = reservasZonasActuales.filter(reserva => Number(reserva.zona_id) === zonaId && ['pendiente', 'aprobada'].includes(reserva.estado));
        if (window.zonasCalendar) window.zonasCalendar.destroy();
        window.zonasCalendar = new FullCalendar.Calendar(document.getElementById('calendar-interno'), {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto', slotMinTime: '00:00:00', slotMaxTime: '24:00:00',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
            events: reservas.map(reserva => eventoReserva(reserva, true)),
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                if (fecha < fechaMinimaReserva(true)) return;
                const hora = info.allDay ? '08:00' : `${String(info.date.getHours()).padStart(2, '0')}:${String(info.date.getMinutes()).padStart(2, '0')}`;
                window.abrirReservaInterna(0, fecha, zonaId, hora);
            },
            eventClick: info => window.abrirReservaInterna(Number(info.event.id))
        });
        window.zonasCalendar.render();
    };
    selector.onchange = render;
    render();
}

loadZonas = async function () {
    const esInterno = ['admin', 'vigilante'].includes(currentUser?.rol);
    const [reservasResponse, zonasResponse, inmueblesResponse] = await Promise.all([
        fetch('api/zonas.php?action=list'),
        fetch('api/zonas.php?action=zonas_list'),
        fetch('api/zonas.php?action=inmuebles_reservas')
    ]);
    const [reservasResult, zonasResult, inmueblesResult] = await Promise.all([reservasResponse.json(), zonasResponse.json(), inmueblesResponse.json()]);
    if (reservasResult.status !== 'success' || zonasResult.status !== 'success' || inmueblesResult.status !== 'success') {
        alert('No fue posible cargar la operación de reservas.');
        return;
    }
    reservasZonasActuales = reservasResult.data || [];
    zonasReservaActuales = zonasResult.data || [];
    inmueblesReservaActuales = inmueblesResult.data || [];
    zonasActuales = zonasReservaActuales;

    const esAdmin = currentUser?.rol === 'admin';
    document.getElementById('panelReservarZona')?.classList.toggle('hidden', esInterno);
    document.getElementById('btnNuevaZona')?.classList.toggle('hidden', !esAdmin);
    document.getElementById('panelGestionZonas')?.classList.toggle('hidden', !esAdmin);
    const config = document.getElementById('tb-zonas-config');
    if (config && esAdmin) config.innerHTML = zonasReservaActuales.length ? zonasReservaActuales.map(zona => `<tr><td><strong>${escapeHtml(zona.nombre)}</strong><br><small>${escapeHtml(zona.descripcion || 'Sin descripción')}</small></td><td>${Number(zona.aforo) || '—'}</td><td>${escapeHtml(zona.horarios || '—')}</td><td>${escapeHtml(etiquetaPoliticaZona(zona))}</td><td>${Number(zona.tarifa || 0) ? formatCurrency(zona.tarifa) : 'Sin costo'}</td><td><button class="btn btn-ghost" style="width:auto" onclick="editarZona(${Number(zona.id)})"><i class="fa-solid fa-pen"></i> Editar</button></td></tr>`).join('') : '<tr><td colspan="6">No hay zonas configuradas.</td></tr>';
    configurarFormularioZona();
    renderTablaReservas(esInterno);

    if (esInterno) {
        document.getElementById('calendar-disponibilidad-residente')?.remove();
        renderCalendarioInterno();
        return;
    }
    rellenarSelect(document.getElementById('reservaZonaId'), zonasReservaActuales, 'Selecciona una zona…', zona => `${zona.nombre} · ${zona.horarios}`);
    rellenarSelect(document.getElementById('reservaInmuebleId'), inmueblesReservaActuales, inmueblesReservaActuales.length ? 'Selecciona tu inmueble…' : 'No tienes inmuebles asociados', inmueble => inmueble.etiqueta);
    const fecha = document.getElementById('reservaFecha');
    if (fecha) fecha.min = fechaMinimaReserva();
    configurarReservaResidente();
    renderCalendarioPersonal();
    renderDisponibilidadResidente();
};

window.abrirReservaInterna = function (reservaId = 0, fecha = '', zonaPreseleccionada = 0, horaPreseleccionada = '08:00') {
    const reserva = reservasZonasActuales.find(item => Number(item.id) === Number(reservaId));
    let modal = document.getElementById('modalReservaInterna');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', '<div id="modalReservaInterna" class="login-modal internal-reservation-modal hidden"></div>'); modal = document.getElementById('modalReservaInterna'); }
    if (reserva) {
        const puedeAprobar = currentUser?.rol === 'admin' && reserva.estado === 'pendiente';
        const puedeCancelar = ['pendiente', 'aprobada'].includes(reserva.estado);
        modal.innerHTML = `<div class="login-box internal-reservation-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalReservaInterna').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><p class="section-kicker">Reserva de zona</p><h2>${escapeHtml(reserva.zona_nombre)}</h2><dl class="reservation-detail-list"><div><dt>Apartamento o casa</dt><dd>${escapeHtml(reserva.inmueble_etiqueta || 'Histórico sin inmueble asignado')}</dd></div><div><dt>Fecha</dt><dd>${formatDate(reserva.fecha_reserva)}</dd></div><div><dt>Horario</dt><dd>${escapeHtml(etiquetaHorarioReserva(reserva))}</dd></div><div><dt>Estado</dt><dd><span class="reserva-estado estado-${escapeHtml(reserva.estado)}">${escapeHtml(reserva.estado)}</span></dd></div></dl><div class="reservation-modal-actions">${puedeAprobar ? `<button class="btn btn-primary" onclick="window.gestionarReservaInterna(${Number(reserva.id)}, 'aprobar')">Aprobar</button><button class="btn btn-ghost" onclick="window.gestionarReservaInterna(${Number(reserva.id)}, 'rechazar')">Rechazar</button>` : ''}${puedeCancelar ? `<button class="btn btn-danger" onclick="window.gestionarReservaInterna(${Number(reserva.id)}, 'cancelar')">Cancelar reserva</button>` : ''}</div></div>`;
    } else {
        modal.innerHTML = `<div class="login-box internal-reservation-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalReservaInterna').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><p class="section-kicker">Reserva interna</p><h2>Crear reserva</h2><p class="muted">Selecciona el inmueble y una franja; la reserva queda aprobada de inmediato.</p><form id="formReservaInterna" class="internal-reservation-form"><label>Zona social<select name="zona_id" required><option value="">Selecciona una zona</option>${zonasReservaActuales.map(zona => `<option value="${Number(zona.id)}" ${Number(zona.id) === Number(zonaPreseleccionada) ? 'selected' : ''}>${escapeHtml(zona.nombre)} · máx. ${Number(zona.max_horas_reserva) || 1} h</option>`).join('')}</select></label><label>Apartamento o casa<select name="inmueble_id" required><option value="">Selecciona un inmueble</option>${inmueblesReservaActuales.map(inmueble => `<option value="${Number(inmueble.id)}">${escapeHtml(inmueble.etiqueta)}</option>`).join('')}</select></label><div class="internal-reservation-time-grid"><label>Fecha<input name="fecha_reserva" type="date" min="${fechaMinimaReserva(true)}" value="${fecha}" required></label><label>Inicio<input name="hora_inicio" type="time" value="${horaPreseleccionada}" required></label><label>Fin<input name="hora_fin" type="time" required></label></div><button class="btn btn-primary" type="submit"><i class="fa-solid fa-calendar-check"></i> Crear reserva</button></form></div>`;
        modal.querySelector('form').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.currentTarget); data.append('action', 'crear_reserva_interna'); const response = await fetch('api/zonas.php', { method: 'POST', body: data }); const result = await response.json(); alert(result.message); if (result.status === 'success') { modal.classList.add('hidden'); await loadZonas(); } };
    }
    modal.classList.remove('hidden');
};

window.gestionarReservaInterna = async function (reservaId, accion) {
    if (accion === 'cancelar' && !confirm('¿Cancelar esta reserva? Se conservará en el historial.')) return;
    const data = new FormData();
    data.append('reserva_id', reservaId);
    if (accion === 'cancelar') data.append('action', 'cancelar_reserva');
    else { data.append('action', 'estado_reserva'); data.append('estado', accion === 'aprobar' ? 'aprobada' : 'rechazada'); }
    const response = await fetch('api/zonas.php', { method: 'POST', body: data });
    const result = await response.json();
    alert(result.message);
    if (result.status === 'success') { document.getElementById('modalReservaInterna')?.classList.add('hidden'); await loadZonas(); }
};

window.abrirDetalleZona = async function (zonaId) {
    const modal = document.getElementById('zona-detalle-modal');
    const titulo = document.getElementById('zona-detalle-titulo');
    if (!modal || !titulo) return;
    modal.classList.remove('hidden');
    titulo.textContent = 'Cargando zona…';
    try {
        const response = await fetch(`api/zonas.php?action=public_zona_detalle&zona_id=${encodeURIComponent(zonaId)}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        const { zona, reservas } = result.data;
        document.getElementById('zona-detalle-imagen').style.backgroundImage = `linear-gradient(120deg, rgba(15,23,42,.2), rgba(15,23,42,.58)), url("${imagenZona(zona)}")`;
        titulo.textContent = zona.nombre;
        document.getElementById('zona-detalle-descripcion').textContent = zona.descripcion || 'Espacio disponible para el disfrute de la comunidad.';
        document.getElementById('zona-detalle-aforo').textContent = `${zona.aforo || 'No definido'} personas`;
        document.getElementById('zona-detalle-horario').textContent = zona.horarios || 'No definido';
        document.getElementById('zona-detalle-tarifa').textContent = Number(zona.tarifa) ? formatCurrency(zona.tarifa) : 'Sin costo';
        document.getElementById('zona-detalle-reglamento').textContent = zona.reglamento || 'No hay normas adicionales registradas.';
        modal.dataset.zonaId = zona.id;
        let video = document.getElementById('zona-detalle-video');
        if (!video) { video = document.createElement('div'); video.id = 'zona-detalle-video'; video.className = 'zona-video'; document.querySelector('.zona-detalle-rules').insertAdjacentElement('afterend', video); }
        const videoId = youtubeId(zona.youtube_url);
        video.innerHTML = videoId ? `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="Video de ${escapeHtml(zona.nombre)}" loading="lazy" allowfullscreen></iframe>` : '';
        const calendario = document.getElementById('public-zona-calendar');
        if (window.publicZonaCalendar) window.publicZonaCalendar.destroy();
        window.publicZonaCalendar = new FullCalendar.Calendar(calendario, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto', slotMinTime: '00:00:00', slotMaxTime: '24:00:00',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
            events: (reservas || []).map(reserva => eventoReserva(reserva, false))
        });
        window.publicZonaCalendar.render();
    } catch (error) {
        console.error(error);
        titulo.textContent = 'No fue posible cargar esta zona';
    }
};


// Portería organizada por operación: directorio, visitas, paquetes y minuta.
let seccionPorteriaActual = 'directorio';
let opcionesUnidadesPorteria = '';
const cargarVistaPorteriaSeparadaBase = loadView;
loadView = function (viewName) {
    // Compatibilidad: cualquier acceso heredado a Portería abre el Directorio nuevo.
    if (viewName === 'porteria') viewName = 'directorio';
    if (!['directorio', 'visitas', 'paquetes', 'minuta'].includes(viewName)) {
        cargarVistaPorteriaSeparadaBase(viewName);
        return;
    }
    seccionPorteriaActual = viewName;
    const nombres = { directorio: 'Directorio', visitas: 'Visitas', paquetes: 'Paquetes', minuta: 'Novedades' };
    const iconos = { directorio: 'fa-address-book', visitas: 'fa-person-walking-arrow-right', paquetes: 'fa-box', minuta: 'fa-clipboard' };
    const acciones = {
        directorio: '',
        visitas: '<button class="btn btn-primary porteria-primary-action" onclick="window.abrirFormularioPorteria(\'visita\')"><i class="fa-solid fa-person-walking-arrow-right"></i> Registrar visita</button>',
        paquetes: '<button class="btn btn-primary porteria-primary-action porteria-package-action" onclick="window.abrirFormularioPorteria(\'paquete\')"><i class="fa-solid fa-box"></i> Recibir paquete</button>',
        minuta: '<button class="btn btn-primary porteria-primary-action" onclick="window.abrirFormularioPorteria(\'minuta\')"><i class="fa-solid fa-clipboard"></i> Registrar novedad</button>'
    };
    const contenido = {
        directorio: `<div class="card porteria-card"><div class="porteria-search"><label for="busquedaDirectorio">Buscar residente</label><input id="busquedaDirectorio" type="search" placeholder="Nombre, torre o apartamento"></div><div class="table-responsive"><table class="data-table"><thead><tr><th>Torre</th><th>Unidad</th><th>Residente</th><th>Contacto</th></tr></thead><tbody id="tb-directorio"><tr><td colspan="4">Cargando directorio…</td></tr></tbody></table></div></div>`,
        visitas: `<div class="card porteria-card table-responsive"><table class="data-table"><thead><tr><th>Visitante</th><th>Unidad destino</th><th>Placa</th><th>Ingreso</th><th>Salida</th></tr></thead><tbody id="tb-visitantes"><tr><td colspan="5">Cargando visitas…</td></tr></tbody></table></div>`,
        paquetes: `<div class="card porteria-card table-responsive"><table class="data-table"><thead><tr><th>Transportadora</th><th>Unidad destino</th><th>Recibido</th><th>Estado</th></tr></thead><tbody id="tb-paquetes"><tr><td colspan="4">Cargando paquetes…</td></tr></tbody></table></div>`,
        minuta: `<div class="card porteria-card table-responsive"><table class="data-table"><thead><tr><th>Fecha y hora</th><th>Registrado por</th><th>Asunto</th><th>Detalle</th></tr></thead><tbody id="tb-minuta"><tr><td colspan="4">Cargando novedades…</td></tr></tbody></table></div>`
    };
    document.getElementById('view-container').innerHTML = `<div class="view porteria-view"><div class="porteria-view-header"><div><p class="section-kicker">Portería y seguridad</p><h1 class="page-title"><i class="fa-solid ${iconos[viewName]}"></i> ${nombres[viewName]}</h1><p class="muted">${viewName === 'directorio' ? 'Consulta rápida de residentes y sus unidades.' : `Gestiona ${nombres[viewName].toLowerCase()} sin mezclar operaciones.`}</p></div>${acciones[viewName]}</div><nav class="porteria-tabs" aria-label="Operaciones de portería">${Object.entries(nombres).map(([clave, nombre]) => `<button type="button" class="${clave === viewName ? 'active' : ''}" onclick="loadView('${clave}')"><i class="fa-solid ${iconos[clave]}"></i><span>${nombre}</span></button>`).join('')}</nav>${contenido[viewName]}</div>`;
    cargarSeccionPorteria(viewName);
};

async function cargarSeccionPorteria(seccion) {
    try {
        if (seccion === 'directorio') {
            const response = await fetch('api/porteria.php?action=list_directorio');
            const result = await response.json();
            const tbody = document.getElementById('tb-directorio');
            if (!tbody) return;
            const registros = result.status === 'success' ? result.data : [];
            tbody.innerHTML = registros.length ? registros.map(registro => `<tr><td>${escapeHtml(registro.torre)}</td><td><strong>${escapeHtml(registro.apartamento)}</strong></td><td>${escapeHtml(registro.nombre)}</td><td>${escapeHtml(registro.contacto || registro.email || 'No registrado')}</td></tr>`).join('') : '<tr><td colspan="4">No hay residentes registrados.</td></tr>';
            document.getElementById('busquedaDirectorio')?.addEventListener('input', event => {
                const texto = event.target.value.toLowerCase().trim();
                tbody.querySelectorAll('tr').forEach(fila => fila.classList.toggle('hidden', texto !== '' && !fila.textContent.toLowerCase().includes(texto)));
            });
            return;
        }
        const accion = seccion === 'visitas' ? 'list_visitantes' : seccion === 'paquetes' ? 'list_paquetes' : 'list_minuta';
        const response = await fetch(`api/porteria.php?action=${accion}`);
        const result = await response.json();
        const registros = result.status === 'success' ? result.data : [];
        if (seccion === 'visitas') {
            const tbody = document.getElementById('tb-visitantes');
            tbody.innerHTML = registros.length ? registros.map(visita => `<tr><td><strong>${escapeHtml(visita.nombre)}</strong><br><small>${escapeHtml(visita.documento || 'Sin documento')}</small></td><td>${escapeHtml(visita.torre || '')} · ${escapeHtml(visita.apartamento || visita.nomenclatura || '—')}</td><td>${escapeHtml(visita.vehiculo_placa || '—')}</td><td>${formatDate(visita.fecha_ingreso)}</td><td>${visita.fecha_salida ? formatDate(visita.fecha_salida) : `<button class="btn btn-primary porteria-table-action" onclick="window.cerrarVisita(${Number(visita.id)})">Marcar salida</button>`}</td></tr>`).join('') : '<tr><td colspan="5">No hay visitas registradas.</td></tr>';
            await cargarUnidadesPorteria();
        } else if (seccion === 'paquetes') {
            const tbody = document.getElementById('tb-paquetes');
            tbody.innerHTML = registros.length ? registros.map(paquete => `<tr><td><strong>${escapeHtml(paquete.transportadora)}</strong><br><small>${escapeHtml(paquete.descripcion || 'Sin descripción')}</small></td><td>${escapeHtml(paquete.torre || '')} · ${escapeHtml(paquete.apartamento || paquete.nomenclatura || '—')}</td><td>${formatDate(paquete.fecha_recepcion)}</td><td>${paquete.estado === 'pendiente' ? `<button class="btn btn-primary porteria-table-action" onclick="window.entregarPaquete(${Number(paquete.id)})">Entregar</button>` : '<span class="reserva-estado estado-aprobada">Entregado</span>'}</td></tr>`).join('') : '<tr><td colspan="4">No hay paquetes registrados.</td></tr>';
            await cargarUnidadesPorteria();
        } else {
            const tbody = document.getElementById('tb-minuta');
            tbody.innerHTML = registros.length ? registros.map(novedad => `<tr><td>${formatDateTime(novedad.fecha_operativa || novedad.fecha_registro)}</td><td>${escapeHtml(novedad.vigilante)}</td><td><strong>${escapeHtml(novedad.asunto)}</strong></td><td>${escapeHtml(novedad.novedad)}</td></tr>`).join('') : '<tr><td colspan="4">No hay novedades registradas.</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando operación de portería', error);
    }
}

async function cargarUnidadesPorteria() {
    const response = await fetch('api/porteria.php?action=list_inmuebles');
    const result = await response.json();
    opcionesUnidadesPorteria = result.status === 'success' ? result.data.map(unidad => `<option value="${Number(unidad.id)}">${escapeHtml([unidad.torre, unidad.nomenclatura || unidad.apartamento].filter(Boolean).join(' · '))}</option>`).join('') : '';
}

window.abrirFormularioPorteria = async function (tipo) {
    if ((tipo === 'visita' || tipo === 'paquete') && !opcionesUnidadesPorteria) await cargarUnidadesPorteria();
    let modal = document.getElementById('modalPorteriaSeparada');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', '<div id="modalPorteriaSeparada" class="login-modal hidden"></div>'); modal = document.getElementById('modalPorteriaSeparada'); }
    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const configuracion = {
        visita: ['Registrar visita', `<label>Nombre del visitante<input name="nombre" required></label><label>Documento <small>(opcional)</small><input name="documento"></label><label>Placa <small>(opcional)</small><input name="vehiculo_placa"></label><label>Unidad visitada<select name="inmueble_id" required><option value="">Selecciona una unidad</option>${opcionesUnidadesPorteria}</select></label>`, 'registrar_visita'],
        paquete: ['Recibir paquete', `<label>Unidad destino<select name="inmueble_id" required><option value="">Selecciona una unidad</option>${opcionesUnidadesPorteria}</select></label><label>Transportadora<input name="transportadora" required></label><label>Descripción <small>(opcional)</small><textarea name="descripcion" rows="3"></textarea></label>`, 'recibir_paquete'],
        minuta: ['Registrar novedad', `<label>Fecha y hora de la novedad<input name="fecha_novedad" type="datetime-local" value="${fechaLocal}" required></label><label>Asunto<input name="asunto" maxlength="150" required></label><label>Detalle de la novedad<textarea name="novedad" rows="5" required></textarea></label>`, 'registrar_novedad']
    }[tipo];
    modal.innerHTML = `<div class="login-box porteria-modal-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalPorteriaSeparada').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><h2>${configuracion[0]}</h2><form id="formPorteriaSeparada" class="porteria-form"><input type="hidden" name="action" value="${configuracion[2]}">${configuracion[1]}<button class="btn btn-primary" type="submit">Guardar</button></form></div>`;
    modal.classList.remove('hidden');
};

document.addEventListener('submit', async event => {
    if (event.target.id !== 'formPorteriaSeparada') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const response = await fetch('api/porteria.php', { method: 'POST', body: new FormData(event.target) });
    const result = await response.json();
    alert(result.message);
    if (result.status === 'success') { document.getElementById('modalPorteriaSeparada')?.classList.add('hidden'); cargarSeccionPorteria(seccionPorteriaActual); }
}, true);

async function operarPorteriaSeparada(action, valores) {
    const data = new FormData();
    data.append('action', action);
    Object.entries(valores).forEach(([clave, valor]) => data.append(clave, valor));
    const response = await fetch('api/porteria.php', { method: 'POST', body: data });
    const result = await response.json();
    alert(result.message);
    if (result.status === 'success') cargarSeccionPorteria(seccionPorteriaActual);
}
window.cerrarVisita = id => operarPorteriaSeparada('marcar_salida', { visitante_id: id });
window.entregarPaquete = id => operarPorteriaSeparada('entregar_paquete', { paquete_id: id });

const iniciarAppPorteriaSeparadaBase = initApp;
initApp = function () {
    iniciarAppPorteriaSeparadaBase();
    if (currentUser?.rol === 'vigilante') {
        ['porteria', 'zonas', 'perfil'].forEach(vista => {
            const enlace = document.querySelector(`.nav-links li[data-view="${vista}"]`);
            if (enlace) enlace.style.display = 'flex';
        });
        document.querySelector('.nav-admin-vigilancia').style.display = 'none';
        ['directorio', 'visitas', 'paquetes', 'minuta'].forEach(vista => {
            const enlace = document.querySelector(`.nav-links li[data-view="${vista}"]`);
            if (enlace) enlace.style.display = 'none';
        });
        document.querySelectorAll('.nav-links li[data-view]').forEach(enlace => enlace.classList.toggle('active', enlace.dataset.view === 'porteria'));
        loadView('porteria');
    }
};


// Interfaz unificada: notificaciones SweetAlert, horarios de servicio y agendas por franja.
window.notificar = function (mensaje, icono = 'info') {
    if (!window.Swal) return console[icono === 'error' ? 'error' : 'log'](mensaje);
    return Swal.fire({ toast: true, position: 'top-end', icon: icono, title: String(mensaje || ''), showConfirmButton: false, timer: 4200, timerProgressBar: true });
};
window.alert = function (mensaje) {
    const texto = String(mensaje || '');
    const icono = /error|no se pudo|inválid|denegad|no autorizado|no encontrad|debe|selecciona/i.test(texto) ? 'error' : 'success';
    return window.notificar(texto, icono);
};
window.confirmarAccion = async function ({ titulo = '¿Continuar?', texto = '', confirmar = 'Continuar', icono = 'warning' } = {}) {
    if (!window.Swal) return false;
    const resultado = await Swal.fire({ title: titulo, text: texto, icon: icono, showCancelButton: true, confirmButtonText: confirmar, cancelButtonText: 'Cancelar', reverseButtons: true, focusCancel: true });
    return resultado.isConfirmed;
};
window.solicitarTexto = async function ({ titulo, etiqueta, valor = '' }) {
    if (!window.Swal) return null;
    const resultado = await Swal.fire({ title: titulo, input: 'text', inputLabel: etiqueta, inputValue: valor, inputPlaceholder: 'Opcional', showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar', reverseButtons: true });
    return resultado.isConfirmed ? String(resultado.value || '') : null;
};

function horarioServicioZona(zona) {
    const coincidencias = String(zona?.horarios || '').trim().match(/^([01]\d|2[0-3]):[0-5]\d\s*[-–]\s*([01]\d|2[0-3]):[0-5]\d$/);
    if (!coincidencias || coincidencias[1] === coincidencias[2]) return null;
    const aMinutos = Number(coincidencias[1].slice(0, 2)) * 60 + Number(coincidencias[1].slice(3));
    const cMinutos = Number(coincidencias[2].slice(0, 2)) * 60 + Number(coincidencias[2].slice(3));
    return { apertura: coincidencias[1], cierre: coincidencias[2], aperturaMinutos: aMinutos, cierreMinutos: cMinutos, nocturno: aMinutos > cMinutos };
}

function minutosHora(valor) {
    const texto = valor instanceof Date ? `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}` : String(valor || '').slice(0, 5);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto) ? Number(texto.slice(0, 2)) * 60 + Number(texto.slice(3)) : null;
}

function momentoEnHorarioServicio(fecha, horario) {
    if (!horario) return false;
    const minutos = minutosHora(fecha);
    if (minutos === null) return false;
    return horario.nocturno ? minutos >= horario.aperturaMinutos || minutos < horario.cierreMinutos : minutos >= horario.aperturaMinutos && minutos < horario.cierreMinutos;
}

function franjaEnHorarioServicio(inicio, fin, horario) {
    const inicioMinutos = minutosHora(inicio);
    const finMinutos = minutosHora(fin);
    if (inicioMinutos === null || finMinutos === null || inicioMinutos >= finMinutos || !horario) return false;
    if (!horario.nocturno) return inicioMinutos >= horario.aperturaMinutos && finMinutos <= horario.cierreMinutos;
    return (inicioMinutos >= horario.aperturaMinutos && finMinutos <= 1440) || (inicioMinutos >= 0 && finMinutos <= horario.cierreMinutos);
}

function eventosFondoHorario(horario) {
    if (!horario) return [];
    const dias = [0, 1, 2, 3, 4, 5, 6];
    const base = { daysOfWeek: dias, display: 'background', classNames: ['zona-calendar-disponible'] };
    if (!horario.nocturno) return [{ ...base, startTime: horario.apertura, endTime: horario.cierre }];
    return [
        { ...base, startTime: '00:00', endTime: horario.cierre },
        { ...base, startTime: horario.apertura, endTime: '24:00' }
    ];
}

function opcionesCalendarioHorario(zona) {
    const horario = horarioServicioZona(zona);
    return {
        slotMinTime: '00:00:00',
        slotMaxTime: '24:00:00',
        slotDuration: '00:30:00',
        businessHours: horario ? eventosFondoHorario(horario).map(({ classNames, display, ...regla }) => regla) : false,
        slotLaneClassNames: info => horario && momentoEnHorarioServicio(info.date, horario) ? ['zona-slot-disponible'] : ['zona-slot-cerrado'],
        dayCellClassNames: info => info.isPast ? ['zona-dia-pasado'] : ['zona-dia-disponible']
    };
}

function leyendaHorarioCalendario() {
    return '<div class="zona-availability-legends" aria-label="Estados de disponibilidad"><span class="zona-availability-legend is-available"><i></i> Disponible</span><span class="zona-availability-legend is-pending"><i></i> Solicitud pendiente</span><span class="zona-availability-legend is-reserved"><i></i> Reservado</span><span class="zona-availability-legend is-closed"><i></i> Fuera de servicio</span></div>';
}

function horaInicialDesdeClick(info, horario) {
    if (info.allDay) return horario?.apertura || '08:00';
    return `${String(info.date.getHours()).padStart(2, '0')}:${String(info.date.getMinutes()).padStart(2, '0')}`;
}

function configurarFormularioZona() {
    const form = document.getElementById('formCrearZona');
    if (!form || currentUser?.rol !== 'admin') return;
    form.onsubmit = async event => {
        event.preventDefault();
        const apertura = document.getElementById('zonaHoraApertura').value;
        const cierre = document.getElementById('zonaHoraCierre').value;
        if (!apertura || !cierre || apertura === cierre) return window.notificar('Define una hora de apertura y otra de cierre diferentes.', 'error');
        const data = new FormData();
        const zonaId = document.getElementById('zonaId').value;
        const horarios = `${apertura} - ${cierre}`;
        document.getElementById('zonaHorarios').value = horarios;
        data.append('action', zonaId ? 'actualizar_zona' : 'crear_zona');
        [['zona_id', 'zonaId'], ['nombre', 'zonaNombre'], ['descripcion', 'zonaDescripcion'], ['aforo', 'zonaAforo'], ['tarifa', 'zonaTarifa'], ['max_horas_reserva', 'zonaMaxHorasReserva'], ['max_reservas_diarias_inmueble', 'zonaMaxReservasDiarias'], ['reglamento', 'zonaReglamento'], ['youtube_url', 'zonaYoutube']].forEach(([nombre, id]) => data.append(nombre, document.getElementById(id).value));
        data.append('horarios', horarios);
        const imagen = document.getElementById('zonaImagen').files[0];
        if (imagen) data.append('imagen', imagen);
        const response = await fetch('api/zonas.php', { method: 'POST', body: data });
        const result = await response.json();
        window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
        if (result.status === 'success') { cerrarFormularioZona(); await loadZonas(); loadPublicZonas(); }
    };
}

window.abrirFormularioZona = function (zona = null) {
    const form = document.getElementById('formCrearZona');
    if (!form) return;
    form.reset();
    document.getElementById('zonaId').value = zona?.id || '';
    document.getElementById('tituloFormularioZona').textContent = zona ? 'Editar zona social' : 'Configurar zona social';
    document.getElementById('btnGuardarZona').innerHTML = zona ? '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios' : '<i class="fa-solid fa-plus"></i> Crear zona';
    const horario = horarioServicioZona(zona);
    document.getElementById('zonaHoraApertura').value = horario?.apertura || '08:00';
    document.getElementById('zonaHoraCierre').value = horario?.cierre || '17:00';
    if (zona) {
        document.getElementById('zonaNombre').value = zona.nombre || '';
        document.getElementById('zonaDescripcion').value = zona.descripcion || '';
        document.getElementById('zonaAforo').value = zona.aforo || '';
        document.getElementById('zonaTarifa').value = zona.tarifa || 0;
        document.getElementById('zonaMaxHorasReserva').value = zona.max_horas_reserva || 1;
        document.getElementById('zonaMaxReservasDiarias').value = zona.max_reservas_diarias_inmueble || 1;
        document.getElementById('zonaReglamento').value = zona.reglamento || '';
        document.getElementById('zonaYoutube').value = zona.youtube_url || '';
    }
    document.getElementById('modalZona').classList.remove('hidden');
    document.getElementById('zonaNombre').focus();
};

function renderDisponibilidadResidente() {
    const selectZona = document.getElementById('reservaZonaId');
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!selectZona || !window.FullCalendar) return;
    if (!calendario) {
        calendario = document.createElement('section');
        calendario.id = 'calendar-disponibilidad-residente';
        calendario.className = 'resident-zone-calendar';
        document.getElementById('calendar')?.closest('.card')?.insertAdjacentElement('beforebegin', calendario);
    }
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selectZona.value));
    if (!zona) { calendario.innerHTML = '<p class="muted">Selecciona una zona para consultar sus horarios disponibles.</p>'; return; }
    const horario = horarioServicioZona(zona);
    if (!horario) { calendario.innerHTML = '<p class="empty-state">Esta zona no tiene un horario de servicio válido. La administración debe configurarlo.</p>'; return; }
    calendario.innerHTML = `<div class="resident-availability-header"><div><p class="section-kicker">Disponibilidad por horas</p><h3>Agenda: ${escapeHtml(zona.nombre)}</h3><p>Solo las franjas verdes están dentro del horario ${horario.apertura} – ${horario.cierre}.</p></div>${leyendaHorarioCalendario()}</div><div class="resident-zone-calendar-body"></div>`;
    const cuerpo = calendario.querySelector('.resident-zone-calendar-body');
    fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(selectZona.value)}`).then(response => response.json()).then(result => {
        if (result.status !== 'success') { cuerpo.innerHTML = `<p class="muted">${escapeHtml(result.message || 'No fue posible cargar la disponibilidad.')}</p>`; return; }
        if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();
        window.residentAvailabilityCalendar = new FullCalendar.Calendar(cuerpo, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
            ...opcionesCalendarioHorario(zona),
            events: [...eventosFondoHorario(horario), ...(result.data.reservas || []).map(reserva => eventoReserva(reserva, false))],
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                const hora = horaInicialDesdeClick(info, horario);
                if (fecha < fechaMinimaReserva()) return window.notificar('Selecciona una fecha futura para reservar.', 'warning');
                if (!info.allDay && !momentoEnHorarioServicio(info.date, horario)) return window.notificar(`La zona está fuera de servicio. Horario: ${horario.apertura} – ${horario.cierre}.`, 'warning');
                document.getElementById('reservaFecha').value = fecha;
                document.getElementById('reservaHoraInicio').value = hora;
                document.getElementById('reservaHoraFin').focus();
            }
        });
        window.residentAvailabilityCalendar.render();
    }).catch(() => { cuerpo.innerHTML = '<p class="muted">No fue posible cargar la disponibilidad.</p>'; });
}

function configurarReservaResidente() {
    const form = document.getElementById('formReservarZona');
    const selectZona = document.getElementById('reservaZonaId');
    if (!form || !selectZona) return;
    selectZona.onchange = renderDisponibilidadResidente;
    form.onsubmit = async event => {
        event.preventDefault();
        const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selectZona.value));
        const horario = horarioServicioZona(zona);
        const inicio = document.getElementById('reservaHoraInicio').value;
        const fin = document.getElementById('reservaHoraFin').value;
        if (!horario || !franjaEnHorarioServicio(inicio, fin, horario)) return window.notificar(`El horario debe estar dentro del servicio: ${horario?.apertura || '—'} – ${horario?.cierre || '—'}.`, 'error');
        const data = new FormData();
        data.append('action', 'crear_reserva');
        [['zona_id', 'reservaZonaId'], ['inmueble_id', 'reservaInmuebleId'], ['fecha_reserva', 'reservaFecha'], ['hora_inicio', 'reservaHoraInicio'], ['hora_fin', 'reservaHoraFin']].forEach(([nombre, id]) => data.append(nombre, document.getElementById(id).value));
        const response = await fetch('api/zonas.php', { method: 'POST', body: data });
        const result = await response.json();
        window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
        if (result.status === 'success') { form.reset(); await loadZonas(); }
    };
}

function renderCalendarioInterno() {
    const contenedor = document.getElementById('calendar');
    if (!contenedor || !window.FullCalendar) return;
    if (!zonasReservaActuales.length) { contenedor.innerHTML = '<p class="empty-state">No hay zonas configuradas para consultar disponibilidad.</p>'; return; }
    const previo = Number(document.getElementById('calendarioZonaInterna')?.value || zonasReservaActuales[0].id);
    contenedor.innerHTML = `<div class="internal-calendar-heading"><div><p class="section-kicker">Disponibilidad por inmueble</p><h3>Agenda operativa por horas</h3><p class="muted">Verde: disponible; amarillo: solicitud pendiente; rojo: reservado; gris: fuera de servicio.</p></div><label for="calendarioZonaInterna">Zona social<select id="calendarioZonaInterna">${zonasReservaActuales.map(zona => `<option value="${Number(zona.id)}" ${Number(zona.id) === previo ? 'selected' : ''}>${escapeHtml(zona.nombre)}</option>`).join('')}</select></label></div>${leyendaHorarioCalendario()}<div id="calendar-interno" class="internal-zone-calendar"></div>`;
    const selector = document.getElementById('calendarioZonaInterna');
    const render = () => {
        const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selector.value));
        const horario = horarioServicioZona(zona);
        const destino = document.getElementById('calendar-interno');
        if (!horario) { destino.innerHTML = '<p class="empty-state">Configura el horario de servicio de esta zona antes de crear reservas.</p>'; return; }
        const reservas = reservasZonasActuales.filter(reserva => Number(reserva.zona_id) === Number(zona.id) && ['pendiente', 'aprobada'].includes(reserva.estado));
        if (window.zonasCalendar) window.zonasCalendar.destroy();
        window.zonasCalendar = new FullCalendar.Calendar(destino, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
            ...opcionesCalendarioHorario(zona),
            events: [...eventosFondoHorario(horario), ...reservas.map(reserva => eventoReserva(reserva, true))],
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                const hora = horaInicialDesdeClick(info, horario);
                if (fecha < fechaMinimaReserva(true)) return window.notificar('No puedes crear reservas en una fecha pasada.', 'warning');
                if (!info.allDay && !momentoEnHorarioServicio(info.date, horario)) return window.notificar(`Fuera de servicio: ${horario.apertura} – ${horario.cierre}.`, 'warning');
                window.abrirReservaInterna(0, fecha, Number(zona.id), hora);
            },
            eventClick: info => window.abrirReservaInterna(Number(info.event.id))
        });
        window.zonasCalendar.render();
    };
    selector.onchange = render;
    render();
}

window.abrirDetalleZona = async function (zonaId) {
    const modal = document.getElementById('zona-detalle-modal');
    const titulo = document.getElementById('zona-detalle-titulo');
    if (!modal || !titulo) return;
    modal.classList.remove('hidden');
    titulo.textContent = 'Cargando zona…';
    try {
        const response = await fetch(`api/zonas.php?action=public_zona_detalle&zona_id=${encodeURIComponent(zonaId)}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        const { zona, reservas } = result.data;
        const horario = horarioServicioZona(zona);
        document.getElementById('zona-detalle-imagen').style.backgroundImage = `linear-gradient(120deg, rgba(15,23,42,.2), rgba(15,23,42,.58)), url("${imagenZona(zona)}")`;
        titulo.textContent = zona.nombre;
        document.getElementById('zona-detalle-descripcion').textContent = zona.descripcion || 'Espacio disponible para el disfrute de la comunidad.';
        document.getElementById('zona-detalle-aforo').textContent = `${zona.aforo || 'No definido'} personas`;
        document.getElementById('zona-detalle-horario').textContent = zona.horarios || 'No definido';
        document.getElementById('zona-detalle-tarifa').textContent = Number(zona.tarifa) ? formatCurrency(zona.tarifa) : 'Sin costo';
        document.getElementById('zona-detalle-reglamento').textContent = zona.reglamento || 'No hay normas adicionales registradas.';
        modal.querySelector('.zona-availability-legends').innerHTML = leyendaHorarioCalendario().replace(/^<div[^>]*>|<\/div>$/g, '');
        const calendario = document.getElementById('public-zona-calendar');
        if (window.publicZonaCalendar) window.publicZonaCalendar.destroy();
        window.publicZonaCalendar = new FullCalendar.Calendar(calendario, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' },
            ...opcionesCalendarioHorario(zona),
            events: [...eventosFondoHorario(horario), ...(reservas || []).map(reserva => eventoReserva(reserva, false))]
        });
        window.publicZonaCalendar.render();
    } catch (error) {
        console.error(error);
        titulo.textContent = 'No fue posible cargar esta zona';
        window.notificar('No fue posible cargar la disponibilidad de la zona.', 'error');
    }
};

window.eliminarEvento = async function (id) {
    if (!await confirmarAccion({ titulo: '¿Eliminar evento?', texto: 'Esta acción no se puede deshacer.', confirmar: 'Eliminar evento' })) return;
    const data = new FormData(); data.append('action', 'delete'); data.append('id', id);
    const response = await fetch('api/eventos.php', { method: 'POST', body: data }); const result = await response.json();
    window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
    if (result.status === 'success') { loadComunicaciones(); loadPublicEventos(); }
};

window.aprobarPago = async function (pagoId, estado) {
    const esAprobacion = estado === 'aprobado';
    if (!await confirmarAccion({ titulo: esAprobacion ? '¿Aprobar pago?' : '¿Rechazar pago?', texto: esAprobacion ? 'El valor aprobado disminuirá la mora del inmueble.' : 'El reporte permanecerá en el historial como rechazado.', confirmar: esAprobacion ? 'Aprobar pago' : 'Rechazar pago', icono: esAprobacion ? 'question' : 'warning' })) return;
    const data = new FormData(); data.append('action', 'aprobar_pago'); data.append('pago_id', pagoId); data.append('estado', estado);
    const response = await fetch('api/finanzas.php', { method: 'POST', body: data }); const result = await response.json();
    window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
    if (result.status === 'success') loadFinanzas();
};

window.retirarParqueadero = async function (asignacionId) {
    const motivo = await solicitarTexto({ titulo: 'Retirar parqueadero', etiqueta: 'Motivo del retiro' });
    if (motivo === null) return;
    if (!await confirmarAccion({ titulo: '¿Retirar parqueadero?', texto: 'La asignación se retirará, pero el historial se conservará.', confirmar: 'Retirar parqueadero' })) return;
    const data = new FormData(); data.append('action', 'retirar'); data.append('asignacion_id', asignacionId); data.append('motivo_retiro', motivo);
    const response = await fetch('api/parqueaderos.php', { method: 'POST', body: data }); const result = await response.json();
    window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
    if (result.status === 'success') loadParqueaderos();
};

window.cambiarEstadoUsuario = async function (usuarioId, activar) {
    let motivo = '';
    if (!activar) {
        motivo = await solicitarTexto({ titulo: 'Deshabilitar cuenta', etiqueta: 'Motivo de la deshabilitación' });
        if (motivo === null) return;
        if (!await confirmarAccion({ titulo: '¿Deshabilitar cuenta?', texto: 'La persona no podrá iniciar sesión; su historial se conservará.', confirmar: 'Deshabilitar cuenta' })) return;
    }
    const data = new FormData(); data.append('action', activar ? 'reactivar_usuario' : 'desactivar_usuario'); data.append('usuario_id', usuarioId); if (!activar) data.append('motivo_desactivacion', motivo);
    const response = await fetch('api/users.php', { method: 'POST', body: data }); const result = await response.json();
    window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
    if (result.status === 'success') document.getElementById('vigilantes-grid') ? loadVigilantes() : loadUsuarios();
};

window.gestionarReservaInterna = async function (reservaId, accion) {
    if (accion === 'cancelar' && !await confirmarAccion({ titulo: '¿Cancelar reserva?', texto: 'La reserva se conservará en el historial.', confirmar: 'Cancelar reserva' })) return;
    const data = new FormData(); data.append('reserva_id', reservaId);
    if (accion === 'cancelar') data.append('action', 'cancelar_reserva');
    else { data.append('action', 'estado_reserva'); data.append('estado', accion === 'aprobar' ? 'aprobada' : 'rechazada'); }
    const response = await fetch('api/zonas.php', { method: 'POST', body: data }); const result = await response.json();
    window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
    if (result.status === 'success') { document.getElementById('modalReservaInterna')?.classList.add('hidden'); await loadZonas(); }
};

window.cambiarEstadoReserva = async function (id, estado) {
    const aprobada = estado === 'aprobada';
    if (!await confirmarAccion({
        titulo: aprobada ? '¿Aprobar reserva?' : '¿Rechazar reserva?',
        texto: aprobada ? 'La franja quedará reservada para el inmueble solicitado.' : 'La solicitud quedará rechazada en el historial.',
        confirmar: aprobada ? 'Aprobar reserva' : 'Rechazar reserva',
        icono: aprobada ? 'question' : 'warning'
    })) return;
    const data = new FormData();
    data.append('action', 'estado_reserva');
    data.append('reserva_id', id);
    data.append('estado', estado);
    const response = await fetch('api/zonas.php', { method: 'POST', body: data });
    const result = await response.json();
    window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
    if (result.status === 'success') await loadZonas();
};


/* Operación administrativa: cartera, contenidos e importación guiada. */
function digitosMoneda(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

function formatearMiles(valor) {
    const digitos = digitosMoneda(valor);
    return digitos ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(digitos)) : '';
}

function valorMonedaInput(id) {
    return digitosMoneda(document.getElementById(id)?.value || '');
}

function prepararCampoMoneda(input) {
    if (!input || input.dataset.moneyInput === 'true') return;
    input.dataset.moneyInput = 'true';
    input.classList.add('money-input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.value = formatearMiles(input.value);
}

function prepararCamposMoneda(contexto = document) {
    contexto.querySelectorAll('input[type="number"][id*="valor" i], input[type="number"][id*="tarifa" i], input[type="number"][id*="mora" i], input[type="number"][id*="cuota" i], input[type="text"][data-money-input="true"]').forEach(prepararCampoMoneda);
}

document.addEventListener('input', evento => {
    const campo = evento.target;
    if (campo?.dataset.moneyInput !== 'true') return;
    campo.value = formatearMiles(campo.value);
}, true);

document.addEventListener('submit', evento => {
    const campos = [...evento.target.querySelectorAll('[data-money-input="true"]')];
    if (!campos.length) return;
    campos.forEach(campo => { campo.value = digitosMoneda(campo.value); });
    window.setTimeout(() => campos.forEach(campo => { campo.value = formatearMiles(campo.value); }), 0);
}, true);

function navegarModuloAdministrativo(vista) {
    const enlace = document.querySelector(`.nav-links li[data-view="${vista}"]`);
    enlace?.click();
}

function etiquetaInmueble(inmueble) {
    return [inmueble.torre, inmueble.apartamento ? `Apto ${inmueble.apartamento}` : inmueble.nomenclatura].filter(Boolean).join(' · ') || inmueble.nomenclatura || 'Inmueble';
}

window.loadDashboard = async function () {
    const novedadesEl = document.getElementById('admin-dashboard-novedades');
    const eventosEl = document.getElementById('admin-dashboard-eventos');
    try {
        const respuestas = await Promise.all([
            fetch('api/comunicaciones.php?action=list_comunicados'),
            fetch('api/eventos.php?action=list'),
            fetch('api/finanzas.php?action=dashboard_financiero')
        ]);
        const [novedades, eventos, finanzas] = await Promise.all(respuestas.map(respuesta => respuesta.json()));
        const listaNovedades = novedades.status === 'success' ? novedades.data : [];
        const listaEventos = eventos.status === 'success' ? eventos.data : [];
        const resumen = finanzas.status === 'success' ? finanzas.data : {};
        document.getElementById('admin-total-novedades').textContent = listaNovedades.length;
        document.getElementById('admin-total-eventos').textContent = listaEventos.length;
        document.getElementById('admin-total-cartera').textContent = formatCurrency(resumen.total_cartera);
        novedadesEl.innerHTML = listaNovedades.length ? listaNovedades.slice(0, 4).map(item => `<article class="admin-feed-item"><h4>${escapeHtml(item.titulo)}</h4><p>${escapeHtml(item.contenido)}</p><small><i class="fa-regular fa-clock"></i> ${formatDate(item.fecha_publicacion)}</small></article>`).join('') : '<p class="admin-empty-state">Aún no hay novedades publicadas.</p>';
        eventosEl.innerHTML = listaEventos.length ? listaEventos.slice(0, 4).map(item => `<article class="admin-feed-item"><h4>${escapeHtml(item.titulo)}</h4><p><i class="fa-regular fa-calendar"></i> ${formatDate(item.fecha_hora)} · ${escapeHtml(item.lugar || 'Lugar por definir')}</p><small>${escapeHtml(item.descripcion || '')}</small></article>`).join('') : '<p class="admin-empty-state">No hay eventos próximos.</p>';
        [['comunicaciones', 'Gestionar novedades'], ['comunicaciones', 'Gestionar eventos'], ['finanzas', 'Ver cartera']].forEach(([vista, etiqueta], indice) => {
            const tarjeta = document.querySelectorAll('.admin-summary-card')[indice];
            if (!tarjeta) return;
            tarjeta.classList.add('dashboard-link-card');
            tarjeta.tabIndex = 0;
            tarjeta.setAttribute('role', 'button');
            tarjeta.setAttribute('aria-label', etiqueta);
            tarjeta.onclick = () => navegarModuloAdministrativo(vista);
            tarjeta.onkeydown = evento => { if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); navegarModuloAdministrativo(vista); } };
        });
    } catch (error) {
        console.error('Error cargando el panel administrativo', error);
        if (novedadesEl) novedadesEl.innerHTML = '<p class="admin-empty-state">No fue posible cargar las novedades.</p>';
        if (eventosEl) eventosEl.innerHTML = '<p class="admin-empty-state">No fue posible cargar los eventos.</p>';
    }
};

window.abrirModalRegistrarPago = async function (inmueblePreferido = '') {
    const modal = document.getElementById('modalRegistrarPago');
    const select = document.getElementById('pagoInmuebleId');
    if (!modal || !select) return;
    modal.classList.remove('hidden');
    select.innerHTML = '<option value="">Cargando inmuebles…</option>';
    try {
        const respuesta = await fetch('api/inmuebles.php?action=list');
        const datos = await respuesta.json();
        if (datos.status !== 'success') throw new Error(datos.message);
        select.innerHTML = '<option value="">Selecciona un inmueble…</option>' + datos.data.map(inmueble => `<option value="${Number(inmueble.id)}" ${String(inmueble.id) === String(inmueblePreferido) ? 'selected' : ''}>${escapeHtml(etiquetaInmueble(inmueble))} · Debe ${formatCurrency(inmueble.mora_actual)}</option>`).join('');
        if (inmueblePreferido) document.getElementById('pagoValor')?.focus();
    } catch (error) {
        select.innerHTML = '<option value="">No fue posible cargar inmuebles</option>';
        window.notificar('No fue posible cargar los inmuebles para registrar el pago.', 'error');
    }
};

const cargarFinanzasConCuotasBase = window.loadFinanzas;
window.loadFinanzas = async function () {
    await cargarFinanzasConCuotasBase();
    const [carteraR, pendientesR, historialR] = await Promise.all([
        fetch('api/finanzas.php?action=cartera'),
        fetch('api/finanzas.php?action=pagos_pendientes'),
        fetch('api/finanzas.php?action=historial_pagos')
    ]);
    const [cartera, pendientes, historial] = await Promise.all([carteraR.json(), pendientesR.json(), historialR.json()]);
    const tablaCartera = document.getElementById('tb-cartera');
    if (cartera.status === 'success' && tablaCartera) {
        const cabecera = tablaCartera.closest('table')?.querySelector('thead tr');
        if (cabecera && cabecera.children.length === 3) cabecera.insertAdjacentHTML('beforeend', '<th>Acción</th>');
        tablaCartera.innerHTML = cartera.data.length ? cartera.data.map(item => `<tr><td>${escapeHtml(etiquetaInmueble(item))}</td><td>${escapeHtml(item.propietario_nombre || 'Sin propietario asociado')}</td><td><b>${formatCurrency(item.mora_actual)}</b></td><td class="finance-action-cell"><button type="button" class="btn btn-primary" onclick="abrirModalRegistrarPago(${Number(item.id)})"><i class="fa-solid fa-cash-register"></i> Registrar pago</button></td></tr>`).join('') : '<tr><td colspan="4">No hay cartera pendiente</td></tr>';
    }
    const tablaPendientes = document.getElementById('tb-pagos-pendientes');
    if (pendientes.status === 'success' && tablaPendientes) tablaPendientes.innerHTML = pendientes.data.length ? pendientes.data.map(item => `<tr><td>${escapeHtml(etiquetaInmueble(item))}</td><td>${escapeHtml(item.residente || 'Desconocido')}</td><td><b>${formatCurrency(item.valor)}</b></td><td>${escapeHtml(item.metodo_pago)}${item.referencia ? ` · ${escapeHtml(item.referencia)}` : ''}</td><td class="finance-action-cell"><button class="btn btn-primary" style="background:#16a34a" onclick="aprobarPago(${Number(item.id)}, 'aprobado')">Aprobar</button> <button class="btn btn-ghost" style="color:#dc2626" onclick="aprobarPago(${Number(item.id)}, 'rechazado')">Rechazar</button></td></tr>`).join('') : '<tr><td colspan="5">No hay pagos pendientes de aprobación</td></tr>';
    const tablaHistorial = document.getElementById('tb-historial-pagos');
    if (historial.status === 'success' && tablaHistorial) tablaHistorial.innerHTML = historial.data.length ? historial.data.map(item => `<tr><td>${escapeHtml(item.fecha_pago)}</td><td>${escapeHtml(etiquetaInmueble(item))}</td><td><b>${formatCurrency(item.valor)}</b></td><td>${escapeHtml(item.metodo_pago)}</td><td>${item.descripcion ? escapeHtml(item.descripcion) : '<span class="muted">Sin descripción</span>'}</td><td>${item.soporte_archivo ? `<a href="api/finanzas.php?action=ver_soporte&pago_id=${Number(item.id)}" target="_blank" rel="noopener">Ver soporte</a>` : '—'}</td><td>${escapeHtml(item.registrado_por_nombre || 'N/A')}</td></tr>`).join('') : '<tr><td colspan="7">No hay pagos registrados</td></tr>';

    const campoCobro = document.getElementById('cobroValor');
    if (campoCobro) {
        campoCobro.id = 'cobroPeriodo';
        campoCobro.type = 'month';
        campoCobro.removeAttribute('data-money-input');
        campoCobro.closest('form')?.previousElementSibling?.replaceChildren(document.createTextNode('Genera las cuotas con la tarifa configurada de cada inmueble para el período elegido.'));
    }
    const formCobro = document.getElementById('formGenerarCobro');
    if (formCobro) formCobro.onsubmit = async evento => {
        evento.preventDefault();
        const datos = new FormData(); datos.append('action', 'generar_cobro'); datos.append('periodo', document.getElementById('cobroPeriodo').value);
        const respuesta = await fetch('api/finanzas.php', { method: 'POST', body: datos }); const resultado = await respuesta.json();
        window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { document.getElementById('modalCobro').classList.add('hidden'); await loadFinanzas(); }
    };
    const formPago = document.getElementById('formRegistrarPago');
    if (formPago) formPago.onsubmit = async evento => {
        evento.preventDefault();
        const datos = new FormData();
        [['action', 'registrar_pago'], ['inmueble_id', document.getElementById('pagoInmuebleId').value], ['valor', valorMonedaInput('pagoValor')], ['metodo', document.getElementById('pagoMetodo').value], ['referencia', document.getElementById('pagoReferencia').value], ['descripcion', document.getElementById('pagoDescripcion').value]].forEach(([nombre, valor]) => datos.append(nombre, valor));
        const soporte = document.getElementById('pagoSoporte')?.files[0]; if (soporte) datos.append('soporte', soporte);
        const respuesta = await fetch('api/finanzas.php', { method: 'POST', body: datos }); const resultado = await respuesta.json();
        window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { document.getElementById('modalRegistrarPago').classList.add('hidden'); formPago.reset(); await loadFinanzas(); }
    };
    prepararCamposMoneda(document);
};

let eventosGestionActuales = [];
let comunicadosGestionActuales = [];
function prepararModalContenido(tipo, item = null) {
    const esEvento = tipo === 'evento';
    const formulario = document.getElementById(esEvento ? 'formEvento' : 'formComunicado');
    const modal = document.getElementById(esEvento ? 'modalEvento' : 'modalComunicado');
    if (!formulario || !modal) return;
    let id = formulario.querySelector('input[type="hidden"]');
    if (!id) { id = document.createElement('input'); id.type = 'hidden'; formulario.appendChild(id); }
    id.id = esEvento ? 'evId' : 'comId'; id.value = item?.id || '';
    modal.querySelector('h3').textContent = item ? (esEvento ? 'Editar evento' : 'Editar novedad') : (esEvento ? 'Crear nuevo evento' : 'Publicar novedad en el inicio');
    formulario.querySelector('button[type="submit"]').textContent = item ? 'Guardar cambios' : (esEvento ? 'Publicar evento' : 'Publicar novedad');
    if (esEvento) {
        document.getElementById('evTitulo').value = item?.titulo || '';
        document.getElementById('evFecha').value = item?.fecha_hora ? String(item.fecha_hora).replace(' ', 'T').slice(0, 16) : '';
        document.getElementById('evLugar').value = item?.lugar || '';
        document.getElementById('evDescripcion').value = item?.descripcion || '';
    } else { document.getElementById('comTitulo').value = item?.titulo || ''; document.getElementById('comContenido').value = item?.contenido || ''; }
    modal.classList.remove('hidden');
}

window.editarEvento = id => prepararModalContenido('evento', eventosGestionActuales.find(item => Number(item.id) === Number(id)));
window.editarComunicado = id => prepararModalContenido('comunicado', comunicadosGestionActuales.find(item => Number(item.id) === Number(id)));
window.eliminarComunicado = async function (id) {
    if (!await confirmarAccion({ titulo: '¿Eliminar novedad?', texto: 'Se retirará del inicio y se conservará el registro de auditoría.', confirmar: 'Eliminar novedad' })) return;
    const datos = new FormData(); datos.append('action', 'eliminar_comunicado'); datos.append('id', id);
    const respuesta = await fetch('api/comunicaciones.php', { method: 'POST', body: datos }); const resultado = await respuesta.json();
    window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
    if (resultado.status === 'success') { await loadComunicaciones(); loadPublicCartelera(); }
};

window.loadComunicaciones = async function () {
    const [comunicadosR, eventosR, auditoriaR] = await Promise.all([fetch('api/comunicaciones.php?action=list_comunicados'), fetch('api/eventos.php?action=list'), fetch('api/comunicaciones.php?action=list_auditoria')]);
    const [comunicados, eventos, auditoria] = await Promise.all([comunicadosR.json(), eventosR.json(), auditoriaR.json()]);
    comunicadosGestionActuales = comunicados.status === 'success' ? comunicados.data : [];
    eventosGestionActuales = eventos.status === 'success' ? eventos.data : [];
    const lista = document.getElementById('list-comunicados');
    if (lista) lista.innerHTML = comunicadosGestionActuales.length ? comunicadosGestionActuales.map(item => `<article class="notice-item"><h4>${escapeHtml(item.titulo)}</h4><p>${escapeHtml(item.contenido)}</p><small>Por ${escapeHtml(item.autor || 'Sistema')} · ${escapeHtml(item.fecha_publicacion)}</small><div class="content-actions"><button class="btn btn-ghost" onclick="editarComunicado(${Number(item.id)})"><i class="fa-solid fa-pen"></i> Editar</button><button class="btn btn-ghost" style="color:#dc2626" onclick="eliminarComunicado(${Number(item.id)})"><i class="fa-solid fa-trash"></i> Eliminar</button></div></article>`).join('') : '<p class="empty-state">No hay novedades publicadas.</p>';
    const tablaEventos = document.getElementById('tb-eventos-admin');
    if (tablaEventos) tablaEventos.innerHTML = eventosGestionActuales.length ? eventosGestionActuales.map(item => `<tr><td>${formatDate(item.fecha_hora)}</td><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.lugar || '—')}</td><td class="finance-action-cell"><button class="btn btn-ghost" onclick="editarEvento(${Number(item.id)})">Editar</button><button class="btn btn-ghost" style="color:#dc2626" onclick="eliminarEvento(${Number(item.id)})">Eliminar</button></td></tr>`).join('') : '<tr><td colspan="4">No hay eventos</td></tr>';
    const tablaAuditoria = document.getElementById('tb-auditoria');
    if (auditoria.status === 'success' && tablaAuditoria) tablaAuditoria.innerHTML = auditoria.data.length ? auditoria.data.map(item => `<tr><td>${escapeHtml(item.fecha)}</td><td>${escapeHtml(item.usuario || 'Sistema')}</td><td>${escapeHtml(item.accion)} en ${escapeHtml(item.entidad)}</td><td>${escapeHtml(item.detalles || '')}</td></tr>`).join('') : '<tr><td colspan="4">No hay registros de auditoría.</td></tr>';
    const formEvento = document.getElementById('formEvento');
    if (formEvento) formEvento.onsubmit = async evento => {
        evento.preventDefault(); const datos = new FormData(); const id = document.getElementById('evId')?.value;
        datos.append('action', id ? 'update' : 'create'); if (id) datos.append('id', id);
        [['titulo', 'evTitulo'], ['fecha_hora', 'evFecha'], ['lugar', 'evLugar'], ['descripcion', 'evDescripcion']].forEach(([nombre, campo]) => datos.append(nombre, document.getElementById(campo).value));
        const respuesta = await fetch('api/eventos.php', { method: 'POST', body: datos }); const resultado = await respuesta.json(); window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { document.getElementById('modalEvento').classList.add('hidden'); formEvento.reset(); await loadComunicaciones(); loadPublicEventos(); }
    };
    const formComunicado = document.getElementById('formComunicado');
    if (formComunicado) formComunicado.onsubmit = async evento => {
        evento.preventDefault(); const datos = new FormData(); const id = document.getElementById('comId')?.value;
        datos.append('action', id ? 'actualizar_comunicado' : 'crear_comunicado'); if (id) datos.append('id', id);
        datos.append('titulo', document.getElementById('comTitulo').value); datos.append('contenido', document.getElementById('comContenido').value);
        const respuesta = await fetch('api/comunicaciones.php', { method: 'POST', body: datos }); const resultado = await respuesta.json(); window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { document.getElementById('modalComunicado').classList.add('hidden'); formComunicado.reset(); await loadComunicaciones(); loadPublicCartelera(); }
    };
    [...document.querySelectorAll('button')].forEach(boton => {
        if (boton.textContent.includes('Nuevo Evento')) boton.onclick = () => prepararModalContenido('evento');
        if (boton.textContent.includes('Publicar novedad')) boton.onclick = () => prepararModalContenido('comunicado');
    });
};

window.initImportView = function () {
    const input = document.getElementById('excelFile'); const zona = document.getElementById('uploadZone'); const seccion = document.getElementById('mappingSection'); const formulario = document.getElementById('mappingForm');
    if (!input || !zona || !seccion || !formulario) return;
    input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const tipos = {
        residentes: { titulo: 'Residentes', descripcion: 'Documento, nombre y vínculo opcional con inmueble', campos: [['documento', 'Documento *'], ['nombre', 'Nombre completo *'], ['email', 'Correo'], ['contacto', 'Teléfono'], ['inmueble_nomenclatura', 'Nomenclatura del inmueble']] },
        propietarios: { titulo: 'Propietarios', descripcion: 'Documento, nombre y vínculo opcional con inmueble', campos: [['documento', 'Documento *'], ['nombre', 'Nombre completo *'], ['email', 'Correo'], ['contacto', 'Teléfono'], ['inmueble_nomenclatura', 'Nomenclatura del inmueble']] },
        inmuebles: { titulo: 'Apartamentos o casas', descripcion: 'Nomenclatura única, torre, cuota y mora opcionales', campos: [['nomenclatura', 'Nomenclatura *'], ['tipo_unidad', 'Tipo: apartamento/casa'], ['torre', 'Torre o bloque'], ['apartamento', 'Apartamento'], ['coeficiente', 'Coeficiente'], ['cuota_administracion', 'Cuota de administración'], ['mora_actual', 'Mora actual']] },
        parqueaderos: { titulo: 'Parqueaderos', descripcion: 'Código único y asignación opcional a inmueble', campos: [['codigo', 'Código *'], ['tipo', 'Tipo: privado/administracion/visitante/otro'], ['estado', 'Estado: disponible/asignado/inactivo'], ['observaciones', 'Observaciones'], ['inmueble_nomenclatura', 'Nomenclatura asignada']] }
    };
    zona.insertAdjacentHTML('beforebegin', `<p class="import-help">1. Selecciona qué deseas importar. 2. Carga un XLSX. 3. Relaciona cada columna. 4. Revisa la vista previa antes de confirmar.</p><div class="import-type-picker">${Object.entries(tipos).map(([clave, tipo], indice) => `<label><input type="radio" name="importTipo" value="${clave}" ${indice === 0 ? 'checked' : ''}><strong>${tipo.titulo}</strong><small>${tipo.descripcion}</small></label>`).join('')}</div><div id="importPreview"></div>`);
    let headers = []; let listoParaImportar = false;
    const tipoSeleccionado = () => document.querySelector('input[name="importTipo"]:checked')?.value || 'residentes';
    const opciones = campo => `<option value="">— No mapear —</option>${headers.map((header, indice) => `<option value="${indice}" ${String(header).toLowerCase().includes(campo.split('_')[0]) ? 'selected' : ''}>${escapeHtml(header || `Columna ${indice + 1}`)}</option>`).join('')}`;
    const mapeo = () => Object.fromEntries(tipos[tipoSeleccionado()].campos.map(([campo]) => [campo, formulario.querySelector(`[name="map_${campo}"]`)?.value || '']));
    const enviar = async accion => {
        const archivo = input.files[0]; if (!archivo) return window.notificar('Selecciona el archivo XLSX primero.', 'warning');
        const datos = new FormData(); datos.append('action', accion); datos.append('tipo', tipoSeleccionado()); datos.append('mapping', JSON.stringify(mapeo())); datos.append('file', archivo);
        const respuesta = await fetch('api/import.php', { method: 'POST', body: datos }); return leerRespuestaImportacion(respuesta);
    };
    input.onchange = async () => {
        const archivo = input.files[0]; if (!archivo) return;
        const datos = new FormData(); datos.append('action', 'get_headers'); datos.append('tipo', tipoSeleccionado()); datos.append('file', archivo);
        const respuesta = await fetch('api/import.php', { method: 'POST', body: datos }); const resultado = await leerRespuestaImportacion(respuesta);
        if (resultado.status !== 'success') return window.notificar(resultado.message, 'error');
        headers = resultado.data.headers; listoParaImportar = false;
        formulario.innerHTML = tipos[tipoSeleccionado()].campos.map(([campo, etiqueta]) => `<div class="mapping-item"><label>${etiqueta}</label><select name="map_${campo}">${opciones(campo)}</select></div>`).join('');
        seccion.classList.remove('hidden');
        seccion.querySelector('h3').textContent = `Asignar columnas: ${tipos[tipoSeleccionado()].titulo}`;
        seccion.querySelector('p').textContent = `${resultado.data.rows} fila(s) detectadas. Los campos con * son obligatorios.`;
        seccion.insertAdjacentHTML('beforeend', '<div class="actions mt-4"><button type="button" class="btn btn-ghost" id="btnPrevisualizarImportacion">Validar y ver vista previa</button></div>');
        document.getElementById('btnProcesarImportacion').disabled = true;
        document.getElementById('btnPrevisualizarImportacion').onclick = async () => {
            const previo = await enviar('preview'); const panel = document.getElementById('importPreview');
            if (previo.status !== 'success') return window.notificar(previo.message, 'error');
            const info = previo.data; listoParaImportar = info.summary.errores === 0 && info.summary.validas > 0;
            panel.innerHTML = `<p class="${listoParaImportar ? 'import-ok' : 'import-errors'}">${listoParaImportar ? `Listo: ${info.summary.validas} fila(s) válidas.` : `${info.summary.errores} error(es). Corrígelos antes de importar.`}</p>${info.sample.length ? `<div class="import-preview-wrap"><table class="import-preview-table"><thead><tr>${Object.keys(info.sample[0]).filter(campo => campo !== '_fila').map(campo => `<th>${escapeHtml(campo)}</th>`).join('')}</tr></thead><tbody>${info.sample.map(fila => `<tr>${Object.keys(fila).filter(campo => campo !== '_fila').map(campo => `<td>${escapeHtml(fila[campo] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}${info.errors.length ? `<div class="import-errors">${info.errors.map(error => `Fila ${error.fila}: ${escapeHtml(error.mensaje)}`).join('<br>')}</div>` : ''}`;
            document.getElementById('btnProcesarImportacion').disabled = !listoParaImportar;
        };
    };
    document.querySelectorAll('input[name="importTipo"]').forEach(radio => radio.onchange = () => { input.value = ''; headers = []; listoParaImportar = false; seccion.classList.add('hidden'); document.getElementById('importPreview').innerHTML = ''; });
    document.getElementById('btnProcesarImportacion').onclick = async () => {
        if (!listoParaImportar) return window.notificar('Valida la vista previa sin errores antes de importar.', 'warning');
        if (!await confirmarAccion({ titulo: '¿Importar datos?', texto: 'Se crearán o actualizarán solo las filas validadas del archivo.', confirmar: 'Importar datos', icono: 'question' })) return;
        const boton = document.getElementById('btnProcesarImportacion'); boton.disabled = true; const original = boton.textContent; boton.textContent = 'Importando…';
        try { const resultado = await enviar('process'); window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error'); if (resultado.status === 'success') { input.value = ''; seccion.classList.add('hidden'); document.getElementById('importPreview').innerHTML = ''; } } finally { boton.textContent = original; boton.disabled = false; }
    };
};


window.loadMisPagos = async function () {
    const respuesta = await fetch('api/finanzas.php?action=mis_pagos');
    const resultado = await respuesta.json();
    if (resultado.status !== 'success') return window.notificar(resultado.message, 'error');
    const cuenta = resultado.data.cuenta;
    if (cuenta) {
        document.getElementById('txtDeudaResidente').textContent = formatCurrency(cuenta.mora_actual);
        document.getElementById('txtInmuebleResidente').innerHTML = `<i class="fa-solid fa-building"></i> ${escapeHtml(etiquetaInmueble(cuenta))}`;
    }
    const tabla = document.getElementById('tb-mis-pagos');
    if (tabla) tabla.innerHTML = resultado.data.historial.length ? resultado.data.historial.map(pago => `<tr><td>${escapeHtml(pago.fecha_pago)}</td><td>${formatCurrency(pago.valor)}</td><td>${escapeHtml(pago.metodo_pago)}</td><td>${escapeHtml(pago.referencia || '—')}</td><td><span class="reserva-estado estado-${escapeHtml(pago.estado)}">${escapeHtml(pago.estado)}</span></td></tr>`).join('') : '<tr><td colspan="6">No has reportado ningún pago.</td></tr>';
    const formulario = document.getElementById('formReportarPago');
    if (formulario) formulario.onsubmit = async evento => {
        evento.preventDefault();
        const datos = new FormData();
        [['action', 'reportar_pago'], ['valor', valorMonedaInput('repPagoValor')], ['referencia', document.getElementById('repPagoRef').value], ['metodo', document.getElementById('repPagoMetodo').value], ['descripcion', document.getElementById('repPagoDescripcion').value]].forEach(([nombre, valor]) => datos.append(nombre, valor));
        const soporte = document.getElementById('repPagoSoporte')?.files[0]; if (soporte) datos.append('soporte', soporte);
        const respuestaPago = await fetch('api/finanzas.php', { method: 'POST', body: datos }); const pago = await respuestaPago.json();
        window.notificar(pago.message, pago.status === 'success' ? 'success' : 'error');
        if (pago.status === 'success') { formulario.reset(); await loadMisPagos(); }
    };
    prepararCamposMoneda(document);
};


const cargarVistaConFormatoMoneda = window.loadView;
window.loadView = function (vista) {
    cargarVistaConFormatoMoneda(vista);
    window.setTimeout(() => prepararCamposMoneda(document), 0);
};


/* Ajustes finales de operación: cuota visible, horas AM/PM y disponibilidad real por franja. */
function formatearHoraAMPM(valor) {
    const minutos = minutosHora(valor);
    if (minutos === null) return '—';
    const hora24 = Math.floor(minutos / 60);
    const minuto = String(minutos % 60).padStart(2, '0');
    const meridiano = hora24 >= 12 ? 'PM' : 'AM';
    return `${hora24 % 12 || 12}:${minuto} ${meridiano}`;
}

function formatearHorarioServicio(valor) {
    const horario = typeof valor === 'object' && valor?.apertura ? valor : horarioServicioZona({ horarios: valor });
    return horario ? `${formatearHoraAMPM(horario.apertura)} – ${formatearHoraAMPM(horario.cierre)}` : 'No definido';
}

function etiquetaHorarioReserva(reserva) {
    const inicio = horaCorta(reserva.hora_inicio);
    const fin = horaCorta(reserva.hora_fin);
    return inicio && fin ? `${formatearHoraAMPM(inicio)} – ${formatearHoraAMPM(fin)}` : 'Bloque histórico: día completo';
}

function fechaSiguiente(fecha) {
    const resultado = new Date(`${fecha}T00:00:00`);
    resultado.setDate(resultado.getDate() + 1);
    return fechaLocal(resultado);
}

function eventoReserva(reserva, interno = false) {
    const historica = !reserva.hora_inicio || !reserva.hora_fin;
    const titulo = interno
        ? `${reserva.inmueble_etiqueta || 'Inmueble no asignado'} · ${etiquetaHorarioReserva(reserva)}`
        : (historica ? 'No disponible: día completo' : reserva.estado === 'aprobada' ? 'No disponible' : 'Solicitud pendiente');
    return {
        id: String(reserva.id || ''),
        title: titulo,
        start: historica ? `${reserva.fecha_reserva}T00:00:00` : `${reserva.fecha_reserva}T${horaCorta(reserva.hora_inicio)}`,
        end: historica ? `${fechaSiguiente(reserva.fecha_reserva)}T00:00:00` : `${reserva.fecha_reserva}T${horaCorta(reserva.hora_fin)}`,
        allDay: false,
        extendedProps: { reservaHistorica: historica },
        classNames: [reserva.estado === 'aprobada' ? 'zona-calendar-reserva' : 'zona-calendar-pendiente']
    };
}

function contenidoEventoReserva(argumento) {
    const evento = argumento.event;
    const esHistorica = Boolean(evento.extendedProps.reservaHistorica);
    const horario = esHistorica ? 'Día completo' : `${formatearHoraAMPM(evento.start)} – ${formatearHoraAMPM(evento.end)}`;
    return {
        html: `<span class="zona-event-time">${escapeHtml(horario)}</span><span class="zona-event-title">${escapeHtml(evento.title || '')}</span>`
    };
}

function eventosFondoHorario() {
    // La clase de cada celda es la única capa de disponibilidad: evita que un evento recurrente cubra horas cerradas.
    return [];
}

function opcionesCalendarioHorario(zona) {
    const horario = horarioServicioZona(zona);
    return {
        slotMinTime: '00:00:00',
        slotMaxTime: '24:00:00',
        slotDuration: '00:30:00',
        slotLabelInterval: { hours: 1 },
        allDaySlot: false,
        businessHours: false,
        slotLaneClassNames: info => momentoEnHorarioServicio(info.date, horario) ? ['zona-slot-disponible'] : ['zona-slot-cerrado'],
        slotLabelContent: info => ({ html: formatearHoraAMPM(info.date) }),
        eventTimeFormat: { hour: 'numeric', minute: '2-digit', hour12: true },
        eventContent: contenidoEventoReserva
    };
}

function opcionesCalendarioSoloReservas() {
    return {
        slotMinTime: '00:00:00',
        slotMaxTime: '24:00:00',
        slotDuration: '00:30:00',
        slotLabelInterval: { hours: 1 },
        allDaySlot: false,
        businessHours: false,
        slotLabelContent: info => ({ html: formatearHoraAMPM(info.date) }),
        eventTimeFormat: { hour: 'numeric', minute: '2-digit', hour12: true },
        eventContent: contenidoEventoReserva
    };
}

function opcionesHorasAMPM(valorActual = '') {
    const opciones = ['<option value="">Selecciona una hora…</option>'];
    for (let minutos = 0; minutos < 1440; minutos += 15) {
        const valor = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
        opciones.push(`<option value="${valor}">${formatearHoraAMPM(valor)}</option>`);
    }
    const normalizado = horaCorta(valorActual);
    if (normalizado && !opciones.some(opcion => opcion.includes(`value="${normalizado}"`))) opciones.push(`<option value="${normalizado}">${formatearHoraAMPM(normalizado)}</option>`);
    return opciones.join('');
}

function convertirControlHoraAMPM(control) {
    if (!control) return null;
    const valor = horaCorta(control.value);
    if (control.tagName === 'SELECT') {
        control.innerHTML = opcionesHorasAMPM(valor);
        control.value = valor;
        return control;
    }
    const selector = document.createElement('select');
    [...control.attributes].forEach(atributo => {
        if (atributo.name !== 'type' && atributo.name !== 'value') selector.setAttribute(atributo.name, atributo.value);
    });
    selector.classList.add('time-ampm-select');
    selector.innerHTML = opcionesHorasAMPM(valor);
    selector.value = valor;
    control.replaceWith(selector);
    return selector;
}

function prepararSelectoresHoraAMPM(contexto = document) {
    ['zonaHoraApertura', 'zonaHoraCierre', 'reservaHoraInicio', 'reservaHoraFin'].forEach(id => convertirControlHoraAMPM(contexto.querySelector?.(`#${id}`)));
    contexto.querySelectorAll?.('input[type="time"][name="hora_inicio"], input[type="time"][name="hora_fin"], select.time-ampm-select[name="hora_inicio"], select.time-ampm-select[name="hora_fin"]').forEach(convertirControlHoraAMPM);
}

function actualizarHorariosVisibles() {
    const zonasPorId = new Map(zonasReservaActuales.map(zona => [String(zona.id), zona]));
    const selectorZona = document.getElementById('reservaZonaId');
    selectorZona?.querySelectorAll('option[value]').forEach(opcion => {
        const zona = zonasPorId.get(opcion.value);
        if (zona) opcion.textContent = `${zona.nombre} · ${formatearHorarioServicio(zona.horarios)}`;
    });
    document.querySelectorAll('#tb-zonas-config tr').forEach((fila, indice) => {
        const zona = zonasReservaActuales[indice];
        if (zona && fila.children[2]) fila.children[2].textContent = formatearHorarioServicio(zona.horarios);
    });
    document.querySelectorAll('#public-zonas-grid p').forEach(linea => {
        const coincidencia = linea.textContent.match(/^\s*Horario:\s*(.+)$/i);
        if (coincidencia) linea.textContent = `Horario: ${formatearHorarioServicio(coincidencia[1])}`;
    });
}

function renderCalendarioPersonal() {
    const contenedor = document.getElementById('calendar');
    if (!contenedor || !window.FullCalendar) return;
    if (window.zonasCalendar) window.zonasCalendar.destroy();
    window.zonasCalendar = new FullCalendar.Calendar(contenedor, {
        initialView: 'timeGridWeek',
        locale: 'es',
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
        ...opcionesCalendarioSoloReservas(),
        events: reservasZonasActuales.map(reserva => eventoReserva(reserva, false))
    });
    window.zonasCalendar.render();
}

async function renderDisponibilidadResidente() {
    const selectZona = document.getElementById('reservaZonaId');
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!selectZona || !window.FullCalendar) return;
    if (!calendario) {
        calendario = document.createElement('section');
        calendario.id = 'calendar-disponibilidad-residente';
        calendario.className = 'resident-zone-calendar';
        document.getElementById('calendar')?.closest('.card')?.insertAdjacentElement('beforebegin', calendario);
    }
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selectZona.value));
    if (!zona) {
        calendario.innerHTML = '<p class="muted">Selecciona una zona para consultar sus horarios disponibles.</p>';
        return;
    }
    const horario = horarioServicioZona(zona);
    if (!horario) {
        calendario.innerHTML = '<p class="empty-state">Esta zona no tiene un horario de servicio válido. La administración debe configurarlo.</p>';
        return;
    }
    calendario.innerHTML = `<div class="resident-availability-header"><div><p class="section-kicker">Disponibilidad por horas</p><h3>Agenda: ${escapeHtml(zona.nombre)}</h3><p>Verde: disponible dentro de ${formatearHorarioServicio(horario)}. Gris: fuera de servicio.</p></div>${leyendaHorarioCalendario()}</div><div class="resident-zone-calendar-body"></div>`;
    const cuerpo = calendario.querySelector('.resident-zone-calendar-body');
    try {
        const response = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(selectZona.value)}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();
        window.residentAvailabilityCalendar = new FullCalendar.Calendar(cuerpo, {
            initialView: 'timeGridWeek',
            locale: 'es',
            height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
            ...opcionesCalendarioHorario(zona),
            events: (result.data.reservas || []).map(reserva => eventoReserva(reserva, false)),
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                const hora = horaInicialDesdeClick(info, horario);
                if (fecha < fechaMinimaReserva()) return window.notificar('Selecciona una fecha futura para reservar.', 'warning');
                if (!momentoEnHorarioServicio(info.date, horario)) return window.notificar(`La zona está fuera de servicio. Horario: ${formatearHorarioServicio(horario)}.`, 'warning');
                document.getElementById('reservaFecha').value = fecha;
                document.getElementById('reservaHoraInicio').value = hora;
                document.getElementById('reservaHoraFin')?.focus();
            }
        });
        window.residentAvailabilityCalendar.render();
    } catch (error) {
        cuerpo.innerHTML = `<p class="muted">${escapeHtml(error.message || 'No fue posible cargar la disponibilidad.')}</p>`;
    }
}

function renderCalendarioInterno() {
    const contenedor = document.getElementById('calendar');
    if (!contenedor || !window.FullCalendar) return;
    if (!zonasReservaActuales.length) {
        contenedor.innerHTML = '<p class="empty-state">No hay zonas configuradas para consultar disponibilidad.</p>';
        return;
    }
    const previo = Number(document.getElementById('calendarioZonaInterna')?.value || zonasReservaActuales[0].id);
    contenedor.innerHTML = `<div class="internal-calendar-heading"><div><p class="section-kicker">Disponibilidad por inmueble</p><h3>Agenda operativa por horas</h3><p class="muted">Verde: disponible; amarillo: solicitud pendiente; rojo: reservado; gris: fuera de servicio.</p></div><label for="calendarioZonaInterna">Zona social<select id="calendarioZonaInterna">${zonasReservaActuales.map(zona => `<option value="${Number(zona.id)}" ${Number(zona.id) === previo ? 'selected' : ''}>${escapeHtml(zona.nombre)} · ${escapeHtml(formatearHorarioServicio(zona.horarios))}</option>`).join('')}</select></label></div>${leyendaHorarioCalendario()}<div id="calendar-interno" class="internal-zone-calendar"></div>`;
    const selector = document.getElementById('calendarioZonaInterna');
    const render = () => {
        const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selector.value));
        const horario = horarioServicioZona(zona);
        const destino = document.getElementById('calendar-interno');
        if (!horario) {
            destino.innerHTML = '<p class="empty-state">Configura el horario de servicio de esta zona antes de crear reservas.</p>';
            return;
        }
        const reservas = reservasZonasActuales.filter(reserva => Number(reserva.zona_id) === Number(zona.id) && ['pendiente', 'aprobada'].includes(reserva.estado));
        if (window.zonasCalendar) window.zonasCalendar.destroy();
        window.zonasCalendar = new FullCalendar.Calendar(destino, {
            initialView: 'timeGridWeek',
            locale: 'es',
            height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
            ...opcionesCalendarioHorario(zona),
            events: reservas.map(reserva => eventoReserva(reserva, true)),
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                const hora = horaInicialDesdeClick(info, horario);
                if (fecha < fechaMinimaReserva(true)) return window.notificar('No puedes crear reservas en una fecha pasada.', 'warning');
                if (!momentoEnHorarioServicio(info.date, horario)) return window.notificar(`Fuera de servicio: ${formatearHorarioServicio(horario)}.`, 'warning');
                window.abrirReservaInterna(0, fecha, Number(zona.id), hora);
            },
            eventClick: info => window.abrirReservaInterna(Number(info.event.id))
        });
        window.zonasCalendar.render();
    };
    selector.onchange = render;
    render();
}

window.abrirDetalleZona = async function (zonaId) {
    const modal = document.getElementById('zona-detalle-modal');
    const titulo = document.getElementById('zona-detalle-titulo');
    if (!modal || !titulo) return;
    modal.classList.remove('hidden');
    titulo.textContent = 'Cargando zona…';
    try {
        const response = await fetch(`api/zonas.php?action=public_zona_detalle&zona_id=${encodeURIComponent(zonaId)}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        const { zona, reservas } = result.data;
        const horario = horarioServicioZona(zona);
        document.getElementById('zona-detalle-imagen').style.backgroundImage = `linear-gradient(120deg, rgba(15,23,42,.2), rgba(15,23,42,.58)), url("${imagenZona(zona)}")`;
        titulo.textContent = zona.nombre;
        document.getElementById('zona-detalle-descripcion').textContent = zona.descripcion || 'Espacio disponible para el disfrute de la comunidad.';
        document.getElementById('zona-detalle-aforo').textContent = `${zona.aforo || 'No definido'} personas`;
        document.getElementById('zona-detalle-horario').textContent = formatearHorarioServicio(zona.horarios);
        document.getElementById('zona-detalle-tarifa').textContent = Number(zona.tarifa) ? formatCurrency(zona.tarifa) : 'Sin costo';
        document.getElementById('zona-detalle-reglamento').textContent = zona.reglamento || 'No hay normas adicionales registradas.';
        modal.dataset.zonaId = zona.id;
        let video = document.getElementById('zona-detalle-video');
        if (!video) {
            video = document.createElement('div');
            video.id = 'zona-detalle-video';
            video.className = 'zona-video';
            document.querySelector('.zona-detalle-rules')?.insertAdjacentElement('afterend', video);
        }
        if (video) {
            const videoId = youtubeId(zona.youtube_url);
            video.innerHTML = videoId ? `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="Video de ${escapeHtml(zona.nombre)}" loading="lazy" allowfullscreen></iframe>` : '';
        }
        const leyenda = modal.querySelector('.zona-availability-legends');
        if (leyenda) leyenda.innerHTML = leyendaHorarioCalendario().replace(/^<div[^>]*>|<\/div>$/g, '');
        const calendario = document.getElementById('public-zona-calendar');
        if (window.publicZonaCalendar) window.publicZonaCalendar.destroy();
        window.publicZonaCalendar = new FullCalendar.Calendar(calendario, {
            initialView: 'timeGridWeek',
            locale: 'es',
            height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
            ...opcionesCalendarioHorario(zona),
            events: (reservas || []).map(reserva => eventoReserva(reserva, false))
        });
        window.publicZonaCalendar.render();
    } catch (error) {
        console.error(error);
        titulo.textContent = 'No fue posible cargar esta zona';
        window.notificar('No fue posible cargar la disponibilidad de la zona.', 'error');
    }
};

const cargarZonasConHorasAMPMBase = loadZonas;
loadZonas = async function () {
    await cargarZonasConHorasAMPMBase();
    prepararSelectoresHoraAMPM(document.getElementById('view-container') || document);
    actualizarHorariosVisibles();
};

const abrirFormularioZonaConHorasAMPMBase = window.abrirFormularioZona;
window.abrirFormularioZona = function (...argumentos) {
    abrirFormularioZonaConHorasAMPMBase(...argumentos);
    prepararSelectoresHoraAMPM(document.getElementById('modalZona') || document);
};

const abrirReservaInternaConHorasAMPMBase = window.abrirReservaInterna;
window.abrirReservaInterna = function (...argumentos) {
    abrirReservaInternaConHorasAMPMBase(...argumentos);
    prepararSelectoresHoraAMPM(document.getElementById('modalReservaInterna') || document);
};

const cargarZonasPublicasConHorasAMPMBase = window.loadPublicZonas;
window.loadPublicZonas = async function (...argumentos) {
    await cargarZonasPublicasConHorasAMPMBase(...argumentos);
    actualizarHorariosVisibles();
};

const cargarFinanzasConAccesoCuotasBase = window.loadFinanzas;
window.loadFinanzas = async function () {
    await cargarFinanzasConAccesoCuotasBase();
    const panel = document.getElementById('panel-cuotas-configuradas');
    const modal = document.getElementById('modalCobro');
    const encabezado = modal?.closest('.view')?.firstElementChild;
    const acciones = encabezado?.querySelector('div:last-child');
    if (panel && acciones && !document.getElementById('btnConfigurarCuotasAdministracion')) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.id = 'btnConfigurarCuotasAdministracion';
        boton.className = 'btn btn-ghost finance-configure-fees-button';
        boton.innerHTML = '<i class="fa-solid fa-sliders"></i> Configurar cuotas de administración';
        boton.onclick = () => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.setTimeout(() => panel.querySelector('#cuotaValorApartamentos')?.focus(), 350);
        };
        acciones.prepend(boton);
    }
    prepararCamposMoneda(panel || document);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => prepararSelectoresHoraAMPM());
else prepararSelectoresHoraAMPM();


/* Personas por inmueble, PQRS con adjuntos y selección automática de franjas. */
async function leerRespuestaImportacion(respuesta) {
    const contenido = await respuesta.text();
    try {
        const datos = JSON.parse(contenido);
        if (!respuesta.ok && datos.status === 'success') return { status: 'error', message: `Error HTTP ${respuesta.status}` };
        return datos;
    } catch (_) {
        const detalle = contenido.trim().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 220);
        return { status: 'error', message: `El servidor respondió HTTP ${respuesta.status} sin JSON válido.${detalle ? ` Detalle: ${detalle}` : ' Revisa el log PHP del servidor.'}` };
    }
}

function horaDesdeMinutosReserva(minutos) {
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function finAutomaticoReserva(inicio, zona) {
    const horario = horarioServicioZona(zona);
    const inicioMinutos = minutosHora(inicio);
    if (!horario || inicioMinutos === null) return '';
    const maximo = Math.max(1, Number(zona.max_horas_reserva) || 1) * 60;
    let limite = horario.cierreMinutos;
    if (horario.nocturno && inicioMinutos >= horario.aperturaMinutos) limite = 1425;
    const fin = Math.floor(Math.min(inicioMinutos + maximo, limite) / 15) * 15;
    return fin > inicioMinutos ? horaDesdeMinutosReserva(fin) : '';
}

function asignarFranjaAutomatica(inicio, zona, inicioEl, finEl) {
    const fin = finAutomaticoReserva(inicio, zona);
    inicioEl.value = inicio;
    if (!fin) {
        finEl.value = '';
        window.notificar(`No hay tiempo suficiente dentro del horario ${formatearHorarioServicio(zona.horarios)} para iniciar una reserva a esa hora.`, 'warning');
        return false;
    }
    finEl.value = fin;
    return true;
}

async function renderDisponibilidadResidente() {
    const selectZona = document.getElementById('reservaZonaId');
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!selectZona || !window.FullCalendar) return;
    if (!calendario) {
        calendario = document.createElement('section');
        calendario.id = 'calendar-disponibilidad-residente';
        calendario.className = 'resident-zone-calendar';
        document.getElementById('calendar')?.closest('.card')?.insertAdjacentElement('beforebegin', calendario);
    }
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selectZona.value));
    if (!zona) {
        calendario.innerHTML = '<p class="muted">Selecciona una zona para consultar sus horarios disponibles.</p>';
        return;
    }
    const horario = horarioServicioZona(zona);
    if (!horario) {
        calendario.innerHTML = '<p class="empty-state">Esta zona no tiene un horario de servicio válido.</p>';
        return;
    }
    calendario.innerHTML = `<div class="resident-availability-header"><div><p class="section-kicker">Disponibilidad por horas</p><h3>Agenda: ${escapeHtml(zona.nombre)}</h3><p>Al tocar una franja se completa la fecha, inicio y hasta ${Number(zona.max_horas_reserva) || 1} hora(s) de reserva.</p></div>${leyendaHorarioCalendario()}</div><div class="resident-zone-calendar-body"></div>`;
    const cuerpo = calendario.querySelector('.resident-zone-calendar-body');
    try {
        const response = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(selectZona.value)}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();
        window.residentAvailabilityCalendar = new FullCalendar.Calendar(cuerpo, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
            ...opcionesCalendarioHorario(zona),
            events: (result.data.reservas || []).map(reserva => eventoReserva(reserva, false)),
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                const inicio = horaInicialDesdeClick(info, horario);
                if (fecha < fechaMinimaReserva()) return window.notificar('Selecciona una fecha futura para reservar.', 'warning');
                if (!momentoEnHorarioServicio(info.date, horario)) return window.notificar(`La zona está fuera de servicio. Horario: ${formatearHorarioServicio(horario)}.`, 'warning');
                document.getElementById('reservaFecha').value = fecha;
                const inicioEl = document.getElementById('reservaHoraInicio');
                const finEl = document.getElementById('reservaHoraFin');
                if (asignarFranjaAutomatica(inicio, zona, inicioEl, finEl)) finEl.focus();
            }
        });
        window.residentAvailabilityCalendar.render();
    } catch (error) {
        cuerpo.innerHTML = `<p class="muted">${escapeHtml(error.message || 'No fue posible cargar la disponibilidad.')}</p>`;
    }
}

const abrirReservaInternaConFinAutomaticoBase = window.abrirReservaInterna;
window.abrirReservaInterna = function (reservaId = 0, fecha = '', zonaId = 0, hora = '08:00') {
    abrirReservaInternaConFinAutomaticoBase(reservaId, fecha, zonaId, hora);
    if (reservaId) return;
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(zonaId));
    const modal = document.getElementById('modalReservaInterna');
    const inicio = modal?.querySelector('[name="hora_inicio"]');
    const fin = modal?.querySelector('[name="hora_fin"]');
    if (zona && inicio && fin) asignarFranjaAutomatica(hora, zona, inicio, fin);
};

let rolUsuariosActivo = 'admin';
let inmueblesUsuariosActuales = [];

function prepararInterfazUsuarios() {
    const vista = document.getElementById('listaUsuarios')?.closest('.view');
    if (!vista) return;
    if (!vista.querySelector('#usuarios-role-tabs')) {
        const tabla = document.getElementById('listaUsuarios')?.closest('.card');
        tabla?.insertAdjacentHTML('beforebegin', '<nav id="usuarios-role-tabs" class="user-role-tabs" aria-label="Clasificación de personas"><button type="button" data-rol="admin"><i class="fa-solid fa-user-tie"></i> Administradores</button><button type="button" data-rol="vigilante"><i class="fa-solid fa-shield-halved"></i> Vigilantes</button><button type="button" data-rol="residente"><i class="fa-solid fa-house-user"></i> Residentes</button><button type="button" data-rol="propietario"><i class="fa-solid fa-key"></i> Propietarios</button></nav>');
        vista.querySelectorAll('#usuarios-role-tabs button').forEach(boton => boton.onclick = () => { rolUsuariosActivo = boton.dataset.rol; renderTablaUsuarios(); });
    }
    const selectRol = document.getElementById('usrRol');
    if (selectRol) selectRol.innerHTML = '<option value="admin">Administrador</option><option value="vigilante">Vigilante</option><option value="residente">Residente</option><option value="propietario">Propietario</option>';
    const form = document.getElementById('formCrearUsuario');
    if (form && !document.getElementById('usrInmuebleGrupo')) {
        document.getElementById('usrEmail')?.removeAttribute('required');
        const boton = form.querySelector('button[type="submit"]');
        boton?.insertAdjacentHTML('beforebegin', '<div id="usrInmuebleGrupo" class="form-group"><label style="font-weight:500; font-size:14px; margin-bottom:4px; display:block;">Apartamento o casa asociado</label><select id="usrInmuebleId" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc;"></select><small>Obligatorio para residentes y propietarios.</small></div><label id="usrAccesoGrupo" class="user-access-toggle"><input id="usrSinAcceso" type="checkbox" checked> Registrar como persona sin acceso al portal</label>');
        selectRol?.addEventListener('change', sincronizarFormularioUsuario);
        document.getElementById('usrSinAcceso')?.addEventListener('change', sincronizarFormularioUsuario);
    }
}

function opcionesInmuebleUsuario(seleccionado = '') {
    return '<option value="">Selecciona apartamento o casa…</option>' + inmueblesUsuariosActuales.map(inmueble => `<option value="${Number(inmueble.id)}" ${String(inmueble.id) === String(seleccionado) ? 'selected' : ''}>${escapeHtml([inmueble.torre, inmueble.nomenclatura || inmueble.apartamento].filter(Boolean).join(' · '))}</option>`).join('');
}

function sincronizarFormularioUsuario() {
    const rol = document.getElementById('usrRol')?.value || '';
    const esPersona = ['residente', 'propietario'].includes(rol);
    const sinAcceso = document.getElementById('usrSinAcceso');
    const grupoInmueble = document.getElementById('usrInmuebleGrupo');
    const grupoAcceso = document.getElementById('usrAccesoGrupo');
    const inmueble = document.getElementById('usrInmuebleId');
    const correo = document.getElementById('usrEmail');
    const password = document.getElementById('usrPass');
    if (grupoInmueble) grupoInmueble.hidden = !esPersona;
    if (grupoAcceso) grupoAcceso.hidden = !esPersona;
    if (inmueble) inmueble.required = esPersona;
    if (!esPersona && sinAcceso) { sinAcceso.checked = false; sinAcceso.disabled = true; } else if (sinAcceso) sinAcceso.disabled = false;
    const requiereAcceso = !esPersona || !sinAcceso?.checked;
    if (correo) correo.required = requiereAcceso;
    if (password) {
        password.required = !document.getElementById('usrId')?.value && requiereAcceso;
        password.placeholder = requiereAcceso ? 'Contraseña mínima de 8 caracteres' : 'Sin contraseña: solo aparece en directorio';
    }
}

function renderTablaUsuarios() {
    const cuerpo = document.getElementById('listaUsuarios');
    if (!cuerpo) return;
    document.querySelectorAll('#usuarios-role-tabs button').forEach(boton => boton.classList.toggle('active', boton.dataset.rol === rolUsuariosActivo));
    const usuarios = usuariosActuales.filter(usuario => usuario.rol === rolUsuariosActivo);
    const etiqueta = { admin: 'administradores', vigilante: 'vigilantes', residente: 'residentes', propietario: 'propietarios' }[rolUsuariosActivo];
    const nota = document.getElementById('usuarios-contador');
    if (nota) nota.textContent = `${usuarios.length} ${etiqueta} · las personas sin cuenta permanecen en el directorio de portería.`;
    cuerpo.innerHTML = usuarios.length ? usuarios.map(usuario => `<tr><td><strong>${escapeHtml(usuario.nombre)}</strong>${Number(usuario.tiene_cuenta) ? '' : '<br><small class="person-no-account">Sin acceso al portal</small>'}</td><td>${escapeHtml(usuario.documento)}</td><td><span class="reserva-estado">${escapeHtml(usuario.rol)}</span></td><td>${escapeHtml(usuario.inmuebles || 'Sin inmueble')}</td><td class="user-actions"><button class="btn btn-ghost user-status-action" onclick="window.openUsuarioModal(${Number(usuario.id)})"><i class="fa-solid fa-pen"></i> Editar</button></td></tr>`).join('') : `<tr><td colspan="5">No hay ${etiqueta} registrados.</td></tr>`;
}

loadUsuarios = async function () {
    const [usuariosResponse, inmueblesResponse] = await Promise.all([fetch('api/users.php?action=list'), fetch('api/inmuebles.php?action=list')]);
    const [usuarios, inmuebles] = await Promise.all([usuariosResponse.json(), inmueblesResponse.json()]);
    if (usuarios.status !== 'success') return window.notificar(usuarios.message || 'No fue posible cargar usuarios.', 'error');
    usuariosActuales = usuarios.data || [];
    inmueblesUsuariosActuales = inmuebles.status === 'success' ? inmuebles.data || [] : [];
    prepararInterfazUsuarios();
    renderTablaUsuarios();
};

window.openUsuarioModal = function (id = null, rolPreferido = rolUsuariosActivo, inmueblePreferido = '') {
    prepararInterfazUsuarios();
    const form = document.getElementById('formCrearUsuario');
    const usuario = usuariosActuales.find(item => Number(item.id) === Number(id));
    form?.reset();
    document.getElementById('usrId').value = usuario?.id || '';
    document.getElementById('modalUsuarioTitle').textContent = usuario ? 'Editar persona o usuario' : `Crear ${rolPreferido}`;
    document.getElementById('usrDoc').value = usuario?.documento || '';
    document.getElementById('usrNombre').value = usuario?.nombre || '';
    document.getElementById('usrEmail').value = usuario?.email || '';
    document.getElementById('usrRol').value = usuario?.rol || rolPreferido;
    document.getElementById('usrSinAcceso').checked = usuario ? !Number(usuario.tiene_cuenta) : ['residente', 'propietario'].includes(rolPreferido);
    document.getElementById('usrInmuebleId').innerHTML = opcionesInmuebleUsuario(inmueblePreferido || usuario?.inmueble_id || '');
    sincronizarFormularioUsuario();
    document.getElementById('modalUsuario').classList.remove('hidden');
};

document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'formCrearUsuario') return;
    event.preventDefault();
    event.stopPropagation();
    const boton = form.querySelector('[type="submit"]');
    if (boton?.dataset.enviando === '1') return;
    if (boton) { boton.dataset.enviando = '1'; boton.disabled = true; }
    const datos = new FormData();
    [['action', document.getElementById('usrId').value ? 'update' : 'crear_usuario'], ['id', document.getElementById('usrId').value], ['documento', document.getElementById('usrDoc').value], ['nombre', document.getElementById('usrNombre').value], ['email', document.getElementById('usrEmail').value], ['password', document.getElementById('usrPass').value], ['rol', document.getElementById('usrRol').value], ['inmueble_id', document.getElementById('usrInmuebleId').value]].forEach(([nombre, valor]) => datos.append(nombre, valor));
    if (document.getElementById('usrSinAcceso').checked) datos.append('sin_acceso', '1');
    try {
        const respuesta = await fetch('api/users.php', { method: 'POST', body: datos });
        const resultado = await respuesta.json();
        window.notificar(resultado.message || 'No fue posible guardar el usuario.', resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { document.getElementById('modalUsuario').classList.add('hidden'); await loadUsuarios(); }
    } catch (error) {
        console.error('Error guardando usuario', error);
        window.notificar('No fue posible comunicarse con el servidor al guardar el usuario.', 'error');
    } finally {
        if (boton) { boton.disabled = false; delete boton.dataset.enviando; }
    }
}, true);

loadInmuebles = async function () {
    const [inmueblesResponse, parqueaderosResponse] = await Promise.all([
        fetch('api/inmuebles.php?action=list'),
        fetch('api/parqueaderos.php?action=list')
    ]);
    const [resultado, parqueaderosResultado] = await Promise.all([
        inmueblesResponse.json(),
        parqueaderosResponse.json()
    ]);
    if (resultado.status !== 'success') return window.notificar(resultado.message || 'No fue posible cargar inmuebles.', 'error');
    inmueblesActuales = resultado.data || [];
    window.parqueaderosEnInmuebles = parqueaderosResultado.status === 'success' ? parqueaderosResultado.data || [] : [];
    const tabla = document.getElementById('tb-inmuebles');
    const cabecera = tabla?.closest('table')?.querySelector('thead tr');
    if (cabecera) cabecera.innerHTML = '<th>Unidad</th><th>Torre/bloque</th><th>Ocupación</th><th>Parqueadero</th><th>Vehículos / mascotas</th><th>Mora</th><th>Acciones</th>';
    if (tabla) tabla.innerHTML = inmueblesActuales.length ? inmueblesActuales.map(inmueble => {
        const sinCuenta = Number(inmueble.num_cuentas || 0) === 0;
        const estado = `<span class="inmueble-state ${sinCuenta ? 'is-empty' : 'is-linked'}"><i class="fa-solid ${sinCuenta ? 'fa-user-slash' : 'fa-user-check'}"></i> ${sinCuenta ? 'Sin usuario con acceso' : `${Number(inmueble.num_cuentas)} con acceso`}</span><small>${Number(inmueble.num_residentes)} residente(s) · ${Number(inmueble.num_personas)} persona(s)</small>`;
        const parqueadero = inmueble.parqueadero_codigo ? `${escapeHtml(inmueble.parqueadero_codigo)}<br><small>${escapeHtml(inmueble.parqueadero_tipo)}</small>` : 'Sin parqueadero';
        return `<tr class="inmueble-row" tabindex="0" onclick="window.abrirDetalleInmueble(${Number(inmueble.id)})"><td><strong>${escapeHtml(inmueble.nomenclatura || inmueble.apartamento)}</strong><br><small>${escapeHtml(inmueble.tipo_unidad)}</small></td><td>${escapeHtml(inmueble.torre || '—')}</td><td>${estado}</td><td>${parqueadero}</td><td>${Number(inmueble.num_vehiculos)} vehículo(s)<br><small>${Number(inmueble.num_mascotas)} mascota(s)</small></td><td>${formatCurrency(inmueble.mora_actual)}</td><td class="inmueble-actions"><button class="btn btn-ghost" onclick="event.stopPropagation(); window.abrirDetalleInmueble(${Number(inmueble.id)})">Ver ficha</button><button class="btn btn-ghost" onclick="event.stopPropagation(); window.abrirModalInmueble(${Number(inmueble.id)})">Editar</button></td></tr>`;
    }).join('') : '<tr><td colspan="7">No hay unidades registradas.</td></tr>';
    document.getElementById('formInmueble').onsubmit = guardarInmueble;
};

window.abrirDetalleInmueble = async function (inmuebleId) {
    const [detalleResponse, usuariosResponse] = await Promise.all([fetch(`api/inmuebles.php?action=detalle&inmueble_id=${encodeURIComponent(inmuebleId)}`), fetch('api/users.php?action=list')]);
    const [detalle, usuarios] = await Promise.all([detalleResponse.json(), usuariosResponse.json()]);
    if (detalle.status !== 'success') return window.notificar(detalle.message || 'No fue posible abrir el inmueble.', 'error');
    const { inmueble, personas = [], vehiculos = [], mascotas = [] } = detalle.data;
    let modal = document.getElementById('modalDetalleInmueble');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', '<div id="modalDetalleInmueble" class="login-modal detalle-inmueble-modal hidden"></div>'); modal = document.getElementById('modalDetalleInmueble'); }
    const tarjetasPersonas = personas.length ? personas.map(persona => `<article class="inmueble-person-card"><span class="inmueble-person-icon"><i class="fa-solid ${persona.tipo_relacion === 'propietario' ? 'fa-key' : 'fa-house-user'}"></i></span><div><strong>${escapeHtml(persona.nombre)}</strong><small>${escapeHtml(persona.tipo_relacion)} · ${Number(persona.tiene_cuenta) ? 'Acceso al portal' : 'Solo directorio de portería'}</small><small>${escapeHtml(persona.contacto || persona.email || 'Sin contacto')}</small></div></article>`).join('') : '<p class="empty-state">No hay propietarios ni residentes relacionados.</p>';
    const opcionesPersonas = usuarios.status === 'success' ? usuarios.data.filter(persona => ['residente', 'propietario'].includes(persona.rol)).map(persona => `<option value="${Number(persona.id)}">${escapeHtml(persona.nombre)} · ${escapeHtml(persona.documento)}</option>`).join('') : '';
    modal.innerHTML = `<div class="login-box inmueble-detail-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalDetalleInmueble').classList.add('hidden')"></button><header class="inmueble-detail-heading"><div><p class="section-kicker">Ficha integral del inmueble</p><h2>${escapeHtml(inmueble.nomenclatura || inmueble.apartamento)}</h2><p>${escapeHtml(inmueble.tipo_unidad)} · ${escapeHtml(inmueble.torre || 'Sin torre')} · ${inmueble.parqueadero_codigo ? `Parqueadero ${escapeHtml(inmueble.parqueadero_codigo)}` : 'Sin parqueadero asignado'}</p></div><strong>${formatCurrency(inmueble.mora_actual)}</strong></header><section class="inmueble-detail-section"><div class="inmueble-section-title"><h3>Personas vinculadas</h3><button class="btn btn-primary" type="button" onclick="window.abrirPersonaDesdeInmueble(${Number(inmueble.id)})"><i class="fa-solid fa-user-plus"></i> Agregar persona</button></div><div class="inmueble-person-grid">${tarjetasPersonas}</div><form id="formVincularUsuarioInmueble" class="inmueble-link-form"><input type="hidden" name="inmueble_id" value="${Number(inmueble.id)}"><select name="usuario_id" required><option value="">Vincular persona existente…</option>${opcionesPersonas}</select><select name="tipo_relacion" required><option value="residente">Residente</option><option value="propietario">Propietario</option></select><button class="btn btn-ghost" type="submit">Vincular</button></form></section><section class="inmueble-detail-grid"><div class="inmueble-detail-section"><h3><i class="fa-solid fa-car"></i> Vehículos</h3>${vehiculos.length ? `<ul>${vehiculos.map(vehiculo => `<li><strong>${escapeHtml(vehiculo.placa)}</strong> · ${escapeHtml([vehiculo.tipo, vehiculo.marca, vehiculo.linea].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : '<p class="muted">Sin vehículos registrados.</p>'}</div><div class="inmueble-detail-section"><h3><i class="fa-solid fa-paw"></i> Mascotas</h3>${mascotas.length ? `<ul>${mascotas.map(mascota => `<li>${escapeHtml(mascota.descripcion)}</li>`).join('')}</ul>` : '<p class="muted">Sin mascotas registradas.</p>'}</div></section></div>`;
    modal.querySelector('#formVincularUsuarioInmueble').onsubmit = async event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget); data.append('action', 'vincular_usuario');
        const response = await fetch('api/inmuebles.php', { method: 'POST', body: data }); const result = await response.json();
        window.notificar(result.message, result.status === 'success' ? 'success' : 'error');
        if (result.status === 'success') window.abrirDetalleInmueble(inmuebleId);
    };
    modal.classList.remove('hidden');
};

window.abrirPersonaDesdeInmueble = function (inmuebleId) {
    let modal = document.getElementById('modalPersonaInmueble');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', '<div id="modalPersonaInmueble" class="login-modal hidden"></div>'); modal = document.getElementById('modalPersonaInmueble'); }
    modal.innerHTML = `<div class="login-box inmueble-person-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalPersonaInmueble').classList.add('hidden')"></button><h2>Agregar residente o propietario</h2><p class="muted">Puedes guardarlo solo para el directorio de Portería o habilitar su acceso al portal.</p><form id="formPersonaInmueble" class="stack-form"><select name="rol" required><option value="residente">Residente</option><option value="propietario">Propietario</option></select><input name="documento" placeholder="Documento" required><input name="nombre" placeholder="Nombre completo" required><input name="email" type="email" placeholder="Correo (opcional si no tendrá acceso)"><label class="user-access-toggle"><input name="sin_acceso" type="checkbox" checked> Sin acceso al portal</label><input name="password" type="password" placeholder="Contraseña si tendrá acceso" minlength="8"><input type="hidden" name="inmueble_id" value="${Number(inmuebleId)}"><button class="btn btn-primary" type="submit">Guardar y enlazar</button></form></div>`;
    modal.querySelector('form').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.currentTarget); data.append('action', 'crear_usuario'); const response = await fetch('api/users.php', { method: 'POST', body: data }); const result = await response.json(); window.notificar(result.message, result.status === 'success' ? 'success' : 'error'); if (result.status === 'success') { modal.classList.add('hidden'); await loadInmuebles(); window.abrirDetalleInmueble(inmuebleId); } };
    modal.classList.remove('hidden');
};

window.abrirFormularioPQRS = function () {
    let modal = document.getElementById('modalPQRS');
    if (!modal) { document.getElementById('view-container').insertAdjacentHTML('beforeend', '<div id="modalPQRS" class="login-modal hidden"></div>'); modal = document.getElementById('modalPQRS'); }
    modal.innerHTML = '<div class="login-box pqrs-dialog"><button class="close-btn" type="button" onclick="document.getElementById(\'modalPQRS\').classList.add(\'hidden\')"></button><h2>Radicar PQRS</h2><form id="formPQRS" class="stack-form" enctype="multipart/form-data"><input name="asunto" maxlength="150" placeholder="Asunto" required><select name="categoria"><option>Queja</option><option>Petición</option><option>Reclamo</option><option>Sugerencia</option><option>General</option></select><textarea name="descripcion" placeholder="Describe tu solicitud" required></textarea><label class="pqrs-file-field">Adjuntos opcionales<input name="adjuntos[]" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime"><small>Máximo 5 archivos; cada uno hasta 25 MB. Imágenes, PDF o video MP4/WEBM/MOV.</small></label><button class="btn btn-primary" type="submit">Radicar PQRS</button></form></div>';
    modal.querySelector('form').onsubmit = async event => { event.preventDefault(); event.stopPropagation(); const data = new FormData(event.currentTarget); data.append('action', 'crear'); const response = await fetch('api/reclamaciones.php', { method: 'POST', body: data }); const result = await response.json(); window.notificar(result.message, result.status === 'success' ? 'success' : 'error'); if (result.status === 'success') { modal.classList.add('hidden'); loadReclamaciones(); } };
    modal.classList.remove('hidden');
};

function botonesAdjuntosReclamacion(adjuntos = []) {
    if (!adjuntos.length) return '<span class="muted">—</span>';
    const codificados = JSON.stringify(encodeURIComponent(JSON.stringify(adjuntos))).replace(/"/g, '&quot;');
    return `<button type="button" class="btn btn-ghost pqrs-files-button" onclick="window.verAdjuntosReclamacionCodificados(${codificados})"><i class="fa-solid fa-paperclip"></i> ${adjuntos.length}</button>`;
}

window.verAdjuntosReclamacionCodificados = function (valor) {
    try { window.verAdjuntosReclamacion(JSON.parse(decodeURIComponent(valor))); } catch (_) { window.notificar('No fue posible leer los adjuntos de esta PQRS.', 'error'); }
}

window.verAdjuntosReclamacion = function (adjuntos) {
    const contenido = adjuntos.map(adjunto => {
        const url = `api/reclamaciones.php?action=ver_adjunto&adjunto_id=${Number(adjunto.id)}`;
        const esImagen = String(adjunto.mime).startsWith('image/');
        const esVideo = String(adjunto.mime).startsWith('video/');
        const vista = esImagen ? `<img src="${url}" alt="${escapeHtml(adjunto.nombre_original)}">` : esVideo ? `<video controls preload="metadata" src="${url}"></video>` : '<i class="fa-solid fa-file-pdf"></i>';
        return `<article class="pqrs-attachment-preview">${vista}<a href="${url}" target="_blank" rel="noopener">${escapeHtml(adjunto.nombre_original)}</a></article>`;
    }).join('');
    if (window.Swal) Swal.fire({ title: 'Adjuntos de la PQRS', html: `<div class="pqrs-attachment-grid">${contenido}</div>`, width: 760, confirmButtonText: 'Cerrar' });
};

loadReclamaciones = async function () {
    const response = await fetch('api/reclamaciones.php?action=list');
    const result = await response.json();
    const tabla = document.getElementById('tb-reclamaciones');
    const cabecera = tabla?.closest('table')?.querySelector('thead tr');
    if (cabecera) cabecera.innerHTML = '<th>Asunto</th><th>Usuario</th><th>Fecha</th><th>Estado</th><th>Adjuntos</th>';
    if (result.status !== 'success') return window.notificar(result.message || 'No fue posible cargar PQRS.', 'error');
    tabla.innerHTML = result.data.length ? result.data.map(item => `<tr><td><strong>${escapeHtml(item.asunto)}</strong><br><small>${escapeHtml(item.categoria || 'General')}</small></td><td>${escapeHtml(item.usuario_nombre || 'Tú')}</td><td>${escapeHtml(item.creado_en)}</td><td><span class="reserva-estado">${escapeHtml(item.estado)}</span></td><td>${botonesAdjuntosReclamacion(item.adjuntos || [])}</td></tr>`).join('') : '<tr><td colspan="5">No hay PQRS radicadas.</td></tr>';
};


let cargaConfiguracionCuotasEnCurso = null;

async function abrirConfiguracionCuotasAdministracion() {
    let panel = document.getElementById('panel-cuotas-configuradas');
    if (!panel) {
        if (!cargaConfiguracionCuotasEnCurso) {
            cargaConfiguracionCuotasEnCurso = Promise.resolve(window.loadFinanzas()).finally(() => {
                cargaConfiguracionCuotasEnCurso = null;
            });
        }
        await cargaConfiguracionCuotasEnCurso;
        panel = document.getElementById('panel-cuotas-configuradas');
    }
    if (!panel) {
        window.notificar('No fue posible cargar la configuración de cuotas. Intenta recargar la página.', 'error');
        return;
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => panel.querySelector('#cuotaBusqueda')?.focus(), 350);
}


/* Estabilidad de API y experiencia de operación (2026-08-10). */
(() => {
    const mensajeHttp = status => {
        if (status === 413) return 'La carga supera el límite permitido por el servidor. Reduce el tamaño del archivo o solicita a administración ajustar el límite de cargas.';
        if (status >= 500) return 'El servidor no pudo completar la operación. Intenta de nuevo; si continúa, informa a la administración.';
        if (status === 401 || status === 403) return 'Tu sesión no tiene permisos para esta operación.';
        return `No fue posible completar la operación (HTTP ${status || 'sin respuesta'}).`;
    };

    // Todas las llamadas existentes usan response.json(). Al leer el cuerpo de forma segura,
    // una página HTML de Nginx/PHP (413/500) se convierte en un mensaje útil y no en SyntaxError.
    Response.prototype.json = async function () {
        const texto = await this.text();
        if (!texto.trim()) return { status: 'error', message: mensajeHttp(this.status), data: [] };
        try {
            const resultado = JSON.parse(texto);
            return this.ok || resultado?.status === 'error'
                ? resultado
                : { status: 'error', message: resultado?.message || mensajeHttp(this.status), data: resultado?.data || [] };
        } catch (_) {
            return { status: 'error', message: mensajeHttp(this.status), data: [] };
        }
    };
})();

// Evita que un formulario sin controlador específico recargue la página y devuelva al panel.
document.addEventListener('submit', event => {
    if (event.target.closest('#app')) event.preventDefault();
}, true);

const cargarVistaConMemoria = window.loadView;
window.loadView = function (vista) {
    if (vista && currentUser?.id) sessionStorage.setItem(`resiportalVistaActiva:${currentUser.id}`, vista);
    return cargarVistaConMemoria(vista);
};
const iniciarAppConMemoria = initApp;
initApp = function () {
    iniciarAppConMemoria();
    const vista = currentUser?.id ? sessionStorage.getItem(`resiportalVistaActiva:${currentUser.id}`) : null;
    const permitidas = currentUser?.rol === 'vigilante'
        ? ['porteria', 'zonas', 'perfil']
        : currentUser?.rol === 'residente' || currentUser?.rol === 'propietario'
            ? ['home-residente', 'mis-pagos', 'zonas', 'reclamaciones', 'perfil']
            : null;
    if (vista && (!permitidas || permitidas.includes(vista))) window.loadView(vista);
};

window.cancelarMiReserva = async function (reservaId) {
    const confirmar = window.confirmarAccion
        ? await window.confirmarAccion({ titulo: '¿Cancelar reserva?', texto: 'La franja quedará disponible y la reserva se conservará en el historial.', confirmar: 'Cancelar reserva', icono: 'warning' })
        : window.confirm('¿Cancelar esta reserva?');
    if (!confirmar) return;
    const datos = new FormData();
    datos.append('action', 'cancelar_reserva');
    datos.append('reserva_id', reservaId);
    const respuesta = await fetch('api/zonas.php', { method: 'POST', body: datos });
    const resultado = await respuesta.json();
    window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
    if (resultado.status === 'success') await loadZonas();
};

renderTablaReservas = function (esInterno) {
    const tabla = document.getElementById('tb-zonas');
    if (!tabla) return;
    tabla.innerHTML = reservasZonasActuales.length ? reservasZonasActuales.map(reserva => {
        const estado = escapeHtml(reserva.estado);
        const activa = ['pendiente', 'aprobada'].includes(reserva.estado);
        const acciones = esInterno
            ? `<button class="btn btn-ghost internal-reservation-action" onclick="window.abrirReservaInterna(${Number(reserva.id)})">Ver / gestionar</button>`
            : activa ? `<button class="btn btn-ghost internal-reservation-action" onclick="window.cancelarMiReserva(${Number(reserva.id)})"><i class="fa-solid fa-ban"></i> Cancelar</button>` : '—';
        return `<tr><td>${escapeHtml(reserva.zona_nombre)}</td><td><strong>${escapeHtml(reserva.inmueble_etiqueta || 'Histórico sin inmueble')}</strong></td><td>${formatDate(reserva.fecha_reserva)}</td><td>${escapeHtml(etiquetaHorarioReserva(reserva))}</td><td><span class="reserva-estado estado-${estado}">${estado}</span></td><td>${acciones}</td></tr>`;
    }).join('') : '<tr><td colspan="6">No hay reservas registradas.</td></tr>';
};

function completarFinReservaResidente(inicio, zona, fin) {
    if (typeof asignarFranjaAutomatica === 'function') return asignarFranjaAutomatica(inicio.value, zona, inicio, fin);
    const [hora, minuto] = inicio.value.split(':').map(Number);
    const total = hora * 60 + minuto + (Number(zona.max_horas_reserva || 1) * 60);
    fin.value = `${String(Math.min(23, Math.floor(total / 60))).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

window.abrirReservaResidente = function (fecha, hora) {
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(document.getElementById('reservaZonaId')?.value));
    if (!zona) return window.notificar('Selecciona una zona antes de elegir una franja.', 'warning');
    let modal = document.getElementById('modalReservaResidente');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', '<div id="modalReservaResidente" class="login-modal internal-reservation-modal hidden"></div>');
        modal = document.getElementById('modalReservaResidente');
    }
    modal.innerHTML = `<div class="login-box internal-reservation-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalReservaResidente').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><p class="section-kicker">Reserva de zona</p><h2>${escapeHtml(zona.nombre)}</h2><p class="muted">Completa tu inmueble y confirma la franja. La reserva se aprobará automáticamente si está disponible.</p><form id="formReservaResidenteModal" class="internal-reservation-form"><label>Inmueble<select name="inmueble_id" required><option value="">Selecciona tu inmueble</option>${inmueblesReservaActuales.map(inmueble => `<option value="${Number(inmueble.id)}">${escapeHtml(inmueble.etiqueta)}</option>`).join('')}</select></label><div class="internal-reservation-time-grid"><label>Fecha<input name="fecha_reserva" type="date" min="${fechaMinimaReserva()}" value="${fecha}" required></label><label>Inicio<input name="hora_inicio" type="time" value="${hora}" required></label><label>Fin<input name="hora_fin" type="time" required></label></div><button class="btn btn-primary" type="submit"><i class="fa-solid fa-calendar-check"></i> Confirmar reserva</button></form></div>`;
    const form = modal.querySelector('form');
    const inicio = form.elements.hora_inicio;
    const fin = form.elements.hora_fin;
    completarFinReservaResidente(inicio, zona, fin);
    inicio.addEventListener('change', () => completarFinReservaResidente(inicio, zona, fin));
    form.onsubmit = async event => {
        event.preventDefault();
        const datos = new FormData(form);
        datos.append('action', 'crear_reserva');
        datos.append('zona_id', zona.id);
        const respuesta = await fetch('api/zonas.php', { method: 'POST', body: datos });
        const resultado = await respuesta.json();
        window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { modal.classList.add('hidden'); await loadZonas(); }
    };
    modal.classList.remove('hidden');
};

renderDisponibilidadResidente = async function () {
    const selectZona = document.getElementById('reservaZonaId');
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selectZona?.value));
    if (!selectZona || !zona || !window.FullCalendar) return;
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!calendario) {
        calendario = document.createElement('section');
        calendario.id = 'calendar-disponibilidad-residente';
        calendario.className = 'resident-zone-calendar';
        document.getElementById('calendar')?.closest('.card')?.insertAdjacentElement('beforebegin', calendario);
    }
    const horario = horarioServicioZona(zona);
    if (!horario) { calendario.innerHTML = '<p class="empty-state">La zona no tiene un horario de servicio válido.</p>'; return; }
    calendario.innerHTML = `<div class="resident-availability-header"><div><p class="section-kicker">Disponibilidad por horas</p><h3>Agenda: ${escapeHtml(zona.nombre)}</h3><p>Selecciona una franja verde para completar tu reserva.</p></div>${leyendaHorarioCalendario()}</div><div class="resident-zone-calendar-body"></div>`;
    const respuesta = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(zona.id)}`);
    const resultado = await respuesta.json();
    const cuerpo = calendario.querySelector('.resident-zone-calendar-body');
    if (resultado.status !== 'success') { cuerpo.innerHTML = `<p class="muted">${escapeHtml(resultado.message)}</p>`; return; }
    if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();
    window.residentAvailabilityCalendar = new FullCalendar.Calendar(cuerpo, {
        initialView: 'timeGridWeek', locale: 'es', height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
        ...opcionesCalendarioHorario(zona),
        events: (resultado.data.reservas || []).map(reserva => eventoReserva(reserva, false)),
        dateClick: info => {
            const fecha = fechaLocal(info.date);
            if (fecha < fechaMinimaReserva()) return window.notificar('Selecciona una fecha futura para reservar.', 'warning');
            if (!momentoEnHorarioServicio(info.date, horario)) return window.notificar(`La zona está fuera de servicio: ${formatearHorarioServicio(horario)}.`, 'warning');
            window.abrirReservaResidente(fecha, horaInicialDesdeClick(info, horario));
        }
    });
    window.residentAvailabilityCalendar.render();
};

const cargarPorteriaConAdjuntos = loadPorteria;
loadPorteria = async function () {
    await cargarPorteriaConAdjuntos();
    const respuesta = await fetch('api/porteria.php?action=list_minuta');
    const resultado = await respuesta.json();
    const tabla = document.getElementById('tb-minuta');
    const cabecera = tabla?.closest('table')?.querySelector('thead tr');
    if (!tabla || resultado.status !== 'success') return;
    if (cabecera) cabecera.innerHTML = '<th>Fecha</th><th>Vigilante</th><th>Asunto</th><th>Adjunto</th>';
    tabla.innerHTML = resultado.data.length ? resultado.data.map(novedad => `<tr><td>${escapeHtml(novedad.fecha_operativa || novedad.fecha_registro)}</td><td>${escapeHtml(novedad.vigilante)}</td><td>${escapeHtml(novedad.asunto)}</td><td>${novedad.adjuntos?.length ? novedad.adjuntos.map(adjunto => `<a href="api/porteria.php?action=ver_adjunto_novedad&adjunto_id=${Number(adjunto.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(adjunto.nombre_original)}</a>`).join('<br>') : '—'}</td></tr>`).join('') : '<tr><td colspan="4">Minuta vacía.</td></tr>';
};

abrirModalPorteria = function (tipo) {
    const modal = document.getElementById('modalPorteria');
    if (!modal) return;
    const form = document.getElementById('formPorteria');
    const opciones = modal.dataset.opciones || '';
    const fechaActual = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const estructuras = {
        visita: ['Registrar visita', `<input name="nombre" placeholder="Nombre del visitante" required><input name="documento" placeholder="Documento (opcional)"><input name="vehiculo_placa" placeholder="Placa (opcional)"><select name="inmueble_id" required><option value="">Unidad visitada…</option>${opciones}</select>`],
        paquete: ['Recibir paquete', `<select name="inmueble_id" required><option value="">Unidad destino…</option>${opciones}</select><input name="transportadora" placeholder="Transportadora" required><textarea name="descripcion" placeholder="Descripción (opcional)"></textarea>`],
        minuta: ['Registrar novedad', `<input name="asunto" maxlength="150" placeholder="Asunto" required><input name="fecha_novedad" type="datetime-local" value="${fechaActual}" required><textarea name="novedad" placeholder="Detalle de la novedad" required></textarea><label class="pqrs-file-field">Adjunto opcional<input name="adjunto" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"><small>JPG, PNG, WEBP o PDF; máximo 5 MB.</small></label>`]
    };
    const [titulo, campos] = estructuras[tipo];
    document.getElementById('porteriaModalTitle').textContent = titulo;
    form.innerHTML = `<input type="hidden" name="action" value="${tipo === 'visita' ? 'registrar_visita' : tipo === 'paquete' ? 'recibir_paquete' : 'registrar_novedad'}">${campos}<button class="btn btn-primary" type="submit">Guardar</button>`;
    modal.classList.remove('hidden');
};

document.addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'formPorteria') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const respuesta = await fetch('api/porteria.php', { method: 'POST', body: new FormData(form) });
    const resultado = await respuesta.json();
    window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
    if (resultado.status === 'success') { document.getElementById('modalPorteria')?.classList.add('hidden'); await loadPorteria(); }
}, true);

function agregarOjoContrasena(input) {
    if (!input || input.dataset.ojoContrasena || input.id === 'loginPassword' || input.closest('.password-visibility-wrap')) return;
    input.dataset.ojoContrasena = '1';
    const contenedor = document.createElement('span');
    contenedor.className = 'password-visibility-wrap';
    input.parentNode.insertBefore(contenedor, input);
    contenedor.appendChild(input);
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'password-visibility-toggle'; boton.setAttribute('aria-label', 'Mostrar contraseña');
    boton.innerHTML = '<i class="fa-solid fa-eye"></i>';
    boton.onclick = () => { const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña'); boton.innerHTML = `<i class="fa-solid fa-eye${visible ? '' : '-slash'}"></i>`; };
    contenedor.appendChild(boton);
}
function prepararOjosContrasena(nodo = document) { nodo.querySelectorAll?.('input[type="password"]').forEach(agregarOjoContrasena); }
prepararOjosContrasena();
new MutationObserver(registros => registros.forEach(registro => registro.addedNodes.forEach(nodo => { if (nodo.nodeType === Node.ELEMENT_NODE) { if (nodo.matches?.('input[type="password"]')) agregarOjoContrasena(nodo); prepararOjosContrasena(nodo); } }))).observe(document.body, { childList: true, subtree: true });


/* Consolidación operativa 2026-08-11: una capa final para los flujos críticos. */
const cargarZonasConModalResidenteBase = loadZonas;
const cargarMisPagosConSoportesBase = loadMisPagos;
const cargarFinanzasConSoportesBase = window.loadFinanzas || loadFinanzas;
const cargarComunicacionesModalBase = window.loadComunicaciones || loadComunicaciones;
const cargarInicioResidenteActivosBase = loadHomeResidente;
const abrirVigilanteConAccionBase = window.abrirModalVigilante;
const verificarSesionConMarcaBase = checkAuth;

function enlaceSoportePago(pago) {
    return pago?.soporte_archivo
        ? `<a class="payment-support-link" href="api/finanzas.php?action=ver_soporte&pago_id=${Number(pago.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> Ver soporte</a>`
        : '<span class="muted">—</span>';
}

async function aplicarMarcaPortal() {
    try {
        const respuesta = await fetch('api/conjuntos.php?action=public_config', { cache: 'no-store' });
        const resultado = await respuesta.json();
        if (resultado.status !== 'success') return;
        const marca = resultado.data || {};
        const nombre = String(marca.nombre || 'ResiPortal');
        const logo = String(marca.logo_url || '');
        document.title = `${nombre} · Portal residencial`;
        document.querySelectorAll('.public-nav .logo, .sidebar .logo').forEach(contenedor => {
            contenedor.innerHTML = logo
                ? `<img class="conjunto-brand-logo" src="${escapeHtml(logo)}" alt="Logo de ${escapeHtml(nombre)}"><span>${escapeHtml(nombre)}</span>`
                : '<i class="fa-solid fa-building-user" aria-hidden="true"></i><span></span>';
            contenedor.querySelector('span').textContent = nombre;
        });
        document.querySelectorAll('.page-title').forEach(titulo => {
            if (/Bienvenido a ResiPortal/i.test(titulo.textContent)) titulo.textContent = `Bienvenido a ${nombre}`;
        });
        let favicon = document.getElementById('app-favicon');
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.id = 'app-favicon';
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = logo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="14" fill="%234f46e5"/%3E%3Cpath fill="white" d="M14 51V22l18-9 18 9v29H14zm8-8h6v-9h8v9h6V26l-10-5-10 5v17z"/%3E%3C/svg%3E';
    } catch (error) {
        console.warn('No fue posible cargar la marca del conjunto.', error);
    }
}

checkAuth = async function () {
    await verificarSesionConMarcaBase();
    await aplicarMarcaPortal();
};

window.abrirModalVigilante = function (...argumentos) {
    abrirVigilanteConAccionBase?.(...argumentos);
    const form = document.getElementById('formVigilante');
    if (form && !form.querySelector('[name="action"]')) {
        form.insertAdjacentHTML('afterbegin', '<input type="hidden" name="action" value="guardar_vigilante">');
    }
};

function prepararPanelReservaResidente() {
    const panel = document.getElementById('panelReservarZona');
    const selector = document.getElementById('reservaZonaId');
    if (!panel || !selector) return;
    const etiqueta = document.createElement('label');
    etiqueta.className = 'resident-zone-select';
    etiqueta.innerHTML = '<span>Zona social</span>';
    etiqueta.appendChild(selector);
    panel.replaceChildren(etiqueta);
    selector.onchange = () => renderDisponibilidadResidente();
}

window.abrirReservaResidente = function (fecha, hora) {
    const selector = document.getElementById('reservaZonaId');
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selector?.value));
    if (!zona) return window.notificar('Selecciona una zona antes de elegir una franja.', 'warning');
    if (!inmueblesReservaActuales.length) return window.notificar('No tienes un apartamento o casa asociado para reservar.', 'error');
    let modal = document.getElementById('modalReservaResidente');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', '<div id="modalReservaResidente" class="login-modal internal-reservation-modal hidden"></div>');
        modal = document.getElementById('modalReservaResidente');
    }
    const variosInmuebles = inmueblesReservaActuales.length > 1;
    const inmuebleUnico = inmueblesReservaActuales[0];
    const campoInmueble = variosInmuebles
        ? `<label>Apartamento o casa<select name="inmueble_id" required><option value="">Selecciona el inmueble…</option>${inmueblesReservaActuales.map(inmueble => `<option value="${Number(inmueble.id)}">${escapeHtml(inmueble.etiqueta)}</option>`).join('')}</select></label>`
        : `<input type="hidden" name="inmueble_id" value="${Number(inmuebleUnico.id)}"><p class="reservation-unit-note"><i class="fa-solid fa-house"></i> Reserva para ${escapeHtml(inmuebleUnico.etiqueta)}</p>`;
    modal.innerHTML = `<div class="login-box internal-reservation-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalReservaResidente').classList.add('hidden')" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button><p class="section-kicker">Reserva de zona</p><h2>${escapeHtml(zona.nombre)}</h2><p class="muted">Confirma la franja. Si sigue disponible, se aprobará automáticamente.</p><form id="formReservaResidenteModal" class="internal-reservation-form">${campoInmueble}<div class="internal-reservation-time-grid"><label>Fecha<input name="fecha_reserva" type="date" min="${fechaMinimaReserva()}" value="${fecha}" required></label><label>Inicio<input name="hora_inicio" type="time" value="${hora}" required></label><label>Fin<input name="hora_fin" type="time" required></label></div><button class="btn btn-primary" type="submit"><i class="fa-solid fa-calendar-check"></i> Confirmar reserva</button></form></div>`;
    const form = modal.querySelector('form');
    const inicio = form.elements.hora_inicio;
    const fin = form.elements.hora_fin;
    completarFinReservaResidente(inicio, zona, fin);
    inicio.addEventListener('change', () => completarFinReservaResidente(inicio, zona, fin));
    form.onsubmit = async evento => {
        evento.preventDefault();
        const boton = form.querySelector('[type="submit"]');
        boton.disabled = true;
        const datos = new FormData(form);
        datos.append('action', 'crear_reserva');
        datos.append('zona_id', zona.id);
        try {
            const respuesta = await fetch('api/zonas.php', { method: 'POST', body: datos });
            const resultado = await respuesta.json();
            window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
            if (resultado.status === 'success') {
                modal.classList.add('hidden');
                await loadZonas();
            }
        } finally {
            boton.disabled = false;
        }
    };
    modal.classList.remove('hidden');
};

renderDisponibilidadResidente = async function () {
    const selector = document.getElementById('reservaZonaId');
    const zona = zonasReservaActuales.find(item => Number(item.id) === Number(selector?.value));
    let calendario = document.getElementById('calendar-disponibilidad-residente');
    if (!selector || !window.FullCalendar) return;
    if (!calendario) {
        calendario = document.createElement('section');
        calendario.id = 'calendar-disponibilidad-residente';
        calendario.className = 'resident-zone-calendar';
        document.getElementById('calendar')?.closest('.card')?.insertAdjacentElement('beforebegin', calendario);
    }
    if (!zona) {
        calendario.innerHTML = '<p class="muted">Selecciona una zona para consultar sus horarios disponibles.</p>';
        return;
    }
    const horario = horarioServicioZona(zona);
    if (!horario) {
        calendario.innerHTML = '<p class="empty-state">La zona no tiene un horario de servicio válido.</p>';
        return;
    }
    calendario.innerHTML = `<div class="resident-availability-header"><div><p class="section-kicker">Disponibilidad por horas</p><h3>Agenda: ${escapeHtml(zona.nombre)}</h3><p>Elige una franja verde. Solo verás disponibilidad, nunca quién reservó.</p></div>${leyendaHorarioCalendario()}</div><div class="resident-zone-calendar-body"></div>`;
    const cuerpo = calendario.querySelector('.resident-zone-calendar-body');
    try {
        const respuesta = await fetch(`api/zonas.php?action=zona_disponibilidad&zona_id=${encodeURIComponent(zona.id)}`, { cache: 'no-store' });
        const resultado = await respuesta.json();
        if (resultado.status !== 'success') throw new Error(resultado.message);
        if (window.residentAvailabilityCalendar) window.residentAvailabilityCalendar.destroy();
        window.residentAvailabilityCalendar = new FullCalendar.Calendar(cuerpo, {
            initialView: 'timeGridWeek', locale: 'es', height: 'auto',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
            ...opcionesCalendarioHorario(zona),
            events: (resultado.data.reservas || []).map(reserva => ({
                id: String(reserva.id || ''), title: 'Ocupado', start: `${reserva.fecha_reserva}T${reserva.hora_inicio || '00:00'}`,
                end: reserva.hora_fin ? `${reserva.fecha_reserva}T${reserva.hora_fin}` : undefined, classNames: ['zona-calendar-reserva'], editable: false
            })),
            dateClick: info => {
                const fecha = fechaLocal(info.date);
                if (fecha < fechaMinimaReserva()) return window.notificar('Selecciona una fecha futura para reservar.', 'warning');
                const hora = info.allDay ? horario.apertura : horaInicialDesdeClick(info, horario);
                if (!info.allDay && !momentoEnHorarioServicio(info.date, horario)) return window.notificar(`La zona está fuera de servicio: ${formatearHorarioServicio(horario)}.`, 'warning');
                window.abrirReservaResidente(fecha, hora);
            }
        });
        window.residentAvailabilityCalendar.render();
    } catch (error) {
        cuerpo.innerHTML = `<p class="muted">${escapeHtml(error.message || 'No fue posible cargar la disponibilidad.')}</p>`;
    }
};

loadZonas = async function () {
    await cargarZonasConModalResidenteBase();
    if (!['residente', 'propietario'].includes(currentUser?.rol)) return;
    prepararPanelReservaResidente();
    await renderDisponibilidadResidente();
};

window.cancelarMiReserva = async function (reservaId) {
    const confirmar = await confirmarAccion({ titulo: '¿Cancelar reserva?', texto: 'La franja volverá a estar disponible; el registro permanecerá en el historial.', confirmar: 'Cancelar reserva', icono: 'warning' });
    if (!confirmar) return;
    const datos = new FormData();
    datos.append('action', 'cancelar_reserva');
    datos.append('reserva_id', reservaId);
    const respuesta = await fetch('api/zonas.php', { method: 'POST', body: datos });
    const resultado = await respuesta.json();
    window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
    if (resultado.status === 'success') await loadZonas();
};

loadMisPagos = async function () {
    await cargarMisPagosConSoportesBase();
    const respuesta = await fetch('api/finanzas.php?action=mis_pagos');
    const resultado = await respuesta.json();
    const tabla = document.getElementById('tb-mis-pagos');
    if (!tabla || resultado.status !== 'success') return;
    const cabecera = tabla.closest('table')?.querySelector('thead tr');
    if (cabecera) cabecera.innerHTML = '<th>Fecha</th><th>Valor</th><th>Método</th><th>Referencia / descripción</th><th>Soporte</th><th>Estado</th>';
    const pagos = resultado.data?.historial || [];
    tabla.innerHTML = pagos.length ? pagos.map(pago => `<tr><td>${escapeHtml(pago.fecha_pago)}</td><td>${formatCurrency(pago.valor)}</td><td>${escapeHtml(pago.metodo_pago)}</td><td>${escapeHtml(pago.referencia || '—')}<br><small>${escapeHtml(pago.descripcion || 'Sin descripción')}</small></td><td>${enlaceSoportePago(pago)}</td><td><span class="reserva-estado estado-${escapeHtml(pago.estado)}">${escapeHtml(pago.estado)}</span></td></tr>`).join('') : '<tr><td colspan="6">No has reportado pagos.</td></tr>';
};

loadFinanzas = window.loadFinanzas = async function () {
    await cargarFinanzasConSoportesBase();
    const [pendientesR, historialR] = await Promise.all([fetch('api/finanzas.php?action=pagos_pendientes'), fetch('api/finanzas.php?action=historial_pagos')]);
    const [pendientes, historial] = await Promise.all([pendientesR.json(), historialR.json()]);
    const tablaPendientes = document.getElementById('tb-pagos-pendientes');
    if (tablaPendientes && pendientes.status === 'success') {
        const cabecera = tablaPendientes.closest('table')?.querySelector('thead tr');
        if (cabecera) cabecera.innerHTML = '<th>Apto</th><th>Residente</th><th>Valor</th><th>Referencia</th><th>Soporte</th><th>Acciones</th>';
        tablaPendientes.innerHTML = pendientes.data.length ? pendientes.data.map(pago => `<tr><td>${escapeHtml([pago.torre, pago.nomenclatura || pago.apartamento].filter(Boolean).join(' · '))}</td><td>${escapeHtml(pago.residente || '—')}</td><td>${formatCurrency(pago.valor)}</td><td>${escapeHtml(pago.referencia || '—')}<br><small>${escapeHtml(pago.descripcion || '')}</small></td><td>${enlaceSoportePago(pago)}</td><td class="finance-action-cell"><button class="btn btn-primary" type="button" onclick="aprobarPago(${Number(pago.id)}, 'aprobado')">Aprobar</button><button class="btn btn-ghost" type="button" style="color:#dc2626" onclick="aprobarPago(${Number(pago.id)}, 'rechazado')">Rechazar</button></td></tr>`).join('') : '<tr><td colspan="6">No hay pagos pendientes de aprobación.</td></tr>';
    }
    const tablaHistorial = document.getElementById('tb-historial-pagos');
    if (tablaHistorial && historial.status === 'success') {
        const cabecera = tablaHistorial.closest('table')?.querySelector('thead tr');
        if (cabecera) cabecera.innerHTML = '<th>Fecha</th><th>Apto</th><th>Valor</th><th>Método</th><th>Descripción</th><th>Soporte</th><th>Registrado por</th>';
        tablaHistorial.innerHTML = historial.data.length ? historial.data.map(pago => `<tr><td>${escapeHtml(pago.fecha_pago)}</td><td>${escapeHtml([pago.torre, pago.nomenclatura || pago.apartamento].filter(Boolean).join(' · '))}</td><td>${formatCurrency(pago.valor)}</td><td>${escapeHtml(pago.metodo_pago)}</td><td>${escapeHtml(pago.descripcion || pago.referencia || '—')}</td><td>${enlaceSoportePago(pago)}</td><td>${escapeHtml(pago.registrado_por_nombre || '—')}</td></tr>`).join('') : '<tr><td colspan="7">No hay pagos registrados.</td></tr>';
    }
};

function normalizarModalContenido(id) {
    const modal = document.getElementById(id);
    if (!modal || modal.dataset.normalizado === '1') return;
    modal.dataset.normalizado = '1';
    modal.className = 'login-modal content-management-modal hidden';
    const contenido = modal.innerHTML;
    modal.innerHTML = `<div class="login-box content-management-dialog">${contenido}</div>`;
}

window.loadComunicaciones = async function () {
    normalizarModalContenido('modalEvento');
    normalizarModalContenido('modalComunicado');
    await cargarComunicacionesModalBase();
    document.querySelectorAll('[data-content-modal]').forEach(boton => boton.onclick = () => prepararModalContenido(boton.dataset.contentModal));
    [...document.querySelectorAll('button')].forEach(boton => {
        if (boton.textContent.includes('Nuevo Evento')) boton.onclick = () => prepararModalContenido('evento');
        if (boton.textContent.includes('Publicar novedad')) boton.onclick = () => prepararModalContenido('comunicado');
    });
};
loadComunicaciones = window.loadComunicaciones;

function adjuntosPQRSHtml(adjuntos = []) {
    if (!adjuntos.length) return '<span class="muted">Sin adjuntos</span>';
    return `<div class="pqrs-detail-files">${adjuntos.map(adjunto => `<a href="api/reclamaciones.php?action=ver_adjunto&adjunto_id=${Number(adjunto.id)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(adjunto.nombre_original)}</a>`).join('')}</div>`;
}

window.abrirDetalleReclamacion = async function (reclamacionId) {
    const respuesta = await fetch(`api/reclamaciones.php?action=detalle&reclamacion_id=${encodeURIComponent(reclamacionId)}`);
    const resultado = await respuesta.json();
    if (resultado.status !== 'success') return window.notificar(resultado.message, 'error');
    const { reclamacion, adjuntos = [], notas = [] } = resultado.data;
    let modal = document.getElementById('modalDetallePQRS');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', '<div id="modalDetallePQRS" class="login-modal pqrs-detail-modal hidden"></div>');
        modal = document.getElementById('modalDetallePQRS');
    }
    const esAdmin = currentUser?.rol === 'admin';
    const timeline = notas.length ? notas.map(nota => `<article class="pqrs-timeline-item ${Number(nota.es_solucion) ? 'is-solution' : ''}"><header><strong>${escapeHtml(nota.autor)}</strong><span>${escapeHtml(nota.autor_rol)} · ${escapeHtml(nota.creado_en)}</span></header><p>${escapeHtml(nota.contenido)}</p>${adjuntosPQRSHtml(nota.adjuntos)}</article>`).join('') : '<p class="muted">Aún no hay notas de seguimiento.</p>';
    const controlAdmin = esAdmin ? `<form id="formEstadoPQRS" class="pqrs-admin-form"><label>Estado<select name="estado"><option value="abierto" ${reclamacion.estado === 'abierto' ? 'selected' : ''}>Abierto</option><option value="en_progreso" ${reclamacion.estado === 'en_progreso' ? 'selected' : ''}>En progreso</option><option value="cerrado" ${reclamacion.estado === 'cerrado' ? 'selected' : ''}>Cerrado / solucionado</option></select></label><label>Solución final<textarea name="solucion" placeholder="Obligatoria para cerrar el caso">${escapeHtml(reclamacion.solucion || '')}</textarea></label><button class="btn btn-primary" type="submit">Actualizar seguimiento</button></form>` : `<form id="formNotaPQRS" class="pqrs-note-form" enctype="multipart/form-data"><h3>Agregar información</h3><textarea name="contenido" required placeholder="Escribe una aclaración o avance para administración"></textarea><label class="pqrs-file-field">Capturas o adjuntos<input name="adjuntos[]" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.webm,.mov"><small>Máximo cinco archivos por nota.</small></label><button class="btn btn-primary" type="submit">Agregar nota</button></form>`;
    modal.innerHTML = `<div class="login-box pqrs-detail-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalDetallePQRS').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><header class="pqrs-detail-heading"><p class="section-kicker">PQRS #${Number(reclamacion.id)}</p><h2>${escapeHtml(reclamacion.asunto)}</h2><p>${escapeHtml(reclamacion.categoria || 'General')} · ${escapeHtml(reclamacion.creado_en)}</p><span class="reserva-estado estado-${escapeHtml(reclamacion.estado)}">${escapeHtml(reclamacion.estado)}</span></header><section class="pqrs-original"><h3>Solicitud inicial</h3><p>${escapeHtml(reclamacion.descripcion)}</p>${adjuntosPQRSHtml(adjuntos)}</section><section class="pqrs-timeline"><h3>Seguimiento</h3>${timeline}</section>${controlAdmin}</div>`;
    const formularioNota = modal.querySelector('#formNotaPQRS');
    if (formularioNota) formularioNota.onsubmit = async evento => {
        evento.preventDefault(); const datos = new FormData(formularioNota); datos.append('action', 'agregar_nota'); datos.append('reclamacion_id', reclamacionId);
        const r = await fetch('api/reclamaciones.php', { method: 'POST', body: datos }); const d = await r.json();
        window.notificar(d.message, d.status === 'success' ? 'success' : 'error'); if (d.status === 'success') { await loadReclamaciones(); window.abrirDetalleReclamacion(reclamacionId); }
    };
    const formularioEstado = modal.querySelector('#formEstadoPQRS');
    if (formularioEstado) formularioEstado.onsubmit = async evento => {
        evento.preventDefault(); const datos = new FormData(formularioEstado); datos.append('action', 'actualizar_estado'); datos.append('reclamacion_id', reclamacionId);
        const r = await fetch('api/reclamaciones.php', { method: 'POST', body: datos }); const d = await r.json();
        window.notificar(d.message, d.status === 'success' ? 'success' : 'error'); if (d.status === 'success') { await loadReclamaciones(); window.abrirDetalleReclamacion(reclamacionId); }
    };
    modal.classList.remove('hidden');
};

loadReclamaciones = async function () {
    const respuesta = await fetch('api/reclamaciones.php?action=list');
    const resultado = await respuesta.json();
    const tabla = document.getElementById('tb-reclamaciones');
    if (!tabla || resultado.status !== 'success') return resultado.status !== 'success' && window.notificar(resultado.message, 'error');
    const cabecera = tabla.closest('table')?.querySelector('thead tr');
    if (cabecera) cabecera.innerHTML = '<th>Asunto</th><th>Usuario</th><th>Fecha</th><th>Estado</th><th>Adjuntos</th><th>Seguimiento</th>';
    tabla.innerHTML = resultado.data.length ? resultado.data.map(item => `<tr><td><strong>${escapeHtml(item.asunto)}</strong><br><small>${escapeHtml(item.categoria || 'General')}</small></td><td>${escapeHtml(item.usuario_nombre || 'Tú')}</td><td>${escapeHtml(item.creado_en)}</td><td><span class="reserva-estado estado-${escapeHtml(item.estado)}">${escapeHtml(item.estado)}</span></td><td>${item.adjuntos?.length ? `<i class="fa-solid fa-paperclip"></i> ${item.adjuntos.length}` : '—'}</td><td><button type="button" class="btn btn-ghost pqrs-follow-button" onclick="window.abrirDetalleReclamacion(${Number(item.id)})">Ver seguimiento</button></td></tr>`).join('') : '<tr><td colspan="6">No hay PQRS radicadas.</td></tr>';
};

async function abrirEditorActivo(tipo, activo, inmuebleId) {
    let modal = document.getElementById('modalEditarActivo');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', '<div id="modalEditarActivo" class="login-modal hidden"></div>'); modal = document.getElementById('modalEditarActivo'); }
    const esVehiculo = tipo === 'vehiculo';
    modal.innerHTML = `<div class="login-box asset-editor-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalEditarActivo').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><h2>Editar ${esVehiculo ? 'vehículo' : 'mascota'}</h2><form class="stack-form">${esVehiculo ? `<input name="placa" value="${escapeHtml(activo.placa)}" required><input name="tipo" value="${escapeHtml(activo.tipo || '')}" required><input name="marca" value="${escapeHtml(activo.marca || '')}" placeholder="Marca"><input name="linea" value="${escapeHtml(activo.linea || '')}" placeholder="Línea">` : `<textarea name="descripcion" required>${escapeHtml(activo.descripcion || '')}</textarea>`}<button class="btn btn-primary" type="submit">Guardar cambios</button></form></div>`;
    modal.querySelector('form').onsubmit = async evento => { evento.preventDefault(); const datos = new FormData(evento.currentTarget); datos.append('action', `actualizar_${tipo}`); datos.append(`${tipo}_id`, activo.id); const r = await fetch('api/inmuebles.php', { method: 'POST', body: datos }); const d = await r.json(); window.notificar(d.message, d.status === 'success' ? 'success' : 'error'); if (d.status === 'success') { modal.classList.add('hidden'); if (currentUser?.rol === 'admin') window.abrirDetalleInmueble(inmuebleId); else loadHomeResidente(); } };
    modal.classList.remove('hidden');
}

window.eliminarActivoInmueble = async function (tipo, activoId, inmuebleId) {
    if (!await confirmarAccion({ titulo: `¿Eliminar ${tipo}?`, texto: 'Esta acción no se puede deshacer.', confirmar: 'Eliminar', icono: 'warning' })) return;
    const datos = new FormData(); datos.append('action', `eliminar_${tipo}`); datos.append(`${tipo}_id`, activoId);
    const respuesta = await fetch('api/inmuebles.php', { method: 'POST', body: datos }); const resultado = await respuesta.json();
    window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
    if (resultado.status === 'success') { if (currentUser?.rol === 'admin') window.abrirDetalleInmueble(inmuebleId); else loadHomeResidente(); }
};

window.abrirDetalleInmueble = async function (inmuebleId) {
    const [detalleR, usuariosR] = await Promise.all([fetch(`api/inmuebles.php?action=detalle&inmueble_id=${encodeURIComponent(inmuebleId)}`), fetch('api/users.php?action=list')]);
    const [detalle, usuarios] = await Promise.all([detalleR.json(), usuariosR.json()]);
    if (detalle.status !== 'success') return window.notificar(detalle.message, 'error');
    const { inmueble, vehiculos = [], mascotas = [] } = detalle.data;
    const vistos = new Set();
    const personas = (detalle.data.personas || []).filter(persona => { const clave = `${persona.id}:${persona.tipo_relacion}`; if (vistos.has(clave)) return false; vistos.add(clave); return true; });
    let modal = document.getElementById('modalDetalleInmueble');
    if (!modal) { document.body.insertAdjacentHTML('beforeend', '<div id="modalDetalleInmueble" class="login-modal detalle-inmueble-modal hidden"></div>'); modal = document.getElementById('modalDetalleInmueble'); }
    const personasHtml = personas.length ? personas.map(persona => `<article class="inmueble-person-card"><span class="inmueble-person-icon"><i class="fa-solid ${persona.tipo_relacion === 'propietario' ? 'fa-key' : 'fa-house-user'}"></i></span><div><strong>${escapeHtml(persona.nombre)}</strong><small>${escapeHtml(persona.tipo_relacion)} · ${Number(persona.tiene_cuenta) ? 'Acceso al portal' : 'Solo directorio'}</small><small>${escapeHtml(persona.contacto || persona.email || 'Sin contacto')}</small></div></article>`).join('') : '<p class="empty-state">No hay personas vinculadas.</p>';
    const opcionesPersonas = usuarios.status === 'success' ? usuarios.data.filter(persona => ['residente', 'propietario'].includes(persona.rol)).map(persona => `<option value="${Number(persona.id)}">${escapeHtml(persona.nombre)} · ${escapeHtml(persona.documento)}</option>`).join('') : '';
    const activosHtml = (tipo, lista) => lista.length ? `<div class="asset-list">${lista.map(activo => `<article><div><strong>${escapeHtml(tipo === 'vehiculo' ? activo.placa : activo.descripcion)}</strong><small>${escapeHtml(tipo === 'vehiculo' ? [activo.tipo, activo.marca, activo.linea].filter(Boolean).join(' · ') : 'Registrada en el inmueble')}</small></div><div class="asset-actions"><button class="btn btn-ghost" type="button" onclick='abrirEditorActivo("${tipo}", ${JSON.stringify(activo).replace(/'/g, '&#39;')}, ${Number(inmuebleId)})'>Editar</button><button class="btn btn-ghost" type="button" style="color:#dc2626" onclick="window.eliminarActivoInmueble('${tipo}', ${Number(activo.id)}, ${Number(inmuebleId)})">Eliminar</button></div></article>`).join('')}</div>` : '<p class="muted">Sin registros.</p>';
    modal.innerHTML = `<div class="login-box inmueble-detail-dialog"><button class="close-btn" type="button" onclick="document.getElementById('modalDetalleInmueble').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button><header class="inmueble-detail-heading"><div><p class="section-kicker">Ficha del inmueble</p><h2>${escapeHtml(inmueble.nomenclatura || inmueble.apartamento)}</h2><p>${escapeHtml(inmueble.tipo_unidad)} · ${escapeHtml(inmueble.torre || 'Sin torre')}</p></div><div class="inmueble-summary-actions"><strong>${formatCurrency(inmueble.mora_actual)}</strong><button class="btn btn-ghost" type="button" onclick="window.verHistorialInmueble(${Number(inmuebleId)})"><i class="fa-solid fa-clock-rotate-left"></i> Parqueaderos</button></div></header><section class="inmueble-detail-section"><div class="inmueble-section-title"><h3>Personas vinculadas</h3><button class="btn btn-primary" type="button" onclick="window.abrirPersonaDesdeInmueble(${Number(inmuebleId)})">Agregar persona</button></div><div class="inmueble-person-grid">${personasHtml}</div><form id="formVincularUsuarioInmueble" class="inmueble-link-form"><input type="hidden" name="inmueble_id" value="${Number(inmuebleId)}"><label>Persona<select name="usuario_id" required><option value="">Selecciona una persona…</option>${opcionesPersonas}</select></label><label>Relación<select name="tipo_relacion" required><option value="residente">Residente</option><option value="propietario">Propietario</option></select></label><button class="btn btn-ghost" type="submit">Vincular</button></form></section><section class="inmueble-detail-grid"><div class="inmueble-detail-section"><h3><i class="fa-solid fa-car"></i> Vehículos</h3>${activosHtml('vehiculo', vehiculos)}</div><div class="inmueble-detail-section"><h3><i class="fa-solid fa-paw"></i> Mascotas</h3>${activosHtml('mascota', mascotas)}</div></section></div>`;
    modal.querySelector('#formVincularUsuarioInmueble').onsubmit = async evento => { evento.preventDefault(); const datos = new FormData(evento.currentTarget); datos.append('action', 'vincular_usuario'); const r = await fetch('api/inmuebles.php', { method: 'POST', body: datos }); const d = await r.json(); window.notificar(d.message, d.status === 'success' ? 'success' : 'error'); if (d.status === 'success') window.abrirDetalleInmueble(inmuebleId); };
    modal.classList.remove('hidden');
};

window.verHistorialInmueble = async function (inmuebleId) {
    const respuesta = await fetch(`api/parqueaderos.php?action=historial_inmueble&inmueble_id=${encodeURIComponent(inmuebleId)}`); const resultado = await respuesta.json();
    if (resultado.status !== 'success') return window.notificar(resultado.message, 'error');
    const filas = resultado.data.length ? resultado.data.map(item => `<tr><td><strong>${escapeHtml(item.codigo)}</strong><br><small>${escapeHtml(item.tipo)}</small></td><td>${escapeHtml(item.asignado_en)}</td><td>${item.retirado_en ? escapeHtml(item.retirado_en) : '<span class="reserva-estado estado-aprobada">Vigente</span>'}</td><td>${escapeHtml(item.motivo_retiro || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No hay asignaciones registradas.</td></tr>';
    if (window.Swal) Swal.fire({ title: 'Historial de parqueaderos', html: `<div class="parking-history-dialog"><table class="data-table"><thead><tr><th>Cupo</th><th>Asignado</th><th>Retirado</th><th>Motivo</th></tr></thead><tbody>${filas}</tbody></table></div>`, width: 850, confirmButtonText: 'Cerrar' });
};

window.verHistorialParqueadero = async function (parqueaderoId, codigo) {
    const respuesta = await fetch(`api/parqueaderos.php?action=historial&parqueadero_id=${encodeURIComponent(parqueaderoId)}`); const resultado = await respuesta.json();
    if (resultado.status !== 'success') return window.notificar(resultado.message, 'error');
    const filas = resultado.data.length ? resultado.data.map(item => `<tr><td>${escapeHtml([item.torre, item.nomenclatura || item.apartamento].filter(Boolean).join(' · '))}</td><td>${escapeHtml(item.asignado_en)}</td><td>${escapeHtml(item.retirado_en || 'Vigente')}</td><td>${escapeHtml(item.motivo_retiro || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No hay asignaciones registradas.</td></tr>';
    if (window.Swal) Swal.fire({ title: `Historial ${escapeHtml(codigo)}`, html: `<div class="parking-history-dialog"><table class="data-table"><thead><tr><th>Inmueble</th><th>Asignado</th><th>Retirado</th><th>Motivo</th></tr></thead><tbody>${filas}</tbody></table></div>`, width: 850, confirmButtonText: 'Cerrar' });
};

loadHomeResidente = async function () {
    await cargarInicioResidenteActivosBase();
    const [vehiculosR, mascotasR] = await Promise.all([fetch('api/inmuebles.php?action=mis_vehiculos'), fetch('api/inmuebles.php?action=mis_mascotas')]);
    const [vehiculos, mascotas] = await Promise.all([vehiculosR.json(), mascotasR.json()]);
    const tablaVehiculos = document.getElementById('tb-mis-vehiculos');
    if (tablaVehiculos && vehiculos.status === 'success') {
        const cabecera = tablaVehiculos.closest('table')?.querySelector('thead tr'); if (cabecera) cabecera.innerHTML = '<th>Placa</th><th>Tipo</th><th>Marca</th><th>Acciones</th>';
        tablaVehiculos.innerHTML = vehiculos.data.length ? vehiculos.data.map(item => `<tr><td>${escapeHtml(item.placa)}</td><td>${escapeHtml(item.tipo)}</td><td>${escapeHtml([item.marca, item.linea].filter(Boolean).join(' · ') || '—')}</td><td class="asset-actions"><button class="btn btn-ghost" onclick='abrirEditorActivo("vehiculo", ${JSON.stringify(item).replace(/'/g, '&#39;')}, ${Number(item.inmueble_id || 0)})'>Editar</button><button class="btn btn-ghost" style="color:#dc2626" onclick="window.eliminarActivoInmueble('vehiculo', ${Number(item.id)}, 0)">Eliminar</button></td></tr>`).join('') : '<tr><td colspan="4">Aún no tienes vehículos registrados.</td></tr>';
    }
    const tablaMascotas = document.getElementById('tb-mis-mascotas');
    if (tablaMascotas && mascotas.status === 'success') {
        const cabecera = tablaMascotas.closest('table')?.querySelector('thead tr'); if (cabecera) cabecera.innerHTML = '<th>Descripción</th><th>Acciones</th>';
        tablaMascotas.innerHTML = mascotas.data.length ? mascotas.data.map(item => `<tr><td>${escapeHtml(item.descripcion)}</td><td class="asset-actions"><button class="btn btn-ghost" onclick='abrirEditorActivo("mascota", ${JSON.stringify(item).replace(/'/g, '&#39;')}, ${Number(item.inmueble_id || 0)})'>Editar</button><button class="btn btn-ghost" style="color:#dc2626" onclick="window.eliminarActivoInmueble('mascota', ${Number(item.id)}, 0)">Eliminar</button></td></tr>`).join('') : '<tr><td colspan="2">Aún no tienes mascotas registradas.</td></tr>';
    }
    await aplicarMarcaPortal();
};


const cargarConfiguracionConMarcaBase = loadConfiguracion;
loadConfiguracion = async function () {
    await cargarConfiguracionConMarcaBase();
    const formulario = document.getElementById('formConfiguracion');
    formulario?.addEventListener('submit', () => window.setTimeout(aplicarMarcaPortal, 500));
};


/* PQRS: administración también puede añadir notas y evidencias sin cerrar el caso. */
const abrirDetallePQRSConNotasAdminBase = window.abrirDetalleReclamacion;
window.abrirDetalleReclamacion = async function (reclamacionId) {
    await abrirDetallePQRSConNotasAdminBase(reclamacionId);
    if (currentUser?.rol !== 'admin') return;
    const modal = document.getElementById('modalDetallePQRS');
    const formularioEstado = modal?.querySelector('#formEstadoPQRS');
    if (!modal || !formularioEstado || modal.querySelector('#formNotaPQRS')) return;
    formularioEstado.insertAdjacentHTML('afterend', '<form id="formNotaPQRS" class="pqrs-note-form" enctype="multipart/form-data"><h3>Agregar nota de seguimiento</h3><textarea name="contenido" required placeholder="Registra una gestión, respuesta o avance para el residente"></textarea><label class="pqrs-file-field">Adjuntar evidencia opcional<input name="adjuntos[]" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.webm,.mov"><small>Máximo cinco archivos por nota.</small></label><button class="btn btn-primary" type="submit">Agregar nota</button></form>');
    const formularioNota = modal.querySelector('#formNotaPQRS');
    formularioNota.onsubmit = async evento => {
        evento.preventDefault();
        const datos = new FormData(formularioNota);
        datos.append('action', 'agregar_nota');
        datos.append('reclamacion_id', reclamacionId);
        const respuesta = await fetch('api/reclamaciones.php', { method: 'POST', body: datos });
        const resultado = await respuesta.json();
        window.notificar(resultado.message, resultado.status === 'success' ? 'success' : 'error');
        if (resultado.status === 'success') { await loadReclamaciones(); window.abrirDetalleReclamacion(reclamacionId); }
    };
};
