"""
Suspicious Login Detection - Flask Backend API
Run: python app.py
"""

from flask import Flask, request, jsonify
import pickle
import numpy as np
import pandas as pd
import sqlite3
import json
from datetime import datetime
import random
import os

app = Flask(__name__)

# ─── CORS ─────────────────────────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def options(path):
    return jsonify({}), 200

# ─── Load Model ───────────────────────────────────────────────────────────────
with open('model.pkl', 'rb') as f:
    artifacts = pickle.load(f)

MODEL   = artifacts['model']
SCALER  = artifacts['scaler']
FEATURES = artifacts['features']

# ─── Database ─────────────────────────────────────────────────────────────────
DB_PATH = 'logins.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS login_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            username TEXT,
            ip_address TEXT,
            country TEXT,
            device TEXT,
            hour_of_day INTEGER,
            day_of_week INTEGER,
            failed_attempts INTEGER,
            country_risk REAL,
            is_new_device INTEGER,
            is_new_ip INTEGER,
            ip_reputation REAL,
            session_duration_prev REAL,
            login_frequency_deviation REAL,
            time_since_last_login_hours REAL,
            vpn_proxy INTEGER,
            risk_score REAL,
            prediction TEXT,
            attack_type TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ─── Helpers ──────────────────────────────────────────────────────────────────
COUNTRIES       = ['US', 'UK', 'IN', 'DE', 'FR', 'AU', 'CA', 'JP']
RISKY_COUNTRIES = ['CN', 'RU', 'NG', 'KP', 'IR']
DEVICES         = ['Chrome/Windows', 'Safari/Mac', 'Firefox/Linux', 'Mobile/Android', 'Mobile/iOS']

def classify_attack(features, prediction):
    if prediction == 0:
        return 'None'
    fa       = features['failed_attempts']
    freq_dev = features['login_frequency_deviation']
    vpn      = features['vpn_proxy']
    new_dev  = features['is_new_device']
    time_gap = features['time_since_last_login_hours']
    ip_rep   = features['ip_reputation']

    # Score each attack type — highest score wins
    scores = {
        'Brute Force':         fa * 2.5,
        'Credential Stuffing': freq_dev * 1.5 + vpn * 4 + ip_rep * 2,
        'Account Takeover':    new_dev * 5 + min(time_gap, 500) / 80,
        'Anomalous Login':     features['country_risk'] * 1.2 + (1 - ip_rep) * 2,
    }
    return max(scores, key=scores.get)

