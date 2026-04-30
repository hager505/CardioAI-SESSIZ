import db from '../config/db.js';

export async function getPatientMedications(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM medications WHERE patient_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ count: rows.length, medications: rows });
  } catch (err) {
    console.error('getPatientMedications error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

export async function createMedication(req, res) {
  try {
    const {
      patient_id, medication_name, dosage, frequency,
      time_of_day, start_date, end_date, instructions,
      prescribed_by, status, refill_due
    } = req.body;

    if (!patient_id || !medication_name || !dosage)
      return res.status(400).json({ message: 'patient_id, medication_name, and dosage are required' });

    const [result] = await db.query(
      `INSERT INTO medications
         (patient_id, medication_name, dosage, frequency, time_of_day,
          start_date, end_date, instructions, prescribed_by, status, refill_due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, medication_name, dosage, frequency || null, time_of_day || null,
        start_date || null, end_date || null, instructions || null,
        prescribed_by || null, status || 'active', refill_due || null]
    );

    res.status(201).json({ message: 'Medication created', data: { id: result.insertId } });
  } catch (err) {
    console.error('createMedication error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

export async function updateMedication(req, res) {
  try {
    const {
      medication_name, dosage, frequency, time_of_day,
      start_date, end_date, instructions, prescribed_by, status, refill_due
    } = req.body;

    const [result] = await db.query(
      `UPDATE medications SET
         medication_name = COALESCE(?, medication_name),
         dosage          = COALESCE(?, dosage),
         frequency       = COALESCE(?, frequency),
         time_of_day     = COALESCE(?, time_of_day),
         start_date      = COALESCE(?, start_date),
         end_date        = COALESCE(?, end_date),
         instructions    = COALESCE(?, instructions),
         prescribed_by   = COALESCE(?, prescribed_by),
         status          = COALESCE(?, status),
         refill_due      = COALESCE(?, refill_due)
       WHERE id = ?`,
      [medication_name || null, dosage || null, frequency || null, time_of_day || null,
      start_date || null, end_date || null, instructions || null, prescribed_by || null,
      status || null, refill_due || null, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Medication not found' });
    res.json({ message: 'Medication updated' });
  } catch (err) {
    console.error('updateMedication error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}


export async function deleteMedication(req, res) {
  try {
    const [result] = await db.query(
      `DELETE FROM medications WHERE id = ?`, [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Medication not found' });
    res.json({ message: 'Medication deleted' });
  } catch (err) {
    console.error('deleteMedication error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}


