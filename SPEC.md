# SmartTerminal - 规格说明书

## 概念与愿景

SmartTerminal 是一个轻量级的 AI 终端助手，提供类似 conda 的模型管理体验。在终端提示符中实时显示当前使用的 AI 模型（如 `(deepseek)`），让用户清楚地知道当前使用哪个 AI 模型进行交互。

## 设计原则

1. **简洁**: 只做一件事——模型管理
2. **集成**: 与 shell 深度集成，提示符即状态
3. **安全**: API 密钥本地加密存储
4. **兼容**: 支持 OpenAI 格式的任何 API 提供商

## 核心功能

### 1. 模型管理 (CLI)

- `smartterm models` - 列出所有已注册模型
- `smartterm add-model` - 添加新模型（交互式或命令行，API 格式可选 OpenAI/Anthropic）
- `smartterm remove-model <name>` - 删除模型
- `smartterm use <model>` - 切换默认模型

### 2. Shell 集成

- 在提示符左侧显示当前模型: `(deepseek) user@host %`
- 自动检测 zsh/bash
- 配置保存在项目目录 `.smartterm/config.json`

### 3. 命令记录

- 每次 AI 返回命令时自动保存到 `.smartterm/commands.json`
- `smartterm cmds` - 列出所有命令记录（包含问题、解释、命令、ID）
- `smartterm del-cmd <id>` - 删除指定命令记录
- `smartterm export-cmds` - 导出纯命令文本

### 3. 安全存储

- API 密钥使用 AES-256-CBC 加密
- 加密密钥基于机器特征生成
- 只存储加密后的密钥

## 技术架构

```
smartterminal/
├── bin/
│   ├── smartterm.js          # CLI 主程序
│   └── smartterm-init.sh     # Shell 集成脚本
├── src/
│   └── index.js              # 核心逻辑
├── .smartterm/
│   └── config.json           # 配置文件 (用户生成)
└── package.json
```

## 数据模型

### 配置 (config.json)

```json
{
  "defaultModel": "deepseek",
  "models": {
    "deepseek": {
      "provider": "openai",
      "encryptedKey": "iv:encrypted_data",
      "modelName": "deepseek-chat",
      "baseUrl": "https://api.deepseek.com"
    }
  }
}
```

### 命令记录 (commands.json)

```json
[
  {
    "id": "uuid",
    "question": "用户问题",
    "explanation": "AI 解释",
    "command": "实际命令",
    "createdAt": "ISO时间戳"
  }
]
```

## 用户流程

1. 用户安装并链接 `smartterm`
2. 用户添加第一个模型 → 设为默认
3. 用户配置 shell 集成 → 提示符显示模型
4. 用户运行 `smartterm use <name>` 切换模型
5. 提示符自动更新显示新模型

## 状态

✅ 已实现: CLI 模型管理、Shell 集成、安全存储、命令记录与导出
