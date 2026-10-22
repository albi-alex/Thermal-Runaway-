# Physics-Based Random-Forest Early Warning for Thermal Runaway in an Exothermic CSTR

An end-to-end interactive scientific web application and early-warning decision system for continuous stirred-tank reactors (CSTR). The system combines first-principles chemical engineering physics with a supervised 120-tree Random Forest classifier to predict thermal runaway **strictly 3 minutes in advance** ($H = 3.0\text{ min}$) before crossing the critical limit of $390.0\text{ K}$.

Based on the original model equations, numerical integration specifications, and parameter distributions from the faculty working notes of **Dr. Arun K. Varanasi**, Department of Chemical Engineering, Saintgits College of Engineering.

---

## Key Features

- **Interactive SVG Reactor Simulation**: High-fidelity animated CSTR vessel with dynamic fluid level, temperature-mapped liquid gradient (cool blue $\rightarrow$ emerald $\rightarrow$ amber $\rightarrow$ fire orange $\rightarrow$ alarm red), rotating impeller stirrer, feed inlet and product outlet flow animations, and dynamic cooling jacket circulation.
- **First-Principles Physics Engine**:
  - Species balance: $\frac{dC_A}{dt} = \frac{C_{Af} - C_A}{\tau} - k(T) C_A$
  - Sensible energy balance: $\frac{dT}{dt} = \frac{T_f - T}{\tau} + \beta k(T) C_A - U(T - T_c)$
  - Arrhenius rate constant: $k(T) = A \exp\left(-\frac{E/R}{T}\right)$
  - Numerical integration: Explicit Midpoint Method (RK2) with fixed step size $\Delta t = 0.1\text{ min}$ (6.0 s).
- **14 Strictly Causal Input Features**:
  1. Observed Temperature ($T_{obs}$)
  2. Reactant Concentration ($C_A$)
  3. Heating Rate ($\dot{T}$, backward difference)
  4. Thermal Acceleration ($\ddot{T}$, backward difference)
  5. Trailing Maximum Temperature (1 min window)
  6. Trailing Temperature Slope (1 min window)
  7. Reaction Heat Generation ($q_{gen} = \beta k(T) C_A$)
  8. Jacket Heat Removal ($q_{rem} = U(T - T_c)$)
  9. Net Thermal Drive ($q_{net} = q_{gen} - q_{rem}$)
  10. Driving Force Temperature Difference ($T_{obs} - T_c$)
  11. Cooling Heat Transfer Coefficient ($U$)
  12. Feed Reactant Loading ($C_{Af}$)
  13. Feed Temperature ($T_f$)
  14. Reactor Residence Time ($\tau$)
- **Random Forest Classifier (120 Trees)**:
  - 120 estimators, maximum depth 8, minimum samples per leaf 12, `max_features="sqrt"`, `class_weight="balanced_subsample"`, random state 42.
  - Probability bands: **SAFE** ($P < 0.35$), **WARNING** ($0.35 \le P < 0.70$), **CRITICAL** ($P \ge 0.70$).
  - Hybrid physical alarm override: $S_{hybrid} = \max(S_{physics}, S_{RF})$ triggering immediately if $T \ge 390.0\text{ K}$ or $\dot{T} \ge 12.0\text{ K/min}$.
- **Held-Out Test Set Performance (175 Trajectories, 18,550 States)**:
  - State Recall (Sensitivity): **98.88%**
  - State Precision: **94.02%**
  - False-Alarm Rate (FAR): **2.37%**
  - Overall Accuracy: **97.94%**
  - ROC AUC: **0.9984**
  - Average Precision: **0.9969**
  - Brier Score: **0.0121**
  - Event-Level Recall: **100.0%**
  - Median Warning Lead Time: **3.20 minutes**
- **Clean Industrial Dark-Blue Web Interface**:
  - **Page 1 (Home)**: Large animated reactor, current thermal status, compact AI warning card, quick disturbance triggers.
  - **Page 2 (Simulation)**: Experiment lab with Start/Pause/Reset, speed selector (1x, 2x, 5x, 10x), cooling failure and hot-feed injection, cooling restoration, and 4 synchronized live charts (Temperature, Concentration, Heat balance, Runaway probability).
  - **Page 3 (Model Evaluation)**: Real test metrics, confusion matrix, ROC curve, PR curve, reliability calibration curve, lead time histogram, and MDI feature importances.
  - **Page 4 (Settings)**: Configurable operating conditions ($T_0, C_{A,0}, T_f, C_{Af}, T_c, \tau, U_0, T_{crit}$) with validation bounds.
  - **Page 5 (About)**: Detailed chemical engineering and machine learning principles, equations, and safety disclaimer.

---

## Directory Structure

