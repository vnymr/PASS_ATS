import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.log('❌ OPENAI_API_KEY not set');
  process.exit(1);
}

console.log('=== OPENAI API TEST ===');
console.log('✅ API Key configured:', apiKey.substring(0, 10) + '...');

const openai = new OpenAI({ apiKey });

try {
  console.log('\n🧪 Testing GPT-5-mini access...');
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
    max_completion_tokens: 10
  });
  
  console.log('✅ GPT-5-mini: ACCESSIBLE');
  console.log('   Response:', response.choices[0].message.content);
  console.log('   Tokens:', response.usage.total_tokens);
  
  process.exit(0);
} catch (error) {
  console.error('❌ GPT-5-mini test FAILED:', error.message);
  if (error.status === 401) {
    console.error('   → Invalid API key');
  } else if (error.status === 404) {
    console.error('   → Model not available');
  }
  process.exit(1);
}
