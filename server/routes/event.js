const express = require('express');
const router = express.Router();
const { 
    createEvent, 
    getEvents, 
    getEventById, 
    getEventStats 
} = require('../controllers/event');

// Create new event
router.post('/', createEvent);

// Get all events with filtering and pagination
router.get('/', getEvents);

// Get event statistics
router.get('/stats', getEventStats);

// Get specific event by ID
router.get('/:id', getEventById);

module.exports = router;
