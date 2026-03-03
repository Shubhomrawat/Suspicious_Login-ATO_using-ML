"""
Train a suspicious login detection model using synthetic data.
Run this once to generate model.pkl
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle
import random
from datetime import datetime, timedelta

np.random.seed(42)
random.seed(42)

# ─── Generate Synthetic Login Data ────────────────────────────────────────────

def generate_login_data(n_normal=5000, n_suspicious=500):
    records = []

    countries = ['US', 'UK', 'IN', 'DE', 'FR', 'CN', 'RU', 'BR', 'NG', 'KP']
    devices = ['Chrome/Windows', 'Safari/Mac', 'Firefox/Linux', 'Mobile/Android', 'Mobile/iOS']
    normal_hours = list(range(8, 22))   # typical login hours
    suspicious_hours = list(range(0, 6))  # off-hours

    # Normal logins
    for _ in range(n_normal):
        records.append({
            'hour_of_day': random.choice(normal_hours),
            'day_of_week': random.randint(0, 6),
            'failed_attempts': random.choices([0, 1, 2, 3], weights=[70, 20, 7, 3])[0],
            'country_risk': 1 if random.choice(countries[:5]) else 3,
            'is_new_device': random.choices([0, 1], weights=[85, 15])[0],
            'is_new_ip': random.choices([0, 1], weights=[80, 20])[0],
            'ip_reputation': random.uniform(0.0, 0.3),  # low risk
            'session_duration_prev': random.uniform(300, 3600),
            'login_frequency_deviation': random.uniform(0, 1.5),
            'time_since_last_login_hours': random.uniform(1, 48),
            'vpn_proxy': random.choices([0, 1], weights=[95, 5])[0],
            'label': 0  # normal
        })

    # Suspicious logins
    for _ in range(n_suspicious):
        attack_type = random.choice(['brute_force', 'credential_stuffing', 'ato', 'anomalous'])

        if attack_type == 'brute_force':
            rec = {
                'hour_of_day': random.choice(suspicious_hours),
                'day_of_week': random.randint(0, 6),
                'failed_attempts': random.randint(5, 20),
                'country_risk': random.uniform(2, 5),
                'is_new_device': 1,
                'is_new_ip': 1,
                'ip_reputation': random.uniform(0.6, 1.0),
                'session_duration_prev': random.uniform(0, 60),
                'login_frequency_deviation': random.uniform(3, 10),
                'time_since_last_login_hours': random.uniform(0.01, 0.5),
                'vpn_proxy': random.choices([0, 1], weights=[30, 70])[0],
                'label': 1
            }
        elif attack_type == 'credential_stuffing':
            rec = {
                'hour_of_day': random.randint(0, 23),
                'day_of_week': random.randint(0, 6),
                'failed_attempts': random.randint(1, 3),
                'country_risk': random.uniform(2, 5),
                'is_new_device': 1,
                'is_new_ip': 1,
                'ip_reputation': random.uniform(0.5, 0.9),
                'session_duration_prev': 0,
                'login_frequency_deviation': random.uniform(5, 15),
                'time_since_last_login_hours': random.uniform(0.01, 0.2),
                'vpn_proxy': 1,
                'label': 1
            }
        elif attack_type == 'ato':
            rec = {
                'hour_of_day': random.choice(suspicious_hours),
                'day_of_week': random.randint(0, 6),
                'failed_attempts': random.randint(0, 2),
                'country_risk': random.uniform(3, 5),
                'is_new_device': 1,
                'is_new_ip': 1,
                'ip_reputation': random.uniform(0.4, 0.8),
                'session_duration_prev': random.uniform(0, 120),
                'login_frequency_deviation': random.uniform(4, 12),
                'time_since_last_login_hours': random.uniform(200, 1000),
                'vpn_proxy': random.choices([0, 1], weights=[40, 60])[0],
                'label': 1
            }
        else:  # anomalous
            rec = {
                'hour_of_day': random.choice(suspicious_hours),
                'day_of_week': random.randint(0, 6),
                'failed_attempts': random.randint(2, 8),
                'country_risk': random.uniform(2, 5),
                'is_new_device': random.randint(0, 1),
                'is_new_ip': 1,
                'ip_reputation': random.uniform(0.4, 1.0),
                'session_duration_prev': random.uniform(0, 200),
                'login_frequency_deviation': random.uniform(2, 8),
                'time_since_last_login_hours': random.uniform(0.01, 1),
                'vpn_proxy': random.randint(0, 1),
                'label': 1
            }
        records.append(rec)

    df = pd.DataFrame(records)
    return df.sample(frac=1).reset_index(drop=True)

# ─── Train ─────────────────────────────────────────────────────────────────────

df = generate_login_data()
print(f"Dataset: {len(df)} records | Suspicious: {df['label'].sum()} | Normal: {(df['label']==0).sum()}")

FEATURES = [
    'hour_of_day', 'day_of_week', 'failed_attempts', 'country_risk',
    'is_new_device', 'is_new_ip', 'ip_reputation', 'session_duration_prev',
    'login_frequency_deviation', 'time_since_last_login_hours', 'vpn_proxy'
]

X = df[FEATURES]
y = df['label']

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y)

model = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42, class_weight='balanced')
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=['Normal', 'Suspicious']))

# ─── Save ──────────────────────────────────────────────────────────────────────

with open('model.pkl', 'wb') as f:
    pickle.dump({'model': model, 'scaler': scaler, 'features': FEATURES}, f)

print("\n✅ model.pkl saved successfully!")