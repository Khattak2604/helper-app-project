const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');

dotenv.config();

const app = express();

// Ensure data directory exists on startup
const DATA_DIR = path.join(__dirname, '../data');
fs.ensureDirSync(DATA_DIR);
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
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`🤖 Using Ollama model: ${process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud'}`);
  console.log(`🏪 Dukan Ledger — Shop Record Manager ready!\n`);
});
