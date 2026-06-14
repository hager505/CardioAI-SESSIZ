from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import tensorflow as tf
from typing import List

app = FastAPI(title="Heart Disease Prediction API")

# Load model once when server starts
print("Loading model...")
model = tf.keras.models.load_model('model02.h5')
print("Model loaded successfully!")

# Define input format
class ECGData(BaseModel):
    clinical_features: List[float]  # 7 features
    ecg_signal: List[List[List[float]]] = [[[0.1]*12 for _ in range(1000)]]  # 1 x 1000 x 12

@app.get("/")
def home():
    return {"message": "Heart Disease Prediction API is running"}

@app.post("/predict")
async def predict(data: ECGData):
    try:
        # Convert to numpy arrays
        clinical = np.array([data.clinical_features])
        ecg = np.array(data.ecg_signal)
        
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