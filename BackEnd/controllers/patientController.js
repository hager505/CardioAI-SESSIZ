import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import db from "../config/db.js";

function toUrlPath(p) {
  if (!p) return null;
  return '/' + p.replace(/\\/g, '/');
}

// ─── Serial generator ──────────────────────────────────────
function generateSerial() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ms = Date.now().toString().slice(-4);
  return `#${y}${m}${d}${ms}`;
}

// ─── Register Step 1 ───────────────────────────────────────
export async function registerStep1(req, res) {
  const {
    full_name, national_id, date_of_birth,
    gender, phone, email, password,
    confirm_password, agreed_terms,
  } = req.body;

  if (!full_name || !email || !password)
    return res.status(400).json({ message: "Full name, email and password are required" });

  if (password !== confirm_password)
    return res.status(400).json({ message: "Passwords do not match" });

  if (!agreed_terms || agreed_terms === "false")
    return res.status(400).json({ message: "You must agree to the terms" });

  try {
    const [existing] = await db.query(
      "SELECT id FROM patients WHERE email = ? OR national_id = ?",
      [email, national_id || null]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: "Email or National ID already registered" });

    const password_hash = await bcrypt.hash(password, 10);
    const serial = generateSerial();

    const [result] = await db.query(
      `INSERT INTO patients
        (serial, full_name, national_id, date_of_birth, gender, phone, email, password_hash, agreed_terms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [serial, full_name, national_id || null, date_of_birth || null,
        gender || null, phone || null, email, password_hash, true]
    );

    res.status(201).json({
      message: "Step 1 complete. Proceed to complete your profile.",
      patient_id: result.insertId,
      serial,
    });
  } catch (err) {
    console.error("registerStep1 error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── Register Step 2 ───────────────────────────────────────
export async function registerStep2(req, res) {
  const {
    patient_id, blood_type, chronic_diseases,
    allergies, previous_surgeries, additional_history,
  } = req.body;

  if (!patient_id)
    return res.status(400).json({ message: "patient_id is required" });

  try {
    const prescription_file = req.file ? req.file.path : null;

    await db.query(
      `INSERT INTO patient_info
        (patient_id, blood_type, chronic_diseases, allergies,
         previous_surgeries, prescription_file, additional_history)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         blood_type          = VALUES(blood_type),
         chronic_diseases    = VALUES(chronic_diseases),
         allergies           = VALUES(allergies),
         previous_surgeries  = VALUES(previous_surgeries),
         prescription_file   = VALUES(prescription_file),
         additional_history  = VALUES(additional_history)`,
      [patient_id, blood_type || null, chronic_diseases || null,
        allergies || null, previous_surgeries || null,
        prescription_file, additional_history || null]
    );

    res.status(200).json({ message: "Profile completed successfully!" });
  } catch (err) {
    console.error("registerStep2 error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── Login ─────────────────────────────────────────────────
export async function loginPatient(req, res) {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const [rows] = await db.query(
      `SELECT p.*, pi.blood_type, pi.age, pi.condition_text, pi.chronic_diseases
       FROM patients p
       LEFT JOIN patient_info pi ON p.id = pi.patient_id
       WHERE p.email = ? OR p.phone = ?`,
      [email, email]
    );

    if (!rows.length)
      return res.status(401).json({ message: "Invalid email or password" });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ message: "Invalid email or password" });

    const { password_hash, ...patient } = rows[0];

    // Fetch avatar from patient_files
    const [files] = await db.query(
      "SELECT file_path FROM patient_files WHERE patient_id = ? AND file_type = 'avatar' LIMIT 1",
      [patient.id]
    );
    if (files.length > 0) {
      patient.avatar_url = toUrlPath(files[0].file_path);
    }

    res.json({ message: "Login successful", role: "patient", ...patient });
  } catch (err) {
    console.error("loginPatient error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET all patients ──────────────────────────────────────
export async function getAllPatients(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         p.id, p.serial, p.full_name, p.national_id,
         p.date_of_birth, p.gender, p.phone, p.email,
         p.agreed_terms, p.created_at,
         pi.blood_type, pi.age, pi.condition_text
       FROM patients p
       LEFT JOIN patient_info pi ON p.id = pi.patient_id
       ORDER BY p.created_at DESC`
    );

    const patientIds = rows.map(r => r.id);
    let filesByPatient = {};
    if (patientIds.length) {
      const [files] = await db.query(
        `SELECT patient_id, file_type, file_path
         FROM patient_files
         WHERE patient_id IN (?) AND file_type = 'avatar'`,
        [patientIds]
      );
      if (files) {
        files.forEach(f => {
          if (f.file_path) f.file_path = toUrlPath(f.file_path);
          filesByPatient[f.patient_id] = f;
        });
      }
    }

    const patients = rows.map(r => {
      const avatarFile = filesByPatient[r.id] || null;
      return {
        ...r,
        files: avatarFile ? [avatarFile] : [],
        avatar_url: avatarFile ? avatarFile.file_path : null
      };
    });

    res.json({ count: patients.length, patients });
  } catch (err) {
    console.error("getAllPatients error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET one patient ───────────────────────────────────────
export async function getPatient(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT p.*,
         pi.blood_type, pi.chronic_diseases, pi.allergies,
         pi.previous_surgeries, pi.additional_history,
         pi.age, pi.condition_text, pi.prescription_file
       FROM patients p
       LEFT JOIN patient_info pi ON p.id = pi.patient_id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Patient not found" });

    const [files] = await db.query(
      `SELECT file_type, file_path
       FROM patient_files WHERE patient_id = ?`,
      [req.params.id]
    );
    if (files) {
      files.forEach(f => { if (f.file_path) f.file_path = toUrlPath(f.file_path); });
    }

    const { password_hash, ...patient } = rows[0];
    // Expose avatar_url at top level for easy access
    if (files) {
      const avatarFile = files.find(f => f.file_type === 'avatar');
      if (avatarFile) patient.avatar_url = avatarFile.file_path;
    }
    res.json({ ...patient, files });
  } catch (err) {
    console.error("getPatient error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── DELETE patient ────────────────────────────────────────
export async function deletePatient(req, res) {
  try {
    const [result] = await db.query(
      "DELETE FROM patients WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Patient not found" });

    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    console.error("deletePatient error:", err);
    res.status(500).json({ message: "Server error" });
  }
}





// ─── GET patient medications ───────────────────────────────
export async function getPatientMedications(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM medications
       WHERE patient_id = ?
       ORDER BY
         CASE status WHEN 'active' THEN 0 ELSE 1 END,
         created_at DESC`,
      [req.params.id]
    );

    res.json({ count: rows.length, medications: rows });
  } catch (err) {
    console.error("getPatientMedications error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET patient medical records ───────────────────────────
export async function getPatientRecords(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT r.*,
         (SELECT df.file_path
            FROM doctor_files df
           WHERE df.doctor_id = r.doctor_id
             AND df.file_type = 'avatar'
           LIMIT 1) AS doctor_avatar_path
       FROM medical_records r
       WHERE r.patient_id = ?
       ORDER BY r.record_date DESC`,
      [req.params.id]
    );

    // Normalize the doctor avatar path so the frontend can drop it
    // straight into an <img src>. Mirrors toUrlPath elsewhere in this
    // file: promote `uploads/...` to `/uploads/...` so the static
    // middleware in app.js can serve it.
    for (const r of rows) {
      if (r.doctor_avatar_path) {
        r.doctor_avatar_url = toUrlPath(r.doctor_avatar_path);
      } else {
        r.doctor_avatar_url = null;
      }
      delete r.doctor_avatar_path;
    }

    res.json({ count: rows.length, records: rows });
  } catch (err) {
    console.error("getPatientRecords error:", err);
    res.status(500).json({ message: "Server error" });
  }
}
// ─── UPDATE patient (personal info) ───────────────────────
export async function updatePatient(req, res) {
  // const { full_name, national_id, date_of_birth, gender, phone, email, address } = req.body;
  const { full_name, national_id, date_of_birth, gender, phone, email } = req.body;

  if (!full_name || !email)
    return res.status(400).json({ message: "Full name and email are required" });

  try {
    // Check email/national_id not taken by another patient
    const [conflict] = await db.query(
      `SELECT id FROM patients
       WHERE (email = ? OR national_id = ?) AND id != ?`,
      [email, national_id || null, req.params.id]
    );
    if (conflict.length > 0)
      return res.status(409).json({ message: "Email or National ID already used by another patient" });

    const [result] = await db.query(
      `UPDATE patients
   SET full_name = ?, national_id = ?, date_of_birth = ?,
       gender = ?, phone = ?, email = ?
   WHERE id = ?`,
      [
        full_name,
        national_id || null,
        date_of_birth || null,
        gender || null,
        phone || null,
        email,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Patient not found" });

    // Return the updated patient (without password_hash)
    const [rows] = await db.query(
      `SELECT p.*,
         pi.blood_type, pi.chronic_diseases, pi.allergies,
         pi.previous_surgeries, pi.additional_history,
         pi.age, pi.condition_text
       FROM patients p
       LEFT JOIN patient_info pi ON p.id = pi.patient_id
       WHERE p.id = ?`,
      [req.params.id]
    );

    const { password_hash, ...patient } = rows[0];
    res.json({ message: "Profile updated successfully", patient });
  } catch (err) {
    console.error("updatePatient error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── UPDATE patient medical info (patient_info table) ──────
export async function updatePatientInfo(req, res) {
  const {
    blood_type, condition_text, chronic_diseases,
    allergies, previous_surgeries, additional_history,
  } = req.body;

  try {
    await db.query(
      `INSERT INTO patient_info
         (patient_id, blood_type, condition_text, chronic_diseases,
          allergies, previous_surgeries, additional_history)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         blood_type          = VALUES(blood_type),
         condition_text      = VALUES(condition_text),
         chronic_diseases    = VALUES(chronic_diseases),
         allergies           = VALUES(allergies),
         previous_surgeries  = VALUES(previous_surgeries),
         additional_history  = VALUES(additional_history)`,
      [
        req.params.id,
        blood_type || null,
        condition_text || null,
        chronic_diseases || null,
        allergies || null,
        previous_surgeries || null,
        additional_history || null,
      ]
    );

    res.json({ message: "Medical info updated successfully" });
  } catch (err) {
    console.error("updatePatientInfo error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// ─── CHANGE patient password ───────────────────────────────
export async function changePatientPassword(req, res) {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    return res.status(400).json({ message: "Both current and new password are required" });

  if (new_password.length < 6)
    return res.status(400).json({ message: "New password must be at least 6 characters" });

  try {
    // Fetch current hash
    const [rows] = await db.query(
      "SELECT password_hash FROM patients WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Patient not found" });

    // Verify current password
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ message: "Current password is incorrect" });

    // Hash & save new password
    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      "UPDATE patients SET password_hash = ? WHERE id = ?",
      [password_hash, req.params.id]
    );

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("changePatientPassword error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

export async function getPatientVitals(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, heart_rate, blood_pressure, spo2, body_temperature,
              respiratory_rate, bmi, recorded_at
       FROM vital_signs
       WHERE patient_id = ?
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length)
      return res.json({
        heart_rate: null, blood_pressure: null,
        spo2: null, body_temperature: null,
        respiratory_rate: null, bmi: null,
      });

    res.json(rows[0]);
  } catch (err) {
    console.error("getPatientVitals error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── UPLOAD PATIENT AVATAR ────────────────────────────────────────────────────
export async function uploadPatientAvatar(req, res) {
  try {
    const { id } = req.params;

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded" });

    const file = req.file;

    await db.query(
      "DELETE FROM patient_files WHERE patient_id = ? AND file_type = 'avatar'", [id]
    );

    await db.query(
      `INSERT INTO patient_files (patient_id, file_type, file_path)
       VALUES (?, 'avatar', ?)`,
      [id, file.path]
    );

    const urlPath = toUrlPath(file.path);
    res.json({ message: "Avatar uploaded", file_path: urlPath });
  } catch (err) {
    console.error("uploadPatientAvatar error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── DELETE PATIENT AVATAR ────────────────────────────────────────────────────
export async function deletePatientAvatar(req, res) {
  try {
    const { id } = req.params;
    // Fetch existing file path before deleting
    const [rows] = await db.query(
      "SELECT file_path FROM patient_files WHERE patient_id = ? AND file_type = 'avatar'", [id]
    );
    if (rows.length > 0 && rows[0].file_path) {
      const filePath = path.resolve(rows[0].file_path);
      try { fs.unlinkSync(filePath); } catch (_) { /* file may not exist on disk */ }
    }
    await db.query(
      "DELETE FROM patient_files WHERE patient_id = ? AND file_type = 'avatar'", [id]
    );
    res.json({ message: "Avatar removed", avatar_url: null });
  } catch (err) {
    console.error("deletePatientAvatar error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET patient appointments ──────────────────────────────────────────────────
// Fixed: specialty comes from doctor_details, not doctors
export async function getPatientAppointments(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         a.*,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.appointment_time, '%H:%i')    AS appointment_time,
         d.full_name   AS doctor_name,
         d.phone       AS doctor_phone,
         dd.specialty  AS doctor_specialty,
         (SELECT df.file_path
            FROM doctor_files df
           WHERE df.doctor_id = d.id
             AND df.file_type = 'avatar'
           LIMIT 1) AS doctor_avatar_path
       FROM appointments a
       LEFT JOIN doctors        d  ON a.doctor_id = d.id
       LEFT JOIN doctor_details dd ON d.id         = dd.doctor_id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [req.params.id]
    );

    // Normalize doctor avatar path so the frontend can drop it straight
    // into an <img src>. We mirror what `toUrlPath` does for patients
    // and the doctor login response — strip the `uploads/` prefix if
    // multer stored it, then prefix with `/uploads/`.
    for (const r of rows) {
      if (r.doctor_avatar_path) {
        r.doctor_avatar_url = toUrlPath(r.doctor_avatar_path);
      } else {
        r.doctor_avatar_url = null;
      }
      delete r.doctor_avatar_path;
    }

    res.json({ count: rows.length, appointments: rows });
  } catch (err) {
    console.error("getPatientAppointments error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

export async function savePatientVitals(req, res) {
  const { heart_rate, blood_pressure_sys, blood_pressure_dia, spo2, body_temperature, respiratory_rate, bmi } = req.body;

  if (!heart_rate && !blood_pressure_sys && !blood_pressure_dia && !spo2 && !body_temperature && !respiratory_rate && !bmi) {
    return res.status(400).json({ message: "At least one vital sign is required" });
  }

  const blood_pressure = blood_pressure_sys && blood_pressure_dia
    ? `${blood_pressure_sys}/${blood_pressure_dia}`
    : null;

  try {
    const [result] = await db.query(
      `INSERT INTO vital_signs (patient_id, heart_rate, blood_pressure, spo2, body_temperature, respiratory_rate, bmi)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, heart_rate || null, blood_pressure, spo2 || null, body_temperature || null, respiratory_rate || null, bmi || null]
    );

    res.status(201).json({ message: "Vitals saved", id: result.insertId });
  } catch (err) {
    console.error("savePatientVitals error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}