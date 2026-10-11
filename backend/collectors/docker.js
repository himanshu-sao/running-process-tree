/**
 * Docker collector - discovers Docker containers using Docker CLI.
 * Read-only operations only.
 */

import { spawn } from 'child_process';
import { getConfig } from '../config.js';

/**
 * Validates Docker socket configuration to prevent argument injection.
 * Allows only: unix:///path/to/socket or tcp://host:port
 */
function validateDockerSocket(socket) {
  if (!socket || typeof socket !== 'string') {
    return false;
  }
  // Unix socket: unix:///absolute/path (no whitespace, no dashes at start)
  const unixSocketRegex = /^unix:\/\/\/[a-zA-Z0-9_\-./]+$/;
  // TCP socket: tcp://host:port (host can be hostname, IP, or localhost)
  const tcpSocketRegex = /^tcp:\/\/[a-zA-Z0-9_.\-]+:\d+$/;
  return unixSocketRegex.test(socket) || tcpSocketRegex.test(socket);
}

function runDockerCommand(args) {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    let dockerArgs = args;

    if (config.docker.socket) {
      if (!validateDockerSocket(config.docker.socket)) {
        reject(new Error(`Invalid DOCKER_SOCKET format: ${config.docker.socket}. Must be unix:///path or tcp://host:port`));
        return;
      }
      dockerArgs = ['-H', config.docker.socket, ...args];
    }

    const child = spawn('docker', dockerArgs, {
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
        reject(new Error(`docker ${args.join(' ')} exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn docker: ${err.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('docker command timeout'));
    }, 10000);
  });
}

function parsePorts(portsStr) {
  // Format: "0.0.0.0:5173->5173/tcp, 0.0.0.0:3001->3001/tcp"
  if (!portsStr || portsStr === '') return [];

  const ports = [];
  const entries = portsStr.split(',');
  for (const entry of entries) {
    const trimmed = entry.trim();
    // Match: 0.0.0.0:5173->5173/tcp or 5173/tcp or [::]:5173->5173/tcp
    const match = trimmed.match(/^(?:(\S+):)?(\d+)->(\d+)\/(\w+)$/);
    if (match) {
      ports.push({
        hostIp: match[1] || '0.0.0.0',
        hostPort: parseInt(match[2], 10),
        containerPort: parseInt(match[3], 10),
        protocol: match[4]
      });
    } else {
      // Handle case without host port mapping
      const simpleMatch = trimmed.match(/^(\d+)\/(\w+)$/);
      if (simpleMatch) {
        ports.push({
          hostIp: '0.0.0.0',
          hostPort: null,
          containerPort: parseInt(simpleMatch[1], 10),
          protocol: simpleMatch[2]
        });
      }
    }
  }
  return ports;
}

function parseHealth(healthStr) {
  if (!healthStr || healthStr === 'none') return null;
  // Format: "healthy" or "unhealthy" or "starting" or "(healthy)"
  const match = healthStr.match(/\(?(\w+)\)?/);
  if (match) {
    return { status: match[1] };
  }
  return null;
}

export async function discoverDocker() {
  try {
    // Use docker ps with JSON format for structured output
    const output = await runDockerCommand([
      'ps', '--all', '--format', '{{json .}}'
    ]);

    const lines = output.split('\n').filter(l => l.trim());
    const results = [];

    for (const line of lines) {
      try {
        const container = JSON.parse(line);
        const ports = parsePorts(container.Ports);
        const health = parseHealth(container.HealthStatus);

        results.push({
          id: container.ID,
          shortId: container.ID.slice(0, 12),
          name: container.Names,
          image: container.Image,
          state: container.State, // 'running', 'exited', 'paused', etc.
          status: container.Status,
          ports,
          health,
          labels: {}, // Could parse Labels if needed
          created: parseCreated(container.CreatedAt)
        });
      } catch (err) {
        console.warn('[docker] Failed to parse container:', err.message);
      }
    }

    return results;
  } catch (err) {
    console.warn('[docker] Docker not accessible:', err.message);
    return { error: err.message, containers: [] };
  }
}

function parseCreated(createdStr) {
  // Format: "2026-10-05 16:16:43 -0500 CDT"
  try {
    return new Date(createdStr).getTime();
  } catch {
    return Date.now();
  }
}

export async function getDockerInfo() {
  try {
    const config = getConfig();
    const dockerArgs = config.docker.socket ? ['-H', config.docker.socket] : [];
    const versionOutput = await runDockerCommand([...dockerArgs, 'version', '--format', '{{.Server.Version}}']);
    const infoOutput = await runDockerCommand([...dockerArgs, 'info', '--format', '{{.ContainersRunning}},{{.Containers}},{{.Images}},{{.OperatingSystem}},{{.KernelVersion}}']);

    const [containersRunning, containersTotal, images, os, kernel] = infoOutput.split(',');

    return {
      available: true,
      containersRunning: parseInt(containersRunning, 10),
      containersTotal: parseInt(containersTotal, 10),
      images: parseInt(images, 10),
      serverVersion: versionOutput,
      os,
      kernel
    };
  } catch (err) {
    return {
      available: false,
      error: err.message
    };
  }
}