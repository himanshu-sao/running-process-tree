import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { discoverHostListeners } from './collectors/host.js';
import { discoverDocker } from './collectors/docker.js';
import { probeMultiple } from './collectors/http-probe.js';
import { reconcile } from './reconcile.js';
import { getConfig } from './config.js';
import {
  getServices,
  setServices,
  setScanInProgress,
  isScanInProgress,
  addListener,
  removeListener,
  createServiceFromHostListener,
  createServiceFromDockerContainer,
  updateService,
  getLastScan
} from './state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration
const config = getConfig();

const app = express();
const PORT = config.server.port;
const SCAN_INTERVAL = config.scan.interval;
const PROBE_TIMEOUT = config.probe.timeout;
const PROBE_CONCURRENCY = config.probe.concurrency;

// Serve frontend build
const FRONTEND_DIST = join(__dirname, '../frontend/dist');
app.use(express.static(FRONTEND_DIST));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(join(FRONTEND_DIST, 'index.html'));
});

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get current services
app.get('/api/services', (req, res) => {
  res.json({ services: getServices(), lastScan: getLastScan() });
});

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addListener(res);

  req.on('close', () => {
    removeListener(res);
  });
});

// Manual scan trigger
app.post('/api/scan', async (req, res) => {
  if (isScanInProgress()) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }
  try {
    await performScan();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Perform a full scan
async function performScan() {
  setScanInProgress(true);
  console.log('[scan] Starting scan...');

  try {
    // Discover host listeners
    const hostListeners = await discoverHostListeners();
    console.log(`[scan] Found ${hostListeners.length} host listeners`);

    // Convert to service objects
    const hostServices = hostListeners.map(createServiceFromHostListener);

    // Discover Docker containers
    const dockerContainers = await discoverDocker();
    let dockerServices = [];
    if (Array.isArray(dockerContainers)) {
      dockerServices = dockerContainers.map(createServiceFromDockerContainer);
      console.log(`[scan] Found ${dockerServices.length} Docker containers`);
    } else if (dockerContainers.error) {
      console.warn('[scan] Docker error:', dockerContainers.error);
    }

    // Reconcile host and docker services
    const reconciledServices = reconcile(hostServices, dockerServices);
    console.log(`[scan] Reconciled ${hostServices.length} host + ${dockerServices.length} docker = ${reconciledServices.length} services`);

    // Update state with reconciled services
    setServices(reconciledServices);

    // Probe HTTP for each service that has a port
    console.log('[scan] Starting HTTP probes...');
    // Only probe services that have a port and are not already known to be non-HTTP
    const servicesToProbe = reconciledServices.filter(s => s.port && s.port > 0);
    const probeResults = await probeMultiple(servicesToProbe, {
      concurrency: PROBE_CONCURRENCY,
      timeout: PROBE_TIMEOUT,
      tlsRejectUnauthorized: config.probe.tlsRejectUnauthorized
    });

    // Update services with probe results
    for (const { service, result } of probeResults) {
      if (result.success) {
        updateService(service.identityKey, {
          type: 'web_app',
          httpStatus: 'responding',
          httpStatusCode: result.statusCode,
          httpLatency: result.latency,
          lastProbed: Date.now(),
          status: 'http_responding'
        });
      } else {
        updateService(service.identityKey, {
          httpStatus: 'failed',
          httpStatusCode: null,
          httpLatency: result.latency,
          lastProbed: Date.now(),
          status: 'listening'
        });
      }
    }

    const responding = probeResults.filter(r => r.result.success).length;
    console.log(`[scan] HTTP probes complete: ${responding}/${servicesToProbe.length} responding`);

    console.log('[scan] Scan complete');
  } catch (err) {
    console.error('[scan] Error:', err.message);
    throw err;
  } finally {
    setScanInProgress(false);
  }
}

// Background scan loop
let scanIntervalId = null;

function startScanLoop() {
  if (scanIntervalId) return;
  console.log(`[scan] Starting background scan loop (interval: ${SCAN_INTERVAL}ms)`);
  scanIntervalId = setInterval(async () => {
    try {
      await performScan();
    } catch (err) {
      console.error('[scan] Background scan error:', err.message);
    }
  }, SCAN_INTERVAL);
}

function stopScanLoop() {
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
    console.log('[scan] Stopped background scan loop');
  }
}

// Initial scan on startup
setTimeout(() => {
  performScan().catch(err => console.error('[scan] Initial scan error:', err.message));
  startScanLoop();
}, 1000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  stopScanLoop();
  process.exit(0);
});

process.on('SIGINT', () => {
  stopScanLoop();
  process.exit(0);
});

export default app;