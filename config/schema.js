/**
 * Configuration schema with validation for the service dashboard.
 * Supports YAML/JSON file, environment variables, and defaults.
 */

export const CONFIG_DEFAULTS = {
  // Server
  bind: '0.0.0.0',
  port: 3000,
  expectedHostname: 'localhost',

  // Data
  dataDir: './data',

  // Scan
  scanInterval: 60000, // 60 seconds
  probeTimeout: 3000, // 3 seconds
  probeConcurrency: 10,
  probeDefaultPath: '/',
  offlineGracePeriod: 300000, // 5 minutes (5 consecutive failures at 60s interval)

  // Docker
  dockerSocket: '/var/run/docker.sock',
  dockerEnabled: true,

  // Collectors
  collectors: ['host', 'docker'],

  // Self-exclusion
  selfExclude: true,

  // Logging
  logLevel: 'info',
};

export const CONFIG_SCHEMA = {
  bind: { type: 'string', env: 'BIND' },
  port: { type: 'number', env: 'PORT', min: 1, max: 65535 },
  expectedHostname: { type: 'string', env: 'EXPECTED_HOSTNAME' },
  dataDir: { type: 'string', env: 'DATA_DIR' },
  scanInterval: { type: 'number', env: 'SCAN_INTERVAL', min: 1000 },
  probeTimeout: { type: 'number', env: 'PROBE_TIMEOUT', min: 100 },
  probeConcurrency: { type: 'number', env: 'PROBE_CONCURRENCY', min: 1, max: 100 },
  probeDefaultPath: { type: 'string', env: 'PROBE_DEFAULT_PATH' },
  offlineGracePeriod: { type: 'number', env: 'OFFLINE_GRACE_PERIOD', min: 0 },
  dockerSocket: { type: 'string', env: 'DOCKER_SOCKET' },
  dockerEnabled: { type: 'boolean', env: 'DOCKER_ENABLED' },
  collectors: { type: 'array', env: 'COLLECTORS' },
  selfExclude: { type: 'boolean', env: 'SELF_EXCLUDE' },
  logLevel: { type: 'string', env: 'LOG_LEVEL', enum: ['debug', 'info', 'warn', 'error'] },
};

export function validateConfig(config) {
  const errors = [];

  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    const value = config[key];

    if (value === undefined) {
      continue; // Will use default
    }

    if (schema.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors.push(`${key}: must be a number`);
      } else {
        if (schema.min !== undefined && value < schema.min) {
          errors.push(`${key}: must be >= ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
          errors.push(`${key}: must be <= ${schema.max}`);
        }
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${key}: must be a boolean`);
      }
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${key}: must be a string`);
      } else if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${key}: must be one of ${schema.enum.join(', ')}`);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${key}: must be an array`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export function loadConfigFromEnv() {
  const config = {};
  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    if (schema.env && process.env[schema.env] !== undefined) {
      let value = process.env[schema.env];
      if (schema.type === 'number') {
        value = Number(value);
        if (Number.isNaN(value)) {
          throw new Error(`Environment variable ${schema.env} must be a number`);
        }
      } else if (schema.type === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (schema.type === 'array') {
        value = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
      }
      config[key] = value;
    }
  }
  return config;
}

export function mergeConfig(fileConfig, envConfig, defaults = CONFIG_DEFAULTS) {
  return { ...defaults, ...fileConfig, ...envConfig };
}