"""
Export aggregated 24-hour operational profiles by zone and scenario
for instant, silky-smooth client-side Digital Twin simulation and map rendering.
"""

import os
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "..", "data")

def export_profiles():
    data_path = os.path.join(DATA_DIR, "campus_historical_telemetry.csv")
    df = pd.read_csv(data_path)
    
    profiles = {}
    
    # Categories of days
    regular_weekday = df[(df["is_weekend"] == 0) & (df["is_exam_period"] == 0) & (df["is_fest_event"] == 0) & (df["weather"] == "Clear")]
    exam_weekday = df[(df["is_weekend"] == 0) & (df["is_exam_period"] == 1)]
    fest_day = df[df["is_fest_event"] == 1]
    rain_day = df[df["weather"] == "Heavy Rain"]
    weekend_day = df[(df["is_weekend"] == 1) & (df["is_exam_period"] == 0)]
    
    scenarios = {
        "regular": regular_weekday,
        "exam": exam_weekday,
        "fest": fest_day,
        "rain": rain_day,
        "weekend": weekend_day
    }
    
    for s_name, s_df in scenarios.items():
        profiles[s_name] = {}
        for zid, group in s_df.groupby("zone_id"):
            hourly_agg = group.groupby("hour").agg({
                "headcount": "mean",
                "occupancy_pct": "mean",
                "wifi_probe_count": "mean",
                "co2_ppm": "mean",
                "energy_kwh": "mean",
                "transit_wait_min": "mean",
                "queue_wait_min": "mean"
            }).reset_index()
            
            hours_data = []
            for _, row in hourly_agg.iterrows():
                hours_data.append({
                    "hour": int(row["hour"]),
                    "headcount": int(round(row["headcount"])),
                    "occupancy_pct": round(float(row["occupancy_pct"]), 1),
                    "wifi_probe_count": int(round(row["wifi_probe_count"])),
                    "co2_ppm": int(round(row["co2_ppm"])),
                    "energy_kwh": round(float(row["energy_kwh"]), 2),
                    "transit_wait_min": round(float(row["transit_wait_min"]), 1),
                    "queue_wait_min": round(float(row["queue_wait_min"]), 1)
                })
            profiles[s_name][zid] = hours_data
            
    out_path = os.path.join(DATA_DIR, "hourly_profiles.json")
    with open(out_path, "w") as f:
        json.dump(profiles, f, indent=2)
    print(f"Exported aggregated hourly profiles to: {out_path}")

if __name__ == "__main__":
    export_profiles()
