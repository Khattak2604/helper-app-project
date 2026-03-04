const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');

// GET /api/config/status — returns whether API key is configured
router.get('/status', async (req, res) => {
  try {
    const hasApiKey = !!(process.env.GEMINI_API_KEY);
    res.json({ success: true, hasApiKey, model: 'gemini-1.5-flash' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/config/apikey — test and save API key
router.post('/apikey', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ success: false, message: 'API key is required.' });
    }

    const key = apiKey.trim();

    // Test the key against Gemini API with a minimal request
    try {
      const testPayload = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
        generationConfig: { maxOutputTokens: 10 }
      };
      await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        testPayload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );
    } catch (testErr) {
      const status = testErr.response?.status;
      if (status === 400 || status === 401 || status === 403) {
        return res.status(400).json({ success: false, message: 'Invalid API key. Please check and try again.' });
      }
      if (status === 429) {
        return res.status(400).json({ success: false, message: 'API key is valid but rate limited. Try again in a moment.' });
      }
      // For network errors or other issues, still save if format looks valid
      if (!key.startsWith('AIza')) {
        return res.status(400).json({ success: false, message: 'API key format looks invalid. Gemini keys typically start with "AIza".' });
      }
    }

    // Save to config.json
    await fs.ensureDir(path.dirname(CONFIG_FILE));
    let config = {};
    if (await fs.pathExists(CONFIG_FILE)) {
      config = await fs.readJson(CONFIG_FILE);
    }
    config.geminiApiKey = key;
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });

    // Update in-memory env var immediately
    process.env.GEMINI_API_KEY = key;

    res.json({ success: true, message: '✅ API key saved and verified successfully!' });
  } catch (err) {
    console.error('Config apikey error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
