// controllers/clinicalNotesController.js
// CRUD for per-patient clinical notes written by the doctor. Used by the
// doctor's view-patient-history "Clinical Notes" tab.
import db from "../config/db.js";

// GET /api/clinical-notes?patient_id=5
// Returns every note for a patient, newest first. Joins the doctor so
// the UI can show who wrote the note.
export async function getClinicalNotes(req, res) {
  try {
    const { patient_id } = req.query;
    if (!patient_id) {
      return res.status(400).json({ message: "patient_id is required" });
    }

    const [rows] = await db.query(
      `SELECT n.*,
              d.full_name AS doctor_name
         FROM clinical_notes n
         LEFT JOIN doctors d ON n.doctor_id = d.id
        WHERE n.patient_id = ?
        ORDER BY n.created_at DESC`,
      [patient_id]
    );

    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error("getClinicalNotes error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// POST /api/clinical-notes
// Body: { patient_id, doctor_id?, note }
// Returns the inserted row (with the joined doctor name).
export async function createClinicalNote(req, res) {
  try {
    const { patient_id, doctor_id, note } = req.body || {};
    if (!patient_id || !note || !String(note).trim()) {
      return res.status(400).json({ message: "patient_id and note are required" });
    }

    const [result] = await db.query(
      `INSERT INTO clinical_notes (patient_id, doctor_id, note)
       VALUES (?, ?, ?)`,
      [patient_id, doctor_id ?? null, String(note).trim()]
    );

    const [rows] = await db.query(
      `SELECT n.*, d.full_name AS doctor_name
         FROM clinical_notes n
         LEFT JOIN doctors d ON n.doctor_id = d.id
        WHERE n.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ message: "Note created", data: rows[0] });
  } catch (err) {
    console.error("createClinicalNote error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// PATCH /api/clinical-notes/:id  — edit a note in place
export async function updateClinicalNote(req, res) {
  try {
    const { note } = req.body || {};
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "note is required" });
    }

    const [result] = await db.query(
      `UPDATE clinical_notes SET note = ? WHERE id = ?`,
      [String(note).trim(), req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.json({ message: "Note updated" });
  } catch (err) {
    console.error("updateClinicalNote error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// DELETE /api/clinical-notes/:id
export async function deleteClinicalNote(req, res) {
  try {
    const [result] = await db.query(
      `DELETE FROM clinical_notes WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.json({ message: "Note deleted" });
  } catch (err) {
    console.error("deleteClinicalNote error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}
