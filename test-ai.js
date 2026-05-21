import chalk from 'chalk';
import OpenAI from 'openai';

async function testAI() {
  console.log('🔍 正在测试 AI 服务...\n');
  
  try {
    // 直接测试 OpenAI SDK
    const client = new OpenAI({
      apiKey: 'sk-89101ba639f24f1db1b50c7427787744',
      baseURL: 'https://api.deepseek.com'
    });
    
    console.log('✅ OpenAI 客户端创建成功');
    
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的终端命令助手。用户会描述他们想要完成的任务，你需要：\n1. 直接用自然语言解释你会如何完成这个任务\n2. 给出对应的终端命令（如果是macOS/Linux用bash，如果是Windows用powershell）\n3. 如果需要多个命令，用 && 或换行分隔\n4. 只返回命令，不要返回其他格式\n\n请用简洁的语言解释你的方案，然后给出命令。格式：\n解释：<你的自然语言解释>\n命令：<对应的终端命令>'
        },
        {
          role: 'user',
          content: '你好，请用一句话介绍自己'
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    console.log('✅ AI 请求成功！\n');
    
    const response = completion.choices[0]?.message?.content || '';
    console.log(chalk.cyan('🤖 AI 回答:\n'));
    console.log(chalk.white(response));
    console.log();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ 测试失败: ${error.message}\n`));
    console.error('Error type:', error.constructor.name);
    console.error('Error cause:', error.cause);
    if (error.response) {
      console.error('Response:', error.response);
    }
    process.exit(1);
  }
}

testAI();
