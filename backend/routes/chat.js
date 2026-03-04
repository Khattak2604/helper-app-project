const express = require('express');
const router = express.Router();
const { chatWithOllama } = require('../services/ollamaService');
const db = require('../utils/dataStore');

const SYSTEM_PROMPT = `You are a contacts database assistant. Parse user commands into JSON for CRUD operations.

Database fields: id, name, phone, email, address

CRITICAL: Respond with ONLY raw JSON. No markdown. No backticks. No explanation. Just the JSON object.

JSON format:
{"action":"create|read|update|delete|search","filters":{},"updates":{},"newRecord":{},"message":"brief description"}

RULES:
- "create": extract ALL mentioned fields into "newRecord". Name = just the person's actual name (not "hamza with" - just "hamza")
- "read/search": extract search criteria into "filters". Empty filters = show all
- "update": search criteria in "filters", changed values in "updates"  
- "delete": search criteria in "filters"
- Only include fields that were actually mentioned by the user
- Clean the data: phone numbers digits only or with dashes, names are proper case

EXAMPLES:
User: "add a new person named hamza with phone 2222223333 email hamza@gmail.com and address islamabad"
Response: {"action":"create","filters":{},"updates":{},"newRecord":{"name":"Hamza","phone":"2222223333","email":"hamza@gmail.com","address":"Islamabad"},"message":"Creating new record for Hamza"}

User: "show all records"
Response: {"action":"read","filters":{},"updates":{},"newRecord":{},"message":"Fetching all records"}

User: "find records with name Ali"
Response: {"action":"search","filters":{"name":"Ali"},"updates":{},"newRecord":{},"message":"Searching for Ali"}

User: "update phone for Sara to 0300-9876543"
Response: {"action":"update","filters":{"name":"Sara"},"updates":{"phone":"0300-9876543"},"newRecord":{},"message":"Updating Sara's phone number"}

User: "delete hamza"
Response: {"action":"delete","filters":{"name":"Hamza"},"updates":{},"newRecord":{},"message":"Deleting record for Hamza"}
`;

