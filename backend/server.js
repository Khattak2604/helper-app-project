const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');

dotenv.config();

const app = express();

// Load API key from data/config.json on startup if not already in environment
async function loadConfigApiKey() {
  const configFile = path.join(__dirname, '../data/config.json');
  try {
    if (!process.env.GEMINI_API_KEY && await fs.pathExists(configFile)) {
      const config = await fs.readJson(configFile);
      if (config.geminiApiKey) {
        process.env.GEMINI_API_KEY = config.geminiApiKey;
        console.log('🔑 Loaded Gemini API key from data/config.json');
      }
    }
  } catch (err) {
    console.warn('Could not load config.json:', err.message);
  }
}

// Ensure data directory exists on startup
const DATA_DIR = path.join(__dirname, '../data');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(path.join(DATA_DIR, 'language-packs'));
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
if (!fs.pathExistsSync(CUSTOMERS_FILE)) {
  fs.writeJsonSync(CUSTOMERS_FILE, [], { spaces: 2 });
  console.log('📂 Created data/customers.json');
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/customers', require('./routes/customers'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/config', require('./routes/config'));
app.use('/api/languages', require('./routes/languages'));

// Catch-all: serve frontend for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;

// Start server after loading config
loadConfigApiKey().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    if (process.env.GEMINI_API_KEY) {
      console.log('🤖 Gemini API key: configured ✅');
    } else {
      console.log('⚠️  Gemini API key: NOT configured — open the app and click ⚙️ Setup to add your key');
    }
    console.log('🏪 Dukan Ledger — Shop Record Manager ready!\n');
  });
});
