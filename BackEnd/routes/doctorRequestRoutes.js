import express from "express";
import {
  getDoctorRequests,
  createDoctorRequest,
  updateDoctorRequest,
  deleteDoctorRequest,
} from "../controllers/doctorRequestController.js";

const router = express.Router();

router.get("/",          getDoctorRequests);    // GET    /api/doctor/requests
router.post("/",         createDoctorRequest);  // POST   /api/doctor/requests
router.patch("/:id",     updateDoctorRequest);  // PATCH  /api/doctor/requests/:id
router.delete("/:id",    deleteDoctorRequest);  // DELETE /api/doctor/requests/:id

export default router;