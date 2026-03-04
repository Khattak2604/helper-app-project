const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../../data/customers.json');

async function ensureDataFile() {
  await fs.ensureDir(path.dirname(DATA_FILE));
  if (!await fs.pathExists(DATA_FILE)) {
    await fs.writeJson(DATA_FILE, [], { spaces: 2 });
  }
}

async function loadData() {
  await ensureDataFile();
  return await fs.readJson(DATA_FILE);
}

async function saveData(data) {
  await fs.writeJson(DATA_FILE, data, { spaces: 2 });
}

async function getAllCustomers() {
  const data = await loadData();
  return data.map(c => {
    const overallTotal = (c.dailyRecords || []).reduce((sum, d) => sum + (d.dayTotal || 0), 0);
    const lastRecord = (c.dailyRecords || []).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      extraInfo: c.extraInfo || '',
      createdAt: c.createdAt,
      overallTotal,
      lastActivity: lastRecord ? lastRecord.date : null
    };
  });
}

async function getCustomerById(id) {
  const data = await loadData();
  const customer = data.find(c => c.id === id);
  if (!customer) return null;
  const overallTotal = (customer.dailyRecords || []).reduce((sum, d) => sum + (d.dayTotal || 0), 0);
  return { ...customer, overallTotal };
}

async function createCustomer(fields) {
  const data = await loadData();
  const customer = {
    id: uuidv4(),
    name: fields.name || '',
    phone: fields.phone || '',
    extraInfo: fields.extraInfo || '',
    createdAt: new Date().toISOString(),
    dailyRecords: []
  };
  data.push(customer);
  await saveData(data);
  return customer;
}

async function updateCustomer(id, updates) {
  const data = await loadData();
  const idx = data.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const allowed = ['name', 'phone', 'extraInfo'];
  allowed.forEach(field => {
    if (updates[field] !== undefined) data[idx][field] = updates[field];
  });
  data[idx].updatedAt = new Date().toISOString();
  await saveData(data);
  return data[idx];
}

async function deleteCustomer(id) {
  const data = await loadData();
  const idx = data.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const deleted = data[idx];
  data.splice(idx, 1);
  await saveData(data);
  return deleted;
}

async function addOrUpdateDailyRecord(customerId, date, items, note) {
  const data = await loadData();
  const idx = data.findIndex(c => c.id === customerId);
  if (idx === -1) return null;

  const customer = data[idx];
  if (!customer.dailyRecords) customer.dailyRecords = [];

  const dayTotal = (items || []).reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);

  const existingDayIdx = customer.dailyRecords.findIndex(d => d.date === date);
  if (existingDayIdx >= 0) {
    const existing = customer.dailyRecords[existingDayIdx];
    existing.items = [...(existing.items || []), ...(items || [])];
    existing.dayTotal = existing.items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
    if (note !== undefined) existing.note = note;
  } else {
    customer.dailyRecords.push({ date, items: items || [], dayTotal, note: note || '' });
  }

  customer.dailyRecords.sort((a, b) => a.date.localeCompare(b.date));
  await saveData(data);

  const overallTotal = customer.dailyRecords.reduce((sum, d) => sum + (d.dayTotal || 0), 0);
  return { ...customer, overallTotal };
}

async function getMonthlyReport(customerId, yearMonth) {
  const customer = await getCustomerById(customerId);
  if (!customer) return null;

  const filtered = (customer.dailyRecords || []).filter(d =>
    d.date && d.date.startsWith(yearMonth)
  );

  const monthTotal = filtered.reduce((sum, d) => sum + (d.dayTotal || 0), 0);

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      extraInfo: customer.extraInfo
    },
    month: yearMonth,
    dailyRecords: filtered,
    monthTotal
  };
}

async function searchCustomers(query) {
  const data = await loadData();
  if (!query) return data;
  const q = query.toLowerCase();
  return data.filter(c =>
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.phone && c.phone.toLowerCase().includes(q)) ||
    (c.extraInfo && c.extraInfo.toLowerCase().includes(q))
  );
}

module.exports = {
  loadData,
  saveData,
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addOrUpdateDailyRecord,
  getMonthlyReport,
  searchCustomers
};
