import db from "../config/db.js";
import fs from "fs";

// ─── POST /api/records ─────────────────────────────────────
export async function createRecord(req, res) {
  const {
    patient_id, title, record_type,
    record_date, doctor_name, description,
  } = req.body;

  if (!patient_id || !title || !record_type)
    return res.status(400).json({ message: "patient_id, title and record_type are required" });

  try {
    const report_file = req.file ? req.file.path.replace(/\\/g, "/") : null;

    const [result] = await db.query(
      `INSERT INTO medical_records
         (patient_id, title, record_type, record_date, doctor_name, description, report_file)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        title,
        record_type,
        record_date   || null,
        doctor_name   || null,
        description   || null,
        report_file,
      ]
    );

    // Return the full inserted record
    const [rows] = await db.query(
      "SELECT * FROM medical_records WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Record uploaded successfully",
      record:  rows[0],
    });
  } catch (err) {
    console.error("createRecord error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── DELETE /api/records/:id ───────────────────────────────
export async function deleteRecord(req, res) {
  try {
    // Fetch record first to get file path
    const [rows] = await db.query(
      "SELECT * FROM medical_records WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Record not found" });

    const record = rows[0];

    // Delete from DB
    await db.query(
      "DELETE FROM medical_records WHERE id = ?",
      [req.params.id]
    );

    // Delete physical file if it exists
    if (record.report_file && fs.existsSync(record.report_file)) {
      fs.unlink(record.report_file, err => {
        if (err) console.warn("Could not delete file:", err.message);
      });
    }

    res.json({ message: "Record deleted successfully" });
  } catch (err) {
    console.error("deleteRecord error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}