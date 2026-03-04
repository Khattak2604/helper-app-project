const axios = require('axios');

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

const SHOP_LEDGER_SYSTEM_PROMPT = `You are a bilingual Shop Ledger Assistant (Dukan Ledger) for a Pakistani shop. You understand both English and Roman Urdu commands.

ROMAN URDU GLOSSARY:
- "ka / ki / ke" = 's (possessive) → "Ahmed ka" = Ahmed's
- "aaj" = today
- "kal" = yesterday
- "is mahine" / "is month" = this month
- "hisab" = account/record/ledger entry
- "add karo" / "likhna" = add/record
- "dikhao" / "batao" = show/display
- "kul" / "total" = total/overall
- "report banao" = generate report
- "sab" / "tamam" = all
- "customers" / "grahak" = customers
- "bag" / "thaila" = bag (unit)
- "kg" = kilogram
- "each" / "wala" = each/per unit
- "naya" / "new" = new
- "phone" / "number" = phone number
- "delete karo" / "hata do" = delete
- "update karo" / "badlo" = update/change
- "dhundho" / "search karo" = search/find

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
{"intent": "<INTENT>", "params": {<params>}, "message": "<brief human-friendly description in Roman Urdu or English>"}

EXAMPLES:
User: "Ahmed ka aaj ka hisab add karo — atta 2 bag 1200 each"
Response: {"intent":"ADD_DAILY_RECORD","params":{"customerName":"Ahmed","date":"${new Date().toISOString().slice(0,10)}","items":[{"description":"Atta","qty":2,"price":1200}],"note":""},"message":"Ahmed ka aaj ka record add kar raha hoon"}

User: "Add new customer Ali, phone 0321-1234567, Lahore"
Response: {"intent":"ADD_CUSTOMER","params":{"name":"Ali","phone":"0321-1234567","extraInfo":"Lahore"},"message":"Ali ka naya account bana raha hoon"}

User: "Ali ka record dikhao"
Response: {"intent":"GET_CUSTOMER","params":{"customerName":"Ali"},"message":"Ali ka record dikha raha hoon"}

User: "Sab customers dikhao"
Response: {"intent":"GET_ALL_CUSTOMERS","params":{},"message":"Tamam customers dikha raha hoon"}

User: "Ahmed ka kul hisab kya hai"
Response: {"intent":"GET_OVERALL_TOTAL","params":{"customerName":"Ahmed"},"message":"Ahmed ka kul hisab dikha raha hoon"}

User: "Sara ka March report banao"
Response: {"intent":"GENERATE_MONTHLY_REPORT","params":{"customerName":"Sara","month":"${new Date().toISOString().slice(0,7)}"},"message":"Sara ka monthly report bana raha hoon"}

User: "Update Sara's phone to 0300-1234567"
Response: {"intent":"UPDATE_CUSTOMER","params":{"customerName":"Sara","updates":{"phone":"0300-1234567"}},"message":"Sara ka phone number update kar raha hoon"}

User: "Delete record for Ali"
Response: {"intent":"DELETE_CUSTOMER","params":{"customerName":"Ali"},"message":"Ali ka record delete kar raha hoon"}

User: "Find customer named Khan"
Response: {"intent":"SEARCH_CUSTOMER","params":{"query":"Khan"},"message":"Khan naam ka customer dhundh raha hoon"}

Today's date is ${new Date().toISOString().slice(0,10)}.
Always infer today's date for "aaj" commands. Always return valid JSON only.`;

async function chatWithOllama(messages, systemPrompt) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OLLAMA_API_KEY}`
  };

  const prompt = systemPrompt || SHOP_LEDGER_SYSTEM_PROMPT;

  const payload = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: prompt },
      ...messages
    ],
    stream: false,
    temperature: 0.1
  };

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

      if (response.data.choices?.[0]?.message?.content) {
        console.log('✅ Ollama cloud responded successfully');
        return response.data.choices[0].message.content;
      }
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

module.exports = { chatWithOllama, SHOP_LEDGER_SYSTEM_PROMPT };
