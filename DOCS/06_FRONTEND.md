# Frontend Documentation

## Overview

The frontend is a static HTML/CSS/JS application served by Nginx. No build step needed.

---

## Pages

### Landing Page
- **URL:** http://localhost/
- **File:** `FrontEnd/index.html`
- **Purpose:** Welcome page with navigation to patient/doctor portals

### Authentication

| Page | URL | File |
|------|-----|------|
| Patient Register | /auth/patient/RegisterPatient.html | `FrontEnd/auth/patient/RegisterPatient.html` |
| Patient Login | /auth/patient/LoginPatient.html | `FrontEnd/auth/patient/LoginPatient.html` |
| Doctor Register | /auth/doctor/RegisterDoctor.html | `FrontEnd/auth/doctor/RegisterDoctor.html` |
| Doctor Login | /auth/doctor/LoginDoctor.html | `FrontEnd/auth/doctor/LoginDoctor.html` |

### Patient Portal

| Page | URL | Purpose |
|------|-----|---------|
| Profile | /patient/profile/profile.html | View/edit profile, AI analysis results |
| Dashboard | /patient/dashboard/ | Overview of health data |

### Doctor Portal

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | /doctor/dashboard/dashboard.html | Patient list, appointments, AI diagnosis |

### ChatBot

| Page | URL | Purpose |
|------|-----|---------|
| Chat | /chatbot/chat.html | AI-powered health assistant |

---

## Frontend → Backend Communication

All API calls go to the Backend at port 5000:

```javascript
// Example: Patient Login
const response = await fetch("http://localhost:5000/api/patients/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
});
```

```javascript
// Example: Upload CSV for AI analysis
const formData = new FormData();
formData.append("file", csvFile);

const response = await fetch("http://localhost:5000/api/predict/upload", {
    method: "POST",
    body: formData
});

const result = await response.json();
// result.message_ar = "القلب سليم — نسبة الثقة: 92%"
// result.risk_color = "#10b981"
```

---

## AI Features in Frontend

### Doctor Dashboard — CSV Upload
- Doctor clicks "Upload CSV" button
- Selects a CSV file with vital signs
- System auto-detects CSV type (vitals or clinical)
- Shows risk level with color-coded bar
- Displays recommendations in Arabic and English

### Patient Profile — Analysis Results
- Shows AI analysis results with visual risk bar
- Color-coded: green (safe) → yellow → red (danger)
- Bilingual messages (Arabic + English)

### ChatBot — AI Commands
- Patient can type "حلل بياناتي" (analyze my data) or upload CSV
- Bot sends data to AI model
- Returns formatted analysis with recommendations

---

## Folder Structure

```
FrontEnd/
├── index.html                    ← Landing page
├── auth/
│   ├── patient/
│   │   ├── RegisterPatient.html
│   │   ├── RegisterPatient.css
│   │   ├── RegisterPatient.js
│   │   ├── LoginPatient.html
│   │   ├── LoginPatient.css
│   │   └── LoginPatient.js
│   └── doctor/
│       ├── RegisterDoctor.html
│       ├── RegisterDoctor.css
│       ├── RegisterDoctor.js
│       ├── LoginDoctor.html
│       ├── LoginDoctor.css
│       └── LoginDoctor.js
├── patient/
│   ├── profile/
│   │   ├── profile.html
│   │   ├── profile.css
│   │   └── script.js            ← AI results display
│   └── dashboard/
├── doctor/
│   └── dashboard/
│       ├── dashboard.html
│       ├── dashboard.css
│       └── script.js             ← CSV upload + AI diagnosis
├── chatbot/
│   ├── chat.html
│   ├── chat.css
│   └── chat.js                   ← AI chatbot logic
├── images/                       ← Image assets
├── scripts/                      ← Shared JavaScript
└── style/                        ← Shared CSS
```
