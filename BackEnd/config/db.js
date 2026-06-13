import { createPool } from "mysql2";

const DB_NAME = "cardioai";

const db = createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: process.env.DB_PORT || 3306,
  database: DB_NAME,
  connectionLimit: 10,
}).promise();

// ── Patients ───────────────────────────────────────────────
const createPatients = `
CREATE TABLE IF NOT EXISTS patients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  serial        VARCHAR(20) UNIQUE,
  full_name     VARCHAR(150) NOT NULL,
  national_id   VARCHAR(20) UNIQUE,
  date_of_birth DATE,
  gender        ENUM('male','female'),
  phone         VARCHAR(20),
  email         VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  agreed_terms  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const createPatientInfo = `
CREATE TABLE IF NOT EXISTS patient_info (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  patient_id         INT UNIQUE NOT NULL,
  blood_type         VARCHAR(5),
  chronic_diseases   TEXT,
  allergies          TEXT,
  previous_surgeries TEXT,
  prescription_file  VARCHAR(255),
  additional_history TEXT,
  age                INT,
  condition_text     TEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);`;

// ── Doctors ────────────────────────────────────────────────
const createDoctors = `
CREATE TABLE IF NOT EXISTS doctors (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  serial        VARCHAR(20) UNIQUE,
  full_name     VARCHAR(150) NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  gender        ENUM('male','female'),
  age           INT,
  address       TEXT,
  role          ENUM('doctor','specialist','surgeon','consultant') DEFAULT 'doctor',
  status        ENUM('pending','approved','rejected') DEFAULT 'approved',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

// كل المعلومات المهنية للدكتور في جدول منفصل
const createDoctorDetails = `
CREATE TABLE IF NOT EXISTS doctor_details (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id            INT UNIQUE NOT NULL,
  specialty            VARCHAR(100),
  medical_id           VARCHAR(50) UNIQUE,
  hospital_affiliation VARCHAR(200),
  has_private_clinic   BOOLEAN DEFAULT FALSE,
  years_experience     INT,
  patients_per_week    INT,
  university           VARCHAR(200),
  medical_degree       VARCHAR(200),
  has_masters_phd      BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);`;

// ملفات الدكتور (license + documents)
const createDoctorFiles = `
CREATE TABLE IF NOT EXISTS doctor_files (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id   INT NOT NULL,
  file_type   ENUM('license','document','avatar') NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  file_size   INT,
  mime_type   VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);`;

// ── Appointments ───────────────────────────────────────────
const createAppointments = `
CREATE TABLE IF NOT EXISTS appointments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT,
  doctor_id        INT,
  patient_name     VARCHAR(150),
  phone            VARCHAR(20),
  email            VARCHAR(120),
  appointment_type ENUM('Check-up','Follow-up','Emergency','Consultation','New Patient'),
  appointment_date DATE,
  appointment_time TIME,
  duration         VARCHAR(50),
  duration_minutes INT,
  reason_for_visit TEXT,
  notes            TEXT,
  status           VARCHAR(50) DEFAULT 'scheduled',
  heart_rate       INT,
  blood_pressure   VARCHAR(20),
  spo2             INT,
  body_temperature DECIMAL(4,1),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL
);`;

const createVitalSigns = `
CREATE TABLE IF NOT EXISTS vital_signs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  patient_id       INT NOT NULL,
  heart_rate       INT,
  blood_pressure   VARCHAR(20),
  spo2             INT,
  body_temperature DECIMAL(4,1),
  respiratory_rate INT,
  bmi              DECIMAL(4,1),
  recorded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);`;

const createMedications = `
CREATE TABLE IF NOT EXISTS medications (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  patient_id      INT NOT NULL,
  medication_name VARCHAR(200),
  dosage          VARCHAR(100),
  frequency       VARCHAR(50),
  time_of_day     VARCHAR(50),
  start_date      DATE,
  end_date        DATE,
  instructions    TEXT,
  prescribed_by   INT,
  status          ENUM('active','past'),
  refill_due      DATE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);`;

const createMedicalRecords = `
CREATE TABLE IF NOT EXISTS medical_records (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT NOT NULL,
  doctor_id   INT,
  doctor_name VARCHAR(150),
  title       VARCHAR(200),
  record_type ENUM('lab','radiology','prescription','surgery'),
  record_date DATE,
  description TEXT,
  report_file VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL
);`;

const createPatientFiles = `
CREATE TABLE IF NOT EXISTS patient_files (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  file_type  VARCHAR(50),
  file_path  VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);`;

const createDoctorRequests = `
CREATE TABLE IF NOT EXISTS doctor_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT,
  patient_id INT,
  patient_name VARCHAR(150),
  message TEXT,
  priority VARCHAR(50),
  notes TEXT,
  status ENUM('pending','approved','rejected','resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);`;

const createNotifications = `
CREATE TABLE IF NOT EXISTS notifications(
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  title      VARCHAR(255),
  message    TEXT,
  is_read    TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
); `;

// ── Chat History ────────────────────────────────────────────
const createChatSessions = `
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  user_type     ENUM('patient','doctor') NOT NULL,
  title         VARCHAR(255) DEFAULT 'New Chat',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, user_type),
  INDEX idx_updated (updated_at)
);`;

const createChatMessages = `
CREATE TABLE IF NOT EXISTS chat_messages (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    INT NOT NULL,
  role          ENUM('user','assistant','system') NOT NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_session (session_id, created_at)
);`;

// ── Clinical Notes (per patient, written by doctors) ─────────
const createClinicalNotes = `
CREATE TABLE IF NOT EXISTS clinical_notes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id  INT,
  note       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL,
  INDEX idx_patient (patient_id, created_at)
);`;

// ── Init ───────────────────────────────────────────────────
export async function initDB() {
  await db.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`USE ${DB_NAME} `);

  // الترتيب مهم — الـ foreign keys لازم تكون بعد المرجع بتاعها
  const tables = [
    ["patients", createPatients],
    ["patient_info", createPatientInfo],
    ["doctors", createDoctors],
    ["doctor_details", createDoctorDetails],
    ["doctor_files", createDoctorFiles],
    ["appointments", createAppointments],
    ["vital_signs", createVitalSigns],
    ["medications", createMedications],
    ["medical_records", createMedicalRecords],
    ["patient_files", createPatientFiles],
    ["doctor_requests", createDoctorRequests],
    ["notifications", createNotifications],
    ["chat_sessions", createChatSessions],
    ["chat_messages", createChatMessages],
    ["clinical_notes", createClinicalNotes],
  ];

  for (const [name, sql] of tables) {
    await db.query(sql);
    console.log(`✅ Table ready: ${name} `);
  }

  // ─── Migrations: add columns to existing tables ───────────────────────
  const migrations = [
    { sql: `ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS respiratory_rate INT`, fallback: `ALTER TABLE vital_signs ADD COLUMN respiratory_rate INT` },
    { sql: `ALTER TABLE vital_signs ADD COLUMN IF NOT EXISTS bmi DECIMAL(4,1)`,     fallback: `ALTER TABLE vital_signs ADD COLUMN bmi DECIMAL(4,1)` },
    { sql: `ALTER TABLE medications ADD COLUMN IF NOT EXISTS frequency VARCHAR(50)`,         fallback: `ALTER TABLE medications ADD COLUMN frequency VARCHAR(50)` },
    { sql: `ALTER TABLE medications ADD COLUMN IF NOT EXISTS time_of_day VARCHAR(50)`,       fallback: `ALTER TABLE medications ADD COLUMN time_of_day VARCHAR(50)` },
    { sql: `ALTER TABLE medications ADD COLUMN IF NOT EXISTS start_date DATE`,               fallback: `ALTER TABLE medications ADD COLUMN start_date DATE` },
    { sql: `ALTER TABLE medications ADD COLUMN IF NOT EXISTS end_date DATE`,                 fallback: `ALTER TABLE medications ADD COLUMN end_date DATE` },
    { sql: `ALTER TABLE medications ADD COLUMN IF NOT EXISTS instructions TEXT`,             fallback: `ALTER TABLE medications ADD COLUMN instructions TEXT` },
    { sql: `ALTER TABLE medications ADD COLUMN IF NOT EXISTS prescribed_by INT`,             fallback: `ALTER TABLE medications ADD COLUMN prescribed_by INT` },
  ];
  for (const m of migrations) {
    try {
      await db.query(m.sql);
    } catch (err) {
      if (err.errno === 1064) {
        // "IF NOT EXISTS" syntax not supported (MySQL < 8.0.16), retry without it
        try {
          await db.query(m.fallback);
        } catch (err2) {
          if (err2.errno !== 1060) console.error(`⚠️ Migration failed: ${m.fallback}`, err2.message);
        }
      } else if (err.errno !== 1060) {
        console.error(`⚠️ Migration failed: ${m.sql}`, err.message);
      }
    }
  }
  console.log("🎉 All tables initialized\n");
}

export default db;