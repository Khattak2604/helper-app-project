const express = require('express');
const router = express.Router();
const db = require('../utils/dataStore');

// GET all records
router.get('/', async (req, res) => {
  try {
    const { search, name, phone, email, address } = req.query;
    let records;

    if (search) {
      const all = await db.readAll();
      const q = search.toLowerCase();
      records = all.filter(r =>
        Object.values(r).some(v => v && v.toString().toLowerCase().includes(q))
      );
    } else if (name || phone || email || address) {
      records = await db.findRecords({ name, phone, email, address });
    } else {
      records = await db.readAll();
    }

    res.json({ success: true, data: records, count: records.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create record
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const record = await db.createRecord({ name, phone, email, address });
    res.status(201).json({ success: true, data: record, message: `Record created for ${name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update record by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.updateRecord(id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: updated, message: 'Record updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE record by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteRecord(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: deleted, message: `Record for ${deleted.name} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
