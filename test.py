import numpy as np
from tensorflow import keras
from sklearn.metrics import classification_report

# ======================
# تحميل الداتا
# ======================
data = np.load("data.npz")

X_test = data["X_test"]
Y_test = data["Y_test"]
Z_test = data["Z_test"]

labels = ['NORM', 'MI', 'STTC', 'CD', 'HYP']

# ======================
# تحميل الموديل
# ======================
model = keras.models.load_model("model02.keras")

# ======================
# Prediction
# ======================
preds = model.predict([X_test, Y_test])
preds_binary = (preds > 0.5).astype(int)

# ======================
# تقييم سريع
# ======================
print("\n📊 TEST RESULTS")
print("="*40)

accuracy = (preds_binary == Z_test).all(axis=1).mean()
print("Strict Accuracy:", accuracy)

print("\n📄 Classification Report:")
print(classification_report(Z_test, preds_binary, target_names=labels, zero_division=0))