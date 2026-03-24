# 🛡️ ThreatLens — Suspicious Login Detection System

ThreatLens is a full-stack, machine learning–powered web application designed to detect suspicious login activity and potential account takeover (ATO) attempts in real time. It combines a React-based frontend, a Flask REST API backend, and an ML detection engine to classify login events, assign risk scores, and visualize attack patterns through an interactive dashboard.

---

## ✨ Features

- Real-time suspicious login detection
- Risk scoring for login attempts
- Detection of common attack patterns such as:
  - Brute Force
  - Credential Stuffing
  - Account Takeover
  - Anomalous Login Behavior
- Interactive dashboard with visual analytics
- Live event feed and recent event tracking
- Predict panel for manual login-event testing
- Demo simulator for generating synthetic attack traffic
- REST API for integration and testing

---

## 🏗️ System Architecture

```text
+----------------------+        +----------------------+        +----------------------+
|   React Frontend     | <----> |   Flask REST API     | <----> |   ML Detection Model |
|   (Vite, Port 3000)  |        |   (Port 5000)        |        |   model.pkl          |
+----------------------+        +----------------------+        +----------------------+
         |                               |                                |
         |                               |                                |
         v                               v                                v
  Dashboard UI                  /api/predict                    Random Forest Classifier
  Event Feed                    /api/events                     Isolation Logic
  Predict Panel                 /api/stats                      Risk Scoring
  Charts & Metrics              /api/simulate                   SQLite Event Storage

---

suspicious-login-detector/
│
├── backend/
│   ├── app.py                 # Flask REST API
│   ├── train_model.py         # ML model training script
│   ├── requirements.txt       # Backend dependencies
│   └── model.pkl              # Saved model (generated after training)
│
└── frontend/
    ├── src/
    │   ├── App.jsx            # Main dashboard UI
    │   └── main.jsx           # React entry point
    ├── index.html
    ├── package.json
    └── vite.config.js

---

# Step- 1: Backend Setup

cd backend
pip install -r requirements.txt
python train_model.py
python app.py

---
# Step- 2: Frontend Setup

cd frontend
npm install
npm run dev

---

# 📌 Use Cases

ThreatLens is especially relevant for:

Financial institutions
Account takeover prevention systems
Fraud monitoring platforms
SOC analyst dashboards
Security analytics research projects
ML-powered threat detection demonstrations
