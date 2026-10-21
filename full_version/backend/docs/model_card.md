# Model Card: CSTR Thermal Runaway Early Warning System

## Model Details
- **Model Name**: Physics-Guided Random Forest Early Warning Classifier
- **Model Version**: 1.0.0
- **Model Type**: Supervised Ensemble Classifier (`scikit-learn` `RandomForestClassifier`)
- **Number of Estimators**: 120 decision trees
- **Tree Depth & Controls**: Maximum depth 8, minimum samples per leaf 12, `max_features="sqrt"`
- **Class Balancing**: `"balanced_subsample"`
- **Target Variable**: Binary classification `critical_within_3min`
  $$y_i = \mathbb{I}\left( \max_{t_i \le t \le t_i + 3.0\text{ min}} T(t) \ge 390.0\text{ K} \right)$$
- **License**: MIT / Educational Research
- **Faculty Reference**: Dr. Arun K. Varanasi, Department of Chemical Engineering, Saintgits College of Engineering (06 Oct 2026).

---

## Intended Use
- **Primary Use Case**: Early warning decision-support in chemical engineering education, process safety simulations, and interactive research demonstrations.
- **Decision Horizon**: Anticipates impending thermal runaway within a strict 3.0-minute future window ($H = 3.0\text{ min}$).
- **Out-of-Scope / Prohibited Uses**: Real-world chemical plant automated trip or safety interlock system without hardware redundancy, physical relief valves, and certified Safety Instrumented Systems (IEC 61508 / IEC 61511).

---

## Input Features (14 Dimensions)
All features are computed using strictly causal observations ($t \le t_i$):
1. `temperature_obs`: Current observed reactor bulk temperature $[ \text{K} ]$
2. `concentration`: Current reactant concentration $C_A \ [ \text{kmol} \cdot \text{m}^{-3} ]$
3. `heating_rate`: Causal backward difference $\dot{T} = (T_{obs}[i] - T_{obs}[i-1])/\Delta t \ [ \text{K} \cdot \text{min}^{-1} ]$
4. `thermal_acceleration`: Causal backward acceleration $\ddot{T} = (\dot{T}[i] - \dot{T}[i-1])/\Delta t \ [ \text{K} \cdot \text{min}^{-2} ]$
5. `trailing_temp_max`: Maximum temperature in trailing 1.0-minute window $[ \text{K} ]$
6. `trailing_temp_slope`: Causal trailing 1.0-minute linear trend $[ \text{K} \cdot \text{min}^{-1} ]$
7. `heat_generation`: Reaction heat release $q_{gen} = \beta k(T_{obs}) C_A \ [ \text{K} \cdot \text{min}^{-1} ]$
8. `heat_removal`: Cooling jacket heat removal $q_{rem} = U(T_{obs} - T_c) \ [ \text{K} \cdot \text{min}^{-1} ]$
9. `net_thermal_drive`: Mechanistic imbalance $q_{net} = q_{gen} - q_{rem} \ [ \text{K} \cdot \text{min}^{-1} ]$
10. `reactor_coolant_temp_diff`: Driving force $T_{obs} - T_c \ [ \text{K} ]$
11. `cooling_coefficient`: Overall heat transfer capacity $U \ [ \text{min}^{-1} ]$
12. `feed_concentration`: Feed reactant loading $C_{Af} \ [ \text{kmol} \cdot \text{m}^{-3} ]$
13. `feed_temperature`: Feed thermal state $T_f \ [ \text{K} ]$
14. `residence_time`: Space time $\tau = V/Q \ [ \text{min} ]$

---

## Training Data & Methodology
- **Generation Engine**: Numerical integration of CSTR mass and energy balances via Explicit Midpoint RK2 ($\Delta t = 0.1\text{ min}$).
- **Trajectory Count**: 700 independent trajectories (seed 42).
- **Split Strategy**: Strict trajectory-level disjoint partitioning (75% train, 25% test).
  - Training set: 525 trajectories (55,650 states).
  - Held-out test set: 175 trajectories (18,550 states).
- **Observation Filtering**: First 1.0 minute warm-up removed; subsampled at $\Delta t_{sample} = 0.2\text{ min}$ (106 observations per trajectory).
- **Uncensored Horizon**: Trajectories simulated to 25.0 minutes to ensure every retained row up to 22.0 minutes possesses a complete 3.0-minute future target.

---

## Held-Out Test Evaluation Results

Evaluated on 175 untouched, held-out test trajectories (18,550 states) at threshold $\tau = 0.35$:

### State-Level Metrics
- **State Recall (Sensitivity)**: **98.88%**
- **State Precision (PPV)**: **94.02%**
- **State False-Alarm Rate (FAR)**: **2.37%**
- **State Specificity**: **97.63%**
- **State Accuracy**: **97.94%**
- **F1 Score**: **0.9638**
- **ROC AUC**: **0.9984**
- **Average Precision (PR AUC)**: **0.9969**
- **Brier Score**: **0.0121**

### Event-Level Metrics
- **Event-Level Recall**: **100.0%** (all runaway test trajectories triggered an alert)
- **Timely Event Recall**: **100.0%** (alert strictly preceded the $390.0\text{ K}$ crossing)
- **Median Warning Lead Time**: **3.20 minutes**
- **Lead Time Range**: $1.0\text{ min}$ to $5.4\text{ min}$

---

## Limitations and Safety Restrictions
1. **Kinetic Specificity**: Calibrated for a single irreversible exothermic reaction $A \rightarrow B$ with Arrhenius kinetics.
2. **Ideal Mixing Assumption**: Assumes uniform spatial temperature and concentration throughout the vessel.
3. **Sensor Noise Sensitivity**: Uses causal backward differences which can amplify high-frequency measurement noise; in noisy industrial environments, causal local polynomial smoothing is advised.
4. **Out-of-Distribution Inputs**: Decision tree predictions for inputs substantially outside the Section 10 parameter envelope should be flagged with an out-of-distribution warning.
5. **Educational Disclaimer**: This model is a synthetic teaching and research proof-of-concept. It does not replace mechanical rupture disks or certified Safety Instrumented Systems.
