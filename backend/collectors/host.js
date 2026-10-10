/**
 * Host listener collector - discovers local TCP listeners using lsof.
 * Returns array of listener objects with port, address, pid, processName.
 */

import { spawn } from 'child_process';

function parseLsofOutput(output) {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header line
  const listeners = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse lsof output: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    // NAME format: IPv4: *:port or 127.0.0.1:port or [::]:port or [::1]:port
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const processName = parts[0];
    const pid = parseInt(parts[1], 10);
    const type = parts[4]; // IPv4 or IPv6
    const name = parts[8];

    // Parse address and port from NAME
    // Examples: *:57204, 127.0.0.1:5037, [::1]:42050, *:8082
    let address = '';
    let port = 0;

    const match = name.match(/^([^:]+):(\d+)$/);
    if (match) {
      address = match[1];
      port = parseInt(match[2], 10);
    } else {
      continue;
    }

    // Normalize address
    // * -> 0.0.0.0 (IPv4) or :: (IPv6)
    // [::1] -> ::1
    if (address === '*') {
      address = type === 'IPv6' ? '::' : '0.0.0.0';
    } else if (address.startsWith('[') && address.endsWith(']')) {
      address = address.slice(1, -1);
    }

    listeners.push({
      port,
      address,
      pid,
      processName,
      protocol: 'tcp',
      source: 'host'
    });
  }

  return listeners;
}

export async function discoverHostListeners() {
  return new Promise((resolve, reject) => {
    // Use lsof to get listening TCP sockets with process info
    // -iTCP -sTCP:LISTEN = TCP listeners only
    // -P = don't resolve port names
    // -n = don't resolve hostnames
    const child = spawn('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        // lsof returns 1 when no processes found, which is OK
        if (code === 1 && stdout.trim() === '') {
          resolve([]);
          return;
        }
        reject(new Error(`lsof exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const listeners = parseLsofOutput(stdout);
        resolve(listeners);
      } catch (err) {
        reject(err);
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn lsof: ${err.message}`));
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('lsof timeout'));
    }, 5000);
  });
}

// For testing
export { parseLsofOutput };