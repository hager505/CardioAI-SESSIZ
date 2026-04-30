// routes/appointmentRoutes.js
import express from "express";
import {
  createAppointment,
  getAllAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointment,
} from "../controllers/appointmentController.js";
 
const router = express.Router();
 
router.post("/",     createAppointment);    // POST   /api/appointments
router.get("/",      getAllAppointments);   // GET    /api/appointments[?doctor_id=&patient_id=&date=&status=]
router.get("/:id",   getAppointment);      // GET    /api/appointments/:id
router.patch("/:id", updateAppointment);   // PATCH  /api/appointments/:id
router.delete("/:id",deleteAppointment);   // DELETE /api/appointments/:id
 
export default router;
