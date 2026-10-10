/**
 * In-memory state store for services.
 * No persistence - state is lost on restart.
 */

let services = [];
let lastScan = null;
let scanInProgress = false;
const listeners = new Set(); // SSE clients

export function getServices() {
  return [...services];
}

export function setServices(newServices) {
  services = newServices;
  lastScan = Date.now();
  notifyListeners({ type: 'services', services: getServices(), lastScan });
}

export function updateService(identityKey, updates) {
  const index = services.findIndex(s => s.identityKey === identityKey);
  if (index >= 0) {
    services[index] = { ...services[index], ...updates, updatedAt: Date.now() };
    notifyListeners({ type: 'service-updated', service: services[index] });
    return services[index];
  }
  return null;
}

export function addService(service) {
  services.push(service);
  notifyListeners({ type: 'service-added', service });
  return service;
}

export function removeService(identityKey) {
  const index = services.findIndex(s => s.identityKey === identityKey);
  if (index >= 0) {
    const removed = services.splice(index, 1)[0];
    notifyListeners({ type: 'service-removed', identityKey });
    return removed;
  }
  return null;
}

export function getLastScan() {
  return lastScan;
}

export function setScanInProgress(inProgress) {
  scanInProgress = inProgress;
  if (!inProgress) {
    lastScan = Date.now();
  }
  notifyListeners({ type: 'scan-status', inProgress, lastScan });
}

export function isScanInProgress() {
  return scanInProgress;
}

// SSE listener management
export function addListener(res) {
  listeners.add(res);
  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'init', services: getServices(), lastScan })}\n\n`);
}

export function removeListener(res) {
  listeners.delete(res);
}

function notifyListeners(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of listeners) {
    try {
      res.write(data);
    } catch {
      // Ignore write errors on closed connections
    }
  }
}

// Generate identity key for a service
export function generateIdentityKey(source, identifier) {
  return `${source}:${identifier}`;
}

// Create service object from host listener
export function createServiceFromHostListener(listener) {
  const identityKey = generateIdentityKey('host', `${listener.address}:${listener.port}`);
  return {
    identityKey,
    source: 'host',
    type: 'tcp_listener', // Will be updated to 'web_app' if HTTP responds
    friendlyName: null,
    detectedName: listener.processName,
    address: listener.address,
    port: listener.port,
    pid: listener.pid,
    containerId: null,
    containerName: null,
    imageName: null,
    httpStatus: null, // null = not probed, 'probing', 'responding', 'failed'
    httpStatusCode: null,
    httpLatency: null,
    lastProbed: null,
    lastSeen: Date.now(),
    status: 'listening',
    sources: ['host'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// Create service object from Docker container
export function createServiceFromDockerContainer(container) {
  const identityKey = generateIdentityKey('docker', container.id);
  const ports = container.ports || [];

  return {
    identityKey,
    source: 'docker',
    type: 'docker_container',
    friendlyName: null,
    detectedName: container.name,
    address: null, // Will be filled from port mapping
    port: ports.length > 0 ? ports[0].hostPort : null,
    pid: null,
    containerId: container.id,
    containerName: container.name,
    imageName: container.image,
    httpStatus: null,
    httpStatusCode: null,
    httpLatency: null,
    lastProbed: null,
    lastSeen: Date.now(),
    status: container.state || 'unknown',
    dockerHealth: container.health,
    sources: ['docker'],
    ports: ports.map(p => ({
      hostPort: p.hostPort,
      containerPort: p.containerPort,
      protocol: p.protocol
    })),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}