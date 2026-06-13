import bcrypt from "bcrypt";
import db from "./config/db.js";

async function restoreDoctor() {
  try {
    const password_hash = await bcrypt.hash("doctor", 10);
    
    // Check if exists
    const [existing] = await db.query("SELECT * FROM doctors WHERE email = 'doctor@gmail.com'");
    if (existing.length > 0) {
      console.log("Doctor already exists!");
      process.exit(0);
    }
    
    const [result] = await db.query(
      `INSERT INTO doctors (serial, full_name, email, phone, password_hash, gender, age, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
      ["DR202605260001", "Test Doctor", "doctor@gmail.com", "01000000000", password_hash, "male", 40, "doctor"]
    );
    
    const doctorId = result.insertId;
    
    await db.query(
      `INSERT INTO doctor_details (doctor_id, medical_id, hospital_affiliation, university, medical_degree)
       VALUES (?, ?, ?, ?, ?)`,
      [doctorId, "MED-RESTORE-1", "CardioAI Hospital", "Cardio Univ", "MD Cardiology"]
    );
    
    console.log("Successfully restored doctor@gmail.com with password 'doctor'");
    process.exit(0);
  } catch (error) {
    console.error("Error restoring doctor:", error);
    process.exit(1);
  }
}

restoreDoctor();
