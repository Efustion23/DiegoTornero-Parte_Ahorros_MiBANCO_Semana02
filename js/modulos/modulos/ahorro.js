/**
 * @file ahorro.js
 * @description Módulo de Cuenta de Ahorro — Mi Banco
 */

import { supabase, requireAuth, formatSoles, formatFecha, showToast } from '../supabase.js';

// ── State ────────────────────────────────────────────────────────────────
let currentUser = null;
let cuentaAhorro = null;
let chartProgreso = null;
let chartProyeccion = null;

// ── UI Elements ──────────────────────────────────────────────────────────
const ui = {
  userName: document.getElementById('userName'),
  btnLogout: document.getElementById('btnLogout'),
  loadingAhorro: document.getElementById('loadingAhorro'),
  contenidoAhorro: document.getElementById('contenidoAhorro'),
  saldoAhorro: document.getElementById('saldoAhorro'),
  tasaAhorro: document.getElementById('tasaAhorro'),
  fechaApertura: document.getElementById('fechaApertura'),
  metaAhorro: document.getElementById('metaAhorro'),
  numCuentaAhorro: document.getElementById('numCuentaAhorro'),
  saldoProgreso: document.getElementById('saldoProgreso'),
  metaProgreso: document.getElementById('metaProgreso'),
  pctProgreso: document.getElementById('pctProgreso'),
  faltaProgreso: document.getElementById('faltaProgreso'),
  metaLabel: document.getElementById('metaLabel'),
  barraProgreso: document.getElementById('barraProgreso'),
  tablaProyeccion: document.getElementById('tablaProyeccion'),
  movAhorro: document.getElementById('movAhorro'),
  chartProgresoCanvas: document.getElementById('chartProgreso'),
  chartProyeccionCanvas: document.getElementById('chartProyeccion'),
  particulasContainer: document.getElementById('particulas'),
};

const actionButtons = {
  depositar: document.getElementById('btnDepositar'),
  retirar: document.getElementById('btnRetirar'),
  meta: document.getElementById('btnMeta'),
  exportar: document.getElementById('btnExportar'),
};

// ── Initialization ───────────────────────────────────────────────────────
/**
 * Main function to initialize the module
 */
async function init() {
  setupEventListeners();
  crearParticulas();

  currentUser = await requireAuth();
  if (!currentUser) return;

  ui.userName.textContent = currentUser.user_metadata?.full_name?.split(' ')[0] || currentUser.email;

  await cargarDatos();
}

/**
 * Sets up all event listeners for the page
 */
function setupEventListeners() {
  ui.btnLogout?.addEventListener('click', cerrarSesion);
  actionButtons.depositar?.addEventListener('click', simularDeposito);
  actionButtons.retirar?.addEventListener('click', simularRetiro);
  actionButtons.meta?.addEventListener('click', cambiarMeta);
  actionButtons.exportar?.addEventListener('click', exportarDatos);
}

// ── Authentication ─────────────────────────────────────────────────────
/**
 * Signs out the user and redirects to the login page
 */
async function cerrarSesion() {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
}

// ── Data Fetching & Rendering ──────────────────────────────────────────
/**
 * Fetches savings account data and related info, then renders the page
 */
async function cargarDatos() {
  try {
    const { data: ahorro, error: ahorroError } = await supabase
      .from('cuentas_ahorro')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();

    if (ahorroError) throw new Error('Error al cargar la cuenta de ahorro.');

    const { data: cuenta, error: cuentaError } = await supabase
      .from('cuentas')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('tipo', 'ahorro')
      .single();

    if (cuentaError) throw new Error('Error al cargar los datos de la cuenta.');

    cuentaAhorro = cuenta;

    mostrarContenido();
    renderCuenta(ahorro, cuenta);
    renderProyeccion(ahorro);
    await cargarMovimientos();

  } catch (error) {
    showToast(error.message, 'danger');
    ui.loadingAhorro.innerHTML = `<p class="text-danger">${error.message}</p>`;
  }
}

/**
 * Hides the loader and shows the main content
 */
