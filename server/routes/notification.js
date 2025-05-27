const express = require('express');
const router = express.Router();
const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notification');

// Get all notifications
router.get('/', getNotifications);

// Create a new notification
router.post('/', createNotification);

// Mark a notification as read
router.patch('/:id/read', markAsRead);

// Mark all notifications as read
router.patch('/read-all', markAllAsRead);

module.exports = router; 