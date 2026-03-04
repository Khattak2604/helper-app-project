const axios = require('axios');

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

// Ollama cloud uses openai-compatible endpoint at ollama.com
const BASE_URL = 'https://ollama.com/v1';

async function chatWithOllama(messages, systemPrompt) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OLLAMA_API_KEY}`
  };

  const payload = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    stream: false,
    temperature: 0.1  // Low temp = more consistent JSON output
  };

  // Try multiple endpoint formats that Ollama cloud supports
  const endpoints = [
    'https://ollama.com/v1/chat/completions',
    'https://api.ollama.com/v1/chat/completions',
    'https://ollama.ai/v1/chat/completions',
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      console.log(`Trying Ollama endpoint: ${url}`);
      const response = await axios.post(url, payload, { headers, timeout: 60000 });

      // OpenAI-compatible response
      if (response.data.choices?.[0]?.message?.content) {
        console.log('✅ Ollama cloud responded successfully');
        return response.data.choices[0].message.content;
      }
      // Native Ollama response
      if (response.data.message?.content) {
        return response.data.message.content;
      }
      if (response.data.response) {
        return response.data.response;
      }
    } catch (err) {
      console.warn(`Endpoint ${url} failed:`, err.response?.status, err.response?.data?.error || err.message);
      lastError = err;
    }
  }

  throw new Error(`All Ollama endpoints failed. Last error: ${lastError?.response?.data?.error || lastError?.message}`);
}

module.exports = { chatWithOllama };