router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    // Get current data context
    const allData = await db.readAll();
    const dataContext = `\nCurrent database has ${allData.length} records. IDs available: ${allData.map(r => `${r.name}(id:${r.id})`).join(', ')}`;

    // Build messages for Ollama
    const messages = [
      ...history.slice(-6), // keep last 3 turns
      { role: 'user', content: message + dataContext }
    ];

    let aiResponse;
    let parsed;
    let usedAI = false;

    try {
      aiResponse = await chatWithOllama(messages, SYSTEM_PROMPT);
      console.log('Raw AI response:', aiResponse);
      // Extract JSON - strip any markdown code fences first
      const cleaned = aiResponse.replace(/```(?:json)?/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI returned no JSON');
      parsed = JSON.parse(jsonMatch[0]);
      usedAI = true;
    } catch (aiErr) {
      console.warn('AI failed, using smart fallback. Reason:', aiErr.message);
      parsed = fallbackParser(message);
      parsed.aiError = aiErr.message;
    }

    // Execute the action
    const result = await executeAction(parsed, allData);

    res.json({
      success: true,
      intent: parsed,
      result,
      usedAI,
      aiError: parsed.aiError || null
    });

  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

async function executeAction(parsed, allData) {
  const { action, filters = {}, updates = {}, newRecord = {} } = parsed;

  switch (action) {
    case 'create': {
      if (!newRecord.name) return { type: 'error', message: 'Please provide at least a name to create a record.' };
      const created = await db.createRecord(newRecord);
      return { type: 'created', record: created, message: `✅ Created record for **${created.name}**` };
    }

    case 'read':
    case 'search': {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v));
      let records;
      if (Object.keys(cleanFilters).length === 0) {
        records = await db.readAll();
      } else {
        records = await db.findRecords(cleanFilters);
      }
      return {
        type: 'records',
        records,
        message: records.length === 0
          ? '❌ No records found matching your search.'
          : `📋 Found **${records.length}** record(s)`
      };
    }

    case 'update': {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v));
      const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([k, v]) => v));

      if (Object.keys(cleanUpdates).length === 0) {
        return { type: 'error', message: 'Please tell me what fields to update.' };
      }

      // If ID provided directly
      if (cleanFilters.id) {
        const updated = await db.updateRecord(cleanFilters.id, cleanUpdates);
        if (!updated) return { type: 'error', message: 'Record not found with that ID.' };
        return { type: 'updated', record: updated, message: `✅ Updated record for **${updated.name}**` };
      }

      // Search first
      const matches = await db.findRecords(cleanFilters);
      if (matches.length === 0) return { type: 'error', message: 'No matching records found to update.' };
      if (matches.length > 1) {
        return { type: 'ambiguous', records: matches, updates: cleanUpdates, message: `⚠️ Found **${matches.length}** matching records. Please tell me which ID to update.` };
      }

      // Single match - update it
      const updated = await db.updateRecord(matches[0].id, cleanUpdates);
      return { type: 'updated', record: updated, message: `✅ Updated record for **${updated.name}**` };
    }

    case 'delete': {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([k, v]) => v));

      if (cleanFilters.id) {
        const deleted = await db.deleteRecord(cleanFilters.id);
        if (!deleted) return { type: 'error', message: 'Record not found.' };
        return { type: 'deleted', record: deleted, message: `🗑️ Deleted record for **${deleted.name}**` };
      }

      const matches = await db.findRecords(cleanFilters);
      if (matches.length === 0) return { type: 'error', message: 'No matching records found to delete.' };
      if (matches.length > 1) {
        return { type: 'ambiguous', records: matches, message: `⚠️ Found **${matches.length}** matching records. Please specify an ID to delete.` };
      }

      const deleted = await db.deleteRecord(matches[0].id);
      return { type: 'deleted', record: deleted, message: `🗑️ Deleted record for **${deleted.name}**` };
    }

    default:
      return { type: 'info', message: parsed.message || "I didn't understand that. Try: 'add', 'show', 'update', or 'delete' a record." };
  }
}

// Smart fallback parser - handles natural language without AI
function fallbackParser(message) {
  const msg = message.toLowerCase();
  const parsed = { action: 'unknown', filters: {}, updates: {}, newRecord: {}, message: '' };

  // ── Detect action ──────────────────────────────────────────────
  if (/\b(add|create|new|insert|register|make)\b/.test(msg)) parsed.action = 'create';
  else if (/\b(delete|remove|erase|drop)\b/.test(msg)) parsed.action = 'delete';
  else if (/\b(update|change|edit|modify|set|rename|fix|correct)\b/.test(msg)) parsed.action = 'update';
  else if (/\b(show|list|get|find|search|fetch|display|view|all records)\b/.test(msg)) parsed.action = 'read';

  // ── Field extractors ───────────────────────────────────────────

  // NAME: "named X", "name X", "person X", "for X" — stops at keywords
  const namePatterns = [
    /(?:named?|person|for|called)\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:with|phone|email|address|and|,|$))/i,
    /(?:named?|person|for|called)\s+([a-z][a-z\s]{1,20}?)(?:\s*$)/i,
  ];
  for (const pat of namePatterns) {
    const m = message.match(pat);
    if (m) { parsed._name = m[1].trim(); break; }
  }

  // PHONE: any sequence of digits, dashes, spaces 7-15 chars
  const phoneMatch = message.match(/(?:phone(?:\s*(?:no|number|#)?)?[\s:]+)([0-9\s\-\+\(\)]{7,20})/i)
    || message.match(/\b([0-9]{4}[\-\s]?[0-9]{3,8})\b/);
  if (phoneMatch) parsed._phone = phoneMatch[1].trim().replace(/\s+/g, '');

  // EMAIL: standard email pattern
  const emailMatch = message.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) parsed._email = emailMatch[1].trim();

  // ADDRESS: after "address" keyword — grab rest of string or until next keyword
  const addressMatch = message.match(/(?:address(?:ed)?|from|in|at|location)\s+([a-z][a-z\s,\.]{3,60}?)(?:\s*(?:phone|email|and\s+phone|and\s+email|$))/i)
    || message.match(/address\s+(.+)$/i);
  if (addressMatch) parsed._address = addressMatch[1].trim().replace(/\.$/, '');

  // ── UPDATE: detect "set/change X to Y" or "update X for name" ──
  const setMatch = message.match(/(?:set|change|update)\s+(name|phone|email|address)\s+(?:to|=)\s+(.+?)(?:\s+for\s+|$)/i);
  const toMatch = message.match(/(?:set|change|update)\s+.+?\s+to\s+(.+)/i);

  // ── Build output based on action ──────────────────────────────
  if (parsed.action === 'create') {
    parsed.newRecord = {};
    if (parsed._name)    parsed.newRecord.name    = parsed._name;
    if (parsed._phone)   parsed.newRecord.phone   = parsed._phone;
    if (parsed._email)   parsed.newRecord.email   = parsed._email;
    if (parsed._address) parsed.newRecord.address = parsed._address;

  } else if (parsed.action === 'update') {
    // What field to update
    if (setMatch) {
      parsed.updates[setMatch[1].toLowerCase()] = setMatch[2].trim();
    } else {
      if (parsed._phone)   parsed.updates.phone   = parsed._phone;
      if (parsed._email)   parsed.updates.email   = parsed._email;
      if (parsed._address) parsed.updates.address = parsed._address;
    }
    // Who to update (name or email as filter)
    const forMatch = message.match(/(?:for|of)\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:to|set|with|$))/i);
    if (forMatch) parsed.filters.name = forMatch[1].trim();
    else if (parsed._name) parsed.filters.name = parsed._name;

  } else if (parsed.action === 'delete') {
    if (parsed._name)  parsed.filters.name  = parsed._name;
    if (parsed._email) parsed.filters.email = parsed._email;
    if (parsed._phone) parsed.filters.phone = parsed._phone;

  } else if (parsed.action === 'read') {
    if (parsed._name)  parsed.filters.name  = parsed._name;
    if (parsed._email) parsed.filters.email = parsed._email;
    if (parsed._phone) parsed.filters.phone = parsed._phone;
  }

  parsed.message = `Smart fallback parsed action: ${parsed.action}`;
  console.log('Fallback parsed:', JSON.stringify(parsed, null, 2));
  return parsed;
}

module.exports = router;
