# CardioAI — Project Overview

## What is CardioAI?

CardioAI is a full-stack medical web application for cardiac health monitoring and AI-powered diagnosis. It connects patients with doctors and uses machine learning models to analyze heart-related data.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (Browser)                         │
│                      http://localhost                           │
└──────────────┬─────────────────────────────────┬───────────────┘
               │                                 │
               ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────────────┐
│    Frontend (Nginx)  │          │    Backend (Node.js)         │
│    Port: 80          │  ────►   │    Port: 5000                │
│                      │  API     │                              │
│  - Landing Page      │  Calls   │  - Express.js REST API       │
│  - Patient Portal    │          │  - MySQL Database            │
│  - Doctor Dashboard  │          │  - Authentication            │
│  - ChatBot           │          │  - File Upload (Multer)      │
└──────────────────────┘          └──────────────┬───────────────┘
                                                 │
                                                 │ HTTP (internal)
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │    AI Model (FastAPI/Python) │
                                  │    Port: 8000                │
                                  │                              │
                                  │  - ECG Model (ONNX)          │
                                  │  - Vitals Model (sklearn)    │
                                  │  - CSV Auto-detection        │
                                  │  - Arabic/English results    │
                                  └──────────────────────────────┘
                                                 
┌──────────────────────────────────────────────────────────────────┐
│                    MySQL Database (Port 3306)                    │
│  patients, doctors, appointments, vitals, medications, records  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Docker Services

All 4 services run together with one command: `docker-compose up --build`

| Service | Container | Port | Technology | Purpose |
|---------|-----------|------|------------|---------|
| `frontend` | cardio_frontend | 80 | Nginx + HTML/CSS/JS | User interface |
| `backend` | cardio_backend | 5000 | Node.js + Express | REST API + Business logic |
| `model` | cardio_model | 8000 | Python + FastAPI | AI predictions |
| `db` | cardio_db | 3306 | MySQL 8 | Data storage |

---

## Folder Structure

```
New folder/
│
├── docker-compose.yml              ← Orchestrates all 4 services
│
├── CardioAI/
│   ├── BackEnd/                    ← Node.js API server
│   │   ├── Dockerfile
│   │   ├── app.js                  ← Entry point
│   │   ├── package.json
│   │   ├── config/
│   │   │   └── db.js               ← Database connection + table creation
│   │   ├── controllers/            ← Business logic
│   │   │   ├── patientController.js
│   │   │   ├── doctorController.js
│   │   │   ├── predictController.js ← AI model communication
│   │   │   ├── appointmentController.js
│   │   │   ├── medicationController.js
│   │   │   ├── recordsController.js
│   │   │   ├── notificationController.js
│   │   │   ├── vitalController.js
│   │   │   └── doctorRequestController.js
│   │   ├── routes/                 ← API endpoint definitions
│   │   │   ├── patientRoutes.js
│   │   │   ├── doctorRoutes.js
│   │   │   ├── predictRoutes.js     ← AI prediction routes
│   │   │   ├── appointmentRoutes.js
│   │   │   ├── medicationRoutes.js
│   │   │   ├── recordsRoutes.js
│   │   │   ├── notificationRoutes.js
│   │   │   ├── vitalRoutes.js
│   │   │   └── doctorRequestRoutes.js
│   │   ├── models/                 ← Database model definitions
│   │   ├── middleware/             ← Auth, validation
│   │   ├── uploads/                ← File storage
│   │   └── utils/                  ← Helper functions
│   │
│   └── FrontEnd/                   ← HTML/CSS/JS UI
│       ├── index.html              ← Landing page
│       ├── auth/                   ← Login/Register pages
│       ├── patient/                ← Patient portal
│       ├── doctor/                 ← Doctor dashboard
│       ├── chatbot/                ← AI ChatBot
│       ├── images/                 ← Image assets
│       ├── scripts/                ← Shared JS
│       └── style/                  ← Shared CSS
│
├── final_model/                    ← AI Model service
│   ├── Dockerfile
│   ├── api.py                      ← FastAPI server (main file)
│   ├── model02.onnx                ← ECG model (0.6 MB)
│   ├── retrain_vitals.py           ← Re-trains vitals during build
│   ├── vitals_model/
│   │   ├── cardiac_rf_model.pkl    ← Random Forest model
│   │   ├── cardiac_scaler.pkl      ← Feature scaler
│   │   └── cardiac_dl_model.keras  ← Original DL model (re-saved during build)
│   └── .dockerignore
│
└── docs/                           ← This documentation
```

---

## How to Run

### Prerequisites
- Docker Desktop installed and running

### Steps
```bash
# 1. Open terminal in the project folder
cd "New folder"

# 2. Build and run everything
docker-compose up --build

# 3. Open in browser
# Frontend:  http://localhost
# Backend:   http://localhost:5000
# AI Model:  http://localhost:8000
```

### To stop
```bash
docker-compose down
```

---

## Communication Flow

```
User clicks "Diagnose" → Frontend JS sends POST to Backend (:5000)
     → Backend forwards request to AI Model (:8000)
          → AI Model runs prediction
          → Returns result + Arabic/English translation
     → Backend sends result back to Frontend
→ Frontend displays results with risk colors and recommendations
```

---

## Key URLs

| What | URL | Method |
|------|-----|--------|
| Landing Page | http://localhost | GET |
| Patient Register | http://localhost/auth/patient/RegisterPatient.html | GET |
| Doctor Dashboard | http://localhost/doctor/dashboard/dashboard.html | GET |
| Backend Health | http://localhost:5000/api/patients | GET |
| AI Model Health | http://localhost:8000/health | GET |
| ECG Prediction | http://localhost:5000/api/predict | POST |
| Vitals Prediction | http://localhost:5000/api/predict/vitals | POST |
| CSV Upload | http://localhost:5000/api/predict/upload | POST |
