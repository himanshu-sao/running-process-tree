/**
 * Configuration loader - loads from file (YAML/JSON), environment variables, and defaults.
 * Supports hot-reload for non-structural keys.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfigFromEnv, mergeConfig, validateConfig, CONFIG_DEFAULTS, CONFIG_SCHEMA } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentConfig = null;
let configFilePath = null;
let configWatchers = [];

export class ConfigLoader {
  static load(configPath = null) {
    let fileConfig = {};

    if (configPath) {
      configFilePath = path.resolve(configPath);
    } else if (configFilePath) {
      // Use previously set path
    } else {
      // Default locations
      const possiblePaths = [
        path.resolve(process.cwd(), 'config.yaml'),
        path.resolve(process.cwd(), 'config.yml'),
        path.resolve(process.cwd(), 'config.json'),
        path.resolve(__dirname, '..', 'config.yaml'),
        path.resolve(__dirname, '..', 'config.yml'),
        path.resolve(__dirname, '..', 'config.json'),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          configFilePath = p;
          break;
        }
      }
    }

    if (configFilePath && fs.existsSync(configFilePath)) {
      const content = fs.readFileSync(configFilePath, 'utf8');
      const ext = path.extname(configFilePath).toLowerCase();
      if (ext === '.yaml' || ext === '.yml') {
        fileConfig = ConfigLoader.parseYaml(content);
      } else if (ext === '.json') {
        fileConfig = JSON.parse(content);
      } else {
        throw new Error(`Unsupported config file format: ${ext}`);
      }
    }

    const envConfig = loadConfigFromEnv();
    currentConfig = mergeConfig(fileConfig, envConfig);
    validateConfig(currentConfig);

    // Ensure dataDir exists
    const dataDir = path.resolve(currentConfig.dataDir);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    currentConfig.dataDir = dataDir;

    return currentConfig;
  }

  static get() {
    if (!currentConfig) {
      return ConfigLoader.load();
    }
    return currentConfig;
  }

  static getConfigFilePath() {
    return configFilePath;
  }

  static parseYaml(content) {
    // Simple YAML parser for our use case (no external dependency)
    // Supports: key: value, nested objects, arrays, strings, numbers, booleans
    const lines = content.split('\n');
    const result = {};
    const stack = [{ indent: -1, obj: result }];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const indent = line.length - line.trimStart().length;

      // Find parent in stack
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;

      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();

        if (value === '' || value === '|') {
          // Object or multiline string - next lines will be children
          const newObj = {};
          parent[key.trim()] = newObj;
          stack.push({ indent, obj: newObj });
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          const arrContent = value.slice(1, -1).trim();
          if (arrContent === '') {
            parent[key.trim()] = [];
          } else {
            parent[key.trim()] = arrContent.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          }
        } else {
          // Simple value
          parent[key.trim()] = ConfigLoader.parseValue(value);
        }
      } else if (trimmed.startsWith('- ')) {
        // Array item
        const arrayParent = stack[stack.length - 2]?.obj;
        const arrayKey = Object.keys(arrayParent).find(k => Array.isArray(arrayParent[k]));
        if (arrayKey) {
          arrayParent[arrayKey].push(ConfigLoader.parseValue(trimmed.slice(2).trim()));
        }
      }
    }

    return result;
  }

  static parseValue(value) {
    const trimmed = value.trim().replace(/^["']|["']$/g, '');
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null' || trimmed === '~') return null;
    const num = Number(trimmed);
    if (!Number.isNaN(num) && trimmed !== '') return num;
    return trimmed;
  }

  static watch(callback) {
    if (!configFilePath || !fs.existsSync(configFilePath)) {
      return () => {}; // No-op unwatch
    }

    const watcher = fs.watch(configFilePath, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        try {
          const oldConfig = { ...currentConfig };
          ConfigLoader.load();
          // Only notify for non-structural changes
          const structuralKeys = ['bind', 'port', 'dataDir', 'dockerSocket', 'collectors'];
          const hasStructuralChange = structuralKeys.some(k => oldConfig[k] !== currentConfig[k]);
          if (!hasStructuralChange) {
            callback(currentConfig, oldConfig);
          }
        } catch (err) {
          console.error('Config reload failed:', err.message);
        }
      }
    });

    configWatchers.push(watcher);
    return () => {
      watcher.close();
      configWatchers = configWatchers.filter(w => w !== watcher);
    };
  }

  static closeWatchers() {
    for (const watcher of configWatchers) {
      watcher.close();
    }
    configWatchers = [];
  }
}

// Initialize on import
ConfigLoader.load();

export default ConfigLoader;