# Assumptions, Implementation Choices, and Methodological Differences

This document explicitly distinguishes:
1. Requirements taken directly from the faculty notes.
2. Engineering choices made to implement the full-stack web application.
3. Assumptions adopted where the source notes did not specify a value.
4. Methodological corrections implemented from the faculty audit section.

---

## 1. Requirements Taken Directly from the Faculty Notes

The following specifications are taken directly without modification from Dr. Arun K. Varanasi's detailed working notes:

- **Mathematical Balances**:
  - Species balance: $\frac{dC_A}{dt} = \frac{C_{Af} - C_A}{\tau} - k(T) C_A$ (Eq. 12)
  - Sensible energy balance: $\frac{dT}{dt} = \frac{T_f - T}{\tau} + \beta k(T) C_A - U(T - T_c)$ (Eq. 32)
  - Arrhenius kinetics: $k(T) = A \exp\left(-\frac{E/R}{T}\right)$ (Eq. 15)
- **Numerical Integration**:
  - Explicit midpoint Runge-Kutta method (RK2) with step size $\Delta t = 0.1\text{ min}$ (Section 9.2).
- **Critical Runaway Threshold**:
  - $T_{event} = 390.0\text{ K}$ (Eq. 1).
- **Prediction Horizon**:
  - $H = 3.0\text{ min}$ strictly. No other prediction horizons are permitted.
- **The 14 Input Features**:
  - Exact 14 features described in Section 13 (Eq. 94):
    $T_{obs}, C_A, \dot{T}, \ddot{T}, T_{max,1m}, s_{T,1m}, q_{gen}, q_{rem}, q_{net}, T-T_c, U, C_{Af}, T_f, \tau$.
- **Offline Random Forest Configuration (Appendix A)**:
  - `n_estimators = 120`
  - `max_depth = 8`
  - `min_samples_leaf = 12`
  - `max_features = 'sqrt'`
  - `class_weight = 'balanced_subsample'`
  - `random_state = 42`
- **Alarm Probability Bands (Section 17)**:
  - SAFE: $P_{RF} < 0.35$
  - WARNING: $0.35 \le P_{RF} < 0.70$
  - CRITICAL: $P_{RF} \ge 0.70$
- **Hybrid Alarm Rule (Section 17)**:
  - $S_{hybrid} = \max(S_{physics}, S_{RF})$ where physics alarm triggers on $T \ge 390\text{ K}$ or $\dot{T} \ge 12\text{ K/min}$.
- **Synthetic Dataset Specification (Section 10 & 11)**:
  - 700 total trajectories generated with random seed 42.
  - Parameter distributions: $C_{Af} \sim \mathcal{U}(0.70, 1.30)$, $T_{f,0} \sim \mathcal{U}(318, 338)$, $\tau \sim \mathcal{U}(3.0, 7.5)$, $T_c \sim \mathcal{U}(292, 307)$, $U_0 \sim \mathcal{U}(0.18, 0.48)$, $A = 1.5\times 10^{10} \exp(Z), Z \sim \mathcal{N}(0, 0.12^2)$, $E/R \sim \mathcal{U}(8450, 9000)$, $\beta \sim \mathcal{U}(105, 155)$, $t_d \sim \mathcal{U}(4, 12)$, $f_{loss} \sim \text{Beta}(1.35, 1.15)$, $\Delta T_f \sim \text{Mixture}(0.58 \text{ for } 0, \mathcal{U}(4, 28))$, $\sigma_T \sim \mathcal{U}(0.05, 0.60)$, $C_A(0) \sim C_{Af}\mathcal{U}(0.72, 0.98)$, $T(0) \sim T_{f,0} + \mathcal{U}(-3, 4)$.
  - 106 retained samples per trajectory from $t=1.0$ to $22.0\text{ min}$ (subsampled every 0.2 min) = 74,200 rows.
  - Trajectory-level disjoint split: 525 training trajectories (55,650 rows), 175 held-out test trajectories (18,550 rows).

---

## 2. Engineering Choices Made to Implement the Application

- **Backend Architecture**:
  - Python 3.12 with FastAPI REST API framework and Uvicorn.
  - NumPy for vectorized ODE step integration.
  - Scikit-learn for Random Forest training and inference.
  - Joblib for model serialization.
  - Pydantic v2 schemas for strict request/response data validation.
- **Frontend Architecture**:
  - React 18/19 with TypeScript and Tailwind CSS.
  - Lucide React industrial and safety iconography.
  - Recharts for multi-series dynamic charting.
  - Custom SVG reactor illustration with dynamic liquid height, dynamic SVG linearGradient color mapping (cool blue $\rightarrow$ emerald $\rightarrow$ amber $\rightarrow$ fire orange $\rightarrow$ alarm red), rotating impeller animation, bubbling convection dots, and animated coolant jacket flow.
- **State Management & Persistence**:
  - Simulation state maintained in memory with rolling causal history buffer.
  - Persisted trained model in `backend/models/rf_model.joblib`.
  - Persisted evaluation results in `backend/models/evaluation_report.json`.

---

## 3. Assumptions Adopted for Missing or Open Details

- **Sensor Noise during Online Simulation**:
  - Section 11.1 notes that $T^{obs}_i = T_i + \epsilon_i$ where $\epsilon_i \sim \mathcal{N}(0, \sigma_T^2)$. During live interactive simulation, a nominal noise standard deviation $\sigma_T = 0.15\text{ K}$ is applied to reactor temperature measurements.
- **Browser Simulation Step Rate**:
  - The backend advances by $\Delta t = 0.1\text{ min}$ (6 simulated seconds) per integration step. In the web interface, a step interval of 150 ms (adjustable via speed controls 1x, 2x, 5x, 10x) provides smooth animation and human-observable reactor dynamics.
- **Reactor Concentration Measurement**:
  - In line with Section 11.1, reactant concentration $C_A$ is treated as an unmeasured or state-estimated quantity provided by the simulator.

---

## 4. Methodological Corrections Implemented from the Faculty Audit

Section 23, 24, and Appendix B of the faculty notes conducted a critical audit of the original notebook. We implemented the recommended corrections:

1. **Strictly Causal Derivative Replacement**:
   - *Original notebook limitation*: Used centered numerical gradients ($T_{i+1} - T_{i-1}) / 2\Delta t$, which uses future sample $T_{i+1}$ (data leakage).
   - *Implemented correction*: Enforced strictly causal backward differences for heating rate:
     $$\dot{T}_i = \frac{T_{obs}[i] - T_{obs}[i-1]}{\Delta t}$$
     and thermal acceleration:
     $$\ddot{T}_i = \frac{\dot{T}_i - \dot{T}_{i-1}}{\Delta t}$$
     As proven in Section 13.1 and Appendix B, this ensures zero future lookahead.

2. **Uncensored Prediction Horizon**:
   - *Original notebook limitation*: Trajectories ended at $t=22.0\text{ min}$, causing rows at $t > 19.0\text{ min}$ to have less than the full 3.0-minute future observation window.
   - *Implemented correction*: Simulated each trajectory out to $t=25.0\text{ min}$ before labeling, ensuring every retained observation up to $t=22.0\text{ min}$ has an authentic, complete 3.0-minute future horizon.

3. **Strict Timely Event Recall Calculation**:
   - *Original notebook limitation*: Counted runaway scenarios as alerted if any alarm occurred, even if $t_{warn} \ge t_{crit}$.
   - *Implemented correction*: Defined strict timely event recall requiring $t_{warn} < t_{crit}$ ($L > 0$), reporting both total and timely event recall alongside full lead-time distributions.
