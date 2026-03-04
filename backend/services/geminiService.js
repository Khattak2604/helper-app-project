const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Base Shop Ledger system prompt (no hardcoded language vocabulary — injected dynamically via language packs)
const SHOP_LEDGER_SYSTEM_PROMPT = `You are a Shop Ledger Assistant (Dukan Ledger) for a Pakistani shop. You understand natural language commands to manage customer records and daily transactions.

INTENT LIST AND PARAM SHAPES:
1. ADD_CUSTOMER: { "name": string, "phone": string, "extraInfo": string }
2. ADD_DAILY_RECORD: { "customerName": string, "date": "YYYY-MM-DD", "items": [{"description": string, "qty": number, "price": number}], "note": string }
3. GET_CUSTOMER: { "customerName": string }
4. GET_ALL_CUSTOMERS: {}
5. GET_DAILY_RECORDS: { "customerName": string, "month": "YYYY-MM" (optional) }
6. GET_OVERALL_TOTAL: { "customerName": string }
7. GENERATE_MONTHLY_REPORT: { "customerName": string, "month": "YYYY-MM" }
8. UPDATE_CUSTOMER: { "customerName": string, "updates": { "name": string, "phone": string, "extraInfo": string } }
9. DELETE_CUSTOMER: { "customerName": string }
10. SEARCH_CUSTOMER: { "query": string }

RESPONSE FORMAT — CRITICAL: Respond with ONLY raw JSON. No markdown. No backticks. No explanation. Just the JSON object:
{"intent": "<INTENT>", "params": {<params>}, "message": "<brief human-friendly description>"}

EXAMPLES:
User: "Add new customer Ali, phone 0321-1234567, Lahore"
Response: {"intent":"ADD_CUSTOMER","params":{"name":"Ali","phone":"0321-1234567","extraInfo":"Lahore"},"message":"Adding new customer Ali"}

User: "Show all customers"
Response: {"intent":"GET_ALL_CUSTOMERS","params":{},"message":"Showing all customers"}

User: "Get Ali's record"
Response: {"intent":"GET_CUSTOMER","params":{"customerName":"Ali"},"message":"Showing record for Ali"}

User: "Delete record for Ali"
Response: {"intent":"DELETE_CUSTOMER","params":{"customerName":"Ali"},"message":"Deleting record for Ali"}

User: "Find customer named Khan"
Response: {"intent":"SEARCH_CUSTOMER","params":{"query":"Khan"},"message":"Searching for Khan"}

Today's date is ${new Date().toISOString().slice(0, 10)}.
Always infer today's date for "today" commands. Always return valid JSON only.`;

/**
 * Build a dynamic system prompt by appending active language pack vocabulary.
 * @param {string[]} activeLanguageCodes - e.g. ["english", "roman-urdu"]
 * @returns {Promise<string>} - full combined system prompt
 */
async function buildSystemPrompt(activeLanguageCodes = []) {
  let prompt = SHOP_LEDGER_SYSTEM_PROMPT;
  const langPacksDir = path.join(__dirname, '../../data/language-packs');

  for (const code of activeLanguageCodes) {
    if (code === 'english') continue; // English is the base, no extra vocabulary needed
    try {
      const packPath = path.join(langPacksDir, `${code}.json`);
      if (await fs.pathExists(packPath)) {
        const pack = await fs.readJson(packPath);
        if (pack.systemPromptAddition) {
          prompt += `\n\n${pack.systemPromptAddition}`;
        }
      }
    } catch (err) {
      console.warn(`Could not load language pack "${code}":`, err.message);
    }
  }

  return prompt;
}

/**
 * Send chat messages to Google Gemini API.
 * @param {Array<{role: string, content: string}>} messages - conversation history in OpenAI format
 * @param {string} systemPrompt - the system prompt to use
 * @returns {Promise<string>} - AI text response
 */
async function chatWithGemini(messages, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please configure your API key in the app settings (⚙️ Setup) or set it in your .env file.');
  }

  const prompt = systemPrompt || SHOP_LEDGER_SYSTEM_PROMPT;

  // Map OpenAI-style history to Gemini format
  // Gemini roles: "user" | "model" (assistant → model)
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const payload = {
    system_instruction: {
      parts: [{ text: prompt }]
    },
    contents,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024
    }
  };

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }
    console.log('✅ Gemini responded successfully');
    return text;
  } catch (err) {
    if (err.response?.status === 400) {
      throw new Error('Invalid Gemini API request: ' + (err.response?.data?.error?.message || err.message));
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('Invalid or unauthorized Gemini API key. Please check your key in ⚙️ Setup.');
    }
    if (err.response?.status === 429) {
      throw new Error('Gemini API rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error('Gemini API error: ' + (err.response?.data?.error?.message || err.message));
  }
}

module.exports = { chatWithGemini, buildSystemPrompt, SHOP_LEDGER_SYSTEM_PROMPT };
