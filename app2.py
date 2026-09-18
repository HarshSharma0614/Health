from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import joblib
import os

app = FastAPI(
    title="Hospital Smart Operations API",
    description="API for No-Show Prediction and Smart Waitlist Matching",
    version="1.0.0"
)

# ==========================================
# 1. GLOBAL VARIABLES & PATHS
# ==========================================
MODEL_PATH = r"D:\Desktop\BootCamp_Hackathon\models\noshow_model_rf.joblib"
THRESHOLD_PATH = r"D:\Desktop\BootCamp_Hackathon\models\threshold.txt"
WAITLIST_PATH = r"D:\Desktop\BootCamp_Hackathon\data\synthetic\waitlist.csv"

model_pipeline = None
base_threshold = 0.45

# ==========================================
# 2. STARTUP EVENT (Load data into memory once)
# ==========================================
@app.on_event("startup")
def load_artifacts():
    global model_pipeline, base_threshold
    
    # Load the trained Scikit-Learn pipeline
    if os.path.exists(MODEL_PATH):
        model_pipeline = joblib.load(MODEL_PATH)
    else:
        print("WARNING: Model file not found. Run training script first.")

    # Load the business threshold
    if os.path.exists(THRESHOLD_PATH):
        with open(THRESHOLD_PATH, 'r') as f:
            base_threshold = float(f.read().strip())

# ==========================================
# 3. PYDANTIC SCHEMAS (Data Validation)
# ==========================================
# This acts as a strict contract for your frontend teammate
class PatientPredictionInput(BaseModel):
    Age: int
    LeadDays: int
    DayOfWeek: str  # e.g., "Monday", "Tuesday"
    Gender: str     # "M" or "F"
    Scholarship: int = 0
    Hypertension: int = 0
    Diabetes: int = 0
    Alcoholism: int = 0
    Handicap: int = 0
    SMS_received: int = 0

class WaitlistRequest(BaseModel):
    specialty: str
    canceled_day: str   # e.g., "Tuesday"
    canceled_time: str  # e.g., "Afternoon"

# ==========================================
# 4. ENDPOINT 1: PREDICT NO-SHOW RISK
# ==========================================
@app.post("/api/predict")
def predict_no_show(patient: PatientPredictionInput):
    if model_pipeline is None:
        raise HTTPException(status_code=500, detail="Model not loaded on server.")

    # 1. Convert incoming JSON to a Pandas DataFrame (matching training format)
    input_df = pd.DataFrame([patient.dict()])

    # 2. Get Probability
    try:
        probability = model_pipeline.predict_proba(input_df)[0][1]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction failed: {str(e)}")

    # 3. Apply Thresholds to determine Risk & Action
    # We use your 0.45 as the "Medium" cutoff, and 0.65 as "High"
    if probability < base_threshold:
        risk_level = "LOW"
        action = "Standard automated SMS reminder."
    elif probability < (base_threshold + 0.20):
        risk_level = "MEDIUM"
        action = "Priority SMS reminder and monitor."
    else:
        risk_level = "HIGH"
        action = "Staff review required. Direct phone call recommended."

    # 4. Send back the exact payload the frontend needs
    return {
        "probability_score": round(probability, 3),
        "risk_level": risk_level,
        "recommended_action": action,
        "threshold_used": base_threshold,
        "disclaimer": "This is a predictive estimate for operational use, not a clinical certainty."
    }

# ==========================================
# 5. ENDPOINT 2: SMART WAITLIST MATCHING
# ==========================================
@app.post("/api/waitlist/match")
def find_waitlist_match(req: WaitlistRequest):
    if not os.path.exists(WAITLIST_PATH):
        raise HTTPException(status_code=500, detail="Waitlist data not found.")

    # 1. Load the latest waitlist
    waitlist_df = pd.read_csv(WAITLIST_PATH)

    # 2. STAGE 1: Hard Compatibility Filters
    # Must match the exact Specialty, and the patient must be available on that Day/Time
    compatible_patients = waitlist_df[
        (waitlist_df['Specialty'] == req.specialty) &
        (waitlist_df['PreferredDay'].isin([req.canceled_day, 'Any'])) &
        (waitlist_df['PreferredTime'].isin([req.canceled_time, 'Any']))
    ].copy()

    if compatible_patients.empty:
        return {"status": "No matches found", "matches": []}

    # 3. STAGE 2: Transparent Ranking Algorithm
    # High urgency gets massive priority (+500). Then we add DaysWaiting as a tie-breaker.
    urgency_points = {'High': 500, 'Medium': 200, 'Low': 0}
    compatible_patients['UrgencyScore'] = compatible_patients['Urgency'].map(urgency_points)
    compatible_patients['TotalMatchScore'] = compatible_patients['UrgencyScore'] + compatible_patients['DaysWaiting']

    # 4. Sort highest score to the top
    ranked_patients = compatible_patients.sort_values(by='TotalMatchScore', ascending=False)

    # 5. Return top 3 matches to the frontend
    top_matches = ranked_patients.head(3).to_dict(orient="records")
    
    return {
        "status": "Matches found",
        "total_compatible": len(ranked_patients),
        "matches": top_matches
    }