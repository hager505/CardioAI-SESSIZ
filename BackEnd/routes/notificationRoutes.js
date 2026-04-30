import express from 'express';
import { markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController.js';
const router = express.Router();
router.patch('/read-all', markAllNotificationsRead);  
router.patch('/:id/read', markNotificationRead);     

export default router;