```text
cstr-thermal-runaway/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI REST application
│   │   ├── physics.py          # CSTR balances, Arrhenius kinetics, RK2 midpoint
│   │   ├── simulator.py        # Interactive stateful simulation engine
│   │   ├── scenarios.py        # Presets and disturbance models
│   │   ├── features.py         # 14 causal feature extraction pipeline
│   │   ├── labels.py           # 3-minute future-event target computation
│   │   ├── dataset.py          # 700-trajectory synthetic dataset generator
│   │   ├── train.py            # Random Forest training and serialization
│   │   ├── predict.py          # Real-time inference engine
│   │   ├── evaluate.py         # Comprehensive held-out evaluation
│   │   ├── warning_logic.py    # Probability bands and hybrid decision logic
│   │   └── schemas.py          # Pydantic data schemas
│   ├── models/
│   │   ├── rf_model.joblib     # Persisted 120-tree classifier
│   │   ├── model_metadata.json # Training metadata and hyperparameters
│   │   └── evaluation_report.json # Test performance metrics
│   ├── data/
│   │   ├── train_dataset.parquet # 525 training trajectories (55,650 rows)
│   │   └── test_dataset.parquet  # 175 test trajectories (18,550 rows)
│   ├── tests/
│   │   ├── test_physics.py
│   │   ├── test_simulator.py
│   │   ├── test_features.py
│   │   ├── test_labels.py
│   │   ├── test_model.py
│   │   └── test_api.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnimatedReactor.tsx # High-detail SVG animated vessel
│   │   │   ├── AIWarningCard.tsx   # Machine learning warning status
│   │   │   ├── Header.tsx          # Top bar telemetry & controls
│   │   │   └── Sidebar.tsx         # Navigation sidebar
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── SimulationPage.tsx
│   │   │   ├── ModelEvaluationPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── AboutPage.tsx
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── api.ts              # REST client
│   │   ├── App.tsx             # Root component with simulation loop
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/
│   ├── pdf_requirements.md     # Faculty working notes specification summary
│   ├── assumptions_and_changes.md # Baseline vs engineering choices vs audit fixes
│   └── model_card.md           # Intended use, metrics, limitations
├── README.md
└── .gitignore
```

---

## Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.12.10)
- Node.js 18+ (tested on Node v24.13.1)

### 1. Backend Setup
From the repository root:

```bash
cd backend
pip install -r requirements.txt
```

### 2. Dataset Generation and Model Training
The trained model (`rf_model.joblib`), evaluation report, and datasets are already generated and persisted in `backend/models/` and `backend/data/`. To re-generate and re-train from scratch:

```bash
python -m app.train
```

This generates 700 synthetic trajectories using random seed 42, trains the 120-tree Random Forest, evaluates on the 175 held-out trajectories, and saves all reports.

### 3. Frontend Setup
From the repository root:

```bash
cd frontend
npm install
npm run build
```

---

## Running the Application

### Option A: Running Backend and Frontend Together (Unified Server)
FastAPI is pre-configured to serve both the API and the compiled React production frontend from port 8000:

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open your web browser to: **`http://localhost:8000`**

### Option B: Running Development Mode (Vite Hot-Reload)
In terminal 1 (Backend):
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```
Open your web browser to: **`http://localhost:5173`**

---

## Running Automated Tests

### Backend Unit & Integration Tests (pytest)
Runs 25 comprehensive tests verifying physics, ODE midpoint integration, causal features, 3-minute future labels, Random Forest predictions, and API endpoints:

```bash
cd backend
pytest tests/ -v
```

### Frontend Tests (vitest)
```bash
cd frontend
npm run test
```

---

## Repeatable Demonstration Workflow

To reproduce the canonical cooling-failure thermal runaway event from Section 22 of the faculty working notes:

1. Open the application at **`http://localhost:8000`** or **`http://localhost:5173`**.
2. Select the preset **"Faculty Worked Cooling Failure (Sec. 22)"** on the Home or Simulation page.
3. Click **"Start Simulation"**.
4. Observe the reactor operating at stable steady conditions ($T \approx 305\text{ K}$, $C_A \approx 0.88\text{ kmol/m}^3$, liquid color: cool blue).
5. At $t = 10.0\text{ min}$, inject a **Cooling Failure (-82%)** ($U$ drops from $1.1$ to $0.198\text{ min}^{-1}$).
6. Observe:
   - Jacket cooling indicators dim to 18% capacity.
   - Heat removal $q_{rem}$ drops sharply below heat generation $q_{gen}$.
   - Reactor temperature begins rising; liquid color shifts from blue to yellow/amber.
   - At $T \approx 312.3\text{ K}$ ($t \approx 13.3\text{ min}$), the Random Forest model issues an **EARLY WARNING** ($P_{RF} \ge 0.35$).
   - At $t \approx 14.0\text{ min}$, the probability crosses into **CRITICAL RISK** ($P_{RF} \ge 0.70$).
   - At $t \approx 16.1\text{ min}$, the reactor temperature crosses the critical threshold $390.0\text{ K}$.
7. The system records an authentic warning lead time of **$L \approx 2.8\text{ min}$**, successfully demonstrating advance notification before runaway occurs.
8. Click **"Reset"** to repeat or experiment with other disturbance scenarios (e.g. moderate 50% cooling loss or hot-feed steps).

---

## Safety & Educational Disclaimer

> [!WARNING]
> This application is an educational simulation and scientific research proof-of-concept. It is **NOT** a certified industrial Safety Instrumented System (SIS) and does not comply with IEC 61508 or IEC 61511 Safety Integrity Level (SIL) standards. It must not be deployed as an autonomous safety trip or relief mechanism in an operating chemical facility.
