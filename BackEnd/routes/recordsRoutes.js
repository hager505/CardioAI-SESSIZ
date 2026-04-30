import express from "express";
import { createRecord, deleteRecord } from "../controllers/recordsController.js";
import { recordUpload } from "../middleware/upload.js";

const router = express.Router();

// ── Records ───────────────────────────────────────────────
router.post("/",     recordUpload.single("report_file"), createRecord);
router.delete("/:id",                                    deleteRecord);

export default router;