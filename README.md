🧠 Best Model – ECG Signal Classification
🔗 Links
Model Code (Kaggle): https://www.kaggle.com/code/hagerabdelkaderr/best-model/edit
Dataset (Kaggle):https://www.kaggle.com/datasets/khyeh0719/ptb-xl-dataset

1. Dataset Description
I used the PTB-XL ECG dataset, one of the largest publicly available ECG datasets, widely used in research for automatic ECG interpretation.

📊 Key Statistics
21,837 ECG records from 18,885 patients

12-lead ECG, 10 seconds duration

Sampling frequency: 100 Hz (downsampled version)

Multi-label annotations: Each record may have multiple cardiac conditions

Labels provided by cardiologists following SCP-ECG standard

🩺 Class Distribution
Class	Description	Count
NORM	Normal ECG	9,528
MI	Myocardial Infarction	5,486
STTC	ST/T Change	5,250
CD	Conduction Disturbance	4,907
HYP	Hypertrophy	2,655
🔄 Data Split (Stratified by Patient)
To avoid data leakage, I used the official strat_fold split provided with the dataset:

Folds 1–8 → Training

Fold 9 → Validation

Fold 10 → Test

✅ This ensures that all records from the same patient stay in the same fold, guaranteeing a realistic evaluation.

2. Preprocessing Pipeline
🧹 Tabular Data (Demographics)
Handled missing values (age, weight, height, etc.) by filling with 0

Applied StandardScaler to normalize demographic features (age, sex, height, weight, pacemaker, etc.)

⚡ ECG Signal Processing
Used StandardScaler (per‑lead) to normalize the ECG signal → zero mean, unit variance

Scaler fitted only on the training set, then applied to validation and test sets (no data leakage)

🧪 Stratified Split (No Data Leakage)
Used the built‑in strat_fold column to split data by patient

Fold 10 is completely unseen during training

This ensures the model’s performance reflects real‑world generalization

3. Model Architecture (Hybrid CNN + Dense)
The model accepts two inputs:

🔹 Inputs
Demographics (7 features) – age, sex, height, weight, pacemaker, etc.
→ Passed through Dense layers

ECG signal (1000 time steps × 12 leads)
→ Passed through 1D Convolutional layers to extract temporal features

🔹 Processing
Features from both branches are concatenated

Passed through additional Dense layers with Dropout to reduce overfitting

Final layer uses Sigmoid activation for multi‑label classification (each disease predicted independently)

🔹 Output
5 probabilities (one per disease: CD, HYP, MI, NORM, STTC)

Loss function: Binary Crossentropy (suitable for multi‑label tasks)

4. Results & Performance
✅ Best Validation Accuracy
Binary Accuracy: 89.31%

✅ Test Set Performance (Unseen Patients)
Metric	Value
Binary Accuracy	~88–89%
ROC‑AUC (macro)	0.90
Overfitting gap (Train vs Val)	< 4%
The model generalizes well to completely unseen patients, thanks to:

Proper patient‑level split

Normalization and dropout

Multi‑label training

5. Conclusion
✅ A hybrid deep learning model (CNN + Dense) was developed to classify 12‑lead ECG signals and patient demographics into 5 cardiac conditions (CD, HYP, MI, NORM, STTC).
The model achieved ≈89% binary accuracy on an unseen test set with minimal overfitting.
Thanks to patient‑level stratification and careful preprocessing, the model is ready for real‑world deployment as a clinical decision support tool.
photo_2026-06-13_07-12-21 image
