"""
Campus Operational Telemetry & Synthetic Data Generator
-------------------------------------------------------
Generates high-fidelity historical data simulating campus IoT sensors:
- WiFi probe density logs
- Automated turnstile headcounts
- Classroom lecture schedules
- Cafeteria point-of-sale traffic
- Shuttle station wait times & passenger loads
- Building energy & HVAC telemetry (kWh)
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

np.random.seed(42)

CAMPUS_ZONES = [
    {
        "id": "LIB_01",
        "name": "Central Library",
        "category": "Library",
        "capacity": 1200,
        "base_energy_kwh": 35.0,
        "energy_per_person": 0.08,
        "description": "Multi-floor research library with digital stacks, reading halls, and study pods."
    },
    {
        "id": "BLK_A",
        "name": "Academic Block A (Engineering & Tech)",
        "category": "Classrooms",
        "capacity": 2400,
        "base_energy_kwh": 70.0,
        "energy_per_person": 0.06,
        "description": "Smart lecture theaters (L101-L108), computing labs, and faculty suites."
    },
    {
        "id": "BLK_B",
        "name": "Academic Block B (Sciences & Management)",
        "category": "Classrooms",
        "capacity": 1800,
        "base_energy_kwh": 55.0,
        "energy_per_person": 0.06,
        "description": "Tiered seminar halls, wet labs, and departmental lounges."
    },
    {
        "id": "SAC_01",
        "name": "Student Activity Center (SAC)",
        "category": "Facilities",
        "capacity": 850,
        "base_energy_kwh": 30.0,
        "energy_per_person": 0.09,
        "description": "Indoor sports pavilion, dance studios, club rooms, and auditorium."
    },
    {
        "id": "CAN_01",
        "name": "North Food Court & Canteen",
        "category": "Food Services",
        "capacity": 700,
        "base_energy_kwh": 40.0,
        "energy_per_person": 0.12,
        "description": "Multi-vendor cafeteria with dining terrace and rapid-service counters."
    },
    {
        "id": "CAN_02",
        "name": "South Cafe & Garden Bistro",
        "category": "Food Services",
        "capacity": 400,
        "base_energy_kwh": 20.0,
        "energy_per_person": 0.10,
        "description": "Artisan bakery, coffee bar, and shaded outdoor dining deck."
    },
    {
        "id": "TRN_01",
        "name": "East Transit & Shuttle Hub",
        "category": "Transportation",
        "capacity": 650,
        "base_energy_kwh": 15.0,
        "energy_per_person": 0.03,
        "description": "Central electric shuttle terminus, bus bays 1-4, and metro link access."
    }
]

def generate_telemetry_dataset(num_days=90):
    """Generates hourly operational telemetry for all campus zones across 90 days."""
    start_date = datetime(2026, 1, 5, 0, 0, 0) # 90 days semester timeline
    records = []
    
    # Pre-define semester calendar events
    # Day 0-45: Regular Semester
    # Day 46-52: Midterm Exam Week
    # Day 53-75: Regular Semester + Tech Fest on Days 60-62
    # Day 76-88: Final Exam Period
    # Day 89-90: Semester Wrap-up
    
    for day in range(num_days):
        current_day = start_date + timedelta(days=day)
        day_of_week = current_day.weekday() # 0=Monday, 6=Sunday
        is_weekend = 1 if day_of_week in [5, 6] else 0
        
        # Calendar period flag
        if 46 <= day <= 52:
            period = "Midterm Exams"
            exam_flag = 1
            fest_flag = 0
        elif 60 <= day <= 62:
            period = "Campus Tech Fest"
            exam_flag = 0
            fest_flag = 1
        elif 76 <= day <= 88:
            period = "Final Exams"
            exam_flag = 1
            fest_flag = 0
        else:
            period = "Regular"
            exam_flag = 0
            fest_flag = 0
            
        # Daily weather variation
        weather_roll = np.random.rand()
        if weather_roll < 0.65:
            weather = "Clear"
            rain_intensity = 0.0
            ambient_temp = 24.0 + np.random.normal(0, 3.0)
        elif weather_roll < 0.85:
            weather = "Overcast"
            rain_intensity = 0.1
            ambient_temp = 21.0 + np.random.normal(0, 2.5)
        else:
            weather = "Heavy Rain"
            rain_intensity = float(np.random.uniform(0.6, 1.0))
            ambient_temp = 18.0 + np.random.normal(0, 2.0)

        for hour in range(24):
            timestamp = current_day.replace(hour=hour)
            
            # Scheduled lecture load ratio (standard weekday peaks 9-13, 14-17)
            if not is_weekend and exam_flag == 0:
                if 9 <= hour <= 12:
                    lecture_load = 0.85 + np.random.uniform(-0.05, 0.05)
                elif 14 <= hour <= 16:
                    lecture_load = 0.70 + np.random.uniform(-0.05, 0.05)
                elif hour in [8, 13, 17]:
                    lecture_load = 0.35 + np.random.uniform(-0.05, 0.05)
                else:
                    lecture_load = 0.05
            elif exam_flag == 1:
                # During exams, scheduled lectures drop, exam slots occur in two shifts: 10-12 and 14-16
                if hour in [10, 11, 14, 15]:
                    lecture_load = 0.50
                else:
                    lecture_load = 0.02
            else:
                lecture_load = 0.02 # Weekends

            for zone in CAMPUS_ZONES:
                zid = zone["id"]
                cap = zone["capacity"]
                
                # Zone specific occupancy behavior models
                if zid == "LIB_01":
                    # Central Library:
                    # Normal: Peak afternoon/evening (14:00 - 21:00)
                    # Exam week: Massive surge (+80% to +140%), open till 2 AM
                    if exam_flag == 1:
                        if 8 <= hour <= 23:
                            base_pct = 0.65 + 0.30 * np.sin((hour - 8) / 15 * np.pi) + np.random.normal(0, 0.04)
                        elif 0 <= hour <= 2:
                            base_pct = 0.40 + np.random.normal(0, 0.03)
                        else:
                            base_pct = 0.10
                    elif fest_flag == 1:
                        base_pct = 0.20 + 0.15 * np.sin(hour / 24 * np.pi)
                    elif is_weekend:
                        base_pct = 0.45 * np.exp(-((hour - 15) ** 2) / 30)
                    else:
                        base_pct = 0.70 * np.exp(-((hour - 16) ** 2) / 36)
                        
                elif zid in ["BLK_A", "BLK_B"]:
                    # Academic Blocks:
                    # Driven primarily by lecture schedules
                    if is_weekend:
                        base_pct = 0.08 if 10 <= hour <= 17 else 0.01
                    elif fest_flag == 1:
                        base_pct = 0.15 if 10 <= hour <= 18 else 0.02
                    elif exam_flag == 1:
                        # Exam exam halls
                        if 9 <= hour <= 12 or 13 <= hour <= 16:
                            base_pct = 0.60 + np.random.normal(0, 0.04)
                        else:
                            base_pct = 0.08
                    else:
                        # Regular weekday: peaks 9-13 and 14-17
                        if 9 <= hour <= 13:
                            base_pct = 0.78 + np.random.normal(0, 0.05)
                        elif 14 <= hour <= 17:
                            base_pct = 0.65 + np.random.normal(0, 0.05)
                        elif hour in [8, 18]:
                            base_pct = 0.28
                        else:
                            base_pct = 0.02

                elif zid in ["CAN_01", "CAN_02"]:
                    # Food Courts:
                    # Peaks at Breakfast (8:00-9:30), Lunch (12:00-14:30), Snacks/Tea (17:00-18:30), Dinner (19:30-21:30)
                    lunch_peak = np.exp(-((hour - 13.0) ** 2) / 1.5)
                    dinner_peak = np.exp(-((hour - 20.0) ** 2) / 2.0)
                    tea_peak = np.exp(-((hour - 17.5) ** 2) / 1.0)
                    breakfast_peak = np.exp(-((hour - 8.5) ** 2) / 1.2)
                    
                    base_pct = 0.85 * lunch_peak + 0.65 * dinner_peak + 0.45 * tea_peak + 0.35 * breakfast_peak
                    if rain_intensity > 0.5:
                        # Students gather indoors during heavy rain
                        base_pct *= 1.25

                elif zid == "SAC_01":
                    # Student Activity Center:
                    # Peaks late afternoon & evenings (16:00 - 22:00), high on fest days
                    if fest_flag == 1:
                        base_pct = 0.88 + np.random.normal(0, 0.05) if 10 <= hour <= 23 else 0.15
                    elif is_weekend:
                        base_pct = 0.65 * np.exp(-((hour - 17) ** 2) / 20)
                    else:
                        base_pct = 0.70 * np.exp(-((hour - 18.5) ** 2) / 12)

                elif zid == "TRN_01":
                    # East Transit Hub:
                    # Arrival rush (7:30 - 9:30), Departure rush (16:30 - 18:30)
                    morning_rush = np.exp(-((hour - 8.5) ** 2) / 1.5)
                    evening_rush = np.exp(-((hour - 17.5) ** 2) / 2.0)
                    lunch_transit = 0.35 * np.exp(-((hour - 13.0) ** 2) / 2.0)
                    
                    base_pct = 0.90 * morning_rush + 0.85 * evening_rush + lunch_transit
                    if rain_intensity > 0.5:
                        base_pct *= 1.35 # transit delays and surges during rain
                
                # Add natural noise and bounds
                base_pct = np.clip(base_pct + np.random.normal(0, 0.02), 0.01, 1.15)
                headcount = int(np.round(base_pct * cap))
                occupancy_pct = round((headcount / cap) * 100, 1)
                
                # Sensor derived telemetry
                # WiFi probe count: 1.15 - 1.35 devices per active student + background devices
                wifi_probe_count = int(np.round(headcount * np.random.uniform(1.15, 1.32) + np.random.randint(5, 25)))
                
                # Indoor CO2 ppm: ambient 410 ppm + indoor accumulation based on occupancy
                co2_ppm = int(410 + (occupancy_pct / 100.0) * 850 + np.random.normal(0, 20))
                
                # Energy consumption (kWh) = base building load + HVAC/lighting dependent on headcount and ambient temp
                temp_factor = 1.0 + max(0, (ambient_temp - 22.0) * 0.035)
                energy_kwh = round((zone["base_energy_kwh"] + headcount * zone["energy_per_person"]) * temp_factor + np.random.normal(0, 1.5), 2)
                
                # Transit wait times and cafeteria queue times
                if zid == "TRN_01":
                    # Base shuttle headway = 5 mins, spikes to 18-28 mins under high congestion
                    transit_wait_min = round(max(3.0, 4.0 + (occupancy_pct / 100.0) ** 2.2 * 24.0 + rain_intensity * 6.0 + np.random.normal(0, 1.2)), 1)
                else:
                    transit_wait_min = 0.0

                if zid in ["CAN_01", "CAN_02"]:
                    # Cafeteria queue wait time
                    queue_wait_min = round(max(1.0, 2.0 + (occupancy_pct / 100.0) ** 2.0 * 20.0 + np.random.normal(0, 1.0)), 1)
                else:
                    queue_wait_min = 0.0

                # Congestion classification label:
                # 0: Low (<45%), 1: Moderate (45-70%), 2: High (70-85%), 3: Severe Bottleneck (>85%)
                if occupancy_pct < 45.0:
                    congestion_code = 0
                    congestion_label = "Low"
                elif occupancy_pct < 70.0:
                    congestion_code = 1
                    congestion_label = "Moderate"
                elif occupancy_pct < 85.0:
                    congestion_code = 2
                    congestion_label = "High"
                else:
                    congestion_code = 3
                    congestion_label = "Severe Bottleneck"

                records.append({
                    "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "date": timestamp.strftime("%Y-%m-%d"),
                    "hour": hour,
                    "day_of_week": day_of_week,
                    "day_name": timestamp.strftime("%A"),
                    "is_weekend": is_weekend,
                    "period": period,
                    "is_exam_period": exam_flag,
                    "is_fest_event": fest_flag,
                    "weather": weather,
                    "rain_intensity": round(rain_intensity, 2),
                    "ambient_temp_c": round(ambient_temp, 1),
                    "lecture_schedule_load": round(lecture_load, 2),
                    "zone_id": zid,
                    "zone_name": zone["name"],
                    "category": zone["category"],
                    "capacity": cap,
                    "headcount": headcount,
                    "occupancy_pct": occupancy_pct,
                    "wifi_probe_count": wifi_probe_count,
                    "co2_ppm": co2_ppm,
                    "energy_kwh": energy_kwh,
                    "transit_wait_min": transit_wait_min,
                    "queue_wait_min": queue_wait_min,
                    "congestion_code": congestion_code,
                    "congestion_label": congestion_label
                })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(__file__)
    DATA_DIR = os.path.join(BASE_DIR, "..", "data")
    os.makedirs(DATA_DIR, exist_ok=True)
    print("Generating 90-day comprehensive campus operational telemetry dataset...")
    df = generate_telemetry_dataset(num_days=90)
    csv_path = os.path.join(DATA_DIR, "campus_historical_telemetry.csv")
    df.to_csv(csv_path, index=False)
    print(f"Generated {len(df)} telemetry records across 7 zones.")
    print(f"Saved to: {csv_path}")
    
    # Save zones catalog JSON
    zones_path = os.path.join(DATA_DIR, "campus_zones.json")
    with open(zones_path, "w") as f:
        json.dump(CAMPUS_ZONES, f, indent=2)
    print(f"Saved campus zones metadata to: {zones_path}")
