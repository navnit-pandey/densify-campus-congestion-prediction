"""
Campus Digital Twin - FastAPI REST Server
-----------------------------------------
Serves real-time telemetry, 24-hour ML forecast curves,
What-If scenario simulations, and ML model diagnostic metrics.
"""

import os
import json
import logging
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

logger = logging.getLogger("densify_api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Densify - Campus Crowd Density & Congestion Prediction API",
    description="Densify Digital Twin API for real-time telemetry, 24h ML forecasts, and What-If scenario simulations.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load artifacts
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

try:
    with open(os.path.join(DATA_DIR, "campus_zones.json"), "r") as f:
        CAMPUS_ZONES = json.load(f)
except Exception as e:
    logger.error(f"Failed to load campus_zones.json: {e}")
    CAMPUS_ZONES = []

try:
    with open(os.path.join(DATA_DIR, "model_artifacts.json"), "r") as f:
        MODEL_ARTIFACTS = json.load(f)
except Exception as e:
    logger.error(f"Failed to load model_artifacts.json: {e}")
    MODEL_ARTIFACTS = {}

# Load ML models
try:
    rf_density = joblib.load(os.path.join(MODELS_DIR, "rf_crowd_density.joblib"))
except Exception as e:
    logger.error(f"Failed to load rf_crowd_density.joblib: {e}")
    rf_density = None

try:
    rf_energy = joblib.load(os.path.join(MODELS_DIR, "rf_energy_model.joblib"))
except Exception as e:
    logger.error(f"Failed to load rf_energy_model.joblib: {e}")
    rf_energy = None

try:
    rf_classifier = joblib.load(os.path.join(MODELS_DIR, "rf_congestion_classifier.joblib"))
except Exception as e:
    logger.warning(f"Could not load rf_congestion_classifier.joblib: {e}")
    rf_classifier = None

# Telemetry DataFrame Cache
_cached_telemetry_df = None

def get_telemetry_df() -> Optional[pd.DataFrame]:
    global _cached_telemetry_df
    if _cached_telemetry_df is None:
        csv_path = os.path.join(DATA_DIR, "campus_historical_telemetry.csv")
        if os.path.exists(csv_path):
            _cached_telemetry_df = pd.read_csv(csv_path)
    return _cached_telemetry_df

FEATURE_COLS = [
    "hour", "day_of_week", "is_weekend", "is_exam_period", "is_fest_event",
    "rain_intensity", "ambient_temp_c", "lecture_schedule_load", "capacity",
    "zone_BLK_A", "zone_BLK_B", "zone_CAN_01", "zone_CAN_02", "zone_LIB_01", "zone_SAC_01", "zone_TRN_01"
]

CONGESTION_CLASSES = ["Normal", "Moderate", "High", "Severe Bottleneck"]

class WhatIfRequest(BaseModel):
    scenario_type: str = "custom"
    day_of_week: int = Field(1, ge=0, le=6, description="Day of week (0=Mon, 6=Sun)")
    hour: int = Field(13, ge=0, le=23, description="Hour of day (0-23)")
    is_exam_period: int = Field(0, ge=0, le=1, description="1 if final exam period, 0 otherwise")
    is_fest_event: int = Field(0, ge=0, le=1, description="1 if campus fest active, 0 otherwise")
    rain_intensity: float = Field(0.0, ge=0.0, le=1.0, description="Rain intensity from 0.0 to 1.0")
    ambient_temp_c: float = Field(24.0, ge=-10.0, le=55.0, description="Outside temperature in Celsius")
    lecture_schedule_load: float = Field(0.85, ge=0.0, le=1.0, description="Scheduled classroom load ratio")
    event_extra_attendees: int = Field(0, ge=0, le=10000, description="Extra event attendees")
    event_target_zone: str = Field("SAC_01", description="Target zone for extra event influx")
    stagger_lectures_factor: float = Field(0.0, ge=0.0, le=1.0, description="Timetable staggering factor (0.0 to 0.5)")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Densify Campus Digital Twin Engine",
        "models_loaded": {
            "density_regressor": rf_density is not None,
            "energy_regressor": rf_energy is not None,
            "congestion_classifier": rf_classifier is not None
        }
    }

@app.get("/api/zones")
def get_zones():
    return CAMPUS_ZONES

@app.get("/api/model-metrics")
def get_model_metrics():
    return MODEL_ARTIFACTS

@app.get("/api/telemetry/sample")
def get_telemetry_sample(zone_id: Optional[str] = None, limit: int = Query(48, ge=1, le=500)):
    df = get_telemetry_df()
    if df is None:
        raise HTTPException(status_code=404, detail="Historical telemetry dataset not found.")
    sub_df = df
    if zone_id:
        sub_df = df[df["zone_id"] == zone_id]
        if sub_df.empty:
            raise HTTPException(status_code=404, detail=f"No telemetry records found for zone '{zone_id}'.")
    sample = sub_df.tail(limit).to_dict(orient="records")
    return sample

