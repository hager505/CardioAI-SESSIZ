import express from "express";
import multer from "multer";
import {
  makePrediction,
  predictVitals,
  uploadAndPredict,
  translateResult,
} from "../controllers/predictController.js";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

// POST /api/predict          — ECG prediction (JSON: clinical_features + ecg_signal)
router.post("/", makePrediction);

// POST /api/predict/vitals   — Vitals prediction (JSON: 7 vital signs)
router.post("/vitals", predictVitals);

// POST /api/predict/upload   — CSV upload — auto-detects model type
router.post("/upload", upload.single("file"), uploadAndPredict);

// POST /api/predict/translate — Translate prediction result for ChatBot
router.post("/translate", translateResult);

export default router;
