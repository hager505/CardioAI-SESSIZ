// import fs from "fs";
// import * as dns from "dns";

// // ══════════════════════════════════════════════════════════════════════════════
// //  Model URL resolution (Docker hostname → localhost fallback)
// // ══════════════════════════════════════════════════════════════════════════════
// function resolveModelUrl(envKey, defaultDockerUrl, defaultLocalUrl) {
//   const envUrl = process.env[envKey];
//   if (envUrl) return envUrl;
//   // Check if we're inside Docker by trying to resolve 'model' hostname
//   let isDocker = false;
//   try {
//     dns.lookupSync('model');
//     isDocker = true;
//   } catch (e) {
//     console.log(`[CardioAI] Docker host 'model' not resolved, using localhost for API calls`);
//   }
//   return isDocker ? defaultDockerUrl : defaultLocalUrl;
// }

// const MODEL_URL        = resolveModelUrl('MODEL_URL',        'http://model:8000/predict',        'http://localhost:8000/predict');
// const MODEL_URL_VITALS = resolveModelUrl('MODEL_URL_VITALS', 'http://model:8000/predict-vitals', 'http://localhost:8000/predict-vitals');
// const MODEL_URL_UPLOAD = resolveModelUrl('MODEL_URL_UPLOAD', 'http://model:8000/upload-predict', 'http://localhost:8000/upload-predict');

// // ══════════════════════════════════════════════════════════════════════════════
// //  ChatBot Translation Logic (runs in Node — no Python needed)
// // ══════════════════════════════════════════════════════════════════════════════
// function translatePrediction(modelType, predictedClass, confidence) {
//   const confPct = (confidence * 100).toFixed(1);

//   if (modelType === "ecg") {
//     const classLabels = ["NORM", "MI", "STTC", "CD", "HYP"];
//     const msgs = {
//       0: { ar: "القلب سليم", en: "Heart is healthy", risk: "none", color: "#10b981",
//            rec_ar: "استمر في نمط حياتك الصحي", rec_en: "Continue your healthy lifestyle" },
//       1: { ar: "احتشاء عضلة القلب — خطر جلطة", en: "Myocardial Infarction risk", risk: "high", color: "#ef4444",
//            rec_ar: "استشارة طبيب القلب فوراً", rec_en: "Consult a cardiologist immediately" },
//       2: { ar: "تغيرات في الموجة ST/T", en: "ST/T wave changes", risk: "medium", color: "#f59e0b",
//            rec_ar: "يرجى مراجعة طبيب القلب خلال 48 ساعة", rec_en: "See a cardiologist within 48 hours" },
//       3: { ar: "اضطراب توصيل القلب", en: "Conduction disturbance", risk: "medium", color: "#f59e0b",
//            rec_ar: "عمل فحص شامل للقلب", rec_en: "Get a comprehensive cardiac exam" },
//       4: { ar: "تضخم في عضلة القلب", en: "Cardiac hypertrophy", risk: "high", color: "#ef4444",
//            rec_ar: "مراجعة طبيب القلب في أقرب وقت", rec_en: "See a cardiologist ASAP" },
//     };
//     const info = msgs[predictedClass] || msgs[0];
//     return {
//       label: classLabels[predictedClass] || "Unknown",
//       risk_level: info.risk, risk_color: info.color,
//       message_ar: `${info.ar} — نسبة الثقة: ${confPct}%`,
//       message_en: `${info.en} — Confidence: ${confPct}%`,
//       recommendation_ar: info.rec_ar, recommendation_en: info.rec_en,
//     };
//   }

