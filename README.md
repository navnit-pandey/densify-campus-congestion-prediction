# Densify Campus Congestion Prediction System
### *Data-Driven Digital Twin & Machine Learning Operations Platform for University Facilities*
**Version**: 1.0.0 (Production-Ready)  
**Live Interactive Demo**: [https://navnit-pandey.github.io/aether-campus-digital-twin/](https://navnit-pandey.github.io/aether-campus-digital-twin/)

---

## 🌟 Executive Overview
**Densify** is a comprehensive, data-driven digital twin platform developed to monitor, predict, and optimize campus-wide student crowd density, facility congestion, transit wait times, and building energy consumption across university operations.

By fusing 90 days of high-fidelity synthetic IoT operational telemetry (15,120 sensor records) with ensemble machine learning models (**Random Forest Regressor**, **Gradient Boosting**, and **Congestion Risk Classifiers**), Densify empowers campus administrators to visualize live conditions and execute interactive **"What-If" scenario simulations**—evaluating the systemic impacts of large campus fests, examination periods, timetable rescheduling, and extreme weather emergencies before committing physical resources.

---

## 🏛️ Modeled Campus Facilities & Operational Telemetry
Densify models seven critical facility zones, tracking human occupancy, environmental air quality, power load, and service queue latencies (Total Campus Design Capacity: **8,000**):

| Facility Code | Zone Name | Category | Design Capacity | Primary Telemetry Sources | Metric Scope |
|---|---|---|---|---|---|
| `LIB_01` | **Central University Library** | Library | 1,200 | Turnstile counters, Edge CCTV Tripwire, Wi-Fi device probes | Primary Ground Truth |
| `BLK_A` | **Academic Block A (Engineering & Tech)** | Classrooms | 2,400 | RFID classroom scanners, lecture hall timetable load, HVAC kW | Primary Ground Truth |
| `BLK_B` | **Academic Block B (Sciences & Mgmt)** | Classrooms | 1,800 | Seminar hall door sensors, laboratory safety monitors | Primary Ground Truth |
| `SAC_01` | **Student Activity Center (SAC)** | Facilities | 850 | Turnstile headcounts, indoor sports/gym sensors, event registers | Primary Ground Truth |
| `CAN_01` | **North Food Court & Canteen** | Food Services | 700 | POS transaction rate, dining terrace occupancy, order queue wait | Primary Ground Truth |
| `CAN_02` | **South Cafe & Garden Bistro** | Food Services | 400 | Artisan cafe registers, terrace seating density | Primary Ground Truth |
| `TRN_01` | **East Transit & Shuttle Terminus** | Transportation | 650 | Bus bays 1-4 GPS arrival beacons, passenger queue cameras | Primary Ground Truth |

> [!NOTE]
> **Metric Scope Demarcation**: Crowd headcounts and occupancy % constitute **Primary Ground Truth Telemetry**. Energy draw (kWh), metabolic $\text{CO}_2$ emissions, Wi-Fi device probes, and shuttle queue latencies are **Derived Physical Proxies** mathematically modeled from human thermal load (100W sensible heat), exhalation rates (0.005 L/s per occupant in ASHRAE 62.1 spaces), hardware probe ratios (1.24x per person), and $M/M/c$ queuing theory.

---

## 📷 Edge Computer Vision & Optical Headcount Pipeline (`cv_pipeline.js`)
To bridge raw physical optical streams into verified Digital Twin headcounts, Densify provides a fully interactive Computer Vision pipeline:
1. **Multi-Input Stream Acquisition**: Supports Synthetic Corridor CCTV (24.2 FPS), Live User Webcam (`getUserMedia`), or Custom Video File Upload.
2. **YOLOv8 Deep Neural Object Detection**: Detects person class bounding boxes with real-time confidence scores ($\ge 0.80$).
3. **DeepSORT Centroid & Trajectory Tracking**: Associates detections across consecutive frames via Kalman filter motion estimation and Hungarian matching, assigning persistent track IDs (e.g. `Person #104`).
4. **Virtual Bidirectional Tripwire**: Calibrated ROI counting line across the corridor detects directional vectors: downward crossing increments **Ingress (+1)**, upward crossing increments **Egress (-1)**.
5. **Digital Twin Synchronization**: One-click synchronization (`Sync Camera Count to Central Library`) feeds live optical net occupancy ($Net = Ingress - Egress$) directly into `LIB_01`, immediately updating the Digital Twin heatmap, occupancy meter, and predictive models.

---

## 🔬 Machine Learning Architecture & Benchmark Results

### 1. Chronological Temporal Holdout Validation (Zero Data Leakage)
To substantiate ML evaluation on time-series telemetry, data is split chronologically rather than randomly shuffled:
- **Total Dataset**: 15,120 records (90 calendar days $\times$ 24 hourly intervals $\times$ 7 facilities).
- **Training Set (80%)**: Days 1 through 72 ($N = 12,096$ records).
- **Test Holdout Set (20%)**: Days 73 through 90 ($N = 3,024$ records).
- **Zero Cross-Period Leakage**: Random shuffling is strictly avoided because training on Tuesday 2 PM and testing on Tuesday 3 PM leaks same-day patterns. The chronological split guarantees evaluation on strictly future unseen operational days.

### 2. Regression: Crowd Headcount & Occupancy % Forecasting
Three distinct regression architectures were evaluated on the chronological test holdout ($N = 3,024$):

| Model Algorithm | RMSE (%) | MAE (%) | $R^2$ Score (Variance Explained) | Selection Status |
|---|---|---|---|---|
| **Random Forest Regressor** (120 Trees, Depth 12) | **2.98%** | **1.99%** | **0.9891** | ⭐ **Selected (Production)** |
| **Gradient Boosting Regressor** (100 Trees, LR 0.1) | 6.03% | 3.80% | 0.9554 | High-Performance Candidate |
| **Ridge Linear Regression** ($\alpha = 1.0$) | 25.04% | 20.10% | 0.2315 | Linear Baseline |

### 3. Multi-Class Classification: Congestion Risk Severity
Classifies real-time risk into four operational states:
- **Low Risk (<45% Occupancy)**
- **Moderate Density (45–70% Occupancy)**
- **High Density Alert (70–85% Occupancy)**
- **Severe Bottleneck (>85% Occupancy)**

- **Classification Accuracy**: **93.62%**
- **Weighted F1-Score**: **0.9323**
- **Confusion Matrix ($N = 3,024$ Chronological Test Samples)**:
  ```text
  True \ Pred     Low    Moderate    High    Severe
  Low (<45%)     2292       2          0        0
  Mod (45-70%)     79     311         10        0
  High (70-85%)    23      30        121       23
  Severe (>85%)    21       0          5      107
  ```

### 4. Verifiable 24-Hour Forecasting with Analytical Confidence Bounds
- **Forecast Horizon**: Rolling 24 consecutive hours starting from the currently selected simulated time (e.g. `13:00 Today → 12:00 Tomorrow`).
- **90% Confidence Bounds**: Calculated analytically from the test-set Root Mean Square Error ($\text{RMSE} = 2.98\%$) as:
  $$\text{CI}_{90\%} = \hat{y} \pm 1.645 \times \text{RMSE} \approx \hat{y} \pm 4.9\%$$
- **Ground-Truth Verification Overlay**: Interactive toggle on the 24h chart enables users to directly inspect unseen historical test-set observations alongside the prediction curve to verify accuracy.

### 3. Feature Importance Analysis (Gini Impurity Reduction)
The Random Forest model identified the primary predictive drivers of university congestion:
1. `hour` (Time of Day): **57.62%**
2. `capacity` (Facility Maximum Limit): **13.25%**
3. `lecture_schedule_load` (Timetable Class Concurrency): **7.67%**
4. `zone_TRN_01` (Transit Hub Commuter Dynamics): **6.25%**
5. `is_exam_period` (Examination Period Status): **3.51%**
6. `zone_LIB_01` (Library Study Surge): **3.37%**
7. `zone_SAC_01` (Student Activity Center): **2.94%**
8. `day_of_week` (Weekly Seasonality): **1.76%**
9. `is_fest_event` (Campus Events): **1.52%**
10. `is_weekend` (Academic vs Leisure Days): **1.25%**

---

## 🎛️ "What-If" Analysis Engine & Automated Dispatch

Densify includes an interactive scenario sandbox allowing administrators to evaluate policy and event impacts before execution:

### 1. Preset Scenarios Evaluated
- **Scenario A: Tech Fest & Hackathon (+1,500 Attendees)**
  - *Impact*: SAC surges to critical bottleneck (140% capacity limit); North Canteen queue wait spikes by +14 minutes; East Transit Hub demand surges 4.5x during evening departure.
  - *AI Dispatch Action*: Deploy safety stanchions, establish one-way ingress at SAC, open satellite meal kiosks on Central Quad, and dispatch 3 on-call reserve electric shuttles.
- **Scenario B: Final Examination Crunch**
  - *Impact*: Classrooms drop to 60% capacity; Central Library surges to 94.4% sustained load; evening library HVAC draw doubles.
  - *AI Dispatch Action*: Activate Academic Block B Seminar Rooms 201–205 as 24/7 overflow silent study zones; pre-cool library HVAC 45 minutes prior to peak morning influx.
- **Scenario C: Timetable Staggering Policy (-35% Concurrency)**
  - *Impact*: Lecture changeover corridor density drops from 78% to 51%; cafeteria peak lunch queue reduces by 38%.
  - *AI Dispatch Action*: Validates timetable staggered scheduling policy without needing physical building renovations.
- **Scenario D: Torrential Monsoon Cloudburst**
  - *Impact*: Outdoor walkways clear; indoor dining and shuttle terminus experience instant crowd surges (+35%); road speeds decrease, ballooning bus headway.

---

## 📁 Project Directory Structure
```text
INT 395/
├── index.html                  # Main Web Application User Interface
├── styles.css                  # Modern Glassmorphic Dark UI Design System
├── app.js                      # Application Controller & Data Orchestration
├── campus_map.js               # Canvas 2D Digital Twin Map & Real-time Heatmap
├── simulator.js                # What-If Simulation Engine & Dispatch Directives
├── charts.js                   # Chart.js Visualizations (24h Forecast, Capacity, Energy)
├── README.md                   # Comprehensive Technical & Academic Documentation
├── data/
│   ├── campus_historical_telemetry.csv   # 15,120 Hourly IoT Records (90 Days)
│   ├── campus_zones.json                 # Facility Coordinates, Capacities, Base kWh
│   ├── model_artifacts.json              # Trained Model Metrics, Benchmarks, CM
│   └── hourly_profiles.json              # Calibrated 24h Scenario Baselines
├── models/
│   ├── rf_crowd_density.joblib           # Trained Random Forest Regressor
│   ├── rf_congestion_classifier.joblib   # Trained Congestion Classifier
│   └── rf_energy_model.joblib            # Trained Building Energy Regressor
└── ml_pipeline/
    ├── generate_data.py                  # Synthetic IoT Operational Telemetry Generator
    ├── train_models.py                   # Model Training, Evaluation, Artifact Export
    ├── export_profiles.py                # 24h Profile Aggregator for Fast Client Simulation
    ├── what_if_analyzer.py               # CLI What-If Comparative Experiment Runner
    └── server.py                         # FastAPI REST API Backend
```

---

## 🚀 How to Run the System

### 1. View the Digital Twin Web Application
Open your browser and navigate to:
```text
http://localhost:3000
```
*(Or simply open `index.html` in any modern web browser!)*

### 2. Run the Machine Learning Pipeline via Command Line
```powershell
# 1. Regenerate 90-day operational telemetry dataset
python ml_pipeline/generate_data.py

# 2. Train Random Forest models & evaluate benchmarks
python ml_pipeline/train_models.py

# 3. Run automated What-If scenario comparisons in terminal
python ml_pipeline/what_if_analyzer.py
```

### 3. Start the FastAPI REST Backend Server (Optional)
```powershell
python ml_pipeline/server.py
```
API Documentation and Swagger UI are accessible at:
```text
http://127.0.0.1:8000/docs
```
Key endpoints:
- `GET /api/zones` - Lists campus zones and metadata
- `GET /api/forecast/24h?zone_id=LIB_01` - 24-hour ML forecast curve with bounds
- `POST /api/what-if` - Computes what-if impact deltas and recommendations
- `GET /api/model-metrics` - Model benchmarks and confusion matrix

---

## 🏆 Core Capabilities & System Deliverables
- [x] **Digital Representation (Digital Twin)**: Interactive blueprint map of 7 facilities with real-time radial heatmaps and foot-traffic flow particle animations.
- [x] **Multi-Domain Operations**: Covers Classrooms, Library, Food Services, Transportation, and Energy/HVAC telemetry.
- [x] **Machine Learning Integration**: Random Forest ($R^2 = 0.9881$) and Congestion Classifier ($93.09\%$ accuracy) trained on 15,120 historical logs.
- [x] **Predictive Demand**: 24-hour forecast with 90% confidence bands and hourly scrubber simulation.
- [x] **What-If Scenario Sandbox**: Interactive simulation of campus events, exam crunch, timetable staggering, and weather emergencies with automated AI administrative dispatch advice.
