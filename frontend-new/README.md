# AuraCare Predictor - Hospital Appointment No-Show & Smart Waitlist Predictor

A clean, modern, and impressive frontend UI and Python decision-support backend server for a 2nd-year student hackathon project.

## 📌 Project Overview
- **Purpose**: Predict upcoming appointment no-show probability, prioritize reminder outreach, match open slots with waitlisted patients, explain recommendations transparently, and calculate potential capacity recovered.
- **Scope**: Decision support tool for hospital scheduling staff (human-in-the-loop). Does NOT automatically cancel appointments or make autonomous care decisions.
- **Design System**: Unique Top Command Dock navigation, soft off-white background (`#F3F6FA`), pure white cards (`#FFFFFF`), restrained healthcare palette (Medical Blue, Teal, Amber, Red, Green).

## 📁 File Structure
```
hospital-noshow-predictor/
├── server.py       # Python backend HTTP server with ML decision endpoints
├── index.html      # Single Page Application HTML shell with top command dock
├── styles.css      # Design system, CSS custom properties, responsive layout
├── app.js          # Reactive state manager, Chart.js donut renderer, demo navigator
└── README.md       # Project documentation & setup instructions
```

## 🚀 Quick Start Instructions

### Running the Python Server & Frontend
1. Open terminal in the project directory:
   ```bash
   cd hospital-noshow-predictor
   ```
2. Start the server:
   ```bash
   python server.py
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

## ⚡ API Endpoints
- `GET /api/health` - API server status & health check
- `GET /api/model-info` - Active model metadata & feature declarations
- `GET /api/appointments/upcoming` - Returns upcoming appointments with probabilities & factor contributions
- `POST /api/predict` - Real-time no-show probability evaluation
- `POST /api/waitlist/recommend` - Ranks compatible waitlist candidates for open slots
- `GET /api/metrics` - Model benchmark performance metrics (ROC-AUC, Precision, Recall, F1)

## ✨ Hackathon Demo Mode
Click the floating **"Next Step →"** button in the bottom right corner of the application to run through the guided 13-step hackathon demo flow during presentations!
