import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const CONFIG_DIR = path.join(os.homedir(), '.smartterm');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const ENCRYPTION_KEY = crypto.scryptSync('smartterm-key', 'salt', 32);

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function loadConfig() {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      defaultModel: 'gpt-4',
      models: {
        'gpt-4': {
          provider: 'openai',
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          modelName: 'gpt-4',
          enabled: true
        },
        'claude-3-sonnet': {
          provider: 'anthropic',
          apiKey: '',
          baseUrl: 'https://api.anthropic.com/v1',
          modelName: 'claude-3-sonnet-20240229',
          enabled: true
        }
      },
      settings: {
        autoExecute: false,
        showCost: true
      }
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(content);
    
    for (const modelName in config.models) {
      const model = config.models[modelName];
      if (model.apiKey && model.apiKey.includes(':')) {
        try {
          model.apiKey = decrypt(model.apiKey);
        } catch (e) {
          // API key might not be encrypted
        }
      }
    }
    
    return config;
  } catch (error) {
    console.error('Error loading config:', error.message);
    return getDefaultConfig();
  }
}

export function saveConfig(config) {
  ensureConfigDir();
  
  const configToSave = JSON.parse(JSON.stringify(config));
  
  for (const modelName in configToSave.models) {
    const model = configToSave.models[modelName];
    if (model.apiKey && !model.apiKey.includes(':')) {
      model.apiKey = encrypt(model.apiKey);
    }
  }
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configToSave, null, 2));
}

export function getDefaultConfig() {
  return {
    defaultModel: 'gpt-4',
    models: {},
    settings: {
      autoExecute: false,
      showCost: true
    }
  };
}

export function getConfigPath() {
  return CONFIG_FILE;
}
