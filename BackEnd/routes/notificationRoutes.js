import express from 'express';
import {
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';
const router = express.Router();

router.post('/',            createNotification);          // POST /api/notifications
router.patch('/read-all',   markAllNotificationsRead);    // PATCH /api/notifications/read-all
router.patch('/:id/read',   markNotificationRead);        // PATCH /api/notifications/:id/read

export default router;
