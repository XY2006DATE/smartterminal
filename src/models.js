import { loadConfig, saveConfig } from './config.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

export function listModels() {
  const config = loadConfig();
  const models = config.models;
  
  if (Object.keys(models).length === 0) {
    console.log(chalk.yellow('No models configured. Add one with: smartterm add-model'));
    return;
  }
  
  console.log(chalk.cyan('\n📋 Configured Models:\n'));
  console.log('┌─────────────────────┬────────────┬──────────────────────────────┐');
  console.log('│ Name                │ Provider   │ Model                        │');
  console.log('├─────────────────────┼────────────┼──────────────────────────────┤');
  
  for (const [name, model] of Object.entries(models)) {
    const isDefault = name === config.defaultModel;
    const marker = isDefault ? ' ✓' : '  ';
    const nameDisplay = isDefault ? chalk.green(name + marker) : name;
    console.log(`│ ${nameDisplay.padEnd(20)} │ ${model.provider.padEnd(10)} │ ${model.modelName.padEnd(28)} │`);
  }
  
  console.log('└─────────────────────┴────────────┴──────────────────────────────┘');
  console.log(chalk.gray(`\nDefault model: ${chalk.green(config.defaultModel)}`));
  console.log(chalk.gray(`Config file: ${chalk.underline('~/.smartterm/config.json')}`));
}

export async function addModel() {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Model name (e.g., my-gpt4):',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = loadConfig();
        if (config.models[input.trim()]) return 'Model with this name already exists';
        return true;
      }
    },
    {
      type: 'list',
      name: 'provider',
      message: 'Select provider:',
      choices: [
        { name: 'OpenAI Compatible', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Custom (OpenAI format)', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'API Base URL:',
      default: (answers) => {
        if (answers.provider === 'openai') return 'https://api.openai.com/v1';
        if (answers.provider === 'anthropic') return 'https://api.anthropic.com/v1';
        return 'https://api.openai.com/v1';
      }
    },
    {
      type: 'input',
      name: 'modelName',
      message: 'Model name (e.g., gpt-4, claude-3-sonnet):',
      validate: (input) => input.trim() ? true : 'Model name is required'
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API Key:',
      mask: '*',
      validate: (input) => input.trim() ? true : 'API key is required'
    }
  ];

  const answers = await inquirer.prompt(questions);
  
  const config = loadConfig();
  config.models[answers.name.trim()] = {
    provider: answers.provider,
    baseUrl: answers.baseUrl.trim(),
    modelName: answers.modelName.trim(),
    apiKey: answers.apiKey.trim(),
    enabled: true
  };
  
  saveConfig(config);
  
  console.log(chalk.green(`\n✓ Model "${answers.name}" added successfully!`));
  console.log(chalk.gray(`  Use it with: smartterm use ${answers.name}`));
}

export function removeModel(modelName) {
  const config = loadConfig();
  
  if (!config.models[modelName]) {
    console.log(chalk.red(`Error: Model "${modelName}" not found`));
    return false;
  }
  
  delete config.models[modelName];
  
  if (config.defaultModel === modelName) {
    const remainingModels = Object.keys(config.models);
    config.defaultModel = remainingModels.length > 0 ? remainingModels[0] : '';
  }
  
  saveConfig(config);
  console.log(chalk.green(`✓ Model "${modelName}" removed successfully`));
  return true;
}

export function useModel(modelName) {
  const config = loadConfig();
  
  if (!config.models[modelName]) {
    console.log(chalk.red(`Error: Model "${modelName}" not found`));
    console.log(chalk.yellow('\nAvailable models:'));
    listModels();
    return false;
  }
  
  config.defaultModel = modelName;
  saveConfig(config);
  console.log(chalk.green(`✓ Now using model: ${modelName}`));
  return true;
}

export function getCurrentModel() {
  const config = loadConfig();
  return config.defaultModel;
}

export function getModelConfig(modelName = null) {
  const config = loadConfig();
  const name = modelName || config.defaultModel;
  return config.models[name] || null;
}
