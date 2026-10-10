/**
 * HTTP/HTTPS probe collector.
 * Probes a TCP endpoint to check if it responds to HTTP/HTTPS.
 */

import http from 'http';
import https from 'https';

const DEFAULT_TIMEOUT = 3000;
const DEFAULT_PATH = '/';

function probeWithClient(client, options, timeout) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
        // Limit body size to avoid memory issues
        if (body.length > 1024) {
          req.destroy();
        }
      });
      res.on('end', () => {
        if (resolved) return;
        resolved = true;
        resolve({
          success: true,
          statusCode: res.statusCode,
          latency: Date.now() - startTime,
          error: null
        });
      });
    });

    req.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      resolve({
        success: false,
        statusCode: null,
        latency: Date.now() - startTime,
        error: err.message
      });
    });

    req.on('timeout', () => {
      if (resolved) return;
      resolved = true;
      req.destroy();
      resolve({
        success: false,
        statusCode: null,
        latency: timeout,
        error: 'timeout'
      });
    });

    req.setTimeout(timeout);
    req.end();
  });
}

export async function probeHTTP(port, address = '127.0.0.1', options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT,
    path = DEFAULT_PATH,
    scheme = 'http',
    headers = {},
    tlsRejectUnauthorized = true
  } = options;

  // Skip IPv6 addresses for now - use IPv4 only for probing
  if (address === '::' || address.includes(':')) {
    // Try localhost instead
    address = '127.0.0.1';
  }

  const client = scheme === 'https' ? https : http;
  // Secure default: verify TLS certificates. Allow override via options for internal services with self-signed certs.
  const requestOptions = {
    hostname: address,
    port,
    path,
    method: 'GET',
    headers: {
      'User-Agent': 'ServiceDashboard/1.0',
      'Accept': '*/*',
      'Connection': 'close',
      ...headers
    },
    rejectUnauthorized: tlsRejectUnauthorized
  };

  try {
    return await probeWithClient(client, requestOptions, timeout);
  } catch (err) {
    return {
      success: false,
      statusCode: null,
      latency: null,
      error: err.message
    };
  }
}

export async function probeMultiple(services, options = {}) {
  const {
    concurrency = 10,
    timeout = DEFAULT_TIMEOUT,
    path = DEFAULT_PATH,
    tlsRejectUnauthorized = true
  } = options;

  const results = [];
  const queue = [...services];
  const workers = [];

  async function worker() {
    while (queue.length > 0) {
      const service = queue.shift();
      if (!service) break;

      // Skip if already probed recently or not a candidate for HTTP
      if (!service.address || service.address === '::' || service.address === '0.0.0.0') {
        // For wildcard addresses or null, try 127.0.0.1
        const result = await probeHTTP(service.port, '127.0.0.1', { timeout, path, tlsRejectUnauthorized });
        results.push({ service, result });
      } else {
        const result = await probeHTTP(service.port, service.address, { timeout, path, tlsRejectUnauthorized });
        results.push({ service, result });
      }
    }
  }

  // Start workers
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}