import express from "express";
import {
  getClinicalNotes,
  createClinicalNote,
  updateClinicalNote,
  deleteClinicalNote,
} from "../controllers/clinicalNotesController.js";

const router = express.Router();

router.get("/",       getClinicalNotes);     // GET    /api/clinical-notes?patient_id=5
router.post("/",      createClinicalNote);   // POST   /api/clinical-notes
router.patch("/:id",  updateClinicalNote);   // PATCH  /api/clinical-notes/:id
router.delete("/:id", deleteClinicalNote);   // DELETE /api/clinical-notes/:id

export default router;