//   // vitals
//   let info;
//   if (confidence >= 0.8) {
//     info = { label: "CRITICAL", risk: "critical", color: "#991b1b",
//       ar: `خطر شديد — نسبة الخطر: ${confPct}% — تدخل فوري`, en: `Critical — ${confPct}%`,
//       rec_ar: "اتصل بالطوارئ فوراً", rec_en: "Call emergency immediately" };
//   } else if (confidence >= 0.6) {
//     info = { label: "HIGH", risk: "high", color: "#ef4444",
//       ar: `خطر مرتفع — ${confPct}%`, en: `High risk — ${confPct}%`,
//       rec_ar: "استشارة طبيب القلب عاجلة", rec_en: "Urgent cardiologist consultation" };
//   } else if (confidence >= 0.4) {
//     info = { label: "MODERATE", risk: "medium", color: "#f59e0b",
//       ar: `خطر متوسط — ${confPct}%`, en: `Moderate risk — ${confPct}%`,
//       rec_ar: "مراجعة الطبيب خلال 48 ساعة", rec_en: "See a doctor within 48 hours" };
//   } else if (confidence >= 0.2) {
//     info = { label: "LOW", risk: "low", color: "#84cc16",
//       ar: `خطر منخفض — ${confPct}%`, en: `Low risk — ${confPct}%`,
//       rec_ar: "متابعة الضغط والسكر بانتظام", rec_en: "Monitor BP and sugar regularly" };
//   } else {
//     info = { label: "NORMAL", risk: "none", color: "#10b981",
//       ar: `المريض سليم — ${confPct}%`, en: `Patient healthy — ${confPct}%`,
//       rec_ar: "استمر في نمط حياتك الصحي", rec_en: "Continue healthy lifestyle" };
//   }
//   return {
//     label: info.label, risk_level: info.risk, risk_color: info.color,
//     message_ar: info.ar, message_en: info.en,
//     recommendation_ar: info.rec_ar, recommendation_en: info.rec_en,
//   };
// }

// // ══════════════════════════════════════════════════════════════════════════════
// //  1. ECG Prediction (JSON body — clinical + ecg)
// // ══════════════════════════════════════════════════════════════════════════════
// export async function makePrediction(req, res) {
//   try {
//     const {
//       clinical_features = [50.0, 1.0, 120.0, 200.0, 0.0, 1.0, 140.0],
//       ecg_signal = [Array.from({ length: 1000 }, () => Array(12).fill(Math.random() * 0.5))],
//     } = req.body;

//     console.log(`[CardioAI] Calling ECG Model at: ${MODEL_URL}`);

//     const response = await fetch(MODEL_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ clinical_features, ecg_signal }),
//     });

//     if (!response.ok) throw new Error(`Model API error: ${response.statusText}`);

//     const result = await response.json();

//     // Add translation if not already present
//     if (!result.message_ar) {
//       const translation = translatePrediction("ecg", result.predicted_class, result.confidence);
//       Object.assign(result, translation);
//     }

//     res.json(result);
//   } catch (error) {
//     console.error("AI Model Error:", error);
//     res.status(500).json({ error: "Failed to connect to the AI model. " + error.message });
//   }
// }

// // ══════════════════════════════════════════════════════════════════════════════
// //  2. Vitals Prediction (JSON body — 7 vitals)
// // ══════════════════════════════════════════════════════════════════════════════
// export async function predictVitals(req, res) {
//   try {
//     console.log(`[CardioAI] Calling Vitals Model at: ${MODEL_URL_VITALS}`);

//     const response = await fetch(MODEL_URL_VITALS, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(req.body),
//     });

//     if (!response.ok) {
//       const errText = await response.text();
//       // Forward validation errors (4xx) with original details for frontend to display
//       if (response.status >= 400 && response.status < 500) {
//         return res.status(response.status).json({
//           error: `Vitals Model error: ${response.status} - ${errText}`,
//           modelError: true,
//           details: errText,
//         });
//       }
//       throw new Error(`Vitals Model error: ${response.status} - ${errText}`);
//     }

//     const result = await response.json();

//     // Ensure translation is present for frontend
//     if (!result.message_ar) {
//       const cls = result.predicted_class ?? result.alert_flag ?? 0;
//       const conf = result.confidence ?? result.ensemble_probability ?? 0;
//       const translation = translatePrediction("vitals", cls, conf);
//       Object.assign(result, translation);
//     }

