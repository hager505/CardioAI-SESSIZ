import express from "express";
import { chatGeneral } from "../controllers/chatController.js";

const router = express.Router();

// ── Chat endpoints ────────────────────────────────────────────────────────────
router.post("/general", chatGeneral);

export default router;
