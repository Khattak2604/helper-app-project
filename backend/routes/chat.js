const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { chatWithGemini, buildSystemPrompt, SHOP_LEDGER_SYSTEM_PROMPT } = require('../services/geminiService');
const db = require('../utils/dataStore');

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');
const DEFAULT_LANGUAGES = ['english'];

router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const allCustomers = await db.getAllCustomers();
    const customerContext = `\nCurrent shop has ${allCustomers.length} customers: ${allCustomers.map(c => `${c.name}(id:${c.id})`).join(', ') || 'none'}`;

    const messages = [
      ...history.slice(-6),
      { role: 'user', content: message + customerContext }
    ];

    // Load active languages from config and build dynamic system prompt
    let systemPrompt = SHOP_LEDGER_SYSTEM_PROMPT;
    try {
      let config = {};
      if (await fs.pathExists(CONFIG_FILE)) {
        config = await fs.readJson(CONFIG_FILE);
      }
      const activeLanguages = config.activeLanguages || DEFAULT_LANGUAGES;
      systemPrompt = await buildSystemPrompt(activeLanguages);
    } catch (promptErr) {
      console.warn('Could not build dynamic system prompt, using base prompt:', promptErr.message);
    }

    let parsed;
    let usedAI = false;

    try {
      const aiResponse = await chatWithGemini(messages, systemPrompt);
      console.log('Raw AI response:', aiResponse);
      const cleaned = aiResponse.replace(/```(?:json)?/gi, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI returned no JSON');
      parsed = JSON.parse(jsonMatch[0]);
      usedAI = true;
    } catch (aiErr) {
      console.warn('AI failed, using fallback parser. Reason:', aiErr.message);
      parsed = fallbackParser(message);
      parsed.aiError = aiErr.message;
    }

    const result = await executeIntent(parsed, allCustomers);

    res.json({
      success: true,
      intent: parsed.intent,
      params: parsed.params,
      message: parsed.message,
      data: result,
      usedAI,
      aiError: parsed.aiError || null
    });

  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

async function findCustomerByName(name) {
  if (!name) return null;
  const customers = await db.loadData();
  const lower = name.toLowerCase();
  return customers.find(c => c.name.toLowerCase().includes(lower)) || null;
}

async function executeIntent(parsed, allCustomers) {
  const { intent, params = {} } = parsed;
  const today = new Date().toISOString().slice(0, 10);

  switch (intent) {
    case 'ADD_CUSTOMER': {
      if (!params.name) return { type: 'error', message: 'Customer name is required.' };
      const created = await db.createCustomer({
        name: params.name,
        phone: params.phone || '',
        extraInfo: params.extraInfo || ''
      });
      return { type: 'customer_created', customer: created, message: `✅ Customer **${created.name}** created!` };
    }

    case 'ADD_DAILY_RECORD': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };

      const date = params.date || today;
      const items = (params.items || []).map(item => ({
        description: item.description || '',
        qty: Number(item.qty) || 1,
        price: Number(item.price) || 0
      }));

      if (!items.length) return { type: 'error', message: 'No items provided for the record.' };

      const updated = await db.addOrUpdateDailyRecord(customer.id, date, items, params.note || '');
      const dayRecord = updated.dailyRecords.find(d => d.date === date);
      return {
        type: 'daily_record_added',
        customer: updated,
        date,
        dayRecord,
        message: `✅ Record added for **${customer.name}** on ${date}. Day total: PKR ${dayRecord ? dayRecord.dayTotal : 0}`
      };
    }

    case 'GET_CUSTOMER': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };
      const full = await db.getCustomerById(customer.id);
      return { type: 'customer_detail', customer: full, message: `📋 Showing record for **${full.name}**` };
    }

    case 'GET_ALL_CUSTOMERS': {
      const customers = await db.getAllCustomers();
      return { type: 'all_customers', customers, message: `📋 Found **${customers.length}** customer(s)` };
    }

    case 'GET_DAILY_RECORDS': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };
      const full = await db.getCustomerById(customer.id);
      let records = full.dailyRecords || [];
      if (params.month) {
        records = records.filter(d => d.date && d.date.startsWith(params.month));
      }
      return { type: 'daily_records', customer: full, records, message: `📋 Showing ${records.length} record(s) for **${full.name}**` };
    }

    case 'GET_OVERALL_TOTAL': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };
      const full = await db.getCustomerById(customer.id);
      return { type: 'overall_total', customer: full, total: full.overallTotal, message: `💰 **${full.name}** ka kul hisab: PKR **${full.overallTotal}**` };
    }

    case 'GENERATE_MONTHLY_REPORT': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };
      const month = params.month || today.slice(0, 7);
      const report = await db.getMonthlyReport(customer.id, month);
      return { type: 'monthly_report', report, message: `📊 Monthly report for **${customer.name}** — ${month}` };
    }

    case 'UPDATE_CUSTOMER': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };
      const updated = await db.updateCustomer(customer.id, params.updates || {});
      return { type: 'customer_updated', customer: updated, message: `✅ **${updated.name}** ka record update ho gaya` };
    }

    case 'DELETE_CUSTOMER': {
      if (!params.customerName) return { type: 'error', message: 'Customer name is required.' };
      const customer = await findCustomerByName(params.customerName);
      if (!customer) return { type: 'error', message: `Customer "${params.customerName}" not found.` };
      const deleted = await db.deleteCustomer(customer.id);
      return { type: 'customer_deleted', customer: deleted, message: `🗑️ **${deleted.name}** ka record delete ho gaya` };
    }

    case 'SEARCH_CUSTOMER': {
      const results = await db.searchCustomers(params.query || '');
      const summaries = results.map(c => {
        const overallTotal = (c.dailyRecords || []).reduce((sum, d) => sum + (d.dayTotal || 0), 0);
        return { id: c.id, name: c.name, phone: c.phone, overallTotal };
      });
      return { type: 'search_results', customers: summaries, message: `🔍 Found **${summaries.length}** customer(s)` };
    }

    default:
      return { type: 'info', message: parsed.message || "Samajh nahi aaya. Try: 'Add customer', 'Show all', 'Ahmed ka record dikhao'" };
  }
}

function fallbackParser(message) {
  const msg = message.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  // ADD_DAILY_RECORD pattern
  if (/\b(add|likhna|hisab add|record add)\b/.test(msg) && /\b(aaj|today|kal|yesterday)\b/.test(msg)) {
    const nameMatch = message.match(/^([A-Za-z]+)/);
    return {
      intent: 'ADD_DAILY_RECORD',
      params: { customerName: nameMatch ? nameMatch[1] : '', date: today, items: [], note: '' },
      message: 'Adding daily record (fallback)'
    };
  }

  // GET_ALL_CUSTOMERS
  if (/\b(sab|all|tamam|show all|dikhao sab)\b/.test(msg)) {
    return { intent: 'GET_ALL_CUSTOMERS', params: {}, message: 'Showing all customers (fallback)' };
  }

  // GET_OVERALL_TOTAL
  if (/\b(kul|total|overall|hisab kya hai)\b/.test(msg)) {
    const nameMatch = message.match(/([A-Za-z]+)\s+ka/i) || message.match(/for\s+([A-Za-z]+)/i);
    return {
      intent: 'GET_OVERALL_TOTAL',
      params: { customerName: nameMatch ? nameMatch[1] : '' },
      message: 'Getting overall total (fallback)'
    };
  }

  // GENERATE_MONTHLY_REPORT
  if (/\b(report|mahine ka|monthly)\b/.test(msg)) {
    const nameMatch = message.match(/([A-Za-z]+)\s+ka/i) || message.match(/for\s+([A-Za-z]+)/i);
    const monthMatch = message.match(/(\d{4}-\d{2})/);
    return {
      intent: 'GENERATE_MONTHLY_REPORT',
      params: { customerName: nameMatch ? nameMatch[1] : '', month: monthMatch ? monthMatch[1] : today.slice(0, 7) },
      message: 'Generating monthly report (fallback)'
    };
  }

  // GET_CUSTOMER
  if (/\b(dikhao|show|record|get)\b/.test(msg)) {
    const nameMatch = message.match(/([A-Za-z]+)\s+ka/i) || message.match(/for\s+([A-Za-z]+)/i) || message.match(/show\s+([A-Za-z]+)/i);
    return {
      intent: 'GET_CUSTOMER',
      params: { customerName: nameMatch ? nameMatch[1] : '' },
      message: 'Getting customer record (fallback)'
    };
  }

  // ADD_CUSTOMER
  if (/\b(add|naya|new|create)\b/.test(msg) && /\b(customer|grahak)\b/.test(msg)) {
    const nameMatch = message.match(/(?:named?|customer)\s+([A-Za-z]+)/i);
    const phoneMatch = message.match(/(\d[\d\-]{7,})/);
    return {
      intent: 'ADD_CUSTOMER',
      params: { name: nameMatch ? nameMatch[1] : '', phone: phoneMatch ? phoneMatch[1] : '', extraInfo: '' },
      message: 'Adding customer (fallback)'
    };
  }

  // DELETE_CUSTOMER
  if (/\b(delete|remove|hata|erase)\b/.test(msg)) {
    const nameMatch = message.match(/(?:delete|remove|for)\s+([A-Za-z]+)/i) || message.match(/([A-Za-z]+)\s+ka/i);
    return {
      intent: 'DELETE_CUSTOMER',
      params: { customerName: nameMatch ? nameMatch[1] : '' },
      message: 'Deleting customer (fallback)'
    };
  }

  return {
    intent: 'UNKNOWN',
    params: {},
    message: "Samajh nahi aaya. Try: 'Show all customers' or 'Ahmed ka record dikhao'"
  };
}

module.exports = router;
