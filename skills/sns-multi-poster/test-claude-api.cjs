const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

(async () => {
  try {
    console.log('🔍 Claude API テスト開始...');
    console.log('API Key:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 20) + '...' : 'NOT SET');
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'こんにちは',
        },
      ],
    });
    
    console.log('✅ 成功:', message.content[0].text);
  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (error.error) {
      console.error('API エラー詳細:', JSON.stringify(error.error, null, 2));
    }
  }
})();
