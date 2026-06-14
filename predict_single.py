import numpy as np
from tensorflow import keras

# Load model
model = keras.models.load_model('model02.h5')

# Example single sample (replace with your real data)
single_clinical = np.random.rand(1, 7)  # 1 sample, 7 features
single_ecg = np.random.rand(1, 1000, 12)  # 1 sample, 1000 timepoints, 12 leads

# Make prediction
prediction = model.predict([single_clinical, single_ecg])
predicted_class = np.argmax(prediction)

print(f"Predicted class: {predicted_class}")
print(f"Prediction probabilities: {prediction[0]}")