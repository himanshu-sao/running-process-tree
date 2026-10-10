/**
 * Configuration loader - reads config.yaml and merges with environment variables
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, '../config.yaml');

let config = null;

function loadConfig() {
  if (config) return config;

  // Default configuration
  const defaults = {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },
    scan: {
      interval: 60000,
      enabled: true
    },
    probe: {
      timeout: 3000,
      concurrency: 10,
      path: '/',
      scheme: 'http',
      tlsRejectUnauthorized: true
    },
    docker: {
      socket: '',
      enabled: true,
      includeStopped: true
    },
    host: {
      command: 'lsof',
      args: ['-iTCP', '-sTCP:LISTEN', '-P', '-n'],
      enabled: true
    },
    logging: {
      level: 'info',
      format: 'json'
    },
    frontend: {
      themePersistence: true,
      defaultTheme: 'system'
    }
  };

  // Try to load from YAML file
  let fileConfig = {};
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    fileConfig = yaml.load(fileContents) || {};
  } catch (err) {
    console.warn('[config] Could not load config.yaml, using defaults:', err.message);
  }

  // Merge configs: defaults -> file -> env vars
  config = deepMerge(defaults, fileConfig);

  // Override with environment variables
  applyEnvOverrides(config);

  return config;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function applyEnvOverrides(config) {
  // Server
  if (process.env.PORT) config.server.port = parseInt(process.env.PORT, 10);
  if (process.env.HOST) config.server.host = process.env.HOST;

  // Scan
  if (process.env.SCAN_INTERVAL) config.scan.interval = parseInt(process.env.SCAN_INTERVAL, 10);
  if (process.env.SCAN_ENABLED !== undefined) config.scan.enabled = process.env.SCAN_ENABLED === 'true';

  // Probe
  if (process.env.PROBE_TIMEOUT) config.probe.timeout = parseInt(process.env.PROBE_TIMEOUT, 10);
  if (process.env.PROBE_CONCURRENCY) config.probe.concurrency = parseInt(process.env.PROBE_CONCURRENCY, 10);
  if (process.env.PROBE_PATH) config.probe.path = process.env.PROBE_PATH;
  if (process.env.PROBE_SCHEME) config.probe.scheme = process.env.PROBE_SCHEME;
  if (process.env.PROBE_TLS_REJECT_UNAUTHORIZED !== undefined) {
    config.probe.tlsRejectUnauthorized = process.env.PROBE_TLS_REJECT_UNAUTHORIZED === 'true';
  }

  // Docker
  if (process.env.DOCKER_SOCKET) config.docker.socket = process.env.DOCKER_SOCKET;
  if (process.env.DOCKER_ENABLED !== undefined) config.docker.enabled = process.env.DOCKER_ENABLED === 'true';
  if (process.env.DOCKER_INCLUDE_STOPPED !== undefined) config.docker.includeStopped = process.env.DOCKER_INCLUDE_STOPPED === 'true';

  // Host
  if (process.env.HOST_COMMAND) config.host.command = process.env.HOST_COMMAND;
  if (process.env.HOST_ARGS) config.host.args = process.env.HOST_ARGS.split(',');
  if (process.env.HOST_ENABLED !== undefined) config.host.enabled = process.env.HOST_ENABLED === 'true';

  // Logging
  if (process.env.LOG_LEVEL) config.logging.level = process.env.LOG_LEVEL;
  if (process.env.LOG_FORMAT) config.logging.format = process.env.LOG_FORMAT;
}

export function getConfig() {
  if (!config) {
    loadConfig();
  }
  return config;
}

export function getConfigValue(path) {
  const cfg = getConfig();
  return path.split('.').reduce((obj, key) => obj?.[key], cfg);
}

export default { getConfig, getConfigValue, loadConfig };