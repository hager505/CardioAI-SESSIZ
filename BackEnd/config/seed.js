import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import { createPool } from "mysql2";
const hashedPassword = await bcrypt.hash("11111111", 10);
const pool = createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT) || 3306,
  connectionLimit: 5,
}).promise();

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// helper for current week dates
function getCurrentWeekDates() {
  const dates = [];
  const curr = new Date(); // get current date
  const first = curr.getDate() - curr.getDay(); // First day is Sunday
  for (let i = 0; i < 7; i++) {
    const day = new Date(curr.getTime());
    day.setDate(first + i);
    dates.push(day.toISOString().split("T")[0]);
  }
  return dates;
}

const recent = (d) => faker.date.recent({ days: d }).toISOString().split("T")[0];

const egyptianNames = ["أحمد محمد", "محمد علي", "أسماء حسن", "محمود عبد الله", "نورهان سامي", "هشام مصطفى", "سارة محمود", "عمرو إبراهيم", "منة الله خالد", "يوسف طه", "علياء حمدي", "كريم عثمان", "مصطفى كمال", "منى صفوت", "حسين فوزي"];
const egyptianNamesEn = ["ahmed.mohamed", "mohamed.ali", "asmaa.hassan", "mahmoud.abdallah", "norhan.sami", "hesham.mostafa", "sara.mahmoud", "amro.ibrahim", "menna.khaled", "youssef.taha", "aliaa.hamdy", "karim.osman", "mostafa.kamal", "mona.safwat", "hussein.fawzi"];
const phonePrefix = ["010", "011", "012", "015"];
const heartConditions = ["Arrhythmia", "Myocardial Infarction", "Heart Failure", "Hypertension", "Coronary Artery Disease", "Palpitations", "Chest Pain Evaluated"];
const apptTypes = ["Check-up", "Follow-up", "Emergency", "Consultation"];
const apptTimes = ["08:00", "09:00", "09:30", "10:00", "11:00", "12:00", "13:30", "14:00", "15:00", "16:00"];
const medsList = ["Aspirin", "Atorvastatin", "Metoprolol", "Lisinopril", "Warfarin", "Amlodipine", "Furosemide", "Digoxin", "Rosuvastatin", "Clopidogrel"];
const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const specialties = ["Cardiology", "Interventional Cardiology", "Electrophysiology", "Heart Failure Specialist"];
const roles = ["doctor", "specialist", "surgeon", "consultant"];
const universities = ["Cairo University", "Ain Shams University", "Alexandria University", "Mansoura University"];
const degrees = ["Doctor of Medicine (MD)", "MBBS", "MBBCh"];
const hospitals = ["Cairo University Hospital", "Ain Shams Specialized Hospital", "Al-Salam Hospital", "Dar Al Fouad Hospital"];
const doctorNames = [
  { en: "Ahmed Samir", email: "ahmed.samir" },
  { en: "Mona Farouk", email: "mona.farouk" },
  { en: "Khaled Nasser", email: "khaled.nasser" },
  { en: "Sara Hassan", email: "sara.hassan" },
  { en: "Omar Fathy", email: "omar.fathy" },
];

function getAvatarUrl(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || 'D';
  const last = parts[1]?.[0] || parts[0]?.[1] || 'R';
  return `https://ui-avatars.com/api/?name=${first}+${last}&background=random&color=fff&size=200`;
}

