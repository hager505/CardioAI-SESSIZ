 Best Model – ECG Multi-Label Classification
Welcome to the official documentation of the Best Model project — a hybrid deep learning pipeline for automatic classification of 12‑lead ECG signals.

🔗 Quick Links
Resource	Link
Kaggle Notebook (model code)	best-model on Kaggle
PTB‑XL ECG Dataset	PTB‑XL on Kaggle
📊 1. Dataset – PTB‑XL
The PTB‑XL ECG dataset is one of the largest publicly available ECG collections, widely used in research and clinical benchmarking.

🔹 Key Statistics
Property	Value
Records	21,837
Patients	18,885
Leads	12 (standard)
Duration	10 seconds
Sampling rate (used)	100 Hz
Labels	Multi‑label, cardiologist‑annotated (SCP‑ECG)

🔹 Class Distribution
Code	Diagnosis	Count
NORM	Normal ECG	9,528
MI	Myocardial Infarction	5,486
STTC	ST/T Change	5,250
CD	Conduction Disturbance	4,907
HYP	Hypertrophy	2,655
2. Preprocessing Pipeline
To ensure clean signals and fair evaluation, the following steps were applied after train/validation/test split (no data leakage).

Tabular (Demographics)
Missing values (age, weight, height, etc.) → filled with 0

StandardScaler fitted on training only → applied to val / test

ECG Signal
Lead‑wise StandardScaler → zero mean, unit variance

Normalization statistics computed only on training set

Augmentation (training only): random time window (window_size=800) + Gaussian noise (σ=0.05)

Data Splitting (No Leakage)
Used the official strat_fold column (patient‑aware split)

Fold 1–8 → Training

Fold 9 → Validation

Fold 10 → Test (completely unseen during training)

✅ This guarantees realistic evaluation and generalization measurement.

🧠 3. Model Architecture – Hybrid (CNN + Dense)
The model is designed as a dual‑input neural network, combining raw ECG features with patient demographics.

Inputs
Input Branch	Shape	Processing
Demographics	(7,)	Dense layers + Dropout
ECG signal	(1000, 12)	1D‑Conv → BatchNorm → GlobalAvgPool
Fusion & Classification
Both branches are concatenated

Passed through dense layers with Dropout (0.5)

Output layer: 5 sigmoid units (multi‑label probability per disease)

text
Demographics (7) → Dense → Dropout ──┐
                                     ├─ Concatenate → Dense → Sigmoid (5)
ECG (1000×12) → CNN → GlobalAvgPool ─┘
Training Details
Loss: Binary cross‑entropy (suitable for multi‑label)

Optimizer: Adam

Callbacks: EarlyStopping, ModelCheckpoint (monitor val_binary_accuracy)

Total parameters: ≈ 154K (lightweight, fast inference)

📈 4. Results & Performance
All metrics reported on the unseen test set (Fold 10).

Overall Performance
Metric	Value
Binary Accuracy	≈ 88–89 %
ROC‑AUC (macro)	0.90
Overfitting gap (train vs val)	< 4 %
Per‑Class Test Accuracy
Class	Accuracy
CD	89.2 %
HYP	88.1 %
MI	87.4 %
NORM	87.0 %
STTC	87.0 %
✅ The model generalizes well to new patients with minimal performance drop.

🚀 5. Conclusion & Deployment Readiness
The hybrid CNN + dense model accurately classifies 5 major cardiac conditions from standard 12‑lead ECG and demographic data.
Thanks to patient‑wise stratification, lead‑wise normalization, and careful split design, the model achieves ≈89 % binary accuracy and AUC 0.90 on unseen data.

Ready for backend integration
Item	Specification
Input 1	ECG signal: shape (1000, 12), normalized
Input 2	Demographics: 7 features (age, sex, height, weight, pacemaker, …)
Output	5 probabilities ([CD, HYP, MI, NORM, STTC])
Model file	model02.keras
photo_2026-06-13_07-12-21 image
