const express = require('express');
const router = express.Router();
const db = require('../utils/dataStore');

// GET all customers (summary)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let customers;
    if (search) {
      const raw = await db.searchCustomers(search);
      customers = raw.map(c => {
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
    } else {
      customers = await db.getAllCustomers();
    }
    res.json({ success: true, data: customers, count: customers.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single customer (full record)
router.get('/:id', async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, extraInfo } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const customer = await db.createCustomer({ name, phone, extraInfo });
    res.status(201).json({ success: true, data: customer, message: `Customer created for ${name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update customer info
router.put('/:id', async (req, res) => {
  try {
    const updated = await db.updateCustomer(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: updated, message: 'Customer updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE customer
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await db.deleteCustomer(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: deleted, message: `Customer ${deleted.name} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add/update daily record
router.post('/:id/daily', async (req, res) => {
  try {
    const { date, items, note } = req.body;
    if (!date || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'date and items are required' });
    }
    const updated = await db.addOrUpdateDailyRecord(req.params.id, date, items, note);
    if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: updated, message: 'Daily record saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET monthly report
router.get('/:id/report', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ success: false, message: 'month query param required (YYYY-MM)' });
    const report = await db.getMonthlyReport(req.params.id, month);
    if (!report) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
