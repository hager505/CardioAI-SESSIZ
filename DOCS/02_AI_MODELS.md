# AI Models — Technical Documentation

## Overview

CardioAI uses 2 AI models for cardiac health analysis:

| Model | Purpose | Input | Output | Technology |
|-------|---------|-------|--------|------------|
| **ECG Model** | Classify heart conditions from ECG signals | 7 clinical features + 12-lead ECG (1000 samples) | 5 classes | ONNX Runtime |
| **Vitals Model** | Detect cardiac risk from vital signs | 7 vital measurements | Risk probability (0-1) | scikit-learn |

---

## Model 1: ECG Classifier (model02.onnx)

### What it does
Takes a patient's clinical information + their ECG signal (12 leads, 1000 data points each) and classifies the heart condition into one of 5 categories.

### Input Shape
```
Input 1: X_inputs  → shape (1, 7)          → 7 clinical features
Input 2: Y_inputs  → shape (1, 1000, 12)   → 12-lead ECG signal
```

### Clinical Features (X_inputs) — 7 values:
```
[age, sex, height, weight, infarction_stadium1, infarction_stadium2, pacemaker]
```

| Index | Feature | Type | Example |
|-------|---------|------|---------|
| 0 | age | float | 55.0 |
| 1 | sex | 0=female, 1=male | 1.0 |
| 2 | height | cm | 175.0 |
| 3 | weight | kg | 80.0 |
| 4 | infarction_stadium1 | 0 or 1 | 0.0 |
| 5 | infarction_stadium2 | 0 or 1 | 1.0 |
| 6 | pacemaker | 0 or 1 | 0.0 |

### ECG Signal (Y_inputs) — 1000 x 12:
- 1000 time samples
- 12 leads (I, II, III, aVR, aVL, aVF, V1-V6)
- Each value is a float (voltage in mV)

### Output — 5 classes:
```
Output shape: (1, 5) → probabilities for each class
```

| Class | Index | Meaning (EN) | Meaning (AR) | Risk Level |
|-------|-------|-------------|-------------|------------|
| NORM | 0 | Normal heart | القلب سليم | None (green) |
| MI | 1 | Myocardial Infarction (heart attack) | احتشاء عضلة القلب | High (red) |
| STTC | 2 | ST/T wave changes | تغيرات في الموجة ST/T | Medium (yellow) |
| CD | 3 | Conduction Disturbance | اضطراب توصيل القلب | Medium (yellow) |
| HYP | 4 | Hypertrophy | تضخم عضلة القلب | High (red) |

### How prediction works in code:
```python
import onnxruntime as ort
import numpy as np

# Load model
session = ort.InferenceSession("model02.onnx")

# Prepare inputs
clinical = np.array([[55.0, 1.0, 175.0, 80.0, 0.0, 1.0, 0.0]], dtype=np.float32)
ecg_signal = np.random.randn(1, 1000, 12).astype(np.float32)

# Run prediction
result = session.run(None, {
    "X_inputs": clinical,
    "Y_inputs": ecg_signal
})

probs = result[0][0]  # [0.85, 0.05, 0.03, 0.04, 0.03]
predicted_class = np.argmax(probs)  # 0 → NORM
confidence = np.max(probs)  # 0.85
```

### Model file info:
- **Original format**: `model02.h5` (TensorFlow/Keras) — 2 MB
- **Converted format**: `model02.onnx` (ONNX) — 0.6 MB
- **Conversion tool**: `tf2onnx` (opset=13)
- **No accuracy loss** — same weights, same results

### ECG Preprocessing:
```python
# Per-lead normalization (zero mean, unit variance)
for lead in range(12):
    lead_data = ecg[:, :, lead]
    ecg[:, :, lead] = (lead_data - mean) / (std + 1e-8)
```

---

## Model 2: Vitals Risk Analyzer

### What it does
Takes 7 vital sign measurements and predicts cardiac risk (probability 0 to 1).

### Input — 7 vital signs:

| Feature | Column Name | Normal Range | Alert Range |
|---------|-------------|-------------|-------------|
| Systolic BP | blood_pressure_systolic | 90-140 | >155 |
| Diastolic BP | blood_pressure_diastolic | 60-90 | >100 |
| Heart Rate | heart_rate | 60-100 | >100 |
| Temperature | temperature | 36.1-37.2°C | >38.0 |
| Respiratory Rate | respiratory_rate | 12-20 | >25 |
| Oxygen Saturation | oxygen_saturation | 95-100% | <92% |
| BMI | bmi | 18.5-25 | >33 |

