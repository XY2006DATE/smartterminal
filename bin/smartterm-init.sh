# SmartTerminal Zsh 集成
setopt PROMPT_SUBST
setopt NO_NOTIFY    # 禁用后台任务通知

SMARTTERM_SOURCE="${(%):-%x}"
if [ -z "$SMARTTERM_SOURCE" ]; then
  SMARTTERM_SOURCE="$0"
fi

SMARTTERM_DIR="$(cd "$(dirname "$SMARTTERM_SOURCE")/.." && pwd)"

smartterm_get_model() {
  local config="${SMARTTERM_DIR}/.smartterm/config.json"
  if [ -f "$config" ]; then
    grep '"defaultModel"' "$config" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\1/'
  fi
}

# 保存原始 PS1（避免重复）
if [ -z "$_SMARTTERM_ORIG_PS1" ]; then
  _SMARTTERM_ORIG_PS1="$PS1"
fi

# 每次显示提示符前更新 PS1
smartterm_update_prompt() {
  local model=$(smartterm_get_model)
  if [ -n "$model" ]; then
    PS1="%F{cyan}${model}%f $_SMARTTERM_ORIG_PS1"
  else
    PS1="$_SMARTTERM_ORIG_PS1"
  fi
}

# 添加 hook
autoload -Uz add-zsh-hook
add-zsh-hook precmd smartterm_update_prompt

# AI 对话功能
ai() {
  local question="$*"
  if [ -z "$question" ]; then
    echo "请输入问题，例如: ai 列出当前目录的文件"
    return
  fi
  
  # 调用 AI（静默模式，获取命令）
  local result
  result=$(NODE_TLS_REJECT_UNAUTHORIZED=0 node "${SMARTTERM_DIR}/bin/smartterm.js" ask "$question" -s --no-save 2>/dev/null)
  local exit_code=$?
  
  if [ $exit_code -eq 0 ]; then
    # 从 JSON 中提取命令
    local cmd=$(echo "$result" | grep -o '"command":"[^"]*"' | sed 's/"command":"\(.*\)"/\1/')
    if [ -n "$cmd" ]; then
      # 输出正常模式结果
      NODE_TLS_REJECT_UNAUTHORIZED=0 node "${SMARTTERM_DIR}/bin/smartterm.js" ask "$question" 2>/dev/null
      echo ""
    else
      # 无命令，输出 AI 回复
      echo ""
      echo "（无对应命令）"
    fi
  else
    echo ""
    echo "❌ AI 请求失败"
  fi
}

# 清空 AI 历史
ai-clear() {
  node "${SMARTTERM_DIR}/bin/smartterm.js" clear-history
}

# 检测是否包含中文
_smartterm_has_chinese() {
  local str="$1"
  # 检查 UTF-8 中文字符范围
  [[ "$str" =~ [一-龥] ]]
}

# 获取 AI 返回的命令（供 widget 使用）
_smartterm_ai_cmd() {
  local question="$*"
  local result
  result=$(NODE_TLS_REJECT_UNAUTHORIZED=0 node "${SMARTTERM_DIR}/bin/smartterm.js" ask "$question" -s --no-save 2>/dev/null)
  # 解析 JSON 中的 command 字段
  echo "$result" | grep -o '"command":"[^"]*"' | sed 's/"command":"\(.*\)"/\1/'
}

# Zle widget 版本
_smartterm_widget() {
  local cmd="$BUFFER"
  
  # 空命令正常执行
  [[ -z "$cmd" ]] && zle .accept-line && return
  
  # ai 命令正常执行
  [[ "$cmd" == ai\ * ]] && zle .accept-line && return
  
  # 检测中文
  if _smartterm_has_chinese "$cmd"; then
    local question="$BUFFER"
    
    # 直接调用，避免子函数上下文问题
    local result
    result=$(NODE_TLS_REJECT_UNAUTHORIZED=0 node "${SMARTTERM_DIR}/bin/smartterm.js" ask "$question" -s --no-save 2>/dev/null)
    local ai_cmd=$(echo "$result" | grep -o '"command":"[^"]*"' | sed 's/"command":"\(.*\)"/\1/')
    
    if [ -n "$ai_cmd" ]; then
      # 清空当前行，显示 AI 解释
      zle .kill-whole-line
      zle .reset-prompt
      echo ""
      
      # 输出解释
      NODE_TLS_REJECT_UNAUTHORIZED=0 node "${SMARTTERM_DIR}/bin/smartterm.js" ask "$question" 2>/dev/null
      
      # 用 zle -U 把命令推送到输入缓冲区
      zle -U "$ai_cmd"
    else
      # 无命令，输出 AI 回复
      zle .kill-whole-line
      zle .reset-prompt
      echo ""
      NODE_TLS_REJECT_UNAUTHORIZED=0 node "${SMARTTERM_DIR}/bin/smartterm.js" ask "$question" 2>/dev/null
      zle .reset-prompt
    fi
    return
  fi
  
  zle .accept-line
}

zle -N accept-line _smartterm_widget