//     res.json(result);
//   } catch (error) {
//     console.error("Vitals Model Error:", error);
//     res.status(500).json({ error: "Failed to connect to the Vitals model. " + error.message });
//   }
// }

// // ══════════════════════════════════════════════════════════════════════════════
// //  3. Upload CSV — auto-detect model
// // ══════════════════════════════════════════════════════════════════════════════
// export async function uploadAndPredict(req, res) {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "No file uploaded" });
//     }

//     const filePath = req.file.path;

//     // Read file and create Blob for fetch FormData
//     const fileBlob = new Blob([fs.readFileSync(filePath)], { type: req.file.mimetype });
//     const formData = new FormData();
//     formData.append("file", fileBlob, req.file.originalname);

//     console.log(`[CardioAI] Sending CSV to Model at: ${MODEL_URL_UPLOAD}`);

//     const response = await fetch(MODEL_URL_UPLOAD, {
//       method: "POST",
//       body: formData,
//     });

//     // Cleanup temp file
//     try { fs.unlinkSync(filePath); } catch (e) {}

//     if (!response.ok) {
//       const errText = await response.text();
//       throw new Error(`Model API error: ${response.status} - ${errText}`);
//     }

//     const result = await response.json();

//     // Ensure translation is present
//     if (!result.message_ar) {
//       const modelType = result.model_used || "vitals";
//       const cls = result.predicted_class ?? result.alert_flag ?? 0;
//       const conf = result.confidence ?? result.ensemble_probability ?? 0;
//       const translation = translatePrediction(modelType, cls, conf);
//       Object.assign(result, translation);
//     }

//     res.json(result);
//   } catch (error) {
//     console.error("AI Model Upload Error:", error);
//     res.status(500).json({ error: "Failed to process file with AI model. " + error.message });
//   }
// }

// // ══════════════════════════════════════════════════════════════════════════════
// //  4. Translate endpoint (for frontend ChatBot)
// // ══════════════════════════════════════════════════════════════════════════════
// export async function translateResult(req, res) {
//   try {
//     const { model_type, predicted_class, confidence } = req.body;
//     if (!model_type) {
//       return res.status(400).json({ error: "model_type is required (ecg or vitals)" });
//     }
//     const translation = translatePrediction(model_type, predicted_class ?? 0, confidence ?? 0);
//     res.json(translation);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// }

import fs from "fs";
import * as dns from "dns";

// ══════════════════════════════════════════════════════════════════════════════
//  Model URL resolution (Docker hostname → localhost fallback)
// ══════════════════════════════════════════════════════════════════════════════
function resolveModelUrl(envKey, defaultDockerUrl, defaultLocalUrl) {
  const envUrl = process.env[envKey];
  if (envUrl) return envUrl;
  // Check if we're inside Docker by trying to resolve 'model' hostname
  let isDocker = false;
  try {
    dns.lookupSync('model');
    isDocker = true;
  } catch (e) {
    console.log(`[CardioAI] Docker host 'model' not resolved, using localhost for API calls`);
  }
  return isDocker ? defaultDockerUrl : defaultLocalUrl;
}

const MODEL_URL        = resolveModelUrl('MODEL_URL',        'http://model:8000/predict',        'http://localhost:8000/predict');
const MODEL_URL_VITALS = resolveModelUrl('MODEL_URL_VITALS', 'http://model:8000/predict-vitals', 'http://localhost:8000/predict-vitals');
const MODEL_URL_UPLOAD = resolveModelUrl('MODEL_URL_UPLOAD', 'http://model:8000/upload-predict', 'http://localhost:8000/upload-predict');