function mostrarContenido() {
  ui.loadingAhorro.classList.add('d-none');
  ui.contenidoAhorro.classList.remove('d-none');
}

/**
 * Renders the main account details
 * @param {object} ahorro - Savings account data from Supabase
 * @param {object} cuenta - General account data from Supabase
 */
function renderCuenta(ahorro, cuenta) {
  const saldo = parseFloat(ahorro.saldo) || 0;
  const meta = parseFloat(ahorro.meta_ahorro) || 1; // Avoid division by zero
  const pct = meta > 0 ? Math.min(Math.round((saldo / meta) * 100), 100) : 0;
  const falta = Math.max(meta - saldo, 0);

  ui.saldoAhorro.textContent = formatSoles(saldo);
  ui.tasaAhorro.textContent = `${ahorro.tasa_interes}%`;
  ui.fechaApertura.textContent = formatFecha(ahorro.fecha_apertura);
  ui.metaAhorro.textContent = formatSoles(meta);
  ui.numCuentaAhorro.textContent = `••• ••• ${cuenta?.numero_cuenta?.slice(-4) || '••••'}`;

  renderProgreso({ saldo, meta, pct, falta });
  renderGraficoProgreso(saldo, meta);
}

/**
 * Renders the savings goal progress bar and text
 * @param {object} params - Object with saldo, meta, pct, and falta
 */
function renderProgreso({ saldo, meta, pct, falta }) {
  ui.saldoProgreso.textContent = formatSoles(saldo);
  ui.metaProgreso.textContent = formatSoles(meta);
  ui.pctProgreso.textContent = `${pct}%`;
  ui.faltaProgreso.textContent = `Falta: ${formatSoles(falta)}`;
  ui.metaLabel.textContent = `Meta: ${formatSoles(meta)}`;
  
  ui.barraProgreso.style.width = `${pct}%`;
  ui.barraProgreso.setAttribute('aria-valuenow', pct);
  ui.barraProgreso.textContent = pct >= 10 ? `${pct}%` : '';
}

// ── Projections & Charts ─────────────────────────────────────────────────
/**
 * Calculates and renders the 12-month projection
 * @param {object} ahorro - Savings account data
 */
function renderProyeccion(ahorro) {
  const tasaMensual = (ahorro.tasa_interes || 0) / 100 / 12;
  let saldoProyectado = parseFloat(ahorro.saldo) || 0;
  
  const filas = Array.from({ length: 12 }, (_, i) => {
    const interes = saldoProyectado * tasaMensual;
    saldoProyectado += interes;
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + i + 1);

    return `
      <tr>
        <td>${fecha.toLocaleDateString('es-PE', { month:'short', year:'numeric' })}</td>
        <td class="text-end fw-semibold">${formatSoles(saldoProyectado)}</td>
        <td class="text-end text-success">+${formatSoles(interes)}</td>
      </tr>
    `;
  }).join('');

  ui.tablaProyeccion.innerHTML = filas;
  renderGraficoProyeccion(ahorro);
}

/**
 * Fetches and renders account movements/transactions
 */
async function cargarMovimientos() {
  if (!cuentaAhorro?.id) return;

  const { data: movs, error } = await supabase
    .from('transacciones')
    .select('*')
    .eq('cuenta_id', cuentaAhorro.id)
    .order('fecha', { ascending: false })
    .limit(10);

  if (error) {
    showToast('Error al cargar movimientos', 'danger');
    return;
  }
  renderMovimientos(movs);
}

/**
 * Renders the movements table
 * @param {Array<object>} movs - Array of movement objects
 */
