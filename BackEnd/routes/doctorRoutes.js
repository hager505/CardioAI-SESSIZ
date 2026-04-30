import express from "express";
import {
  registerDoctor,
  loginDoctor,
  getAllDoctors,
  getDoctor,
  deleteDoctor,
  getDoctorAppointments,
} from "../controllers/doctorController.js";
import { doctorUpload } from "../middleware/upload.js";

const router = express.Router();

// ── Auth ──────────────────────────────────────────────────
router.post("/login",              loginDoctor);

// ── Register ──────────────────────────────────────────────
router.post("/register",           doctorUpload, registerDoctor);

// ── CRUD ──────────────────────────────────────────────────
router.get("/",                    getAllDoctors);
router.get("/:id",                 getDoctor);
router.delete("/:id",              deleteDoctor);

// ── Doctor sub-resources ──────────────────────────────────
router.get("/:id/appointments",    getDoctorAppointments);

export default router;