// ══════════════════════════════════════════════════════════════════════════════
//  ChatBot Translation Logic (runs in Node — no Python needed)
// ══════════════════════════════════════════════════════════════════════════════
function translatePrediction(modelType, predictedClass, confidence) {
  const confPct = (confidence * 100).toFixed(1);

  if (modelType === "ecg") {
    const classLabels = ["NORM", "MI", "STTC", "CD", "HYP"];
    const msgs = {
      0: { ar: "القلب سليم", en: "Heart is healthy", risk: "none", color: "#10b981",
           rec_ar: "استمر في نمط حياتك الصحي", rec_en: "Continue your healthy lifestyle" },
      1: { ar: "احتشاء عضلة القلب — خطر جلطة", en: "Myocardial Infarction risk", risk: "high", color: "#ef4444",
           rec_ar: "استشارة طبيب القلب فوراً", rec_en: "Consult a cardiologist immediately" },
      2: { ar: "تغيرات في الموجة ST/T", en: "ST/T wave changes", risk: "medium", color: "#f59e0b",
           rec_ar: "يرجى مراجعة طبيب القلب خلال 48 ساعة", rec_en: "See a cardiologist within 48 hours" },
      3: { ar: "اضطراب توصيل القلب", en: "Conduction disturbance", risk: "medium", color: "#f59e0b",
           rec_ar: "عمل فحص شامل للقلب", rec_en: "Get a comprehensive cardiac exam" },
      4: { ar: "تضخم في عضلة القلب", en: "Cardiac hypertrophy", risk: "high", color: "#ef4444",
           rec_ar: "مراجعة طبيب القلب في أقرب وقت", rec_en: "See a cardiologist ASAP" },
    };
    const info = msgs[predictedClass] || msgs[0];
    return {
      label: classLabels[predictedClass] || "Unknown",
      risk_level: info.risk, risk_color: info.color,
      message_ar: `${info.ar} — نسبة الثقة: ${confPct}%`,
      message_en: `${info.en} — Confidence: ${confPct}%`,
      recommendation_ar: info.rec_ar, recommendation_en: info.rec_en,
    };
  }

  // vitals
  let info;
  if (confidence >= 0.8) {
    info = { label: "CRITICAL", risk: "critical", color: "#991b1b",
      ar: `خطر شديد — نسبة الخطر: ${confPct}% — تدخل فوري`, en: `Critical — ${confPct}%`,
      rec_ar: "اتصل بالطوارئ فوراً", rec_en: "Call emergency immediately" };
  } else if (confidence >= 0.6) {
    info = { label: "HIGH", risk: "high", color: "#ef4444",
      ar: `خطر مرتفع — ${confPct}%`, en: `High risk — ${confPct}%`,
      rec_ar: "استشارة طبيب القلب عاجلة", rec_en: "Urgent cardiologist consultation" };
  } else if (confidence >= 0.4) {
    info = { label: "MODERATE", risk: "medium", color: "#f59e0b",
      ar: `خطر متوسط — ${confPct}%`, en: `Moderate risk — ${confPct}%`,
      rec_ar: "مراجعة الطبيب خلال 48 ساعة", rec_en: "See a doctor within 48 hours" };
  } else if (confidence >= 0.2) {
    info = { label: "LOW", risk: "low", color: "#84cc16",
      ar: `خطر منخفض — ${confPct}%`, en: `Low risk — ${confPct}%`,
      rec_ar: "متابعة الضغط والسكر بانتظام", rec_en: "Monitor BP and sugar regularly" };
  } else {
    info = { label: "NORMAL", risk: "none", color: "#10b981",
      ar: `المريض سليم — ${confPct}%`, en: `Patient healthy — ${confPct}%`,
      rec_ar: "استمر في نمط حياتك الصحي", rec_en: "Continue healthy lifestyle" };
  }
  return {
    label: info.label, risk_level: info.risk, risk_color: info.color,
    message_ar: info.ar, message_en: info.en,
    recommendation_ar: info.rec_ar, recommendation_en: info.rec_en,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  1. ECG Prediction (JSON body — clinical + ecg)
// ══════════════════════════════════════════════════════════════════════════════
export async function makePrediction(req, res) {
  try {
    const {
      clinical_features = [50.0, 1.0, 120.0, 200.0, 0.0, 1.0, 140.0],
      ecg_signal = [Array.from({ length: 1000 }, () => Array(12).fill(Math.random() * 0.5))],
    } = req.body;

    console.log(`[CardioAI] Calling ECG Model at: ${MODEL_URL}`);

    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinical_features, ecg_signal }),
    });

    if (!response.ok) throw new Error(`Model API error: ${response.statusText}`);

    const result = await response.json();

    if (!result.message_ar) {
      const translation = translatePrediction("ecg", result.predicted_class, result.confidence);
      Object.assign(result, translation);
    }

    res.json(result);
  } catch (error) {
    console.error("AI Model Error:", error);
    res.status(500).json({ error: "Failed to connect to the AI model. " + error.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  2. Vitals Prediction (JSON body — 7 vitals)
// ══════════════════════════════════════════════════════════════════════════════
export async function predictVitals(req, res) {
  try {
    console.log(`[CardioAI] Calling Vitals Model at: ${MODEL_URL_VITALS}`);

    const response = await fetch(MODEL_URL_VITALS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status >= 400 && response.status < 500) {
        return res.status(response.status).json({
          error: `Vitals Model error: ${response.status} - ${errText}`,
          modelError: true,
          details: errText,
        });
      }
      throw new Error(`Vitals Model error: ${response.status} - ${errText}`);
    }

    const result = await response.json();

    if (!result.message_ar) {
      const cls = result.predicted_class ?? result.alert_flag ?? 0;
      const conf = result.confidence ?? result.ensemble_probability ?? 0;
      const translation = translatePrediction("vitals", cls, conf);
      Object.assign(result, translation);
    }

    res.json(result);
  } catch (error) {
    console.error("Vitals Model Error:", error);
    res.status(500).json({ error: "Failed to connect to the Vitals model. " + error.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  3. Upload CSV — auto-detect model
// ══════════════════════════════════════════════════════════════════════════════
export async function uploadAndPredict(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    // Read CSV and inject missing columns with default value 0
    let csvContent = fs.readFileSync(filePath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const missingCols = ['infarction_stadium1', 'infarction_stadium2', 'pacemaker'];
    const colsToAdd = missingCols.filter(col => !headers.includes(col));

    if (colsToAdd.length > 0) {
      console.log(`[CardioAI] Adding missing columns: ${colsToAdd.join(', ')}`);
      lines[0] = lines[0].trim() + ',' + colsToAdd.join(',');
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) lines[i] = lines[i].trim() + ',0'.repeat(colsToAdd.length);
      }
      csvContent = lines.join('\n');
    }

    const fileBlob = new Blob([csvContent], { type: 'text/csv' });
    const formData = new FormData();
    formData.append("file", fileBlob, req.file.originalname);

    console.log(`[CardioAI] Sending CSV to Model at: ${MODEL_URL_UPLOAD}`);

    const response = await fetch(MODEL_URL_UPLOAD, {
      method: "POST",
      body: formData,
    });

    // Cleanup temp file
    try { fs.unlinkSync(filePath); } catch (e) {}

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Model API error: ${response.status} - ${errText}`);
    }

    const result = await response.json();

    if (!result.message_ar) {
      const modelType = result.model_used || "vitals";
      const cls = result.predicted_class ?? result.alert_flag ?? 0;
      const conf = result.confidence ?? result.ensemble_probability ?? 0;
      const translation = translatePrediction(modelType, cls, conf);
      Object.assign(result, translation);
    }

    res.json(result);
  } catch (error) {
    console.error("AI Model Upload Error:", error);
    res.status(500).json({ error: "Failed to process file with AI model. " + error.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  4. Translate endpoint (for frontend ChatBot)
// ══════════════════════════════════════════════════════════════════════════════
export async function translateResult(req, res) {
  try {
    const { model_type, predicted_class, confidence } = req.body;
    if (!model_type) {
      return res.status(400).json({ error: "model_type is required (ecg or vitals)" });
    }
    const translation = translatePrediction(model_type, predicted_class ?? 0, confidence ?? 0);
    res.json(translation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}