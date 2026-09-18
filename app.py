import streamlit as st
import pandas as pd
import joblib

# Page settings
st.set_page_config(page_title="Smart Scheduler UI", layout="wide")

# ==========================================
# 1. LOAD DATA & MODEL (WITH ABSOLUTE PATHS)
# ==========================================
# @st.cache_resource makes sure it only loads once and runs super fast!
@st.cache_resource
def load_assets():
    import os
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(BASE_DIR, "models", "noshow_model_rf.joblib")
    DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "cleaned_appointments.csv")
    WAITLIST_PATH = os.path.join(BASE_DIR, "data", "synthetic", "waitlist.csv")

    # Load Model Pipeline
    model = joblib.load(MODEL_PATH)
    
    # Load 100 upcoming appointments for tomorrow's schedule
    df_upcoming = pd.read_csv(DATA_PATH).tail(100)
    df_upcoming['PatientName'] = [f"Patient_{i}" for i in range(len(df_upcoming))]
    
    # Load Waitlist
    df_waitlist = pd.read_csv(WAITLIST_PATH)
    
    return model, df_upcoming, df_waitlist

try:
    pipeline, df_upcoming, df_waitlist = load_assets()
except Exception as e:
    st.error(f"Error loading files. Check your paths! Error: {e}")
    st.stop()

# ==========================================
# 2. UI HEADER & ETHICS GUARDRAIL
# ==========================================
st.title("🏥 Smart Waitlist & No-Show Predictor")
st.warning("**Ethical Guardrail:** This AI is an operational support tool. Risk scores are used to trigger polite reminders and proactively arrange waitlist backups. **It is never used to cancel an appointment or deny patient care.**")

# ==========================================
# 3. INTERACTIVE SLIDER (THE BUSINESS LOGIC)
# ==========================================
st.sidebar.header("⚙️ Operational Settings")
threshold_percent = st.sidebar.slider("No-Show Risk Threshold (%)", min_value=20, max_value=80, value=45, step=5)
threshold = threshold_percent / 100.0

# ==========================================
# 4. PREDICTIONS
# ==========================================
# Prepare features for the model (Drop things that aren't ML features)
features = df_upcoming.drop(columns=['NoShow', 'Specialty', 'PatientName'], errors='ignore')

# Predict
df_upcoming['RiskScore'] = pipeline.predict_proba(features)[:, 1]

# Filter those above our slider threshold
high_risk_df = df_upcoming[df_upcoming['RiskScore'] >= threshold].sort_values(by='RiskScore', ascending=False)

# ==========================================
# 5. DASHBOARD METRICS
# ==========================================
col1, col2, col3 = st.columns(3)
col1.metric("Total Appointments", len(df_upcoming))
col2.metric(f"High-Risk (≥{threshold_percent}%)", len(high_risk_df))
col3.metric("Est. Slots Recoverable", int(len(high_risk_df) * 0.75))

st.divider()

# ==========================================
# 6. HIGH RISK TABLE
# ==========================================
st.subheader("⚠️ High-Risk Appointments (Action Required)")

if len(high_risk_df) == 0:
    st.success("No high-risk appointments at this threshold. Relax!")
else:
    # Make it look nice for the UI
    display_df = high_risk_df[['PatientName', 'Specialty', 'Age', 'LeadDays', 'RiskScore']].copy()
    display_df['RiskScore'] = (display_df['RiskScore'] * 100).round(1).astype(str) + "%"
    
    st.dataframe(display_df, use_container_width=True)

st.divider()

# ==========================================
# 7. WAITLIST MATCHER
# ==========================================
st.subheader("🔄 Smart Waitlist Replacement")

if len(high_risk_df) > 0:
    # Dropdown to select a patient who might cancel
    selected_patient = st.selectbox("Select a high-risk patient to find waitlist replacements:", high_risk_df['PatientName'])
    
    if selected_patient:
        # Find what specialty this patient needs
        specialty_needed = high_risk_df[high_risk_df['PatientName'] == selected_patient]['Specialty'].values[0]
        st.write(f"**Searching Waitlist for:** `{specialty_needed}`")
        
        # Filter Waitlist
        matches = df_waitlist[df_waitlist['Specialty'] == specialty_needed].copy()
        
        if matches.empty:
            st.error("No waitlist matches found for this specialty.")
        else:
            # Rank matches (Urgency > Days Waiting)
            urgency_map = {'High': 3, 'Medium': 2, 'Low': 1}
            matches['UrgencyScore'] = matches['Urgency'].map(urgency_map)
            ranked_matches = matches.sort_values(by=['UrgencyScore', 'DaysWaiting'], ascending=[False, False])
            
            # Show top 3 results
            st.table(ranked_matches[['PatientName', 'Urgency', 'DaysWaiting', 'ContactNumber']].head(3))