import express from "express";
import {
  registerDoctor,
  loginDoctor,
  getAllDoctors,
  getDoctor,
  updateDoctor,
  changePassword,
  uploadAvatar,
  deleteDoctorAvatar,
  deleteDoctor,
  getDoctorAppointments,
} from "../controllers/doctorController.js";
import { doctorUpload, avatarUpload } from "../middleware/upload.js";

const router = express.Router();

// ── Auth ──────────────────────────────────────────────────
router.post("/login",              loginDoctor);

// ── Register ──────────────────────────────────────────────
router.post("/register",           doctorUpload, registerDoctor);

// ── CRUD ──────────────────────────────────────────────────
router.get("/",                    getAllDoctors);
router.get("/:id",                 getDoctor);
router.put("/:id",                 updateDoctor);
router.delete("/:id",              deleteDoctor);

// ── Doctor sub-resources ──────────────────────────────────
router.get("/:id/appointments",    getDoctorAppointments);
router.put("/:id/password",        changePassword);
router.post("/:id/avatar",         avatarUpload, uploadAvatar);
router.delete("/:id/avatar",       deleteDoctorAvatar);

export default router;