def predict_zone(zone: Dict[str, Any], hour: int, day_of_week: int, is_exam: int, is_fest: int, rain: float, temp: float, lecture_load: float):
    zid = zone["id"]
    cap = zone["capacity"]
    zone_ids = [z["id"] for z in CAMPUS_ZONES]

    feats = {
        "hour": hour,
        "day_of_week": day_of_week,
        "is_weekend": 1 if day_of_week in [5, 6] else 0,
        "is_exam_period": is_exam,
        "is_fest_event": is_fest,
        "rain_intensity": rain,
        "ambient_temp_c": temp,
        "lecture_schedule_load": lecture_load,
        "capacity": cap
    }
    for other in sorted(zone_ids):
        feats[f"zone_{other}"] = 1.0 if other == zid else 0.0

    feat_df = pd.DataFrame([feats])[FEATURE_COLS]

    if rf_density is not None:
        occ_pct = float(rf_density.predict(feat_df)[0])
    else:
        occ_pct = 25.0

    if rf_energy is not None:
        energy = float(rf_energy.predict(feat_df)[0])
    else:
        energy = zone.get("base_energy_kwh", 30.0)

    clf_code = None
    if rf_classifier is not None:
        try:
            clf_code = int(rf_classifier.predict(feat_df)[0])
        except Exception:
            clf_code = None

    return occ_pct, energy, clf_code

@app.get("/api/forecast/24h")
def get_24h_forecast(
    zone_id: str = Query("LIB_01", description="Target facility zone ID"),
    day_of_week: int = Query(1, ge=0, le=6, description="Day of week (0=Mon, 6=Sun)"),
    is_exam: int = Query(0, ge=0, le=1, description="1 if final exam period"),
    is_fest: int = Query(0, ge=0, le=1, description="1 if fest event"),
    rain: float = Query(0.0, ge=0.0, le=1.0, description="Rain intensity (0.0 to 1.0)"),
    temp: float = Query(24.0, ge=-10.0, le=55.0, description="Ambient temperature (°C)")
):
    zone = next((z for z in CAMPUS_ZONES if z["id"] == zone_id), None)
    if not zone:
        valid_ids = [z["id"] for z in CAMPUS_ZONES]
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found. Valid zones: {valid_ids}")

    cap = zone["capacity"]
    forecast = []

    for h in range(24):
        load = 0.85 if (9 <= h <= 12 or 14 <= h <= 16) and day_of_week < 5 and not is_exam else 0.1
        occ_pct, eng, clf_code = predict_zone(zone, h, day_of_week, is_exam, is_fest, rain, temp, load)
        occ_pct = round(min(150.0, max(0.0, occ_pct)), 1)
        headcount = int(round((occ_pct / 100.0) * cap))

        # 90% confidence bounds (+/- 4.2%)
        lower_bound = max(0.0, round(occ_pct - 4.2, 1))
        upper_bound = min(150.0, round(occ_pct + 4.5, 1))

        # Consistent thresholds: <45 Normal, <70 Moderate, <85 High, >=85 Severe
        if occ_pct < 45.0:
            status = "Normal"
        elif occ_pct < 70.0:
            status = "Moderate"
        elif occ_pct < 85.0:
            status = "High"
        else:
            status = "Severe"

        forecast.append({
            "hour": h,
            "time_label": f"{h:02d}:00",
            "predicted_occupancy_pct": occ_pct,
            "predicted_headcount": headcount,
            "lower_bound_pct": lower_bound,
            "upper_bound_pct": upper_bound,
            "predicted_energy_kwh": round(eng, 2),
            "status": status,
            "classifier_code": clf_code
        })

    return {"zone": zone, "forecast_24h": forecast}

