import express from "express";
import {
  registerStep1,
  registerStep2,
  getPatient,
  getAllPatients,
  deletePatient,
  loginPatient,
  getPatientVitals,
  savePatientVitals,
  getPatientAppointments,
  getPatientRecords,
  updatePatient,
  updatePatientInfo,
  changePatientPassword,
  uploadPatientAvatar,
  deletePatientAvatar,
} from "../controllers/patientController.js";
import { patientUpload, patientAvatarUpload } from "../middleware/upload.js";
import { getPatientMedications }    from '../controllers/medicationController.js';
import { getPatientNotifications }  from '../controllers/notificationController.js';

const router = express.Router();

// ── Auth ──────────────────────────────────────────────────
router.post("/login",            loginPatient);

// ── Register ──────────────────────────────────────────────
router.post("/register",         registerStep1);
router.post("/register/info",    patientUpload.single("prescription_file"), registerStep2);

// ── CRUD ──────────────────────────────────────────────────
router.get("/",                  getAllPatients);
router.get("/:id",               getPatient);
router.put("/:id",               updatePatient);           
router.delete("/:id",            deletePatient);

// ── Patient sub-resources ─────────────────────────────────
router.get("/:id/vitals",        getPatientVitals);
router.post("/:id/vitals",       savePatientVitals);
router.get("/:id/appointments",  getPatientAppointments);
router.get("/:id/medications",   getPatientMedications);
router.get("/:id/records",       getPatientRecords);
router.put("/:id/info",          updatePatientInfo);       
router.put("/:id/password",      changePatientPassword);   
router.post("/:id/avatar",       patientAvatarUpload, uploadPatientAvatar);
router.delete("/:id/avatar",     deletePatientAvatar);
router.get('/:id/notifications',  getPatientNotifications);  
export default router;