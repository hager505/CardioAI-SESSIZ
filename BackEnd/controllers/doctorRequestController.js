// controllers/doctorRequestController.js
import db from "../config/db.js";

// GET /api/doctor/requests?doctor_id=1&status=pending
export async function getDoctorRequests(req, res) {
  try {
    const { status, doctor_id } = req.query;

    let sql = `
      SELECT r.*,
        p.full_name AS patient_name,
        p.phone     AS patient_phone
      FROM doctor_requests r
      LEFT JOIN patients p ON r.patient_id = p.id
      WHERE 1=1`;
    const params = [];

    if (doctor_id) { sql += " AND r.doctor_id = ?"; params.push(doctor_id); }
    if (status)    { sql += " AND r.status = ?";    params.push(status); }
    sql += " ORDER BY r.created_at DESC";

    const [rows] = await db.query(sql, params);

    res.json({ count: rows.length, data: rows });
  } catch (err) {
    console.error("getDoctorRequests error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// POST /api/doctor/requests
export async function createDoctorRequest(req, res) {
  const { patientName, patient_id, message, priority, doctor_id } = req.body;
  if (!message) return res.status(400).json({ message: "message is required" });

  try {
    let resolvedPatientId = patient_id ?? null;
    if (!resolvedPatientId && patientName) {
      const [rows] = await db.query(
        "SELECT id FROM patients WHERE full_name LIKE ? LIMIT 1",
        [`%${patientName}%`]
      );
      if (rows.length) resolvedPatientId = rows[0].id;
    }

    const [result] = await db.query(
      `INSERT INTO doctor_requests
        (doctor_id, patient_id, patient_name, message, priority, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [doctor_id ?? null, resolvedPatientId, patientName ?? null, message, priority ?? "Medium"]
    );
    res.status(201).json({ message: "Request created", id: result.insertId });
  } catch (err) {
    console.error("createDoctorRequest error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// PATCH /api/doctor/requests/:id
export async function updateDoctorRequest(req, res) {
  const { status, notes } = req.body;
  const allowed = ["pending", "approved", "rejected", "resolved"];
  if (!status || !allowed.includes(status))
    return res.status(400).json({ message: `status must be one of: ${allowed.join(", ")}` });

  try {
    const [result] = await db.query(
      "UPDATE doctor_requests SET status = ?, notes = ? WHERE id = ?",
      [status, notes ?? null, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Request not found" });
    res.json({ message: "Request updated", status });
  } catch (err) {
    console.error("updateDoctorRequest error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// DELETE /api/doctor/requests/:id
export async function deleteDoctorRequest(req, res) {
  try {
    const [result] = await db.query(
      "DELETE FROM doctor_requests WHERE id = ?", [req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Request not found" });
    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("deleteDoctorRequest error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}