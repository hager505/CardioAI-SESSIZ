# Database Documentation

## Overview

CardioAI uses **MySQL 8** with 12 tables. The database is auto-created when the backend starts — no manual setup needed.

**Connection Info:**
```
Host: localhost (or "db" inside Docker)
Port: 3306
User: root
Password: root
Database: cardioai
Character Set: utf8mb4 (supports Arabic)
```

---

## Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  patients   │────►│  patient_info    │     │   doctors       │
│             │     │  (1:1)           │     │                 │
│  id (PK)    │     │  blood_type      │     │  id (PK)        │
│  serial     │     │  chronic_diseases│     │  serial         │
│  full_name  │     │  allergies       │     │  full_name      │
│  national_id│     │  surgeries       │     │  email          │
│  email      │     │  age             │     │  role           │
│  password   │     │  condition_text  │     │  status         │
│  gender     │     └──────────────────┘     │  (pending/      │
│  phone      │                              │   approved)     │
└──────┬──────┘                              └────────┬────────┘
       │                                              │
       │         ┌───────────────────┐                │
       ├────────►│  appointments     │◄───────────────┤
       │         │  date, time       │                │
       │         │  type, status     │                │
       │         │  vitals at visit  │                │
       │         └───────────────────┘                │
       │                                              │
       │         ┌───────────────────┐                │
       ├────────►│  vital_signs      │                │
       │         │  heart_rate       │                │
       │         │  blood_pressure   │                │
       │         │  spo2, temp       │                │
       │         └───────────────────┘                │
       │                                              │
       │         ┌───────────────────┐                │
       ├────────►│  medications      │                │
       │         │  name, dosage     │                │
       │         │  status, refill   │                │
       │         └───────────────────┘                │
       │                                              │
       │         ┌───────────────────┐                │
       ├────────►│  medical_records  │◄───────────────┤
       │         │  type (lab/radio) │                │
       │         │  report_file      │                │
       │         └───────────────────┘                │
       │                                              │
       │         ┌───────────────────┐                │
       ├────────►│  patient_files    │                │
       │         │  file_type        │                │
       │         │  file_path        │                │
       │         └───────────────────┘                │
       │                                              │
       │         ┌───────────────────┐                │
       ├────────►│  notifications    │                │
       │         │  title, message   │                │
       │         │  is_read          │                │
       │         └───────────────────┘                │
       │                                              │
       │         ┌───────────────────┐     ┌──────────┴───────┐
       └────────►│  doctor_requests  │◄────│  doctor_details  │
                 │  message          │     │  specialty       │
                 │  priority         │     │  medical_id      │
                 │  status           │     │  hospital        │
                 └───────────────────┘     │  experience      │
                                           │  university      │
                                           └──────────────────┘
                                           ┌──────────────────┐
                                           │  doctor_files    │
                                           │  license         │
                                           │  documents       │
                                           └──────────────────┘
```

---

## Tables Detail

### 1. patients
Main patient registration table.
```sql
id            INT AUTO_INCREMENT PRIMARY KEY
serial        VARCHAR(20) UNIQUE          -- e.g. "PAT-00001"
full_name     VARCHAR(150) NOT NULL
national_id   VARCHAR(20) UNIQUE
date_of_birth DATE
gender        ENUM('male','female')
phone         VARCHAR(20)
email         VARCHAR(120) UNIQUE
password_hash VARCHAR(255) NOT NULL       -- bcrypt hashed
agreed_terms  BOOLEAN DEFAULT FALSE
created_at    TIMESTAMP
```

### 2. patient_info
Extended medical info (1:1 with patients).
```sql
patient_id         INT UNIQUE → patients(id)
blood_type         VARCHAR(5)            -- A+, B-, O+, etc.
chronic_diseases   TEXT                  -- comma separated
allergies          TEXT
previous_surgeries TEXT
prescription_file  VARCHAR(255)          -- uploaded file path
additional_history TEXT
age                INT
condition_text     TEXT                  -- current condition
```

### 3. doctors
Doctor registration with approval system.
```sql
id            INT AUTO_INCREMENT PRIMARY KEY
serial        VARCHAR(20) UNIQUE
full_name     VARCHAR(150)
email         VARCHAR(120) UNIQUE
phone         VARCHAR(20)
password_hash VARCHAR(255)
gender        ENUM('male','female')
age           INT
address       TEXT
role          ENUM('doctor','specialist','surgeon','consultant')
status        ENUM('pending','approved','rejected')  -- admin approval
```

### 4. doctor_details
Professional details (1:1 with doctors).
```sql
doctor_id            INT UNIQUE → doctors(id)
specialty            VARCHAR(100)         -- e.g. "Cardiology"
medical_id           VARCHAR(50) UNIQUE   -- license number
hospital_affiliation VARCHAR(200)
has_private_clinic   BOOLEAN
years_experience     INT
patients_per_week    INT
university           VARCHAR(200)
medical_degree       VARCHAR(200)
has_masters_phd      BOOLEAN
```

### 5. doctor_files
Uploaded doctor documents.
```sql
doctor_id   INT → doctors(id)
file_type   ENUM('license','document','avatar')
file_name   VARCHAR(255)
file_path   VARCHAR(500)
file_size   INT
mime_type   VARCHAR(100)
```

### 6. appointments
Patient-doctor appointments with vitals.
```sql
patient_id       INT → patients(id)
doctor_id        INT → doctors(id)
patient_name     VARCHAR(150)
phone            VARCHAR(20)
appointment_type ENUM('Check-up','Follow-up','Emergency','Consultation','New Patient')
appointment_date DATE
appointment_time TIME
duration_minutes INT
reason_for_visit TEXT
notes            TEXT
status           VARCHAR(50) DEFAULT 'scheduled'
heart_rate       INT                    -- vitals taken at visit
blood_pressure   VARCHAR(20)            -- e.g. "120/80"
spo2             INT
body_temperature DECIMAL(4,1)
```

### 7. vital_signs
Historical vital sign records.
```sql
patient_id       INT → patients(id)
heart_rate       INT
blood_pressure   VARCHAR(20)
spo2             INT
body_temperature DECIMAL(4,1)
recorded_at      TIMESTAMP
```

### 8. medications
Patient medication tracking.
```sql
patient_id      INT → patients(id)
medication_name VARCHAR(200)
dosage          VARCHAR(100)
status          ENUM('active','past')
refill_due      DATE
```

### 9. medical_records
Lab results, radiology, prescriptions.
```sql
patient_id  INT → patients(id)
doctor_id   INT → doctors(id)
doctor_name VARCHAR(150)
title       VARCHAR(200)
record_type ENUM('lab','radiology','prescription','surgery')
record_date DATE
description TEXT
report_file VARCHAR(255)          -- uploaded PDF/image
```

### 10. patient_files
General patient file uploads.
```sql
patient_id INT → patients(id)
file_type  VARCHAR(50)
file_path  VARCHAR(255)
```

### 11. doctor_requests
Doctor-initiated requests for patients.
```sql
doctor_id    INT → doctors(id)
patient_id   INT → patients(id)
patient_name VARCHAR(150)
message      TEXT
priority     VARCHAR(50)
notes        TEXT
status       ENUM('pending','approved','rejected','resolved')
```

### 12. notifications
Patient notification system.
```sql
patient_id INT → patients(id)
title      VARCHAR(255)
message    TEXT
is_read    TINYINT(1) DEFAULT 0
```

---

## Data Persistence

Database data is stored in a Docker volume:
```yaml
volumes:
  db_data:  # persists across container restarts
```

To reset the database completely:
```bash
docker-compose down -v  # -v removes volumes
docker-compose up --build
```
