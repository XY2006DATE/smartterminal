import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import OpenAI from 'openai';
import ora from 'ora';

export class SmartTerminal {
  constructor() {
    // 优先使用项目目录中的配置，否则使用用户目录
    const projectConfigDir = path.join(process.cwd(), '.smartterm');
    const homeConfigDir = path.join(os.homedir(), '.smartterm');
    
    // 检查哪个目录可写
    this.configDir = projectConfigDir;
    this.configFile = path.join(this.configDir, 'config.json');
    this.historyFile = path.join(this.configDir, 'history.json');
    this.commandsFile = path.join(this.configDir, 'commands.json');
    this.config = null;
    this.client = null;
    this.conversationHistory = [];
    this.commands = [];
  }
  
  // 获取当前操作系统
  getOS() {
    const platform = process.platform;
    if (platform === 'darwin') return 'macOS';
    if (platform === 'win32') return 'Windows';
    return 'Linux/Unix';
  }
  
  // 获取默认 shell
  getDefaultShell() {
    const platform = process.platform;
    if (platform === 'win32') return 'PowerShell';
    return 'bash/zsh';
  }
  
  // 获取 CPU 品牌检测命令
  getCPUCmd() {
    const platform = process.platform;
    if (platform === 'darwin') return "sysctl -n machdep.cpu.brand_string";
    if (platform === 'win32') return "wmic cpu get name";
    return "cat /proc/cpuinfo | grep 'model name' | head -1";
  }
  