function renderMovimientos(movs) {
  if (!movs || movs.length === 0) {
    ui.movAhorro.innerHTML = `<tr><td colspan="4" class="text-center py-4">
      <i class="bi bi-inbox fs-2 text-muted d-block mb-2"></i>
      <span class="text-muted">Sin movimientos registrados.</span>
    </td></tr>`;
    return;
  }

  ui.movAhorro.innerHTML = movs.map(m => {
    const isDebito = m.tipo === 'debito';
    return `
      <tr class="animate__animated animate__fadeInUp">
        <td class="ps-3 text-muted small">${formatFecha(m.fecha)}</td>
        <td class="fw-semibold small">${m.descripcion}</td>
        <td>
          <span class="badge ${isDebito ? 'badge-debito' : 'badge-credito'}">
            ${isDebito ? 'Retiro' : 'Depósito'}
          </span>
        </td>
        <td class="text-end pe-3">
          <span class="${isDebito ? 'monto-debito' : 'monto-credito'} fw-bold">
            ${isDebito ? '- ' : '+ '}${formatSoles(m.monto)}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}


// ── Chart Rendering ────────────────────────────────────────────────────
/**
 * Renders the progress doughnut chart
 * @param {number} saldo - Current balance
 * @param {number} meta - Savings goal
 */
function renderGraficoProgreso(saldo, meta) {
  if (!ui.chartProgresoCanvas) return;
  const ctx = ui.chartProgresoCanvas.getContext('2d');
  const restante = Math.max(meta - saldo, 0);

  if (chartProgreso) chartProgreso.destroy();

  chartProgreso = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Saldo Actual', 'Restante'],
      datasets: [{
        data: [saldo, restante],
        backgroundColor: ['rgba(25, 135, 84, 0.8)', 'rgba(222, 226, 230, 1)'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 4,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatSoles(context.parsed)}`
          }
        }
      },
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

/**
 * Renders the projection line chart
 * @param {object} ahorro - Savings account data
 */
function renderGraficoProyeccion(ahorro) {
  if (!ui.chartProyeccionCanvas) return;
  const ctx = ui.chartProyeccionCanvas.getContext('2d');
  
  const labels = [];
  const data = [];
  let saldoProyectado = parseFloat(ahorro.saldo);
  const tasaMensual = (ahorro.tasa_interes || 0) / 100 / 12;

  for (let mes = 0; mes <= 12; mes++) {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + mes);
    labels.push(fecha.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }));
    data.push(saldoProyectado);
    saldoProyectado += saldoProyectado * tasaMensual;
  }

  if (chartProyeccion) chartProyeccion.destroy();

  chartProyeccion = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo Proyectado',
        data,
        borderColor: 'rgba(25, 135, 84, 1)',
        backgroundColor: 'rgba(25, 135, 84, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgba(25, 135, 84, 1)',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Saldo: ${formatSoles(context.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => 'S/ ' + value.toLocaleString('es-PE'),
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      }
    }
  });
}

// ── Quick Actions (Simulated) ──────────────────────────────────────────
const showPrompt = (text, callback) => {
  const input = prompt(text);
  if (input && !isNaN(input)) {
    callback(parseFloat(input));
  } else if (input !== null) {
    showToast('Por favor, ingresa un número válido.', 'warning');
  }
};

const simularDeposito = () => showPrompt('Monto a depositar (S/):', monto => {
  showToast(`Depósito de ${formatSoles(monto)} simulado.`, 'success');
  // Lógica real de depósito aquí...
});

const simularRetiro = () => showPrompt('Monto a retirar (S/):', monto => {
  showToast(`Retiro de ${formatSoles(monto)} simulado.`, 'warning');
  // Lógica real de retiro aquí...
});

const cambiarMeta = () => showPrompt('Nueva meta de ahorro (S/):', nuevaMeta => {
  showToast(`Meta cambiada a ${formatSoles(nuevaMeta)}.`, 'info');
  // Lógica real para actualizar meta aquí...
});

function exportarDatos() {
  showToast('Exportando datos...', 'info');
  setTimeout(() => showToast('Datos exportados exitosamente.', 'success'), 2000);
}

// ── Decorative Effects ────────────────────────────────────────────────
/**
 * Creates floating particles for visual effect
 */
function crearParticulas() {
  if (!ui.particulasContainer) return;
  const container = ui.particulasContainer;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 20; i++) {
    const particula = document.createElement('div');
    particula.className = 'particula';
    particula.style.left = `${Math.random() * 100}%`;
    particula.style.animationDelay = `${Math.random() * 8}s`;
    fragment.appendChild(particula);
  }
  container.appendChild(fragment);
}

// ── Start ──────────────────────────────────────────────────────────────
init();