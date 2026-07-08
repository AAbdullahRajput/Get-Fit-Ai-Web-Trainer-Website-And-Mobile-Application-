const express = require('express');
const router = express.Router();
const { getSlots, createSlot, updateSlot, deleteSlot, getClients, getAvailableSlots, bookSlot, toggleDaySlots } = require('../controllers/slotsController');

// GET /api/slots/available?trainer_id=X&date=YYYY-MM-DD  (public - for Flutter/client apps)
router.get('/available', getAvailableSlots);

// POST /api/slots/book  (public - book a slot by trainer_id + date + start_time)
router.post('/book', bookSlot);

// GET /api/slots/clients  (trainer auth required)
router.get('/clients', getClients);

// GET /api/slots  (trainer auth required)
router.get('/', getSlots);

// POST /api/slots
router.post('/', createSlot);

// PUT /api/slots/toggle-day
router.put('/toggle-day', toggleDaySlots);

// PUT /api/slots/:id
router.put('/:id', updateSlot);

// DELETE /api/slots/:id
router.delete('/:id', deleteSlot);

module.exports = router;
