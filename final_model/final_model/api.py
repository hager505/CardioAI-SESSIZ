from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import tensorflow as tf
from typing import List
from scipy import signal

app = FastAPI(title="Heart Disease Prediction API")

# Load model once when server starts
print("Loading model...")
model = tf.keras.models.load_model('model02.h5')
print("Model loaded successfully!")

# Define input format
class ECGData(BaseModel):
    clinical_features: List[float]  # 7 features
    ecg_signal: List[List[List[float]]]  # 1 x 1000 x 12

def preprocess_ecg(ecg_signal):
    """
    Preprocess ECG signal:
    1. Convert to numpy array
    2. Normalize (zero mean, unit variance)
    3. Optional: filter noise (bandpass filter)
    """
    ecg = np.array(ecg_signal)
    
    # Normalize per lead (each of the 12 leads)
    for lead in range(ecg.shape[-1]):
        lead_data = ecg[:, :, lead]
        ecg[:, :, lead] = (lead_data - np.mean(lead_data)) / (np.std(lead_data) + 1e-8)
    
    return ecg

@app.get("/")
def home():
    return {"message": "Heart Disease Prediction API is running"}

@app.post("/predict")
async def predict(data: ECGData):
    try:
        # Convert to numpy arrays
        clinical = np.array([data.clinical_features])
        
        # Preprocess ECG signal
        ecg = preprocess_ecg(data.ecg_signal)
        
        # Make prediction
        prediction = model.predict([clinical, ecg])
        predicted_class = int(np.argmax(prediction[0]))
        confidence = float(np.max(prediction[0]))
        
        return {
            "predicted_class": predicted_class,
            "confidence": confidence,
            "probabilities": prediction[0].tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy"}