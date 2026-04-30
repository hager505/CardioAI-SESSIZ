import express from 'express';
import { createMedication, updateMedication, deleteMedication } from '../controllers/medicationController.js';

const router = express.Router();

router.post('/',     createMedication);    // POST   /api/medications
router.put('/:id',   updateMedication);    // PUT    /api/medications/:id
router.delete('/:id', deleteMedication);   // DELETE /api/medications/:id

export default router;