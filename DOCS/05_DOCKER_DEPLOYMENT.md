# Docker & Deployment Guide

## Quick Start

### Prerequisites
- **Docker Desktop** installed and running (Windows/Mac/Linux)
- No need for Python, Node.js, or MySQL installed locally

### Run Everything
```bash
cd "New folder"
docker-compose up --build
```

First build takes 5-10 minutes. After that, starts in seconds.

### Access
| Service | URL |
|---------|-----|
| Website | http://localhost |
| Backend API | http://localhost:5000 |
| AI Model API | http://localhost:8000 |
| Database | localhost:3306 |

### Stop
```bash
docker-compose down        # Stop containers (data preserved)
docker-compose down -v     # Stop + delete database data
```

---

## docker-compose.yml Explained

```yaml
services:
  # ── Database ──────────────────────────────────────────
  db:
    image: mysql:8                    # Official MySQL 8 image
    container_name: cardio_db
    restart: always                   # Auto-restart on crash
    environment:
      MYSQL_ROOT_PASSWORD: root       # DB password
      MYSQL_DATABASE: cardioai        # Auto-create this DB
    ports:
      - "3306:3306"                   # Access from host
    volumes:
      - db_data:/var/lib/mysql        # Persist data

  # ── Backend (Node.js) ────────────────────────────────
  backend:
    build:
      context: ./CardioAI/BackEnd     # Build from this folder
      dockerfile: Dockerfile
    container_name: cardio_backend
    restart: always
    ports:
      - "5000:5000"
    environment:
      DB_HOST: db                     # Use container name, not localhost
      DB_USER: root
      DB_PASSWORD: root
      DB_NAME: cardioai
      DB_PORT: 3306
      MODEL_URL: http://model:8000/predict           # Internal Docker DNS
      MODEL_URL_VITALS: http://model:8000/predict-vitals
      MODEL_URL_UPLOAD: http://model:8000/upload-predict
    depends_on:
      - db                            # Wait for DB to start
      - model                         # Wait for AI model to start

  # ── AI Model (Python) ───────────────────────────────
  model:
    build:
      context: ./final_model          # Build from this folder
      dockerfile: Dockerfile
    container_name: cardio_model
    restart: always
    ports:
      - "8000:8000"

  # ── Frontend (Nginx) ────────────────────────────────
  frontend:
    image: nginx:alpine               # Lightweight web server
    container_name: cardio_frontend
    restart: always
    ports:
      - "80:80"                       # Main website port
    volumes:
      - ./CardioAI/FrontEnd:/usr/share/nginx/html:ro  # Read-only mount
```

---

## Dockerfile: Backend (Node.js)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## Dockerfile: AI Model (Python)

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# System dependencies (for scipy, scikit-learn compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install packages (NO tensorflow — uses onnxruntime instead)
RUN pip install --no-cache-dir \
    fastapi==0.104.0 \
    uvicorn==0.24.0 \
    numpy==2.1.3 \
    onnxruntime==1.22.0 \
    scipy==1.15.3 \
    python-multipart==0.0.6 \
    pandas==2.2.3 \
    scikit-learn==1.7.2 \
    joblib==1.4.2

# Copy model + code
COPY model02.onnx .
COPY api.py .
COPY retrain_vitals.py .
COPY vitals_model/ ./vitals_model/

# Re-train vitals models for version compatibility
RUN python retrain_vitals.py

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Why no tensorflow?
- tensorflow = **645 MB** download → kept timing out
- We converted `model02.h5` → `model02.onnx` (same accuracy)
- `onnxruntime` = **30 MB** — installs in seconds
- See `02_AI_MODELS.md` for full explanation

---

## Container Communication

Inside Docker, containers talk to each other using **service names** (not localhost):

```
Backend → http://model:8000/predict       ✅ (Docker DNS)
Backend → http://localhost:8000/predict    ❌ (wrong inside Docker)
```

```
Backend → mysql://db:3306/cardioai        ✅ (Docker DNS)
Backend → mysql://localhost:3306/cardioai  ❌ (wrong inside Docker)
```

---

## Troubleshooting

### "Cannot connect to AI model"
```bash
# Check if model container is running
docker ps

# Check model logs
docker logs cardio_model

# Restart model only
docker-compose restart model
```

### "cardio_model exited with code 137"
This means **Out of Memory**. The model needs ~512MB RAM.
- Open Docker Desktop → Settings → Resources → Memory → Set to at least **4 GB**

### "DB connection refused"
The database takes 10-20 seconds to start. The backend will retry automatically.
```bash
# Force restart
docker-compose restart backend
```

### "Port already in use"
```bash
# Find what's using port 80
netstat -ano | findstr :80

# Or change ports in docker-compose.yml
ports:
  - "8080:80"    # Use http://localhost:8080 instead
```

### Rebuild from scratch
```bash
docker-compose down -v                    # Stop + delete data
docker system prune -af                   # Clean all Docker cache
docker-compose up --build                 # Fresh build
```

---

## Files NOT needed for deployment

These can be deleted before sharing the project (saves ~1 GB):

| File | Size | Why not needed |
|------|------|----------------|
| `final_model/data.npz` | 1 GB | Training data — model is already trained |
| `final_model/model02.h5` | 2 MB | Original TF model — converted to .onnx |
| `final_model/tf_wheel/` | folder | Failed tensorflow download attempt |
| `final_model/convert_to_onnx.py` | 1 KB | Conversion script — already executed |
| `final_model/test.py` | 1 KB | Test script — not production |
| `final_model/predict_single.py` | 1 KB | Test script — not production |
