/**
 * Service Dashboard - Main entry point
 * Vanilla JS frontend for displaying running services
 */

import './styles.css';

// State
let services = [];
let filteredServices = [];
let filters = {
  search: '',
  type: 'all',
  status: 'all'
};
let sseConnection = null;
let lastScan = null;

// DOM Elements
const app = document.getElementById('app');

// Initialize the app
function init() {
  render();
  setupEventListeners();
  fetchServices();
  connectSSE();
}

// Render the main app structure
function render() {
  app.innerHTML = `
    <header class="header">
      <div class="header-content">
        <h1 class="header-title">Service Dashboard</h1>
        <div class="header-controls">
          <button id="theme-toggle" class="btn btn-icon" aria-label="Toggle theme">
            <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button id="refresh-btn" class="btn btn-secondary" aria-label="Refresh services">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="filters-bar">
        <div class="filter-group">
          <label for="search-input" class="visually-hidden">Search services</label>
          <input
            type="text"
            id="search-input"
            class="search-input"
            placeholder="Search services..."
            value="${filters.search}"
          >
        </div>
        <div class="filter-group">
          <label for="type-filter" class="visually-hidden">Filter by type</label>
          <select id="type-filter" class="filter-select">
            <option value="all" ${filters.type === 'all' ? 'selected' : ''}>All Types</option>
            <option value="web_app" ${filters.type === 'web_app' ? 'selected' : ''}>Web App</option>
            <option value="tcp_listener" ${filters.type === 'tcp_listener' ? 'selected' : ''}>TCP Listener</option>
            <option value="docker_container" ${filters.type === 'docker_container' ? 'selected' : ''}>Docker Container</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="status-filter" class="visually-hidden">Filter by status</label>
          <select id="status-filter" class="filter-select">
            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>All Status</option>
            <option value="http_responding" ${filters.status === 'http_responding' ? 'selected' : ''}>HTTP Responding</option>
            <option value="listening" ${filters.status === 'listening' ? 'selected' : ''}>Listening</option>
            <option value="running" ${filters.status === 'running' ? 'selected' : ''}>Running</option>
            <option value="exited" ${filters.status === 'exited' ? 'selected' : ''}>Exited</option>
          </select>
        </div>
        <div class="filter-stats">
          <span id="service-count">${filteredServices.length} / ${services.length} services</span>
          <span id="last-scan" class="${lastScan ? '' : 'pending'}">
            ${lastScan ? `Last scan: ${formatTime(lastScan)}` : 'Scanning...'}
          </span>
        </div>
      </div>

      <div class="services-grid" id="services-grid">
        ${filteredServices.length > 0
          ? filteredServices.map(renderServiceCard).join('')
          : '<div class="empty-state">No services found</div>'
        }
      </div>
    </main>

    <footer class="footer">
      <div class="footer-content">
        <span>Service Dashboard</span>
        <span id="connection-status" class="connection-status disconnected">Disconnected</span>
      </div>
    </footer>
  `;

  // Re-attach event listeners after render
  setupEventListeners();
}

// Render a single service card
function renderServiceCard(service) {
  const statusClass = getStatusClass(service.status);
  const typeLabel = getTypeLabel(service.type);
  const typeClass = getTypeClass(service.type);
  const sources = service.sources ? service.sources.join(', ') : service.source;
  const lastProbed = service.lastProbed ? formatTime(service.lastProbed) : 'Never';
  const ports = service.ports && service.ports.length > 0
    ? service.ports.map(p => `${p.hostPort}:${p.containerPort}/${p.protocol}`).join(', ')
    : '';

  return `
    <article class="service-card ${statusClass}" data-identity="${service.identityKey}">
      <div class="card-header">
        <div class="card-name">
          <h3 class="service-name">${escapeHtml(service.friendlyName || service.detectedName || 'Unknown')}</h3>
          <span class="service-type ${typeClass}">${typeLabel}</span>
        </div>
        <span class="service-status ${statusClass}">${formatStatus(service.status)}</span>
      </div>

      <div class="card-details">
        <dl class="detail-list">
          <div class="detail-row">
            <dt>Port</dt>
            <dd class="port-value">${service.port || 'N/A'}</dd>
          </div>
          ${service.pid ? `
          <div class="detail-row">
            <dt>PID</dt>
            <dd>${service.pid}</dd>
          </div>` : ''}
          ${service.containerName ? `
          <div class="detail-row">
            <dt>Container</dt>
            <dd>${escapeHtml(service.containerName)}</dd>
          </div>` : ''}
          ${service.imageName ? `
          <div class="detail-row">
            <dt>Image</dt>
            <dd>${escapeHtml(service.imageName)}</dd>
          </div>` : ''}
          ${ports ? `
          <div class="detail-row">
            <dt>Ports</dt>
            <dd>${escapeHtml(ports)}</dd>
          </div>` : ''}
          <div class="detail-row">
            <dt>HTTP Status</dt>
            <dd class="${service.httpStatus === 'responding' ? 'http-ok' : service.httpStatus === 'failed' ? 'http-fail' : ''}">
              ${service.httpStatus === 'responding' ? `✓ ${service.httpStatusCode} (${service.httpLatency}ms)` : service.httpStatus === 'failed' ? '✗ Failed' : 'Not probed'}
            </dd>
          </div>
          ${service.dockerHealth ? `
          <div class="detail-row">
            <dt>Docker Health</dt>
            <dd class="docker-health ${service.dockerHealth.status}">${service.dockerHealth.status}</dd>
          </div>` : ''}
          <div class="detail-row">
            <dt>Sources</dt>
            <dd>${escapeHtml(sources)}</dd>
          </div>
          <div class="detail-row">
            <dt>Last Probed</dt>
            <dd>${lastProbed}</dd>
          </div>
        </dl>
      </div>
    </article>
  `;
}

