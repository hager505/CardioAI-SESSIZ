import db from "../config/db.js";

export async function getPatientNotifications(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ message: 'Success', data: rows });
  } catch (err) {
    console.error('getPatientNotifications error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}


export async function markNotificationRead(req, res) {
  try {
    const [result] = await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}


export async function markAllNotificationsRead(req, res) {
  try {
    const { patient_id } = req.body;
    if (!patient_id) return res.status(400).json({ message: 'patient_id required' });

    await db.query(
      `UPDATE notifications SET is_read = 1 WHERE patient_id = ?`,
      [patient_id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('markAllNotificationsRead error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}