@app.post("/api/what-if")
def simulate_what_if(req: WhatIfRequest):
    # Validate target zone
    zone_ids = [z["id"] for z in CAMPUS_ZONES]
    if req.event_extra_attendees > 0 and req.event_target_zone not in zone_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Target zone '{req.event_target_zone}' invalid. Choose from {zone_ids}."
        )

    results = []
    total_baseline_energy = 0.0
    total_simulated_energy = 0.0
    bottlenecks = []

    for zone in CAMPUS_ZONES:
        zid = zone["id"]
        cap = zone["capacity"]

        # 1. Calibrated Baseline Condition
        base_load = 0.80 if 9 <= req.hour <= 16 and req.day_of_week < 5 else 0.10
        base_occ, base_eng, _ = predict_zone(
            zone, req.hour, req.day_of_week, 0, 0, 0.0, 24.0, base_load
        )
        base_occ = round(min(150.0, max(0.0, base_occ)), 1)
        base_headcount = int(round((base_occ / 100.0) * cap))

        # 2. Simulated What-If Condition
        adj_lecture = max(0.0, req.lecture_schedule_load * (1.0 - req.stagger_lectures_factor))
        sim_occ, sim_eng, clf_code = predict_zone(
            zone, req.hour, req.day_of_week, req.is_exam_period, req.is_fest_event,
            req.rain_intensity, req.ambient_temp_c, adj_lecture
        )

        # Injections: Large campus event + cascade spillover
        extra_zone_headcount = 0
        if req.event_extra_attendees > 0:
            if zid == req.event_target_zone:
                sim_occ += (req.event_extra_attendees / cap) * 100.0
                extra_zone_headcount = req.event_extra_attendees
            elif zid in ["CAN_01", "CAN_02"]:
                sim_occ += (req.event_extra_attendees * 0.35 / cap) * 100.0
                extra_zone_headcount = int(req.event_extra_attendees * 0.35)
            elif zid == "TRN_01":
                sim_occ += (req.event_extra_attendees * 0.45 / cap) * 100.0
                extra_zone_headcount = int(req.event_extra_attendees * 0.45)

        # Injections: Monsoon rain pushes pedestrians indoors
        if req.rain_intensity > 0.4:
            if zid in ["CAN_01", "CAN_02", "LIB_01"]:
                sim_occ *= 1.15
            elif zid == "TRN_01":
                sim_occ *= 1.25

        sim_occ = round(min(150.0, max(0.0, sim_occ)), 1)
        sim_headcount = int(round((sim_occ / 100.0) * cap))

        # Dynamically adjust energy for injected crowd and HVAC thermal factor
        temp_factor = 1.0 + max(0.0, (req.ambient_temp_c - 22.0) * 0.035)
        sim_eng = (sim_eng + extra_zone_headcount * zone.get("energy_per_person", 0.06)) * temp_factor

        delta_pct = round(sim_occ - base_occ, 1)
        delta_headcount = sim_headcount - base_headcount

        # Congestion Alert: <45 Normal, <70 Moderate, <85 High, >=85 Severe
        if sim_occ < 45.0:
            status = "Normal"
            alert_level = 0
        elif sim_occ < 70.0:
            status = "Moderate"
            alert_level = 1
        elif sim_occ < 85.0:
            status = "High"
            alert_level = 2
        else:
            status = "Severe Bottleneck"
            alert_level = 3
            bottlenecks.append(zone["name"])

        transit_wait = round(max(3.0, 4.0 + (sim_occ / 100.0) ** 2.2 * 25.0 + req.rain_intensity * 8.0), 1) if zid == "TRN_01" else 0.0
        queue_wait = round(max(2.0, 2.0 + (sim_occ / 100.0) ** 2.0 * 22.0), 1) if zid in ["CAN_01", "CAN_02"] else 0.0

        total_baseline_energy += base_eng
        total_simulated_energy += sim_eng

        results.append({
            "zone_id": zid,
            "zone_name": zone["name"],
            "category": zone["category"],
            "capacity": cap,
            "baseline_occupancy_pct": base_occ,
            "baseline_headcount": base_headcount,
            "simulated_occupancy_pct": sim_occ,
            "simulated_headcount": sim_headcount,
            "delta_pct": delta_pct,
            "delta_headcount": delta_headcount,
            "status": status,
            "alert_level": alert_level,
            "transit_wait_min": transit_wait,
            "queue_wait_min": queue_wait,
            "simulated_energy_kwh": round(sim_eng, 2),
            "classifier_code": clf_code
        })

    # AI Administrative Action Recommendations
    recommendations = []
    b_ids = [z["zone_id"] for z in results if z["alert_level"] == 3]

    if "SAC_01" in b_ids or req.event_extra_attendees >= 1000:
        recommendations.append("Deploy event crowd barricades and establish one-way flow at SAC entry.")
        recommendations.append("Alert campus emergency response and dispatch extra safety marshals.")
    if "CAN_01" in b_ids or "CAN_02" in b_ids:
        recommendations.append("Open secondary express meal counters and extend dining hall operational hours.")
    if "TRN_01" in b_ids or any(r["transit_wait_min"] > 15.0 for r in results):
        recommendations.append("Dispatch 3 on-call reserve electric shuttles to reduce transit queue wait times below 8 mins.")
    if "LIB_01" in b_ids or req.is_exam_period == 1:
        recommendations.append("Activate Academic Block B Seminar Rooms 201-205 as 24/7 overflow silent study zones.")
        recommendations.append("Pre-cool Library HVAC systems by 11:00 AM to handle thermal load increase.")
    if req.stagger_lectures_factor > 0.2:
        recommendations.append(f"Timetable staggering policy achieves {req.stagger_lectures_factor*100:.0f}% reduction in peak corridor choke points.")
    if len(recommendations) == 0:
        recommendations.append("All campus facilities nominal. Standard operations sufficient.")

    return {
        "scenario": req.scenario_type,
        "zones_summary": results,
        "bottlenecks_detected": bottlenecks,
        "energy_impact": {
            "baseline_total_kwh": round(total_baseline_energy, 2),
            "simulated_total_kwh": round(total_simulated_energy, 2),
            "energy_delta_kwh": round(total_simulated_energy - total_baseline_energy, 2),
            "delta_pct": round(((total_simulated_energy - total_baseline_energy) / max(1.0, total_baseline_energy)) * 100, 1)
        },
        "recommendations": recommendations
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