// ── جداول الإنشاء ──────
const TABLES = [
  `CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY, serial VARCHAR(20) UNIQUE,
    full_name VARCHAR(150) NOT NULL, national_id VARCHAR(20) UNIQUE,
    date_of_birth DATE, gender ENUM('male','female'), phone VARCHAR(20),
    email VARCHAR(120) UNIQUE, password_hash VARCHAR(255) NOT NULL,
    agreed_terms BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,

  `CREATE TABLE patient_info (
    id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT UNIQUE NOT NULL,
    blood_type VARCHAR(5), chronic_diseases TEXT, allergies TEXT,
    previous_surgeries TEXT, prescription_file VARCHAR(255),
    additional_history TEXT, age INT, condition_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE)`,

  `CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY, serial VARCHAR(20) UNIQUE,
    full_name VARCHAR(150) NOT NULL, email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(20), password_hash VARCHAR(255) NOT NULL,
    gender ENUM('male','female'), age INT, address TEXT,
    role ENUM('doctor','specialist','surgeon','consultant') DEFAULT 'doctor',
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,

  `CREATE TABLE doctor_details (
    id INT AUTO_INCREMENT PRIMARY KEY, doctor_id INT UNIQUE NOT NULL,
    specialty VARCHAR(100), medical_id VARCHAR(50) UNIQUE,
    hospital_affiliation VARCHAR(200), has_private_clinic BOOLEAN DEFAULT FALSE,
    years_experience INT, patients_per_week INT,
    university VARCHAR(200), medical_degree VARCHAR(200),
    has_masters_phd BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE)`,

  `CREATE TABLE doctor_files (
    id INT AUTO_INCREMENT PRIMARY KEY, doctor_id INT NOT NULL,
    file_type ENUM('license','document', 'avatar') NOT NULL,
    file_name VARCHAR(255) NOT NULL, file_path VARCHAR(500) NOT NULL,
    file_size INT, mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE)`,

  `CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT, doctor_id INT,
    patient_name VARCHAR(150), phone VARCHAR(20), email VARCHAR(120),
    appointment_type VARCHAR(100),
    appointment_date DATE, appointment_time TIME, duration VARCHAR(50), duration_minutes INT,
    reason_for_visit TEXT, notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    heart_rate INT, blood_pressure VARCHAR(20), spo2 INT,
    body_temperature DECIMAL(4,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL)`,

  `CREATE TABLE vital_signs (
    id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL,
    heart_rate INT, blood_pressure VARCHAR(20), spo2 INT,
    body_temperature DECIMAL(4,1),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE)`,

  `CREATE TABLE medications (
    id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL,
    medication_name VARCHAR(200), dosage VARCHAR(100),
    status ENUM('active','past'), refill_due DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE)`,

  `CREATE TABLE medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL,
    doctor_id INT, doctor_name VARCHAR(150), title VARCHAR(200),
    record_type ENUM('lab','radiology','prescription','surgery'),
    record_date DATE, description TEXT, report_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE SET NULL)`,

  `CREATE TABLE patient_files (
    id INT AUTO_INCREMENT PRIMARY KEY, patient_id INT NOT NULL,
    file_type VARCHAR(50), file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE)`,

  `CREATE TABLE doctor_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT, patient_id INT, patient_name VARCHAR(150),
    message TEXT, priority VARCHAR(50), notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE)` ,
  `CREATE TABLE notifications(
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE)`
];