// Get status CSS class
function getStatusClass(status) {
  switch (status) {
    case 'http_responding':
      return 'status-http-responding';
    case 'listening':
      return 'status-listening';
    case 'running':
      return 'status-running';
    case 'exited':
      return 'status-exited';
    default:
      return 'status-unknown';
  }
}

// Format status for display
function formatStatus(status) {
  switch (status) {
    case 'http_responding':
      return 'HTTP Responding';
    case 'listening':
      return 'Listening';
    case 'running':
      return 'Running';
    case 'exited':
      return 'Exited';
    default:
      return status;
  }
}

// Get type label
function getTypeLabel(type) {
  switch (type) {
    case 'web_app':
      return 'Web App';
    case 'tcp_listener':
      return 'TCP Listener';
    case 'docker_container':
      return 'Docker Container';
    default:
      return type;
  }
}

// Get type CSS class
function getTypeClass(type) {
  switch (type) {
    case 'web_app':
      return 'type-web';
    case 'tcp_listener':
      return 'type-tcp';
    case 'docker_container':
      return 'type-docker';
    default:
      return '';
  }
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Fetch services from API
async function fetchServices() {
  try {
    const response = await fetch('/api/services');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    services = data.services || [];
    lastScan = data.lastScan;
    applyFilters();
    updateStats();
  } catch (err) {
    console.error('Failed to fetch services:', err);
  }
}

// Apply filters
function applyFilters() {
  filteredServices = services.filter(service => {
    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const name = (service.friendlyName || service.detectedName || '').toLowerCase();
      const container = (service.containerName || '').toLowerCase();
      const image = (service.imageName || '').toLowerCase();
      if (!name.includes(search) && !container.includes(search) && !image.includes(search)) {
        return false;
      }
    }

    // Type filter
    if (filters.type !== 'all' && service.type !== filters.type) {
      return false;
    }

    // Status filter
    if (filters.status !== 'all' && service.status !== filters.status) {
      return false;
    }

    return true;
  });

  renderServicesGrid();
  updateStats();
}

// Render just the services grid
function renderServicesGrid() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  if (filteredServices.length > 0) {
    grid.innerHTML = filteredServices.map(renderServiceCard).join('');
  } else {
    grid.innerHTML = '<div class="empty-state">No services match current filters</div>';
  }
}

// Update stats display
function updateStats() {
  const countEl = document.getElementById('service-count');
  const scanEl = document.getElementById('last-scan');
  if (countEl) countEl.textContent = `${filteredServices.length} / ${services.length} services`;
  if (scanEl) {
    if (lastScan) {
      scanEl.textContent = `Last scan: ${formatTime(lastScan)}`;
      scanEl.classList.remove('pending');
    } else {
      scanEl.textContent = 'Scanning...';
      scanEl.classList.add('pending');
    }
  }
}

// Connect to SSE
function connectSSE() {
  if (sseConnection) {
    sseConnection.close();
  }

  sseConnection = new EventSource('/api/events');

  sseConnection.onopen = () => {
    updateConnectionStatus('connected');
  };

  sseConnection.onerror = () => {
    updateConnectionStatus('disconnected');
    // Reconnect after 5 seconds
    setTimeout(connectSSE, 5000);
  };

  sseConnection.addEventListener('init', (event) => {
    const data = JSON.parse(event.data);
    services = data.services || [];
    lastScan = data.lastScan;
    applyFilters();
  });

  sseConnection.addEventListener('services', (event) => {
    const data = JSON.parse(event.data);
    services = data.services || [];
    lastScan = data.lastScan;
    applyFilters();
  });

  sseConnection.addEventListener('service-updated', (event) => {
    const data = JSON.parse(event.data);
    const index = services.findIndex(s => s.identityKey === data.service.identityKey);
    if (index >= 0) {
      services[index] = data.service;
      applyFilters();
    }
  });

  sseConnection.addEventListener('service-added', (event) => {
    const data = JSON.parse(event.data);
    services.push(data.service);
    applyFilters();
  });

  sseConnection.addEventListener('service-removed', (event) => {
    const data = JSON.parse(event.data);
    services = services.filter(s => s.identityKey !== data.identityKey);
    applyFilters();
  });

  sseConnection.addEventListener('scan-status', (event) => {
    const data = JSON.parse(event.data);
    if (!data.inProgress && data.lastScan) {
      lastScan = data.lastScan;
      updateStats();
    }
  });
}

// Update connection status
function updateConnectionStatus(status) {
  const el = document.getElementById('connection-status');
  if (el) {
    el.textContent = status === 'connected' ? 'Live' : 'Disconnected';
    el.className = `connection-status ${status}`;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetch('/api/scan', { method: 'POST' }).catch(console.error);
    });
  }

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filters.search = e.target.value;
      applyFilters();
    });
  }

  // Type filter
  const typeFilter = document.getElementById('type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      filters.type = e.target.value;
      applyFilters();
    });
  }

  // Status filter
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      filters.status = e.target.value;
      applyFilters();
    });
  }
}

// Toggle theme
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved theme
function loadTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
}

// Initialize
loadTheme();
init();