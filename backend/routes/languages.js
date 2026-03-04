const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const AVAILABLE_PACKS_FILE = path.join(__dirname, '../data/available-packs.json');
const PACKS_SOURCE_DIR = path.join(__dirname, '../data/packs');
const INSTALLED_PACKS_DIR = path.join(__dirname, '../../data/language-packs');
const CONFIG_FILE = path.join(__dirname, '../../data/config.json');
const DEFAULT_LANGUAGES = ['english'];

async function getInstalledCodes() {
  await fs.ensureDir(INSTALLED_PACKS_DIR);
  const files = await fs.readdir(INSTALLED_PACKS_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

async function getConfig() {
  if (await fs.pathExists(CONFIG_FILE)) {
    return fs.readJson(CONFIG_FILE);
  }
  return {};
}

async function saveConfig(config) {
  await fs.ensureDir(path.dirname(CONFIG_FILE));
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

// GET /api/languages/available — list all available packs with installed status
router.get('/available', async (req, res) => {
  try {
    const available = await fs.readJson(AVAILABLE_PACKS_FILE);
    const installedCodes = await getInstalledCodes();
    // English is always installed
    if (!installedCodes.includes('english')) installedCodes.push('english');

    const result = available.map(pack => ({
      ...pack,
      installed: installedCodes.includes(pack.code)
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/languages/installed — list installed packs
router.get('/installed', async (req, res) => {
  try {
    await fs.ensureDir(INSTALLED_PACKS_DIR);
    const files = await fs.readdir(INSTALLED_PACKS_DIR);
    const packs = [];
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const pack = await fs.readJson(path.join(INSTALLED_PACKS_DIR, file));
        packs.push(pack);
      } catch (e) {
        // skip corrupt files
      }
    }
    res.json({ success: true, data: packs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/languages/download/:code — install a language pack
router.post('/download/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const sourcePath = path.join(PACKS_SOURCE_DIR, `${code}.json`);

    if (!(await fs.pathExists(sourcePath))) {
      return res.status(404).json({ success: false, message: `Language pack "${code}" not found.` });
    }

    await fs.ensureDir(INSTALLED_PACKS_DIR);
    const destPath = path.join(INSTALLED_PACKS_DIR, `${code}.json`);
    await fs.copy(sourcePath, destPath);

    const pack = await fs.readJson(destPath);
    res.json({ success: true, message: `✅ Language pack "${pack.name}" installed!`, data: pack });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/languages/:code — remove an installed language pack
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (code === 'english') {
      return res.status(400).json({ success: false, message: 'English is the default language and cannot be removed.' });
    }

    const packPath = path.join(INSTALLED_PACKS_DIR, `${code}.json`);
    if (!(await fs.pathExists(packPath))) {
      return res.status(404).json({ success: false, message: `Language pack "${code}" is not installed.` });
    }

    await fs.remove(packPath);

    // Also remove from active languages in config if present
    const config = await getConfig();
    if (config.activeLanguages && config.activeLanguages.includes(code)) {
      config.activeLanguages = config.activeLanguages.filter(c => c !== code);
      await saveConfig(config);
    }

    res.json({ success: true, message: `✅ Language pack "${code}" removed.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/languages/active — get currently active language codes
router.get('/active', async (req, res) => {
  try {
    const config = await getConfig();
    const activeLanguages = config.activeLanguages || DEFAULT_LANGUAGES;
    res.json({ success: true, data: activeLanguages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/languages/active — set active language codes
router.post('/active', async (req, res) => {
  try {
    const { activeLanguages } = req.body;
    if (!Array.isArray(activeLanguages)) {
      return res.status(400).json({ success: false, message: 'activeLanguages must be an array.' });
    }

    // Always include english (DEFAULT_LANGUAGES)
    const codes = activeLanguages.includes('english') ? activeLanguages : [...DEFAULT_LANGUAGES, ...activeLanguages];

    const config = await getConfig();
    config.activeLanguages = codes;
    await saveConfig(config);

    res.json({ success: true, data: codes, message: 'Active languages updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