function makeSerial(prefix, index) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${prefix}${y}${m}${d}${String(index).padStart(3, "0")}`;
}

async function seed() {
  console.log("🚀 Starting seed...\n");

  await pool.query("DROP DATABASE IF EXISTS cardioai");
  await pool.query("CREATE DATABASE cardioai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await pool.query("USE cardioai");
  console.log("✅ Database recreated\n");

  for (const t of TABLES) await pool.query(t);
  console.log("✅ All tables created\n");

  // ── Doctors ─────────────────────────────────────────
  console.log("👨‍⚕️ Inserting doctors...");
  const doctorIds = [];
  const doctorRecords = [];

  const [fixedDoctor] = await pool.query(
    `INSERT INTO cardioai.doctors
    (serial, full_name, email, phone, password_hash, gender, age, address, role, status)
   VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      makeSerial("DR", 0),
      "Dr. Test Doctor",
      "doctor@gmail.com",
      "01000000000",
      hashedPassword,
      "male",
      40,
      "Cairo",
      "doctor",
      "approved",
    ]
  );

  const fixedDoctorId = fixedDoctor.insertId;

  doctorIds.push(fixedDoctorId);
  doctorRecords.push({ id: fixedDoctorId, name: "Dr. Test Doctor" });

  // doctor_details
  await pool.query(
    `INSERT INTO cardioai.doctor_details
    (doctor_id, specialty, medical_id, hospital_affiliation,
      has_private_clinic, years_experience, patients_per_week,
      university, medical_degree, has_masters_phd)
   VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      fixedDoctorId,
      "Cardiology",
      "MED00001",
      "Test Hospital",
      true,
      10,
      50,
      "Cairo University",
      "MD",
      true,
    ]
  );

  // avatar
  await pool.query(
    `INSERT INTO cardioai.doctor_files
    (doctor_id, file_type, file_name, file_path, file_size, mime_type)
   VALUES(?,?,?,?,?,?)`,
    [
      fixedDoctorId,
      "avatar",
      "avatar_fixed.png",
      getAvatarUrl("Dr. Test Doctor"),
      1024,
      "image/png",
    ]
  );
  for (let i = 0; i < doctorNames.length; i++) {
    const doc = doctorNames[i];
    const gender = i % 2 === 0 ? "male" : "female";
    const fullName = `Dr.${doc.en}`;

    const [r] = await pool.query(
      `INSERT INTO cardioai.doctors
    (serial, full_name, email, phone, password_hash, gender, age, address, role, status)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        makeSerial("DR", i + 1),
        fullName,
        `${doc.email}@cardioai.com`,
        pick(phonePrefix) + rand(10000000, 99999999),
        await faker.internet.password({ length: 12 }),
        gender,
        rand(30, 60),
        `${rand(1, 50)} El - Tahrir St, Cairo`,
        pick(roles),
        "approved",
      ]
    );

    const doctorId = r.insertId;
    doctorIds.push(doctorId);
    doctorRecords.push({ id: doctorId, name: fullName });

    // doctor_details
    await pool.query(
      `INSERT INTO cardioai.doctor_details
    (doctor_id, specialty, medical_id, hospital_affiliation,
      has_private_clinic, years_experience, patients_per_week,
      university, medical_degree, has_masters_phd)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        doctorId, pick(specialties), `MED${rand(10000, 99999)}`, pick(hospitals),
        rand(0, 1) === 1, rand(5, 25), rand(30, 100), pick(universities),
        pick(degrees), rand(0, 1) === 1,
      ]
    );

    // Initial Avatar file
    await pool.query(
      `INSERT INTO cardioai.doctor_files
    (doctor_id, file_type, file_name, file_path, file_size, mime_type)
       VALUES(?,?,?,?,?,?)`,
      [doctorId, "avatar", `avatar_${doctorId}.png`, getAvatarUrl(fullName), 1024, "image/png"]
    );

    console.log(`  ✅ ${fullName}(id: ${doctorId})`);
  }

  // ── Patients ────────────────────────────────────────
  console.log("\n👤 Inserting patients...");
  const patientRecords = [];

  // Fixed patient
  const [fixedPatient] = await pool.query(
    `INSERT INTO cardioai.patients
    (serial, full_name, national_id, date_of_birth, gender, phone, email, password_hash, agreed_terms)
   VALUES(?,?,?,?,?,?,?,?,?)`,
    [
      makeSerial("#PT", 0),
      "Test Patient",
      "29999999999999",
      "1995-01-01",
      "male",
      "01111111111",
      "patient@gmail.com",
      hashedPassword,
      true,
    ]
  );

  const fixedPatientId = fixedPatient.insertId;

  patientRecords.push({
    id: fixedPatientId,
    name: "Test Patient",
    phone: "01111111111",
    email: "patient@gmail.com",
  });

  // patient_info
  await pool.query(
    `INSERT INTO cardioai.patient_info
    (patient_id, blood_type, chronic_diseases, allergies, previous_surgeries, additional_history, age, condition_text)
   VALUES(?,?,?,?,?,?,?,?)`,
    [
      fixedPatientId,
      "A+",
      "None",
      "None",
      "None",
      "No history",
      30,
      "Healthy",
    ]
  );

  // avatar
  await pool.query(
    `INSERT INTO cardioai.patient_files
    (patient_id, file_type, file_path)
   VALUES(?,?,?)`,
    [fixedPatientId, "avatar", getAvatarUrl("Test Patient")]
  );

  for (let i = 0; i < egyptianNames.length; i++) {
    const dob = faker.date.birthdate({ min: 18, max: 80, mode: "age" }).toISOString().split("T")[0];
    const phone = pick(phonePrefix) + rand(10000000, 99999999);
    const email = `${egyptianNamesEn[i]}@gmail.com`;
    const fullName = egyptianNames[i];

    const [r] = await pool.query(
      `INSERT INTO cardioai.patients
    (serial, full_name, national_id, date_of_birth, gender, phone, email, password_hash, agreed_terms)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        makeSerial("#PT", i + 1), fullName, `29${rand(10, 99)}${rand(10000000, 99999999)}`,
        dob, pick(["male", "female"]), phone, email,
        await faker.internet.password({ length: 12 }), true,
      ]
    );

    const pid = r.insertId;
    patientRecords.push({ id: pid, name: fullName, phone, email });

    await pool.query(
      `INSERT INTO cardioai.patient_info
    (patient_id, blood_type, chronic_diseases, allergies, previous_surgeries, additional_history, age, condition_text)
       VALUES(?,?,?,?,?,?,?,?)`,
      [
        pid, pick(bloodTypes), pick(["Diabetes", "Hypertension", "None", "Asthma", "Diabetes, Hypertension"]),
        pick(["Penicillin", "None", "Aspirin", "Dust"]), pick(["None", "Appendectomy", "Bypass Surgery"]),
        faker.lorem.sentence(), rand(18, 80), pick(heartConditions),
      ]
    );

    await pool.query(
      `INSERT INTO cardioai.patient_files
    (patient_id, file_type, file_path)
       VALUES(?,?,?)`,
      [pid, "avatar", getAvatarUrl(fullName)]
    );

    // Medications
    for (let m = 0; m < rand(2, 5); m++) {
      await pool.query(
        `INSERT INTO cardioai.medications
    (patient_id, medication_name, dosage, status, refill_due)
         VALUES(?,?,?,?,?)`,
        [pid, pick(medsList), pick(["10mg", "25mg", "50mg", "100mg"]), pick(["active", "active", "past"]), faker.date.soon({ days: 30 }).toISOString().split("T")[0]]
      );
    }

    // Medical Records (Lab)
    for (let lab = 0; lab < rand(1, 4); lab++) {
      const doc = pick(doctorRecords);
      await pool.query(
        `INSERT INTO cardioai.medical_records
    (patient_id, doctor_id, doctor_name, title, record_type, record_date, description)
         VALUES(?,?,?,?,?,?,?)`,
        [pid, doc.id, doc.name, pick(["ECG Report", "Echo Report", "Blood Test", "Chest X-Ray", "CBC", "AST/ALT", "Lipid Panel"]), pick(["lab", "radiology", "prescription"]), recent(90), faker.lorem.paragraph()]
      );
    }

    // Vital signs
    for (let v = 0; v < rand(2, 5); v++) {
      await pool.query(
        `INSERT INTO cardioai.vital_signs
    (patient_id, heart_rate, blood_pressure, spo2, body_temperature)
         VALUES(?,?,?,?,?)`,
        [pid, rand(55, 110), `${rand(100, 140)} / ${rand(60, 90)}`, rand(92, 100), parseFloat((rand(364, 380) / 10).toFixed(1))]
      );
    }
  }

  // ── Current Week Appointments (3-5 per day) ────────────────────
  console.log("\n📅 Inserting live current-week appointments...");
  const currentWeek = getCurrentWeekDates();

  for (const date of currentWeek) {
    const dailyCount = rand(3, 5);
    for (let a = 0; a < dailyCount; a++) {
      const p = pick(patientRecords);
      const d = pick(doctorRecords);
      const isPast = new Date(date) < new Date(new Date().toISOString().split("T")[0]);
      const status = isPast ? "completed" : pick(["scheduled", "scheduled", "scheduled", "cancelled", "completed"]);

      await pool.query(
        `INSERT INTO cardioai.appointments
    (patient_id, doctor_id, patient_name, phone, email, appointment_type, appointment_date,
      appointment_time, duration, duration_minutes, reason_for_visit, status,
      heart_rate, blood_pressure, spo2, body_temperature)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.id, d.id, p.name, p.phone, p.email, pick(apptTypes), date,
          pick(apptTimes), pick(["15 minutes", "30 minutes", "45 minutes", "60 minutes"]), pick([15, 30, 45, 60]), pick(heartConditions), status,
          rand(55, 110), `${rand(100, 140)} / ${rand(60, 90)}`, rand(92, 100), parseFloat((rand(364, 380) / 10).toFixed(1)),
        ]
      );
    }
  }

  // ── Seeding Notifications ─────────────────────────────────────
  console.log("\n🔔 Seeding notifications for test patient...");
  const notifications = [
    { title: "Appointment Reminder", message: "Your check-up with Dr. Ahmed Samir is scheduled for tomorrow at 10:00 AM.", is_read: 0 },
    { title: "Medication Alert", message: "Time to take your Aspirin (75mg).", is_read: 0 },
    { title: "Lab Results Ready", message: "Your recent blood test results are now available in your records.", is_read: 1 },
    { title: "AI Health Insight", message: "Your heart rate trend looks stable this week. Keep it up!", is_read: 0 }
  ];

  for (const n of notifications) {
    await pool.query(
      `INSERT INTO cardioai.notifications(patient_id, title, message, is_read) VALUES(?,?,?,?)`,
      [fixedPatientId, n.title, n.message, n.is_read]
    );
  }
  console.log("  ✅ Seeded 4 notifications for patient@gmail.com");

  console.log("✅ Seed completed successfully! Live system ready.");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});