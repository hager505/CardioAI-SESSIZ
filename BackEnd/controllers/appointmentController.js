// controllers/appointmentController.js
import db from "../config/db.js";

// ─── POST /api/appointments  (create) ─────────────────────────────────────────
export async function createAppointment(req, res) {
  const {
    doctor_id, patient_id, patient_name,
    appointment_type, appointment_date, appointment_time,
    duration, notes, status, phone, email,
  } = req.body;

  if (!appointment_date || !appointment_time || !appointment_type) {
    return res.status(400).json({ message: "Missing required fields: date, time, type" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO appointments
         (doctor_id, patient_id, patient_name, appointment_type,
          appointment_date, appointment_time, duration, notes, status, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doctor_id ?? null,
        patient_id ?? null,
        patient_name ?? null,
        appointment_type,
        appointment_date,
        appointment_time,
        duration ?? "30 minutes",
        notes ?? null,
        status ?? "scheduled",
        phone ?? null,
        email ?? null,
      ]
    );
    res.status(201).json({
      message: "Appointment created",
      appointment_id: result.insertId,
    });
  } catch (err) {
    console.error("createAppointment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── GET /api/appointments  (all, optional ?doctor_id / ?patient_id) ──────────
export async function getAllAppointments(req, res) {
  try {
    const { doctor_id, patient_id, date, status } = req.query;
    let sql = `
      SELECT a.*,
        COALESCE(p.full_name, a.patient_name) AS patient_name,
        COALESCE(p.phone, a.phone)           AS patient_phone,
        COALESCE(p.email, a.email)           AS patient_email,
        p.gender                             AS patient_gender,
        pi.age                               AS patient_age,
        pi.blood_type,
        pi.condition_text,
        d.full_name AS doctor_name
      FROM appointments a
      LEFT JOIN patients    p  ON a.patient_id  = p.id
      LEFT JOIN patient_info pi ON p.id         = pi.patient_id
      LEFT JOIN doctors     d  ON a.doctor_id   = d.id
      WHERE 1=1`;
    const params = [];
    if (doctor_id) { sql += " AND a.doctor_id = ?"; params.push(doctor_id); }
    if (patient_id) { sql += " AND a.patient_id = ?"; params.push(patient_id); }
    if (date) { sql += " AND DATE(a.appointment_date) = ?"; params.push(date); }
    if (status) { sql += " AND a.status = ?"; params.push(status); }
    sql += " ORDER BY a.appointment_date DESC, a.appointment_time ASC";

    const [rows] = await db.query(sql, params);
    res.json({ count: rows.length, appointments: rows });
  } catch (err) {
    console.error("getAllAppointments error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── GET /api/appointments/:id ────────────────────────────────────────────────
export async function getAppointment(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT a.*,
         COALESCE(p.full_name, a.patient_name) AS patient_name,
         COALESCE(p.phone, a.phone)           AS patient_phone,
         p.gender AS patient_gender,
         d.full_name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors  d ON a.doctor_id  = d.id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Appointment not found" });
    res.json({ appointment: rows[0] });
  } catch (err) {
    console.error("getAppointment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── PATCH /api/appointments/:id  (update status, notes, vitals) ──────────────
export async function updateAppointment(req, res) {
  const allowed = [
    "status", "notes", "heart_rate", "blood_pressure",
    "spo2", "body_temperature", "appointment_date", "appointment_time", "appointment_type",
  ];
  const fields = Object.keys(req.body).filter((k) => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ message: "No valid fields to update" });

  try {
    const set = fields.map((f) => `${f} = ?`).join(", ");
    const vals = fields.map((f) => req.body[f]);
    vals.push(req.params.id);

    const [result] = await db.query(`UPDATE appointments SET ${set} WHERE id = ?`, vals);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment updated" });
  } catch (err) {
    console.error("updateAppointment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── DELETE /api/appointments/:id ─────────────────────────────────────────────
export async function deleteAppointment(req, res) {
  try {
    const [result] = await db.query("DELETE FROM appointments WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment deleted" });
  } catch (err) {
    console.error("deleteAppointment error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}