  // 加载历史记录
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        this.conversationHistory = JSON.parse(content);
      } else {
        this.conversationHistory = [];
      }
    } catch {
      this.conversationHistory = [];
    }
  }
  
  // 保存历史记录
  saveHistory() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, JSON.stringify(this.conversationHistory, null, 2));
    } catch {
      // 忽略保存失败
    }
  }
  
  // 清空历史记录
  clearHistory() {
    this.conversationHistory = [];
    this.saveHistory();
  }

  // 加载命令历史
  loadCommands() {
    try {
      if (fs.existsSync(this.commandsFile)) {
        this.commands = JSON.parse(fs.readFileSync(this.commandsFile, 'utf-8'));
      } else {
        this.commands = [];
      }
    } catch {
      this.commands = [];
    }
  }

  // 保存命令历史
  saveCommands() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.commandsFile, JSON.stringify(this.commands, null, 2));
    } catch {
      // 忽略保存失败
    }
  }

  // 添加命令记录
  addCommand(question, explanation, command) {
    this.loadCommands();
    this.commands.unshift({
      id: crypto.randomUUID(),
      question,
      explanation,
      command,
      createdAt: new Date().toISOString()
    });
    this.saveCommands();
  }

  // 删除命令记录
  deleteCommand(id) {
    this.loadCommands();
    const before = this.commands.length;
    this.commands = this.commands.filter(c => c.id !== id);
    if (this.commands.length === before) {
      throw new Error(`命令 ID "${id}" 不存在`);
    }
    this.saveCommands();
  }

  deleteAllCommands() {
    this.loadCommands();
    this.commands = [];
    this.saveCommands();
  }

  // 导出命令（纯命令文本）
  exportCommands() {
    this.loadCommands();
    return this.commands.map(c => c.command).filter(c => c).join('\n');
  }

  // 创建加载动画
  createSpinner(text) {
    return ora({
      text: chalk.cyan(text),
      spinner: 'dots'
    }).start();
  }

  // 加载配置
  async loadConfig() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configFile)) {
      // 创建默认配置
      this.config = {
        defaultModel: 'openai',
        models: {},
        settings: {
          autoExecute: false,
          showCost: false
        }
      };
      await this.saveConfig();
      console.log(chalk.yellow('📋 首次使用，请先添加 AI 模型配置\n'));
      console.log(chalk.gray('运行 "smartterm add-model" 添加模型\n'));
      return;
    }

    try {
      const content = fs.readFileSync(this.configFile, 'utf-8');
      this.config = JSON.parse(content);
    } catch (error) {
      throw new Error(`配置文件读取失败: ${error.message}`);
    }
    
    // 加载对话历史
    this.loadHistory();
  }

  // 保存配置
  async saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`配置文件保存失败: ${error.message}`);
    }
  }

  // 初始化 AI 客户端
  initClient() {
    if (!this.config || !this.config.models[this.config.defaultModel]) {
      throw new Error('请先添加 AI 模型配置');
    }

    const modelConfig = this.config.models[this.config.defaultModel];

    // 兼容旧格式 api_key / model
    const apiKey = modelConfig.encryptedKey
      ? this.decryptKey(modelConfig.encryptedKey)
      : modelConfig.api_key;

    if (!apiKey) {
      throw new Error(`默认模型 "${this.config.defaultModel}" 未配置 API Key，请运行 smartterm add-model 添加`);
    }

    const modelName = modelConfig.modelName || modelConfig.model;

    const options = {
      apiKey: apiKey
    };

    if (modelConfig.baseUrl) {
      options.baseURL = modelConfig.baseUrl;
    }

    this.client = new OpenAI(options);
    return modelName;
  }

  // 加密 API Key
  encryptKey(key) {
    const secret = this.getSecret();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret), iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // 解密 API Key
  decryptKey(encryptedKey) {
    if (!encryptedKey.includes(':')) {
      return encryptedKey; // 兼容旧格式（明文 key 直接返回）
    }
    try {
      const secret = this.getSecret();
      const [ivHex, encrypted] = encryptedKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encryptedKey; // 解密失败视为明文 key
    }
  }

  // 获取加密密钥
  getSecret() {
    const machineId = os.hostname() + os.platform() + os.arch();
    return crypto.createHash('sha256').update(machineId).digest();
  }

  // 静默询问 AI（不保存对话历史和命令记录，仅获取结构化结果）
  async askSilent(question) {
    const modelName = this.initClient();
    const currentOS = this.getOS();
    const defaultShell = this.getDefaultShell();
    
    try {
      const systemPrompt = `你是一个专业的终端命令助手。当前环境：
|- 操作系统：${currentOS}
|- Shell：${defaultShell}

用户会描述他们想要完成的任务，你需要给出解释和命令。
如果用户只是打招呼或闲聊，不需要返回命令，直接回复即可。
如果需要返回命令，严格按以下格式：

解释：<简洁的自然语言解释>
命令：<对应的终端命令>`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
        { role: 'user', content: question }
      ];
      
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const response = completion.choices[0]?.message?.content || '';
      const { explanation, command } = this.parseResponse(response);
      return { explanation, command };
    } catch (error) {
      if (error.status === 401) {
        throw new Error('API 密钥无效，请检查模型配置');
      }
      if (error.status === 429) {
        throw new Error('请求过于频繁，请稍后重试');
      }
      throw new Error(`AI 请求失败: ${error.message}`);
    }
  }

  // 询问 AI
  async ask(question) {
    const modelName = this.initClient();
    const currentOS = this.getOS();
    const defaultShell = this.getDefaultShell();
    
    try {
      const systemPrompt = `你是一个专业的终端命令助手。当前环境：
- 操作系统：${currentOS}
- Shell：${defaultShell}

用户会描述他们想要完成的任务，你需要给出解释和命令。
如果用户只是打招呼或闲聊，不需要返回命令，直接回复即可。
如果需要返回命令，严格按以下格式：

解释：<简洁的自然语言解释>
命令：<对应的终端命令>`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
        { role: 'user', content: question }
      ];
      
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const response = completion.choices[0]?.message?.content || '';
      const { explanation, command } = this.parseResponse(response);
      return this._finishAsk(question, response, explanation, command);
    } catch (error) {
      if (error.status === 401) {
        throw new Error('API 密钥无效，请检查模型配置');
      }
      if (error.status === 429) {
        throw new Error('请求过于频繁，请稍后重试');
      }
      throw new Error(`AI 请求失败: ${error.message}`);
    }
  }

  // 流式询问 AI
  async askStream(question, onChunk, onEnd) {
    const modelName = this.initClient();
    const currentOS = this.getOS();
    const defaultShell = this.getDefaultShell();
    
    try {
      const systemPrompt = `你是一个专业的终端命令助手。当前环境：
- 操作系统：${currentOS}
- Shell：${defaultShell}

用户会描述他们想要完成的任务，你需要给出解释和命令。
如果用户只是打招呼或闲聊，不需要返回命令，直接回复即可。
如果需要返回命令，严格按以下格式：

解释：<简洁的自然语言解释>
命令：<对应的终端命令>`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
        { role: 'user', content: question }
      ];
      
      let fullResponse = '';
      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          if (onChunk) onChunk(content);
        }
      }
      
      const { explanation, command } = this.parseResponse(fullResponse);
      const result = this._finishAsk(question, fullResponse, explanation, command);
      if (onEnd) onEnd(result);
      return result;
    } catch (error) {
      if (error.status === 401) {
        throw new Error('API 密钥无效，请检查模型配置');
      }
      if (error.status === 429) {
        throw new Error('请求过于频繁，请稍后重试');
      }
      throw new Error(`AI 请求失败: ${error.message}`);
    }
  }

  // 通用保存对话历史
  _finishAsk(question, response, explanation, command) {
    this.conversationHistory.push({ role: 'user', content: question });
    this.conversationHistory.push({ role: 'assistant', content: response });
    
    if (this.conversationHistory.length > 40) {
      this.conversationHistory = this.conversationHistory.slice(-40);
    }
    
    this.saveHistory();
    
    if (command) {
      this.addCommand(question, explanation, command);
    }
    
    return { explanation, command };
  }

  // 解析 AI 响应
  parseResponse(response) {
    const lines = response.split('\n');
    let explanation = '';
    let command = '';

    for (const line of lines) {
      if (line.startsWith('解释：') || line.startsWith('解释:')) {
        explanation = line.replace(/^解释[：:]\s*/, '').trim();
      } else if (line.startsWith('命令：') || line.startsWith('命令:')) {
        command = line.replace(/^命令[：:]\s*/, '').trim();
      }
    }

    // 如果没有按格式输出，尝试提取代码块
    if (!explanation && !command) {
      const codeMatch = response.match(/```(?:bash|sh|powershell|cmd)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        command = codeMatch[1].trim();
        explanation = response.replace(/```[\s\S]*?```/, '').trim() || '我将为你执行以下命令';
      } else {
        // 假设整段都是解释
        explanation = response;
      }
    }

    // 提取纯命令（去除注释）
    command = command
      .split('\n')
      .map(line => {
        // 移除行注释
        const commentIndex = line.indexOf('#');
        if (commentIndex !== -1) {
          line = line.substring(0, commentIndex);
        }
        return line.trim();
      })
      .filter(line => line)
      .join(' && ');

    return { explanation, command };
  }

  // 显示帮助
  showHelp() {
    console.log(chalk.cyan('\n📖 SmartTerminal 帮助\n'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.white('\n使用方式:'));
    console.log(chalk.gray('  smartterm [command] [options]\n'));
    
    console.log(chalk.white('\n命令:'));
    console.log(chalk.gray('  ask <question>       '), chalk.white('向 AI 提问'));
    console.log(chalk.gray('  models              '), chalk.white('列出所有模型'));
    console.log(chalk.gray('  add-model           '), chalk.white('添加新模型'));
    console.log(chalk.gray('  remove-model <name> '), chalk.white('删除模型'));
    console.log(chalk.gray('  use <model>         '), chalk.white('切换默认模型'));
    console.log(chalk.gray('  cmds                '), chalk.white('列出已保存的命令'));
    console.log(chalk.gray('  del-cmd <id>        '), chalk.white('删除命令记录'));
    console.log(chalk.gray('  export-cmds         '), chalk.white('导出命令为纯文本'));
    console.log(chalk.gray('  help                '), chalk.white('显示帮助'));
    
    console.log(chalk.white('\n交互模式命令:'));
    console.log(chalk.gray('  exit/quit         '), chalk.white('退出程序'));
    console.log(chalk.gray('  models            '), chalk.white('管理模型'));
    console.log(chalk.gray('  help              '), chalk.white('显示帮助'));
    
    console.log(chalk.white('\n示例:'));
    console.log(chalk.gray('  smartterm ask "列出当前目录的文件"'));
    console.log(chalk.gray('  smartterm'));
    console.log(chalk.gray('  smartterm add-model\n'));
  }

  // 列出模型
  async listModels() {
    await this.loadConfig();
    
    console.log(chalk.cyan('\n📦 已注册的模型\n'));
    
    const models = Object.entries(this.config.models);
    
    if (models.length === 0) {
      console.log(chalk.gray('  (暂无模型)\n'));
      console.log(chalk.gray('  运行 "smartterm add-model" 添加第一个模型\n'));
      return;
    }

    for (const [name, config] of models) {
      const isDefault = name === this.config.defaultModel;
      console.log(chalk.white(`  ${name}`) + (isDefault ? chalk.green(' (默认)') : ''));
      console.log(chalk.gray(`    API格式: ${config.provider}`));
      console.log(chalk.gray(`    模型: ${config.modelName}`));
      if (config.baseUrl) {
        console.log(chalk.gray(`    API地址: ${config.baseUrl}`));
      }
      console.log();
    }
  }

  // 添加模型
  async addModel(name, provider, apiKey, modelName, baseUrl = null) {
    await this.loadConfig();

    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
    
    if (this.config.models[normalizedName]) {
      throw new Error(`模型 "${normalizedName}" 已存在`);
    }

    const modelConfig = {
      provider: provider,
      encryptedKey: this.encryptKey(apiKey),
      modelName: modelName
    };

    if (baseUrl) {
      modelConfig.baseUrl = baseUrl;
    }

    this.config.models[normalizedName] = modelConfig;

    // 如果是第一个模型，设为默认
    if (!this.config.defaultModel || Object.keys(this.config.models).length === 1) {
      this.config.defaultModel = normalizedName;
    }

    await this.saveConfig();
    
    console.log(chalk.green(`\n✅ 模型 "${normalizedName}" 添加成功!\n`));
    if (normalizedName === this.config.defaultModel) {
      console.log(chalk.cyan(`   已设为默认模型\n`));
    }
  }

  // 删除模型
  async removeModel(name) {
    await this.loadConfig();

    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
    
    if (!this.config.models[normalizedName]) {
      throw new Error(`模型 "${normalizedName}" 不存在`);
    }

    delete this.config.models[normalizedName];

    // 如果删除的是默认模型，清空默认模型
    if (this.config.defaultModel === normalizedName) {
      const remaining = Object.keys(this.config.models);
      this.config.defaultModel = remaining.length > 0 ? remaining[0] : '';
    }

    await this.saveConfig();
    console.log(chalk.green(`\n✅ 模型 "${normalizedName}" 已删除\n`));
  }

  // 切换默认模型
  async useModel(name) {
    await this.loadConfig();

    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
    
    if (!this.config.models[normalizedName]) {
      throw new Error(`模型 "${normalizedName}" 不存在`);
    }

    this.config.defaultModel = normalizedName;
    await this.saveConfig();
    
    console.log(chalk.green(`\n✅ 已切换到模型 "${normalizedName}"\n`));
  }

  // 获取当前模型名称
  getCurrentModel() {
    return this.config?.defaultModel || '未设置';
  }
}
