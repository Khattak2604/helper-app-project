const fs = require('fs-extra');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/contacts.json');

// Migrate old UUID-based IDs to sequential numbers
async function migrateIfNeeded(data) {
  const needsMigration = data.some(r => typeof r.id === 'string' && r.id.includes('-'));
  if (!needsMigration) return data;
  console.log('Migrating old UUID IDs to sequential numbers...');
  const migrated = data.map((r, i) => ({ ...r, id: i + 1 }));
  await fs.writeJson(DATA_FILE, migrated, { spaces: 2 });
  console.log('Migration complete.');
  return migrated;
}

// Ensure data file exists with sample data
async function ensureDataFile() {
  await fs.ensureDir(path.dirname(DATA_FILE));
  if (!await fs.pathExists(DATA_FILE)) {
    const sampleData = [
      { id: 1, name: 'Sagheer', phone: '111111111', email: 'sagheer@gmail.com', address: 'Nowshera KPK', createdAt: new Date().toISOString() },
      { id: 2, name: 'Ali Khan', phone: '222222222', email: 'ali@gmail.com', address: 'Peshawar KPK', createdAt: new Date().toISOString() },
      { id: 3, name: 'Sara Ahmed', phone: '333333333', email: 'sara@gmail.com', address: 'Lahore Punjab', createdAt: new Date().toISOString() },
    ];
    await fs.writeJson(DATA_FILE, sampleData, { spaces: 2 });
  }
}

// Get next available sequential ID
async function getNextId() {
  const data = await readAll();
  if (data.length === 0) return 1;
  return Math.max(...data.map(r => Number(r.id) || 0)) + 1;
}

async function readAll() {
  await ensureDataFile();
  const raw = await fs.readJson(DATA_FILE);
  return await migrateIfNeeded(raw);
}

async function writeAll(data) {
  await fs.writeJson(DATA_FILE, data, { spaces: 2 });
}

async function createRecord(fields) {
  const data = await readAll();
  const newRecord = {
    id: await getNextId(),
    name: fields.name || '',
    phone: fields.phone || '',
    email: fields.email || '',
    address: fields.address || '',
    createdAt: new Date().toISOString()
  };
  data.push(newRecord);
  await writeAll(data);
  return newRecord;
}

async function findRecords(query) {
  const data = await readAll();
  if (!query || Object.keys(query).length === 0) return data;

  return data.filter(record => {
    return Object.entries(query).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      if (!record[key] && record[key] !== 0) return false;
      // Numeric ID: exact match
      if (key === 'id') return String(record[key]) === String(value);
      return record[key].toString().toLowerCase().includes(value.toString().toLowerCase());
    });
  });
}

async function updateRecord(id, fields) {
  const data = await readAll();
  const idx = data.findIndex(r => String(r.id) === String(id));
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...fields, id: data[idx].id, updatedAt: new Date().toISOString() };
  await writeAll(data);
  return data[idx];
}

async function deleteRecord(id) {
  const data = await readAll();
  const idx = data.findIndex(r => String(r.id) === String(id));
  if (idx === -1) return null;
  const deleted = data[idx];
  data.splice(idx, 1);
  await writeAll(data);
  return deleted;
}

module.exports = { readAll, createRecord, findRecords, updateRecord, deleteRecord };
