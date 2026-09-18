from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import joblib

app = FastAPI(title="Hospital AI Backend")

# Allow Frontend to communicate with Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. LOAD MODEL & DATA (Absolute Windows Paths)
# ==========================================
print("Loading model and data...")

try:
    import os
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "models", "noshow_model_rf.joblib")
    DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "cleaned_appointments.csv")
    WAITLIST_PATH = os.path.join(BASE_DIR, "data", "synthetic", "waitlist.csv")

    pipeline = joblib.load(MODEL_PATH)
    
    # Load upcoming appointments (Simulating 100 patients for tomorrow)
    df_upcoming = pd.read_csv(DATA_PATH).tail(100)
    df_upcoming['PatientName'] = [f"Patient_{i}" for i in range(len(df_upcoming))]
    
    # Load the Waitlist CSV
    df_waitlist = pd.read_csv(WAITLIST_PATH)
    
    print("✅ All files loaded successfully!")
except Exception as e:
    print(f"❌ Error loading files: {e}")
    print("Make sure your model and CSV files exist in the exact paths above.")

# ==========================================
# 2. DASHBOARD ENDPOINT (Calculates Risk)
# ==========================================
@app.get("/api/dashboard")
def get_dashboard_data(threshold: float = 0.45):
    """Calculates risks based on the slider threshold from the HTML UI."""
    features = df_upcoming.drop(columns=['NoShow', 'Specialty', 'PatientName'], errors='ignore')
    
    # Predict Probabilities
    df_upcoming['RiskScore'] = pipeline.predict_proba(features)[:, 1]
    
    # Filter High Risk based on UI slider
    high_risk = df_upcoming[df_upcoming['RiskScore'] >= threshold].sort_values(by='RiskScore', ascending=False)
    
    # Format the risk score for UI (e.g., 0.854 -> 85.4)
    high_risk['RiskScore'] = (high_risk['RiskScore'] * 100).round(1)
    
    return {
        "stats": {
            "total": len(df_upcoming),
            "high_risk": len(high_risk),
            "recovered": int(len(high_risk) * 0.75) # Assume 75% recovery rate from waitlist
        },
        "patients": high_risk[['PatientName', 'Specialty', 'Age', 'LeadDays', 'RiskScore']].to_dict(orient='records')
    }

# ==========================================
# 3. WAITLIST MATCHER ENDPOINT
# ==========================================
@app.get("/api/waitlist/{specialty}")
def match_waitlist(specialty: str):
    """Finds top 3 waitlist matches based on specialty and urgency."""
    matches = df_waitlist[df_waitlist['Specialty'] == specialty].copy()
    
    if matches.empty:
        return []
    
    # Transparent Ranking Logic
    urgency_map = {'High': 3, 'Medium': 2, 'Low': 1}
    matches['UrgencyScore'] = matches['Urgency'].map(urgency_map)
    
    # Sort by Urgency first, then how long they have been waiting
    ranked = matches.sort_values(by=['UrgencyScore', 'DaysWaiting'], ascending=[False, False])
    
    return ranked[['PatientName', 'Urgency', 'DaysWaiting', 'ContactNumber']].head(3).to_dict(orient='records')