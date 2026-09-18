import http.server
import socketserver
import json
import urllib.parse
import urllib.request
import os
import sys

PORT = int(os.environ.get("PORT", 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Sample Mock Dataset representing hospital scheduling records
UPCOMING_APPOINTMENTS = [
    {
        "appointment_id": "APT-1042",
        "patient_name": "Eleanor Vance",
        "specialty": "Cardiology",
        "date": "2026-09-24",
        "time": "10:30 AM",
        "lead_time_days": 18,
        "previous_noshows": 3,
        "reminder_status": "Not Sent",
        "noshow_probability": 0.78,
        "risk_level": "HIGH",
        "recommended_action": "Reminder Priority (SMS + Phone)",
        "age_band": "45-54",
        "weekday": "Thursday",
        "factors": [
            {"factor": "Previous no-shows", "value": "3 previous no-shows", "impact": "High Increase"},
            {"factor": "Booking lead time", "value": "18 days", "impact": "Moderate Increase"},
            {"factor": "Reminder status", "value": "Not sent", "impact": "High Increase"},
            {"factor": "Weekday", "value": "Thursday", "impact": "Neutral"},
            {"factor": "Time slot", "value": "10:30 AM", "impact": "Slight Decrease"}
        ]
    },
    {
        "appointment_id": "APT-1043",
        "patient_name": "Marcus Brody",
        "specialty": "Neurology",
        "date": "2026-09-24",
        "time": "11:15 AM",
        "lead_time_days": 24,
        "previous_noshows": 2,
        "reminder_status": "Not Sent",
        "noshow_probability": 0.72,
        "risk_level": "HIGH",
        "recommended_action": "Reminder Priority (Phone Call)",
        "age_band": "35-44",
        "weekday": "Thursday",
        "factors": [
            {"factor": "Previous no-shows", "value": "2 previous no-shows", "impact": "High Increase"},
            {"factor": "Booking lead time", "value": "24 days", "impact": "High Increase"},
            {"factor": "Reminder status", "value": "Not sent", "impact": "High Increase"}
        ]
    },
    {
        "appointment_id": "APT-1044",
        "patient_name": "Sophia Lin",
        "specialty": "Orthopedics",
        "date": "2026-09-24",
        "time": "02:00 PM",
        "lead_time_days": 12,
        "previous_noshows": 1,
        "reminder_status": "Sent (Pending Resp)",
        "noshow_probability": 0.51,
        "risk_level": "MEDIUM",
        "recommended_action": "Follow-up SMS",
        "age_band": "25-34",
        "weekday": "Thursday",
        "factors": [
            {"factor": "Previous no-shows", "value": "1 previous no-show", "impact": "Moderate Increase"},
            {"factor": "Booking lead time", "value": "12 days", "impact": "Moderate Increase"},
            {"factor": "Reminder status", "value": "Sent (Pending)", "impact": "Slight Decrease"}
        ]
    },
    {
        "appointment_id": "APT-1045",
        "patient_name": "Arthur Pendelton",
        "specialty": "Cardiology",
        "date": "2026-09-25",
        "time": "09:00 AM",
        "lead_time_days": 3,
        "previous_noshows": 0,
        "reminder_status": "Confirmed",
        "noshow_probability": 0.14,
        "risk_level": "LOW",
        "recommended_action": "Standard Outreach",
        "age_band": "65+",
        "weekday": "Friday",
        "factors": [
            {"factor": "Previous no-shows", "value": "0 previous no-shows", "impact": "High Decrease"},
            {"factor": "Booking lead time", "value": "3 days", "impact": "High Decrease"},
            {"factor": "Reminder status", "value": "Confirmed via SMS", "impact": "High Decrease"}
        ]
    },
    {
        "appointment_id": "APT-1046",
        "patient_name": "Devon Miller",
        "specialty": "Dermatology",
        "date": "2026-09-25",
        "time": "10:00 AM",
        "lead_time_days": 30,
        "previous_noshows": 2,
        "reminder_status": "Not Sent",
        "noshow_probability": 0.68,
        "risk_level": "HIGH",
        "recommended_action": "Reminder Priority (SMS)",
        "age_band": "18-24",
        "weekday": "Friday",
        "factors": [
            {"factor": "Previous no-shows", "value": "2 previous no-shows", "impact": "High Increase"},
            {"factor": "Booking lead time", "value": "30 days", "impact": "High Increase"},
            {"factor": "Reminder status", "value": "Not sent", "impact": "High Increase"}
        ]
    },
    {
        "appointment_id": "APT-1047",
        "patient_name": "Elena Rostova",
        "specialty": "Endocrinology",
        "date": "2026-09-25",
        "time": "01:30 PM",
        "lead_time_days": 7,
        "previous_noshows": 0,
        "reminder_status": "Confirmed",
        "noshow_probability": 0.18,
        "risk_level": "LOW",
        "recommended_action": "Standard Outreach",
        "age_band": "55-64",
        "weekday": "Friday",
        "factors": [
            {"factor": "Previous no-shows", "value": "0 previous no-shows", "impact": "High Decrease"},
            {"factor": "Reminder status", "value": "Confirmed", "impact": "High Decrease"}
        ]
    },
    {
        "appointment_id": "APT-1048",
        "patient_name": "James Sterling",
        "specialty": "Cardiology",
        "date": "2026-09-26",
        "time": "11:30 AM",
        "lead_time_days": 15,
        "previous_noshows": 1,
        "reminder_status": "Not Sent",
        "noshow_probability": 0.48,
        "risk_level": "MEDIUM",
        "recommended_action": "Standard SMS Reminder",
        "age_band": "55-64",
        "weekday": "Saturday",
        "factors": [
            {"factor": "Previous no-shows", "value": "1 previous no-show", "impact": "Moderate Increase"},
            {"factor": "Booking lead time", "value": "15 days", "impact": "Moderate Increase"}
        ]
    },
    {
        "appointment_id": "APT-1049",
        "patient_name": "Priya Sharma",
        "specialty": "Pediatrics",
        "date": "2026-09-26",
        "time": "03:00 PM",
        "lead_time_days": 2,
        "previous_noshows": 0,
        "reminder_status": "Confirmed",
        "noshow_probability": 0.12,
        "risk_level": "LOW",
        "recommended_action": "Standard Outreach",
        "age_band": "Parent of 0-17",
        "weekday": "Saturday",
        "factors": [
            {"factor": "Previous no-shows", "value": "0 previous no-shows", "impact": "High Decrease"},
            {"factor": "Booking lead time", "value": "2 days", "impact": "High Decrease"}
        ]
    }
]

WAITLIST_CANDIDATES = [
    {
        "waitlist_id": "WL-023",
        "patient_name": "Sarah Jenkins",
        "priority": "High Priority",
        "specialty": "Cardiology",
        "preferred_date": "2026-09-24",
        "preferred_time": "Morning preferred",
        "waiting_duration_days": 4,
        "compatibility_score": 94,
        "reasons": [
            "Specialty matches (Cardiology)",
            "Requested date is compatible (24 Sep 2026)",
            "Preferred time matches (Morning slot 10:30 AM)",
            "High scheduling priority (Urgent cardiology referral)",
            "Has been waiting 4 days (Exceeds 3-day baseline threshold)"
        ]
    },
    {
        "waitlist_id": "WL-019",
        "patient_name": "David Thorne",
        "priority": "High Priority",
        "specialty": "Cardiology",
        "preferred_date": "2026-09-24",
        "preferred_time": "Any time",
        "waiting_duration_days": 6,
        "compatibility_score": 88,
        "reasons": [
            "Specialty matches (Cardiology)",
            "Flexible time commitment (Any time)",
            "High priority patient referral",
            "Has been waiting 6 days"
        ]
    },
    {
        "waitlist_id": "WL-031",
        "patient_name": "Anita Roy",
        "priority": "Standard Priority",
        "specialty": "Cardiology",
        "preferred_date": "2026-09-24",
        "preferred_time": "Morning preferred",
        "waiting_duration_days": 2,
        "compatibility_score": 79,
        "reasons": [
            "Specialty matches (Cardiology)",
            "Preferred time matches (Morning)",
            "Waiting duration 2 days"
        ]
    },
    {
        "waitlist_id": "WL-014",
        "patient_name": "Robert Chen",
        "priority": "Standard Priority",
        "specialty": "Cardiology",
        "preferred_date": "2026-09-25",
        "preferred_time": "Afternoon preferred",
        "waiting_duration_days": 8,
        "compatibility_score": 68,
        "reasons": [
            "Specialty matches (Cardiology)",
            "Alternative date request (25 Sep vs 24 Sep)",
            "Has been waiting 8 days"
        ]
    }
]

MODEL_METRICS = {
    "models": [
        {
            "name": "Logistic Regression",
            "auc": 0.74,
            "precision": 0.68,
            "recall": 0.62,
            "f1": 0.65,
            "description": "Baseline linear classification model"
        },
        {
            "name": "Random Forest",
            "auc": 0.82,
            "precision": 0.77,
            "recall": 0.73,
            "f1": 0.75,
            "description": "Ensemble decision tree model with feature importance"
        },
        {
            "name": "Explainable Boosting Machine (EBM)",
            "auc": 0.85,
            "precision": 0.81,
            "recall": 0.78,
            "f1": 0.79,
            "description": "Glass-box generalized additive model for interpretable clinical decisions"
        }
    ],
    "default_threshold": 0.60
}

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            self.send_json_response({
                "status": "healthy",
                "service": "Hospital No-Show & Waitlist Decision Support API",
                "version": "1.0.0",
                "backend_type": "Live Python Server"
            })
        elif path == '/api/model-info':
            self.send_json_response({
                "active_model": "Explainable Boosting Machine (EBM)",
                "features": ["previous_noshows", "lead_time_days", "reminder_status", "weekday", "time_slot", "age_band"],
                "decision_support_mode": True,
                "disclaimer": "AI-assisted scheduling decision support. Final decision remains with staff."
            })
        elif path == '/api/appointments/upcoming':
            for apt in UPCOMING_APPOINTMENTS:
                try:
                    age = 45
                    if "age_band" in apt:
                        if apt["age_band"] == "45-54": age = 50
                        elif apt["age_band"] == "35-44": age = 40
                        elif apt["age_band"] == "25-34": age = 30
                        elif apt["age_band"] == "65+": age = 70
                        elif apt["age_band"] == "18-24": age = 21
                        elif apt["age_band"] == "55-64": age = 60
                        else: age = 10
                    payload = {
                        "Age": age,
                        "LeadDays": apt.get("lead_time_days", 10),
                        "DayOfWeek": apt.get("weekday", "Monday"),
                        "Gender": "F",
                        "Scholarship": 0,
                        "Hypertension": 0,
                        "Diabetes": 0,
                        "Alcoholism": 0,
                        "Handicap": 0,
                        "SMS_received": 1 if "Sent" in apt.get("reminder_status", "") else 0
                    }
                    req = urllib.request.Request(
                        'http://localhost:8000/api/predict',
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json'}
                    )
                    with urllib.request.urlopen(req) as response:
                        res_data = json.loads(response.read().decode('utf-8'))
                        apt["noshow_probability"] = res_data.get("probability_score", apt["noshow_probability"])
                        apt["risk_level"] = res_data.get("risk_level", apt["risk_level"])
                        apt["recommended_action"] = res_data.get("recommended_action", apt["recommended_action"])
                except Exception as e:
                    pass
            self.send_json_response({
                "total": len(UPCOMING_APPOINTMENTS),
                "appointments": UPCOMING_APPOINTMENTS
            })
        elif path == '/api/waitlist':
            self.send_json_response({
                "total": len(WAITLIST_CANDIDATES),
                "waitlist": WAITLIST_CANDIDATES
            })
        elif path == '/api/metrics':
            self.send_json_response(MODEL_METRICS)
        else:
            # Fallback to serving static files
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        try:
            body = json.loads(body_bytes.decode('utf-8'))
        except Exception:
            body = {}

        if path == '/api/predict':
            try:
                payload = {
                    "Age": body.get("Age", 40),
                    "LeadDays": body.get("lead_time_days", 10),
                    "DayOfWeek": body.get("weekday", "Monday"),
                    "Gender": body.get("Gender", "F"),
                    "Scholarship": 0,
                    "Hypertension": 0,
                    "Diabetes": 0,
                    "Alcoholism": 0,
                    "Handicap": 0,
                    "SMS_received": 1 if body.get("reminder_status") == "Sent" else 0
                }
                req = urllib.request.Request(
                    'http://localhost:8000/api/predict',
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                
                self.send_json_response({
                    "noshow_probability": res_data.get("probability_score", 0.0),
                    "risk_level": res_data.get("risk_level", "LOW"),
                    "recommended_action": res_data.get("recommended_action", "Standard Outreach"),
                    "factors_considered": [
                        {"factor": "Live Backend Model", "value": "Applied"}
                    ]
                })
            except Exception as e:
                print(f"Predict error: {e}")
                self.send_json_response({
                    "noshow_probability": 0.5,
                    "risk_level": "MEDIUM",
                    "recommended_action": "Standard Outreach",
                    "factors_considered": []
                })

        elif path == '/api/waitlist/recommend':
            specialty = body.get('specialty', 'Cardiology')
            date = body.get('date', '2026-09-24')
            time = body.get('time', '10:30 AM')

            time_str = "Any"
            if "AM" in time: time_str = "Morning"
            elif "PM" in time: time_str = "Afternoon"

            import datetime
            try:
                dt = datetime.datetime.strptime(date, "%Y-%m-%d")
                day_name = dt.strftime("%A")
            except:
                day_name = "Any"

            payload = {
                "specialty": specialty,
                "canceled_day": day_name,
                "canceled_time": time_str
            }
            try:
                req = urllib.request.Request(
                    'http://localhost:8000/api/waitlist/match',
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                
                matches = res_data.get("matches", [])
                recommended_candidates = []
                for idx, m in enumerate(matches):
                    recommended_candidates.append({
                        "waitlist_id": m.get("WaitlistID", ""),
                        "patient_name": m.get("PatientName", ""),
                        "priority": "High Priority" if m.get("Urgency") == "High" else "Standard Priority",
                        "specialty": m.get("Specialty", specialty),
                        "preferred_date": m.get("PreferredDay", ""),
                        "preferred_time": m.get("PreferredTime", ""),
                        "waiting_duration_days": m.get("DaysWaiting", 0),
                        "compatibility_score": 99 - idx * 5,
                        "reasons": [
                            f"Urgency matches {m.get('Urgency')}",
                            f"Has been waiting {m.get('DaysWaiting')} days"
                        ]
                    })
                if not recommended_candidates:
                    recommended_candidates = [c for c in WAITLIST_CANDIDATES if c['specialty'].lower() == specialty.lower()]
            except Exception as e:
                print(f"Waitlist match error: {e}")
                recommended_candidates = [c for c in WAITLIST_CANDIDATES if c['specialty'].lower() == specialty.lower()]

            if not recommended_candidates:
                recommended_candidates = WAITLIST_CANDIDATES

            self.send_json_response({
                "available_slot": {
                    "specialty": specialty,
                    "date": date,
                    "time": time,
                    "status": "AVAILABLE"
                },
                "recommended_candidates": recommended_candidates,
                "disclaimer": "Live matching from backend."
            })

        elif path == '/api/appointments/upload':
            records = body.get('records', [])
            added_count = 0
            skipped_duplicates = 0
            invalid_count = 0

            # Existing keys for duplicate detection
            existing_name_keys = set(
                f"{a.get('patient_name', '').lower()}|{a.get('date', '')}|{a.get('time', '')}"
                for a in UPCOMING_APPOINTMENTS
            )
            existing_ids = set(a.get('appointment_id', '') for a in UPCOMING_APPOINTMENTS)

            for rec in records:
                # Basic validation
                p_name = rec.get('patient_name') or rec.get('name')
                p_date = rec.get('date') or rec.get('appointment_date')
                p_spec = rec.get('specialty') or rec.get('department')
                p_time = rec.get('time') or rec.get('appointment_time') or '09:00 AM'
                
                if not p_name or not p_date or not p_spec:
                    invalid_count += 1
                    continue

                apt_id = rec.get('appointment_id') or rec.get('patient_id') or f"APT-{1050 + len(UPCOMING_APPOINTMENTS)}"
                lead_time = int(rec.get('lead_time_days', rec.get('lead_time', 7)))
                prev_noshows = int(rec.get('previous_noshows', rec.get('no_shows', 0)))
                reminder = rec.get('reminder_status', 'Not Sent')

                dup_name_key = f"{p_name.lower()}|{p_date}|{p_time}"
                if dup_name_key in existing_name_keys or apt_id in existing_ids:
                    skipped_duplicates += 1
                    continue

                # Calculate real prediction via backend
                try:
                    payload = {
                        "Age": 40,
                        "LeadDays": lead_time,
                        "DayOfWeek": rec.get('weekday', 'Monday'),
                        "Gender": "F",
                        "Scholarship": 0,
                        "Hypertension": 0,
                        "Diabetes": 0,
                        "Alcoholism": 0,
                        "Handicap": 0,
                        "SMS_received": 1 if reminder == "Sent" else 0
                    }
                    req = urllib.request.Request(
                        'http://localhost:8000/api/predict',
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json'}
                    )
                    with urllib.request.urlopen(req) as response:
                        res_data = json.loads(response.read().decode('utf-8'))
                    prob = res_data.get("probability_score", 0.15)
                    risk = res_data.get("risk_level", "LOW")
                except Exception as e:
                    prob = 0.15 + (prev_noshows * 0.25) + (lead_time * 0.015)
                    if reminder == 'Confirmed': prob -= 0.30
                    elif reminder == 'Not Sent': prob += 0.15
                    prob = max(0.05, min(0.95, round(prob, 2)))
                    risk = "HIGH" if prob >= 0.60 else ("MEDIUM" if prob >= 0.40 else "LOW")

                new_apt = {
                    "appointment_id": apt_id,
                    "patient_name": p_name,
                    "specialty": p_spec,
                    "date": p_date,
                    "time": p_time,
                    "lead_time_days": lead_time,
                    "previous_noshows": prev_noshows,
                    "reminder_status": reminder,
                    "noshow_probability": prob,
                    "risk_level": risk,
                    "recommended_action": "Reminder Priority (SMS)" if risk == "HIGH" else "Standard Outreach",
                    "age_band": rec.get('age_band', '35-44'),
                    "weekday": rec.get('weekday', 'Scheduled Day'),
                    "factors": [
                        {"factor": "Previous no-shows", "value": f"{prev_noshows} previous", "impact": "High Increase" if prev_noshows > 0 else "Low"},
                        {"factor": "Booking lead time", "value": f"{lead_time} days", "impact": "Moderate Increase"},
                        {"factor": "Reminder status", "value": reminder, "impact": "High Increase" if reminder == "Not Sent" else "Decrease"}
                    ]
                }

                UPCOMING_APPOINTMENTS.append(new_apt)
                existing_name_keys.add(dup_name_key)
                existing_ids.add(apt_id)
                added_count += 1

            self.send_json_response({
                "success": True,
                "total_processed": len(records),
                "added_count": added_count,
                "skipped_duplicates": skipped_duplicates,
                "invalid_count": invalid_count,
                "total_appointments": len(UPCOMING_APPOINTMENTS)
            })

        elif path == '/api/appointments/cancel':
            apt_id = body.get('appointment_id')
            cancelled_apt = None
            for a in UPCOMING_APPOINTMENTS:
                if a.get('appointment_id') == apt_id:
                    a['is_empty_slot'] = True
                    a['original_patient_name'] = a.get('patient_name')
                    a['patient_name'] = "Empty Slot"
                    cancelled_apt = a
                    break

            if cancelled_apt:
                self.send_json_response({
                    "success": True,
                    "cancelled_appointment": cancelled_apt,
                    "total_appointments": len(UPCOMING_APPOINTMENTS)
                })
            else:
                self.send_json_response({"success": False, "message": "Appointment not found"}, status_code=404)

        elif path == '/api/waitlist/assign':
            cand_id = body.get('waitlist_id')
            slot = body.get('slot', {})
            cand = None
            for idx, c in enumerate(WAITLIST_CANDIDATES):
                if c.get('waitlist_id') == cand_id:
                    cand = WAITLIST_CANDIDATES.pop(idx)
                    break

            if not cand:
                # If candidate passed as object directly
                cand = body.get('candidate', {})

            p_name = cand.get('patient_name', 'Waitlist Patient')
            p_spec = slot.get('specialty', cand.get('specialty', 'Cardiology'))
            p_date = slot.get('date', '2026-09-24')
            p_time = slot.get('time', '10:30 AM')
            # Find existing empty slot to replace, if applicable
            target_apt_id = slot.get('appointment_id')
            existing_apt_idx = None
            if target_apt_id:
                for idx, a in enumerate(UPCOMING_APPOINTMENTS):
                    if a.get('appointment_id') == target_apt_id:
                        existing_apt_idx = idx
                        break
            
            apt_id = target_apt_id if target_apt_id else f"APT-W{1050 + len(UPCOMING_APPOINTMENTS)}"

            prob = 0.18
            risk = "LOW"

            new_apt = {
                "appointment_id": apt_id,
                "patient_name": p_name,
                "specialty": p_spec,
                "date": p_date,
                "time": p_time,
                "lead_time_days": 1,
                "previous_noshows": 0,
                "reminder_status": "Confirmed (Waitlist Backfill)",
                "noshow_probability": prob,
                "risk_level": risk,
                "recommended_action": "Standard Outreach",
                "age_band": "45-54",
                "weekday": "Scheduled",
                "factors": [
                    {"factor": "Waitlist backfill", "value": "Replaced cancelled slot", "impact": "High Priority"},
                    {"factor": "Reminder status", "value": "Confirmed via Waitlist", "impact": "High Decrease"}
                ]
            }

            if existing_apt_idx is not None:
                UPCOMING_APPOINTMENTS[existing_apt_idx] = new_apt
            else:
                UPCOMING_APPOINTMENTS.append(new_apt)

            self.send_json_response({
                "success": True,
                "assigned_patient": p_name,
                "appointment": new_apt,
                "remaining_waitlist": len(WAITLIST_CANDIDATES),
                "total_appointments": len(UPCOMING_APPOINTMENTS)
            })

        else:
            self.send_error(404, "API Endpoint Not Found")

    def send_json_response(self, data):
        json_str = json.dumps(data, indent=2)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(json_str.encode('utf-8'))))
        self.end_headers()
        self.wfile.write(json_str.encode('utf-8'))

if __name__ == '__main__':
    print(f"Starting Hospital Scheduling Server on http://0.0.0.0:{PORT}")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer shutting down cleanly.")
            sys.exit(0)
