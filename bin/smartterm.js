#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartTerminal } from '../src/index.js';

// 自动处理 SSL 证书问题（代理/VPN 环境）
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// 抑制 TLS 警告
process.emitWarning = (warning, type, code) => {
  if (code === 'ERR_INVALID_ARG_VALUE' || type === 'ExperimentalWarning') return;
  const origEmit = process.emitWarning;
  origEmit(warning, type, code);
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();
const smartterm = new SmartTerminal();

// 列出模型
program
  .command('models')
  .description('列出所有已注册的模型')
  .action(async () => {
    try {
      await smartterm.loadConfig();
      await smartterm.listModels();
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 向 AI 提问
program
  .command('ask')
  .description('向 AI 提问')
  .argument('<question>', '要问的问题')
  .option('-s, --silent', '静默模式，不显示解释，只输出命令')
  .option('--no-save', '不保存对话历史和命令记录')
  .action(async (question, options) => {
    try {
      await smartterm.loadConfig();
      
      const doSave = options.save !== false;
      
      if (!doSave) {
        const result = await smartterm.askSilent(question);
        console.log(JSON.stringify(result));
      } else if (options.stream) {
        const spinner = ora(chalk.cyan('正在思考...')).start();
        await smartterm.askStream(
          question,
          (chunk) => {
            spinner.stop();
            process.stdout.write(chunk);
          },
          () => {
            console.log('\n');
          }
        );
      } else {
        const result = await smartterm.ask(question);
        
        if (options.silent) {
          // 静默模式：输出 JSON 格式
          console.log(JSON.stringify(result));
        } else {
          // 正常模式
          if (result.explanation) {
            console.log(chalk.cyan('💡 ') + result.explanation);
          }
          if (result.command) {
            console.log(chalk.green('命令:'));
            console.log(chalk.white('  ' + result.command + '\n'));
          }
        }
      }
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 添加模型
program
  .command('add-model')
  .description('添加新的 AI 模型')
  .option('-n, --name <name>', '模型名称')
  .option('-p, --provider <provider>', 'API 格式 (openai/anthropic)')
  .option('-k, --api-key <key>', 'API 密钥')
  .option('-m, --model-name <name>', '模型名称 (如 gpt-4)')
  .option('-u, --base-url <url>', 'API 基础地址')
  .action(async (options) => {
    try {
      let name, provider, apiKey, modelName, baseUrl;

      if (options.name && options.provider && options.apiKey && options.modelName) {
        name = options.name;
        provider = options.provider;
        apiKey = options.apiKey;
        modelName = options.modelName;
        baseUrl = options.baseUrl || null;
      } else {
        console.log(chalk.cyan('\n📦 添加新模型\n'));
        console.log(chalk.gray('─'.repeat(40) + '\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: '模型名称 (用于标识，如 my-gpt4):',
            validate: (input) => input.trim() ? true : '请输入名称'
          },
          {
            type: 'list',
            name: 'provider',
            message: '选择 API 格式:',
            choices: [
              { name: 'OpenAI', value: 'openai' },
              { name: 'Anthropic', value: 'anthropic' }
            ]
          },
          {
            type: 'input',
            name: 'modelName',
            message: '模型名称 (如 gpt-4, claude-3-opus):',
            validate: (input) => input.trim() ? true : '请输入模型名称'
          },
          {
            type: 'input',
            name: 'apiKey',
            message: 'API 密钥:',
            mask: '*',
            validate: (input) => input.trim() ? true : '请输入 API 密钥'
          },
          {
            type: 'input',
            name: 'baseUrl',
            message: 'API 地址:',
            validate: (input) => input.trim() ? true : '请输入 API 地址'
          }
        ]);

        name = answers.name.trim();
        provider = answers.provider;
        modelName = answers.modelName.trim();
        apiKey = answers.apiKey.trim();
        baseUrl = answers.baseUrl.trim();
      }

      await smartterm.loadConfig();
      await smartterm.addModel(name, provider, apiKey, modelName, baseUrl);
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 删除模型
program
  .command('remove-model')
  .description('删除指定的模型')
  .argument('<name>', '要删除的模型名称')
  .action(async (name) => {
    try {
      await smartterm.loadConfig();
      await smartterm.removeModel(name);
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 切换模型
program
  .command('use')
  .description('切换默认使用的模型')
  .argument('<model>', '要使用的模型名称')
  .action(async (model) => {
    try {
      await smartterm.loadConfig();
      await smartterm.useModel(model);
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 清空对话历史
program
  .command('clear-history')
  .description('清空对话历史记录')
  .action(async () => {
    try {
      await smartterm.loadConfig();
      smartterm.clearHistory();
      console.log(chalk.green('\n✅ 对话历史已清空\n'));
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 列出命令历史
program
  .command('cmds')
  .description('列出已保存的命令')
  .action(async () => {
    try {
      await smartterm.loadConfig();
      smartterm.loadCommands();
      
      if (smartterm.commands.length === 0) {
        console.log(chalk.gray('\n(暂无命令记录)\n'));
        return;
      }

      console.log(chalk.cyan('\n📋 命令记录\n'));
      smartterm.commands.forEach((cmd, i) => {
        const num = smartterm.commands.length - i;
        console.log(chalk.white(`  ${num}. ${cmd.question}`));
        console.log(chalk.gray(`     解释: ${cmd.explanation}`));
        console.log(chalk.green(`     命令: ${cmd.command}`));
        console.log(chalk.gray(`     ID: ${cmd.id}`));
        console.log();
      });
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 删除命令记录
program
  .command('del-cmd')
  .description('删除指定的命令记录（不带参数则清空所有）')
  .argument('[id]', '命令记录的 ID（可选，不传则清空所有）')
  .action(async (id) => {
    try {
      await smartterm.loadConfig();
      if (id) {
        smartterm.deleteCommand(id);
        console.log(chalk.green('\n✅ 命令记录已删除\n'));
      } else {
        smartterm.deleteAllCommands();
        console.log(chalk.green('\n✅ 所有命令记录已清空\n'));
      }
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 导出命令（纯命令文本）
program
  .command('export-cmds')
  .description('导出命令为纯文本')
  .action(async () => {
    try {
      await smartterm.loadConfig();
      const text = smartterm.exportCommands();
      console.log(text || chalk.gray('(暂无命令记录)'));
    } catch (error) {
      console.log(chalk.red('\n❌ 错误: ' + error.message + '\n'));
      process.exit(1);
    }
  });

// 内部命令：获取当前模型名
program.option('--current-model', '获取当前模型名称');

const opts = program.opts();
if (opts.currentModel) {
  smartterm.loadConfig().then(() => {
    const model = smartterm.getCurrentModel();
    if (model && model !== '未设置') {
      console.log(model);
    }
  });
  process.exit(0);
}

// 输出 shell 集成脚本
if (process.argv.includes('shell-config')) {
  const configDir = path.join(process.cwd(), '.smartterm');
  const binPath = path.resolve(__dirname);
  
  console.log(`
# ============================================
# SmartTerminal Shell 集成配置
# ============================================

# 在 ~/.zshrc 或 ~/.bashrc 中添加以下内容:

function smartterm_prompt() {
  local config="${configDir}/config.json"
  if [ -f "$config" ]; then
    local model=$(grep '"defaultModel"' "$config" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\\1/')
    if [ -n "$model" ]; then
      echo -n "\\033[36m[$model]\\033[0m"
    fi
  fi
}

# Zsh: 添加到 PS1
# PROMPT='$(smartterm_prompt) '$PROMPT

# 或 Bash: 添加到 PS1  
# PS1='$(smartterm_prompt)'$PS1

# ============================================
# 快速使用:
#   source <(smartterm shell-config)
# ============================================
`);
  process.exit(0);
}

// 帮助信息
program
  .name('smartterm')
  .description('🤖 AI 终端助手 - 模型管理')
  .version('1.0.0');

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}