def risk_label(score):
    if score < 0.3:
        return 'SAFE'
    elif score < 0.6:
        return 'SUSPICIOUS'
    else:
        return 'BLOCKED'

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()
    features = {
        'hour_of_day':                  int(data.get('hour_of_day', datetime.now().hour)),
        'day_of_week':                  int(data.get('day_of_week', datetime.now().weekday())),
        'failed_attempts':              int(data.get('failed_attempts', 0)),
        'country_risk':                 float(data.get('country_risk', 1.0)),
        'is_new_device':                int(data.get('is_new_device', 0)),
        'is_new_ip':                    int(data.get('is_new_ip', 0)),
        'ip_reputation':                float(data.get('ip_reputation', 0.1)),
        'session_duration_prev':        float(data.get('session_duration_prev', 600)),
        'login_frequency_deviation':    float(data.get('login_frequency_deviation', 0.5)),
        'time_since_last_login_hours':  float(data.get('time_since_last_login_hours', 24)),
        'vpn_proxy':                    int(data.get('vpn_proxy', 0)),
    }
    X        = pd.DataFrame([features], columns=FEATURES)
    X_scaled = SCALER.transform(X)
    prediction  = int(MODEL.predict(X_scaled)[0])
    proba       = MODEL.predict_proba(X_scaled)[0]
    risk_score  = float(proba[1])
    label       = risk_label(risk_score)
    attack      = classify_attack(features, prediction)

    conn = get_db()
    conn.execute('''
        INSERT INTO login_events (
            timestamp, username, ip_address, country, device,
            hour_of_day, day_of_week, failed_attempts, country_risk,
            is_new_device, is_new_ip, ip_reputation, session_duration_prev,
            login_frequency_deviation, time_since_last_login_hours, vpn_proxy,
            risk_score, prediction, attack_type
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (
        datetime.utcnow().isoformat(),
        data.get('username', 'unknown'), data.get('ip_address', '0.0.0.0'),
        data.get('country', 'Unknown'),  data.get('device', 'Unknown'),
        features['hour_of_day'], features['day_of_week'], features['failed_attempts'],
        features['country_risk'], features['is_new_device'], features['is_new_ip'],
        features['ip_reputation'], features['session_duration_prev'],
        features['login_frequency_deviation'], features['time_since_last_login_hours'],
        features['vpn_proxy'], risk_score, label, attack
    ))
    conn.commit()
    conn.close()

    return jsonify({
        'prediction':       label,
        'risk_score':       round(risk_score, 4),
        'attack_type':      attack,
        'features_used':    features,
        'model_confidence': round(float(max(proba)), 4),
    })


@app.route('/api/events', methods=['GET'])
def get_events():
    limit = request.args.get('limit', 60)
    conn  = get_db()
    rows  = conn.execute('SELECT * FROM login_events ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    total      = conn.execute('SELECT COUNT(*) FROM login_events').fetchone()[0]
    suspicious = conn.execute("SELECT COUNT(*) FROM login_events WHERE prediction != 'SAFE'").fetchone()[0]
    blocked    = conn.execute("SELECT COUNT(*) FROM login_events WHERE prediction = 'BLOCKED'").fetchone()[0]
    safe       = conn.execute("SELECT COUNT(*) FROM login_events WHERE prediction = 'SAFE'").fetchone()[0]

    attack_rows  = conn.execute("SELECT attack_type, COUNT(*) as count FROM login_events WHERE attack_type != 'None' GROUP BY attack_type").fetchall()
    attack_dist  = [{'type': r['attack_type'], 'count': r['count']} for r in attack_rows]

    hourly       = conn.execute("SELECT hour_of_day, COUNT(*) as count FROM login_events GROUP BY hour_of_day ORDER BY hour_of_day").fetchall()
    hourly_data  = [{'hour': r['hour_of_day'], 'count': r['count']} for r in hourly]

    countries    = conn.execute("SELECT country, COUNT(*) as count FROM login_events WHERE prediction != 'SAFE' GROUP BY country ORDER BY count DESC LIMIT 5").fetchall()
    country_data = [{'country': r['country'], 'count': r['count']} for r in countries]

    trend        = conn.execute('SELECT timestamp, risk_score, prediction FROM login_events ORDER BY id DESC LIMIT 20').fetchall()
    trend_data   = [{'time': r['timestamp'][:16], 'score': r['risk_score'], 'label': r['prediction']} for r in reversed(list(trend))]

    conn.close()
    return jsonify({
        'total':                  total,
        'suspicious':             suspicious,
        'blocked':                blocked,
        'safe':                   safe,
        'detection_rate':         round(suspicious / total * 100, 1) if total > 0 else 0,
        'attack_distribution':    attack_dist,
        'hourly_activity':        hourly_data,
        'top_flagged_countries':  country_data,
        'risk_trend':             trend_data,
    })


@app.route('/api/reset', methods=['POST', 'OPTIONS'])
def reset():
    """Wipe all login events and reset the auto-increment counter"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    try:
        conn = get_db()
        conn.execute('DELETE FROM login_events')
        try:
            conn.execute('DELETE FROM sqlite_sequence WHERE name="login_events"')
        except Exception:
            pass
        conn.commit()
        conn.close()
        return jsonify({'status': 'ok', 'message': 'All logs cleared'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/simulate', methods=['POST'])
def simulate():
    count = int(request.get_json().get('count', 20))
    generated = []

    # Attack type profiles — each generates features that score highest for that type
    ATTACK_PROFILES = {
        'Brute Force': lambda: {
            'hour_of_day': random.randint(0, 4),
            'day_of_week': random.randint(0, 6),
            'failed_attempts': random.randint(8, 20),
            'country_risk': random.uniform(3, 5),
            'is_new_device': random.choice([0, 1]),
            'is_new_ip': 1,
            'ip_reputation': random.uniform(0.6, 1.0),
            'session_duration_prev': random.uniform(0, 60),
            'login_frequency_deviation': random.uniform(1, 3),
            'time_since_last_login_hours': random.uniform(0.01, 1),
            'vpn_proxy': random.choice([0, 1]),
        },
        'Credential Stuffing': lambda: {
            'hour_of_day': random.randint(1, 6),
            'day_of_week': random.randint(0, 6),
            'failed_attempts': random.randint(0, 2),
            'country_risk': random.uniform(2, 4),
            'is_new_device': 1,
            'is_new_ip': 1,
            'ip_reputation': random.uniform(0.55, 0.85),
            'session_duration_prev': random.uniform(5, 80),
            'login_frequency_deviation': random.uniform(6, 14),
            'time_since_last_login_hours': random.uniform(0.05, 2),
            'vpn_proxy': 1,
        },
        'Account Takeover': lambda: {
            'hour_of_day': random.randint(0, 5),
            'day_of_week': random.randint(0, 6),
            'failed_attempts': random.randint(0, 3),
            'country_risk': random.uniform(2, 4.5),
            'is_new_device': 1,
            'is_new_ip': 1,
            'ip_reputation': random.uniform(0.3, 0.65),
            'session_duration_prev': random.uniform(10, 120),
            'login_frequency_deviation': random.uniform(2, 6),
            'time_since_last_login_hours': random.uniform(250, 700),
            'vpn_proxy': random.choice([0, 1]),
        },
        'Anomalous Login': lambda: {
            'hour_of_day': random.randint(0, 6),
            'day_of_week': random.randint(0, 6),
            'failed_attempts': random.randint(0, 2),
            'country_risk': random.uniform(4, 5),
            'is_new_device': random.choice([0, 1]),
            'is_new_ip': random.choice([0, 1]),
            'ip_reputation': random.uniform(0.1, 0.4),
            'session_duration_prev': random.uniform(50, 300),
            'login_frequency_deviation': random.uniform(1, 4),
            'time_since_last_login_hours': random.uniform(1, 48),
            'vpn_proxy': random.choice([0, 1]),
        },
    }
    ATTACK_TYPES = list(ATTACK_PROFILES.keys())

    for _ in range(count):
        is_attack = random.random() < 0.35   # slightly more attacks for better variety
        country   = random.choice(RISKY_COUNTRIES if is_attack else COUNTRIES)

        if is_attack:
            attack_type = random.choice(ATTACK_TYPES)
            features = ATTACK_PROFILES[attack_type]()
            features['day_of_week'] = random.randint(0, 6)
        else:
            features = {
                'hour_of_day': random.randint(8, 21),
                'day_of_week': random.randint(0, 6),
                'failed_attempts': random.randint(0, 1),
                'country_risk': random.uniform(1, 2),
                'is_new_device': random.choice([0, 0, 0, 1]),
                'is_new_ip': random.choice([0, 0, 1]),
                'ip_reputation': random.uniform(0, 0.25),
                'session_duration_prev': random.uniform(300, 3600),
                'login_frequency_deviation': random.uniform(0, 1.2),
                'time_since_last_login_hours': random.uniform(2, 72),
                'vpn_proxy': random.choice([0, 0, 0, 1]),
            }
        features['country_risk'] = random.uniform(3, 5) if country in RISKY_COUNTRIES else features.get('country_risk', random.uniform(1,2))

        X        = pd.DataFrame([features], columns=FEATURES)
        X_scaled = SCALER.transform(X)
        prediction  = int(MODEL.predict(X_scaled)[0])
        proba       = MODEL.predict_proba(X_scaled)[0]
        risk_score  = float(proba[1])
        label       = risk_label(risk_score)
        attack      = classify_attack(features, prediction)

        username   = f"user_{random.randint(1000, 9999)}"
        ip_address = f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(0,255)}"
        device     = random.choice(DEVICES)

        conn = get_db()
        conn.execute('''
            INSERT INTO login_events (
                timestamp, username, ip_address, country, device,
                hour_of_day, day_of_week, failed_attempts, country_risk,
                is_new_device, is_new_ip, ip_reputation, session_duration_prev,
                login_frequency_deviation, time_since_last_login_hours, vpn_proxy,
                risk_score, prediction, attack_type
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            datetime.utcnow().isoformat(), username, ip_address, country, device,
            features['hour_of_day'], features['day_of_week'], features['failed_attempts'],
            features['country_risk'], features['is_new_device'], features['is_new_ip'],
            features['ip_reputation'], features['session_duration_prev'],
            features['login_frequency_deviation'], features['time_since_last_login_hours'],
            features['vpn_proxy'], risk_score, label, attack
        ))
        conn.commit()
        conn.close()
        generated.append({'username': username, 'prediction': label, 'attack': attack})

    return jsonify({'generated': count, 'results': generated})


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'RandomForest', 'features': len(FEATURES)})


if __name__ == '__main__':
    print("🚀 Suspicious Login Detection API → http://localhost:5000")
    app.run(debug=True, port=5000)