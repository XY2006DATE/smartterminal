# SmartTerminal

AI 终端助手 - 在终端中显示当前 AI 模型，像 conda 一样管理你的 AI 模型配置。

## 特性

- **模型管理**: 轻松添加、切换、删除 AI 模型
- **Shell 集成**: 在提示符中显示当前模型 (类似 conda 环境)
- **API 密钥加密存储**: 安全的密钥管理

## 快速开始

### 1. 安装

```bash
cd /path/to/smartterminal
npm install
npm link
```

### 2. 添加模型

```bash
# 交互式添加
smartterm add-model

# 命令行参数添加
smartterm add-model -n deepseek -p openai -k YOUR_API_KEY -m deepseek-chat -u https://api.deepseek.com
```

### 3. Shell 集成

**Zsh (推荐):**

```bash
# 在 ~/.zshrc 中添加:
source /path/to/smartterminal/bin/smartterm-init.sh
```

**Bash:**

```bash
# 在 ~/.bashrc 中添加:
source /path/to/smartterminal/bin/smartterm-init.sh
```

然后重启终端，你会看到提示符变成:

```
(deepseek) xuyu@MacBook-Pro smartterminal %
```

## 命令

| 命令 | 说明 |
|------|------|
| `smartterm models` | 列出所有模型 |
| `smartterm add-model` | 添加新模型 |
| `smartterm remove-model <name>` | 删除模型 |
| `smartterm use <model>` | 切换模型 |
| `smartterm cmds` | 列出已保存的命令 |
| `smartterm del-cmd <id>` | 删除命令记录 |
| `smartterm export-cmds` | 导出命令为纯文本 |

## API 格式

- **OpenAI**: GPT-4, GPT-3.5 等
- **Anthropic**: Claude 等

## 配置文件

配置保存在项目目录的 `.smartterm/config.json` 中。

## License

MIT
