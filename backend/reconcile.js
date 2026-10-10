/**
 * Reconciliation module - merges host listeners and Docker containers
 * by matching ports to create unified service entries.
 */

/**
 * Reconcile host services and Docker services by matching ports.
 * @param {Array} hostServices - Services from host discovery
 * @param {Array} dockerServices - Services from Docker discovery
 * @returns {Array} Reconciled services with merged entries
 */
export function reconcile(hostServices, dockerServices) {
  const reconciled = [];
  const matchedDocker = new Set(); // Track which docker services have been matched

  // First pass: match host services to docker services by port
  for (const hostService of hostServices) {
    const hostPort = hostService.port;
    const hostAddress = hostService.address;

    // Find matching docker service by port
    let matchedDockerService = null;
    let matchedDockerIndex = -1;

    for (let i = 0; i < dockerServices.length; i++) {
      if (matchedDocker.has(i)) continue;

      const dockerService = dockerServices[i];
      // Check if any docker port matches host port
      const hasMatchingPort = dockerService.ports && dockerService.ports.some(p => p.hostPort === hostPort);

      if (hasMatchingPort) {
        matchedDockerService = dockerService;
        matchedDockerIndex = i;
        break;
      }
    }

    if (matchedDockerService) {
      // Merge the two services
      matchedDocker.add(matchedDockerIndex);
      const merged = mergeServices(hostService, matchedDockerService);
      reconciled.push(merged);
    } else {
      // No match - host service only
      reconciled.push(hostService);
    }
  }

  // Second pass: add unmatched docker services
  for (let i = 0; i < dockerServices.length; i++) {
    if (!matchedDocker.has(i)) {
      reconciled.push(dockerServices[i]);
    }
  }

  return reconciled;
}

/**
 * Merge a host service and a docker service into a single entry.
 * @param {Object} hostService - Host listener service
 * @param {Object} dockerService - Docker container service
 * @returns {Object} Merged service
 */
function mergeServices(hostService, dockerService) {
  // Combine identity keys
  const combinedIdentityKey = `${hostService.identityKey}|${dockerService.identityKey}`;

  // Determine the best address - prefer host address if available
  const address = hostService.address !== '::' ? hostService.address : dockerService.address;
  // Port from host service (already verified to match)
  const port = hostService.port;

  // Determine status - prefer more specific status
  let status = hostService.status;
  if (dockerService.status === 'running' && hostService.status === 'listening') {
    status = 'running';
  }

  // Combine sources
  const sources = [...new Set([...hostService.sources, ...dockerService.sources])];

  // Use host's HTTP probe results if available
  const httpStatus = hostService.httpStatus;
  const httpStatusCode = hostService.httpStatusCode;
  const httpLatency = hostService.httpLatency;
  const lastProbed = hostService.lastProbed;

  // Use docker's health if available and host doesn't have HTTP info
  const dockerHealth = dockerService.dockerHealth;

  return {
    ...hostService,
    identityKey: combinedIdentityKey,
    type: 'web_app', // Merged services are typically web apps
    friendlyName: dockerService.detectedName || hostService.friendlyName,
    detectedName: dockerService.detectedName || hostService.detectedName,
    address,
    port,
    containerId: dockerService.containerId,
    containerName: dockerService.containerName,
    imageName: dockerService.imageName,
    pid: hostService.pid,
    httpStatus,
    httpStatusCode,
    httpLatency,
    lastProbed,
    status,
    dockerHealth,
    sources,
    ports: dockerService.ports,
    dockerState: dockerService.status,
    updatedAt: Date.now()
  };
}

/**
 * Group services by identity for display purposes.
 * This creates a map of identityKey -> list of source services.
 * @param {Array} services - Array of services
 * @returns {Object} Map of identityKey to service groups
 */
export function groupByIdentity(services) {
  const groups = {};

  for (const service of services) {
    const key = service.identityKey;
    if (!groups[key]) {
      groups[key] = {
        identityKey: key,
        services: [],
        primary: service
      };
    }
    groups[key].services.push(service);
  }

  // For each group, determine the primary display service
  for (const group of Object.values(groups)) {
    // Prefer merged services (those with multiple sources)
    const multiSource = group.services.find(s => s.sources && s.sources.length > 1);
    if (multiSource) {
      group.primary = multiSource;
    }
  }

  return groups;
}

export default { reconcile, groupByIdentity };