### Architecture — Ensemble of 2 models:

```
Input (7 features)
       │
       ├──► Random Forest (100 trees, max_depth=4)
       │         │
       │         ▼
       │    RF probability ─────────┐
       │                            │
       └──► MLP Classifier          │  Average
             (64→32→16 neurons)     │    │
                  │                 │    ▼
                  ▼                 │
             MLP probability ───────┘
                                    │
                                    ▼
                             Final Risk Score
                             (0.0 — 1.0)
```

### Output — Risk levels:

| Probability | Label | Risk Level | Color | Action |
|-------------|-------|------------|-------|--------|
| 0.0 — 0.2 | NORMAL | None | 🟢 #10b981 | Healthy lifestyle |
| 0.2 — 0.4 | LOW | Low | 🟡 #84cc16 | Monitor regularly |
| 0.4 — 0.6 | MODERATE | Medium | 🟠 #f59e0b | See doctor in 48h |
| 0.6 — 0.8 | HIGH | High | 🔴 #ef4444 | Urgent consultation |
| 0.8 — 1.0 | CRITICAL | Critical | 🔴 #991b1b | Call emergency |

### How prediction works in code:
```python
import joblib, numpy as np

# Load models
rf_model = joblib.load("vitals_model/cardiac_rf_model.pkl")
scaler = joblib.load("vitals_model/cardiac_scaler.pkl")
mlp_model = joblib.load("vitals_model/cardiac_dl_model.pkl")

# Input
vitals = [[155, 100, 110, 38.2, 28, 89, 35]]

# Random Forest
rf_proba = rf_model.predict_proba(vitals)[0, 1]  # e.g. 0.82

# MLP (needs scaling)
vitals_scaled = scaler.transform(vitals)
mlp_proba = mlp_model.predict_proba(vitals_scaled)[0, 1]  # e.g. 0.78

# Ensemble
risk = (rf_proba + mlp_proba) / 2  # 0.80 → CRITICAL
```

### Model files:
| File | Size | Description |
|------|------|-------------|
| `cardiac_rf_model.pkl` | 266 KB | Random Forest classifier |
| `cardiac_scaler.pkl` | 735 B | StandardScaler for MLP input |
| `cardiac_dl_model.pkl` | ~50 KB | MLP classifier (retrained during build) |

### retrain_vitals.py — What it does:
This script runs **once** during Docker build. It:
1. Generates synthetic medical data matching real-world patterns
2. Trains RF + MLP with same hyperparameters as original
3. Saves `.pkl` files compatible with the container's Python/numpy versions
4. **Eliminates all version mismatch errors forever**

---

## CSV Auto-Detection

When a user uploads a CSV file, the API automatically detects which model to use:

```python
# If CSV contains these columns → Vitals Model
vitals_keywords = ["blood_pressure_systolic", "heart_rate", 
                   "oxygen_saturation", "respiratory_rate", "bmi", "temperature"]

# If CSV contains these columns → ECG Model (clinical features only)
clinical_keywords = ["age", "sex", "pacemaker", "infarction"]
```

### Example Vitals CSV:
```csv
blood_pressure_systolic,blood_pressure_diastolic,heart_rate,temperature,respiratory_rate,oxygen_saturation,bmi
145,95,88,37.1,18,96,27.5
```

### Example Clinical CSV:
```csv
age,sex,height,weight,infarction_stadium1,infarction_stadium2,pacemaker
55,1,175,80,0,1,0
```

---

## Translation System

Both models return results in Arabic and English:

```json
{
  "label": "MI",
  "risk_level": "high",
  "risk_color": "#ef4444",
  "confidence_pct": 87.3,
  "message_ar": "احتشاء عضلة القلب — خطر جلطة — نسبة الثقة: 87.3%",
  "message_en": "Myocardial Infarction — Heart attack risk — Confidence: 87.3%",
  "recommendation_ar": "استشارة طبيب القلب فوراً",
  "recommendation_en": "Consult a cardiologist immediately"
}
```
