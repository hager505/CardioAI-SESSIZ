// controllers/doctorController.js
import bcrypt from "bcrypt";
import db from "../config/db.js";

// ─── Normalise filesystem path → URL path ──────────────────────────────────────
function toUrlPath(p) {
  if (!p) return null;
  return '/' + p.replace(/\\/g, '/');
}

// ─── Serial generator ─────────────────────────────────────────────────────────
function generateSerial() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `DR${y}${m}${d}${Date.now().toString().slice(-4)}`;
}

// ─── Normalise a MySQL DATE/DATETIME/Timestamp → "YYYY-MM-DD" string ──────────
function normaliseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return String(val).split("T")[0];
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerDoctor(req, res) {
  const {
    full_name, email, address, password, confirm_password,
    phone, age, gender, role,
    medical_id, hospital_affiliation, has_private_clinic,
    years_experience, patients_per_week,
    university, medical_degree, has_masters_phd,
    acknowledged_terms,
  } = req.body;

  const missing = [];
  if (!full_name) missing.push("full_name");
  if (!email) missing.push("email");
  if (!password) missing.push("password");
  if (!phone) missing.push("phone");
  if (!age) missing.push("age");
  if (!gender) missing.push("gender");
  if (!role) missing.push("role");
  if (!medical_id) missing.push("medical_id");
  if (!hospital_affiliation) missing.push("hospital_affiliation");
  if (!university) missing.push("university");
  if (!medical_degree) missing.push("medical_degree");

  if (missing.length > 0)
    return res.status(400).json({ message: "Missing required fields", missing });

  if (password !== confirm_password)
    return res.status(400).json({ message: "Passwords do not match" });

  if (!acknowledged_terms || acknowledged_terms === "false")
    return res.status(400).json({ message: "You must acknowledge the terms" });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [dupEmail] = await conn.query(
      "SELECT id FROM doctors WHERE email = ?", [email]
    );
    if (dupEmail.length > 0)
      return res.status(409).json({ message: "Email already registered as a doctor" });

    const [dupMed] = await conn.query(
      "SELECT id FROM doctor_details WHERE medical_id = ?", [medical_id]
    );
    if (dupMed.length > 0)
      return res.status(409).json({ message: "Medical ID already registered" });

    const password_hash = await bcrypt.hash(password, 10);
    const serial = generateSerial();

    const [doctorResult] = await conn.query(
      `INSERT INTO doctors
        (serial, full_name, email, phone, password_hash,
         gender, age, address, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [serial, full_name, email, phone, password_hash,
        gender, parseInt(age), address || null, role]
    );
    const doctorId = doctorResult.insertId;

    await conn.query(
      `INSERT INTO doctor_details
        (doctor_id, medical_id, hospital_affiliation, has_private_clinic,
         years_experience, patients_per_week, university,
         medical_degree, has_masters_phd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doctorId, medical_id, hospital_affiliation,
        has_private_clinic === true || has_private_clinic === "true" ? 1 : 0,
        parseInt(years_experience) || 0,
        parseInt(patients_per_week) || 0,
        university, medical_degree,
        has_masters_phd === true || has_masters_phd === "yes" ? 1 : 0,
      ]
    );

    if (req.files) {
      const fileRows = [];
      if (req.files.medical_license?.[0]) {
        const f = req.files.medical_license[0];
        fileRows.push([doctorId, "license", f.originalname, f.path, f.size, f.mimetype]);
      }
      if (req.files.medical_documents?.length) {
        for (const f of req.files.medical_documents) {
          fileRows.push([doctorId, "document", f.originalname, f.path, f.size, f.mimetype]);
        }
      }
      if (fileRows.length > 0) {
        await conn.query(
          `INSERT INTO doctor_files
            (doctor_id, file_type, file_name, file_path, file_size, mime_type)
           VALUES ?`,
          [fileRows]
        );
      }
    }

    await conn.commit();
    res.status(201).json({
      message: "Application submitted and approved successfully.",
      doctor_id: doctorId,
      serial,
      status: "approved",
    });

  } catch (err) {
    await conn.rollback();
    console.error("registerDoctor error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    conn.release();
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
// CRITICAL: response must include `id` at top level so frontend can store
// sessionStorage.setItem("user_id", String(data.id))
export async function loginDoctor(req, res) {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const [rows] = await db.query(
      `SELECT d.*,
         dd.specialty, dd.medical_id, dd.hospital_affiliation,
         dd.years_experience, dd.patients_per_week
       FROM doctors d
       LEFT JOIN doctor_details dd ON d.id = dd.doctor_id
       WHERE d.email = ? OR d.phone = ?`,
      [email, email]
    );

    if (!rows.length)
      return res.status(401).json({ message: "Invalid email or password" });

    const doctor = rows[0];

    if (doctor.status === "pending")
      return res.status(403).json({ message: "Your account is pending admin approval. Please wait." });

    if (doctor.status === "rejected")
      return res.status(403).json({ message: "Your application was rejected. Please contact support." });

    const valid = await bcrypt.compare(password, doctor.password_hash);
    if (!valid)
      return res.status(401).json({ message: "Invalid email or password" });

    const { password_hash, ...safeDoctor } = doctor;

    // Fetch avatar from doctor_files
    const [files] = await db.query(
      "SELECT file_path FROM doctor_files WHERE doctor_id = ? AND file_type = 'avatar' LIMIT 1",
      [doctor.id]
    );
    if (files.length > 0) {
      safeDoctor.avatar_url = toUrlPath(files[0].file_path);
    }

    // Normalise any date fields
    if (safeDoctor.created_at instanceof Date)
      safeDoctor.created_at = safeDoctor.created_at.toISOString();

    res.json({
      message: "Login successful",
      role: "doctor",
      id: doctor.id,      // ← EXPLICIT — frontend stores as user_id
      ...safeDoctor,           // also contains id, full_name, specialty, etc.
    });

  } catch (err) {
    console.error("loginDoctor error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET all doctors ──────────────────────────────────────────────────────────
export async function getAllDoctors(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         d.id, d.serial, d.full_name, d.email, d.phone,
         d.gender, d.age, d.role, d.status, d.created_at,
         dd.specialty, dd.medical_id, dd.hospital_affiliation,
         dd.years_experience, dd.patients_per_week
       FROM doctors d
       LEFT JOIN doctor_details dd ON d.id = dd.doctor_id
       ORDER BY d.created_at DESC`
    );
    res.json({ count: rows.length, doctors: rows });
  } catch (err) {
    console.error("getAllDoctors error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET one doctor ───────────────────────────────────────────────────────────
export async function getDoctor(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         d.*,
         dd.specialty, dd.medical_id, dd.hospital_affiliation,
         dd.has_private_clinic, dd.years_experience, dd.patients_per_week,
         dd.university, dd.medical_degree, dd.has_masters_phd
       FROM doctors d
       LEFT JOIN doctor_details dd ON d.id = dd.doctor_id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Doctor not found" });

    const [files] = await db.query(
      `SELECT file_type, file_name, file_path, uploaded_at
       FROM doctor_files WHERE doctor_id = ?`,
      [req.params.id]
    );

    const { password_hash, ...doctor } = rows[0];
    // Normalise file paths to URL paths
    if (files) {
      files.forEach(f => { if (f.file_path) f.file_path = toUrlPath(f.file_path); });
      const avatarFile = files.find(f => f.file_type === 'avatar');
      if (avatarFile) doctor.avatar_url = avatarFile.file_path;
    }
    res.json({ ...doctor, files });

  } catch (err) {
    console.error("getDoctor error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── UPDATE doctor ────────────────────────────────────────────────────────────
export async function updateDoctor(req, res) {
  try {
    const { full_name, email, phone, address } = req.body;
    const { id } = req.params;

    if (!full_name || !email)
      return res.status(400).json({ message: "Full name and email are required" });

    const [result] = await db.query(
      "UPDATE doctors SET full_name = ?, email = ?, phone = ?, address = ? WHERE id = ?",
      [full_name, email, phone || null, address || null, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Doctor not found" });

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("updateDoctor error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
export async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    const { id } = req.params;

    if (!current_password || !new_password)
      return res.status(400).json({ message: "Current and new password required" });

    if (new_password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const [rows] = await db.query(
      "SELECT password_hash FROM doctors WHERE id = ?", [id]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Doctor not found" });

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid)
      return res.status(401).json({ message: "Current password is incorrect" });

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query("UPDATE doctors SET password_hash = ? WHERE id = ?", [password_hash, id]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── UPLOAD AVATAR ────────────────────────────────────────────────────────────
export async function uploadAvatar(req, res) {
  try {
    const { id } = req.params;

    if (!req.file)
      return res.status(400).json({ message: "No file uploaded" });

    const file = req.file;

    // Remove old avatar files
    await db.query(
      "DELETE FROM doctor_files WHERE doctor_id = ? AND file_type = 'avatar'", [id]
    );

    await db.query(
      `INSERT INTO doctor_files (doctor_id, file_type, file_name, file_path)
       VALUES (?, 'avatar', ?, ?)`,
      [id, file.originalname, file.path]
    );

    const urlPath = toUrlPath(file.path);
    res.json({ message: "Avatar uploaded", file_path: urlPath });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── DELETE DOCTOR AVATAR ────────────────────────────────────────────────────
export async function deleteDoctorAvatar(req, res) {
  try {
    const { id } = req.params;
    await db.query(
      "DELETE FROM doctor_files WHERE doctor_id = ? AND file_type = 'avatar'", [id]
    );
    res.json({ message: "Avatar removed", avatar_url: null });
  } catch (err) {
    console.error("deleteDoctorAvatar error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── DELETE doctor ────────────────────────────────────────────────────────────
export async function deleteDoctor(req, res) {
  try {
    const [result] = await db.query(
      "DELETE FROM doctors WHERE id = ?", [req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Doctor not found" });
    res.json({ message: "Doctor deleted successfully" });
  } catch (err) {
    console.error("deleteDoctor error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// ─── GET doctor appointments ──────────────────────────────────────────────────
// Fixes vs original:
//   • appointment_date normalised from MySQL Date object → "YYYY-MM-DD" string
//   • patient_age calculated via TIMESTAMPDIFF (not the static `age` column)
//   • patient_id explicitly selected so frontend can key avatars
export async function getDoctorAppointments(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         a.id,
         a.patient_id,
         a.doctor_id,
         a.appointment_type,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d')    AS appointment_date,
         TIME_FORMAT(a.appointment_time, '%H:%i')       AS appointment_time,
         a.duration,
         a.reason_for_visit,
         a.notes,
         a.status,
         a.heart_rate,
         a.blood_pressure,
         a.spo2,
         a.body_temperature,
         a.created_at,
         p.full_name                                    AS patient_name,
         p.phone                                        AS patient_phone,
         p.email                                        AS patient_email,
         p.gender                                       AS patient_gender,
         TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS patient_age,
         pi.blood_type,
         pi.condition_text
       FROM appointments a
       LEFT JOIN patients    p  ON a.patient_id = p.id
       LEFT JOIN patient_info pi ON p.id         = pi.patient_id
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time ASC`,
      [req.params.id]
    );

    res.json({ count: rows.length, appointments: rows });
  } catch (err) {
    console.error("getDoctorAppointments error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}