# API Documentation

## Overview

CardioAI has **2 API servers**:

| Server | Technology | Port | Purpose |
|--------|-----------|------|---------|
| **Backend API** | Node.js + Express | 5000 | User auth, DB, file uploads, proxy to AI |
| **Model API** | Python + FastAPI | 8000 | AI predictions (ECG + Vitals) |

The Frontend talks to the **Backend only**. The Backend forwards AI requests to the Model API internally.

```
Frontend  →  Backend (:5000)  →  Model API (:8000)
                ↕
            MySQL (:3306)
```

---

## Model API (FastAPI — Port 8000)

### Base URL: `http://localhost:8000`

---

### GET /
Health message.
```json
Response: { "message": "CardioAI Unified Prediction API — Models: ECG + Vitals" }
```

---

### GET /health
Check if models are loaded.
```json
Response: { "status": "healthy", "models": ["ecg_model02", "vitals_rf", "vitals_dl"] }
```

---

### POST /predict
ECG prediction from JSON.

**Request Body:**
```json
{
  "clinical_features": [55.0, 1.0, 175.0, 80.0, 0.0, 1.0, 0.0],
  "ecg_signal": [[[0.1, 0.2, ...12 values], ...1000 rows]]
}
```

**Response:**
```json
{
  "model_used": "ecg",
  "predicted_class": 0,
  "confidence": 0.92,
  "probabilities": [0.92, 0.03, 0.02, 0.02, 0.01],
  "label": "NORM",
  "risk_level": "none",
  "risk_color": "#10b981",
  "message_ar": "القلب سليم — لا توجد مشاكل — نسبة الثقة: 92.0%",
  "message_en": "Heart is healthy — No issues detected — Confidence: 92.0%",
  "recommendation_ar": "استمر في نمط حياتك الصحي",
  "recommendation_en": "Continue your healthy lifestyle"
}
```

---

### POST /predict-vitals
Vitals prediction from JSON.

**Request Body:**
```json
{
  "blood_pressure_systolic": 145,
  "blood_pressure_diastolic": 95,
  "heart_rate": 88,
  "temperature": 37.1,
  "respiratory_rate": 18,
  "oxygen_saturation": 96,
  "bmi": 27.5
}
```

**Response:**
```json
{
  "model_used": "vitals",
  "alert_flag": 0,
  "confidence": 0.35,
  "rf_probability": 0.32,
  "dl_probability": 0.38,
  "ensemble_probability": 0.35,
  "label": "LOW",
  "risk_level": "low",
  "risk_color": "#84cc16",
  "message_ar": "خطر منخفض — نسبة الخطر: 35.0%",
  "message_en": "Low risk — 35.0%",
  "recommendation_ar": "متابعة الضغط والسكر بانتظام",
  "recommendation_en": "Monitor blood pressure and sugar regularly"
}
```

---

### POST /upload-predict
Upload CSV file — auto-detects model type.

**Request:** `multipart/form-data` with field `file` (CSV)

**Response:** Same format as `/predict` or `/predict-vitals` depending on detected CSV type, with additional field:
```json
{ "input_type": "csv_upload", ... }
```

---

### POST /translate
Translate a prediction result (used by ChatBot).

**Request Body:**
```json
{
  "model_type": "ecg",
  "predicted_class": 1,
  "confidence": 0.87
}
```

**Response:**
```json
{
  "label": "MI",
  "risk_level": "high",
  "risk_color": "#ef4444",
  "message_ar": "احتشاء عضلة القلب — خطر جلطة — نسبة الثقة: 87.0%",
  "message_en": "Myocardial Infarction — Heart attack risk — Confidence: 87.0%",
  "recommendation_ar": "استشارة طبيب القلب فوراً",
  "recommendation_en": "Consult a cardiologist immediately"
}
```

---

## Backend API (Express — Port 5000)

### Base URL: `http://localhost:5000/api`

### Authentication & Users

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/patients/register` | POST | Register new patient |
| `/api/patients/login` | POST | Patient login |
| `/api/patients/:id` | GET | Get patient profile |
| `/api/patients/:id` | PUT | Update patient profile |
| `/api/doctors/register` | POST | Register new doctor |
| `/api/doctors/login` | POST | Doctor login |
| `/api/doctors/:id` | GET | Get doctor profile |

### Medical Records

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/records/:patientId` | GET | Get patient's medical records |
| `/api/records` | POST | Add new medical record |
| `/api/medications/:patientId` | GET | Get patient medications |
| `/api/medications` | POST | Add medication |

### Appointments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/appointments` | POST | Create appointment |
| `/api/appointments/patient/:id` | GET | Get patient appointments |
| `/api/appointments/doctor/:id` | GET | Get doctor appointments |

### AI Predictions (Proxy to Model API)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/predict` | POST | ECG prediction (proxies to Model :8000/predict) |
| `/api/predict/vitals` | POST | Vitals prediction (proxies to Model :8000/predict-vitals) |
| `/api/predict/upload` | POST | CSV upload (proxies to Model :8000/upload-predict) |
| `/api/predict/translate` | POST | Translate result (runs in Node.js locally) |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications/:patientId` | GET | Get notifications |

### Doctor Requests

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/doctor/requests` | POST | Create doctor request |
| `/api/doctor/requests/doctor/:id` | GET | Get doctor's requests |

---

## Environment Variables

### Backend (cardio_backend)
```
DB_HOST=db                                    # MySQL container name
DB_USER=root
DB_PASSWORD=root
DB_NAME=cardioai
DB_PORT=3306
MODEL_URL=http://model:8000/predict           # ECG prediction
MODEL_URL_VITALS=http://model:8000/predict-vitals  # Vitals prediction
MODEL_URL_UPLOAD=http://model:8000/upload-predict  # CSV upload
```

### Database (cardio_db)
```
MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=cardioai
```
