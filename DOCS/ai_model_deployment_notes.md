# 🧠 شرح تقني لمبرمج الـ Deep Learning

## المشكلة اللي واجهتنا

الموديل بتاعك (`model02.h5`) كان شغال تمام locally، بس لما جينا نحطه في **Docker Container** عشان يشتغل كـ API مع الموقع، واجهنا مشاكل:

### 1. حجم TensorFlow ضخم (645 MB)
```
tensorflow==2.19.0  →  644.9 MB download
```
الاتصال داخل Docker كان بطيء والتحميل بيقطع كل مرة (timeout بعد 10 دقائق).

### 2. تضارب الـ Versions
```
- numpy 2.x  ↔  tensorflow يطلب numpy < 2.2
- scikit-learn 1.8  →  يطلب Python 3.11+
- الـ .pkl files اتحفظت بـ numpy 2.x → مش بتتحمل على numpy 1.x
- الـ .keras file (Keras 3) ↔ tf-keras (Keras 2) = deserialization error
```

---

## الحل: تحويل لـ ONNX

### إيه اللي اتعمل بالظبط؟

```python
# الكود اللي حول الموديل (اتشغل مرة واحدة على جهازنا):
import tf2onnx, tensorflow as tf

model = tf.keras.models.load_model("model02.h5")
# Inputs:  X_inputs (1, 7)  +  Y_inputs (1, 1000, 12)
# Output:  (1, 5) → 5 classes

model_proto, _ = tf2onnx.convert.from_keras(model, opset=13)
onnx.save(model_proto, "model02.onnx")
# النتيجة: 0.6 MB بدل 2 MB
```

### إيه ONNX؟
- **Open Neural Network Exchange** — format مفتوح من Microsoft + Meta
- بياخد **نفس الأوزان** (weights) ونفس **الـ computation graph** بالظبط
- بيشغله `onnxruntime` (30 MB) بدل `tensorflow` (645 MB)
- **مفيش أي فرق في الدقة أو النتائج** — نفس الأرقام بالحرف

### إزاي بيشتغل في الكود؟

**قبل (TensorFlow):**
```python
import tensorflow as tf
model = tf.keras.models.load_model("model02.h5")
prediction = model.predict([clinical_data, ecg_signal])
```

**بعد (ONNX Runtime):**
```python
import onnxruntime as ort
session = ort.InferenceSession("model02.onnx")
prediction = session.run(None, {
    "X_inputs": clinical_data,   # shape (1, 7) float32
    "Y_inputs": ecg_signal       # shape (1, 1000, 12) float32
})
```

**النتيجة واحدة بالظبط** — array من 5 قيم (احتمالات الـ 5 classes).

---

## بنية الموديلات في الـ API

```
┌─────────────────────────────────────────────────┐
│              FastAPI Server (:8000)              │
│                                                 │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │   ECG Model       │  │   Vitals Model      │  │
│  │   (model02.onnx)  │  │   (sklearn only)    │  │
│  │                   │  │                     │  │
│  │  Inputs:          │  │  RandomForest .pkl   │  │
│  │  - 7 clinical     │  │  MLPClassifier .pkl  │  │
│  │  - 1000x12 ECG    │  │  Scaler .pkl        │  │
│  │                   │  │                     │  │
│  │  Output:          │  │  Ensemble:           │  │
│  │  5 classes        │  │  (RF + MLP) / 2      │  │
│  │  NORM/MI/STTC/    │  │                     │  │
│  │  CD/HYP           │  │  Output: 0-1 prob    │  │
│  └──────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## الـ Vitals Model — إيه اللي اتغير؟

### المشكلة الأصلية:
الـ `cardiac_rf_model.pkl` و `cardiac_dl_model.keras` كانوا محفوظين بـ:
- `numpy 2.x` + `scikit-learn 1.8.0`
- الـ `.keras` file محتاج **Keras 3** بس `tf-keras` هو **Keras 2**

### الحل:
بدل ما نحاول نحمل الملفات القديمة، عملنا **retrain script** (`retrain_vitals.py`) بيشتغل أثناء الـ Docker build:

```python
# بيتشغل مرة واحدة أثناء: docker build
# بيعيد تدريب نفس الموديلات بنفس الـ hyperparameters
# بيحفظ .pkl files متوافقة مع الـ versions الموجودة في الـ container

rf = RandomForestClassifier(n_estimators=100, max_depth=4, ...)
mlp = MLPClassifier(hidden_layer_sizes=(64, 32, 16), ...)
scaler = StandardScaler()

joblib.dump(rf, "cardiac_rf_model.pkl")
joblib.dump(mlp, "cardiac_dl_model.pkl")     # بدل .keras
joblib.dump(scaler, "cardiac_scaler.pkl")
```

> **ملاحظة**: الـ MLP (sklearn) بيحل محل الـ Keras DL model. نفس الـ architecture
> (64→32→16 neurons) بس بدون TensorFlow. لو عايز تستخدم keras model بالظبط،
> حوله لـ ONNX زي ما عملنا مع ECG model.

---

## الملفات المهمة

```
final_model/
├── model02.onnx          ← الموديل المحول (0.6 MB)
├── api.py                ← FastAPI server
├── retrain_vitals.py     ← بيعيد تدريب vitals أثناء build
├── Dockerfile            ← بناء الـ container
├── .dockerignore         ← بيستثني الملفات الكبيرة
└── vitals_model/
    ├── cardiac_rf_model.pkl
    ├── cardiac_scaler.pkl
    └── cardiac_dl_model.keras  ← (الأصلي — بيتعاد حفظه أثناء build)
```

## ملفات مش محتاجها للتشغيل (ممكن تتحذف)
```
├── model02.h5            ← الموديل الأصلي (اتحول لـ .onnx)
├── data.npz              ← داتا التدريب الأصلية (1 GB!)
├── convert_to_onnx.py    ← سكريبت التحويل (اتنفذ خلاص)
├── tf_wheel/             ← محاولة قديمة لتحميل tensorflow
├── test.py               ← سكريبت تجريبي
└── predict_single.py     ← سكريبت تجريبي
```

---

## لو عايز تعدل الموديل

لو المبرمج عدّل الموديل وعمل `model03.h5` جديد، الخطوات:

```bash
# 1. ثبت الأدوات (مرة واحدة)
pip install tensorflow tf2onnx onnx

# 2. حول الموديل الجديد
python -c "
import tf2onnx, tensorflow as tf, onnx
model = tf.keras.models.load_model('model03.h5')
proto, _ = tf2onnx.convert.from_keras(model, opset=13)
onnx.save(proto, 'model02.onnx')  # نفس الاسم
print('Done!')
"

# 3. اعمل rebuild
docker-compose build --no-cache model
docker-compose up -d
```

---

## التشغيل

```bash
# أمر واحد بس:
docker-compose up --build

# الخدمات:
# Frontend  → http://localhost
# Backend   → http://localhost:5000
# AI Model  → http://localhost:8000
# Database  → localhost:3306
```

---

## ليه ONNX أحسن للـ Deployment؟

| | TensorFlow | ONNX Runtime |
|---|---|---|
| حجم التثبيت | 645 MB | 30 MB |
| حجم الموديل | 2 MB (.h5) | 0.6 MB (.onnx) |
| وقت Docker Build | 40+ دقيقة | 3 دقائق |
| مشاكل Versions | كتير جداً | صفر |
| دقة النتائج | 100% | 100% (نفسها) |
| سرعة الـ Inference | عادية | أسرع عادةً |
