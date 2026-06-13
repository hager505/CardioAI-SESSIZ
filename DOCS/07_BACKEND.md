# Backend Documentation

## Overview

The backend is a **Node.js + Express 5** REST API that handles:
- User authentication (patients + doctors)
- Database operations (MySQL)
- File uploads (Multer)
- Proxy requests to AI Model service
- Translation of AI results

---

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18 | Runtime |
| Express | 5.2.1 | Web framework |
| MySQL2 | 3.19.1 | Database driver |
| Bcrypt | 6.0.0 | Password hashing |
| Multer | 2.1.1 | File upload handling |
| CORS | 2.8.6 | Cross-origin requests |
| Faker | 10.3.0 | Test data generation |

---

## Entry Point: app.js

```javascript
// Registers all route modules
app.use("/api/patients",        patientsRouter);
app.use("/api/doctors",         doctorsRouter);
app.use("/api/records",         recordsRoutes);
app.use("/api/medications",     medicationRoutes);
app.use("/api/notifications",   notificationRoutes);
app.use("/api/appointments",    appointmentRoutes);
app.use("/api/doctor/requests", doctorRequestRoutes);
app.use("/api/predict",         predictRoutes);

// Starts on port 5000 after DB initialization
initDB().then(() => app.listen(5000));
```

---

## Controllers (Business Logic)

### predictController.js — AI Integration
The most important controller. It:

1. **Receives** prediction requests from the frontend
2. **Forwards** them to the Python AI model (FastAPI at port 8000)
3. **Translates** results to Arabic/English
4. **Returns** formatted results to the frontend

```
Frontend → predictController → AI Model (Python) → predictController → Frontend
```

**Functions:**
| Function | Route | What it does |
|----------|-------|-------------|
| `makePrediction()` | POST /api/predict | Send clinical + ECG data to AI model |
| `predictVitals()` | POST /api/predict/vitals | Send 7 vital signs to AI model |
| `uploadAndPredict()` | POST /api/predict/upload | Upload CSV, forward to AI model |
| `translateResult()` | POST /api/predict/translate | Translate prediction (runs locally) |

**Key:** The `translatePrediction()` function also runs **locally in Node.js** — it doesn't need the Python server. This is used by the ChatBot for instant translations.

### patientController.js
Handles patient registration, login, profile CRUD.

### doctorController.js
Handles doctor registration (with approval flow), login, profile CRUD.

### appointmentController.js
Create, read, update appointments. Links patients to doctors.

### medicationController.js
CRUD for patient medications (name, dosage, status, refill dates).

### recordsController.js
Medical records management (lab results, radiology, prescriptions).

### notificationController.js
Patient notification system (create + read + mark as read).

### doctorRequestController.js
Doctor-to-patient request system with priority levels.

### vitalController.js
Vital signs recording and history.

---

## Routes

Each route file maps HTTP endpoints to controller functions:

```javascript
// predictRoutes.js
router.post("/",        makePrediction);      // POST /api/predict
router.post("/vitals",  predictVitals);       // POST /api/predict/vitals
router.post("/upload",  upload.single("file"), uploadAndPredict);  // POST /api/predict/upload
router.post("/translate", translateResult);    // POST /api/predict/translate
```

---

## Database Connection (config/db.js)

- Uses **connection pool** (max 10 connections)
- Auto-creates all 12 tables on startup
- Supports Arabic text (utf8mb4 charset)
- Environment variables for configuration:

```javascript
const db = createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    port: process.env.DB_PORT || 3306,
    database: "cardioai",
    connectionLimit: 10
}).promise();
```

---

## AI Model Communication

The backend communicates with the Python AI service using **HTTP fetch**:

```javascript
// Environment variables (set in docker-compose.yml)
const modelUrl = process.env.MODEL_URL;              // http://model:8000/predict
const modelUrlVitals = process.env.MODEL_URL_VITALS;  // http://model:8000/predict-vitals
const modelUrlUpload = process.env.MODEL_URL_UPLOAD;  // http://model:8000/upload-predict

// Example: ECG prediction
const response = await fetch(modelUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clinical_features, ecg_signal })
});
const result = await response.json();
```

**Important:** Inside Docker, use container names (`model`, `db`) not `localhost`.

---

## File Uploads

Uses **Multer** middleware for handling file uploads:

```javascript
import multer from "multer";
const upload = multer({ dest: "uploads/" });

// CSV upload for AI prediction
router.post("/upload", upload.single("file"), uploadAndPredict);
```

Uploaded files are stored in `/app/uploads/` inside the container.

---

## Error Handling

All controllers use try/catch with meaningful error messages:

```javascript
try {
    // ... business logic
} catch (error) {
    console.error("AI Model Error:", error);
    res.status(500).json({ 
        error: "Failed to connect to the AI model. " + error.message 
    });
}
```
