# Faculty CSTR Thermal Runaway Notes — Scientific Requirements Summary

**Document Reference**: *Detailed Working Notes: Physics-Based Random-Forest Early Warning for Thermal Runaway in an Exothermic CSTR*  
**Faculty / Author**: Dr. Arun K. Varanasi, Department of Chemical Engineering, Saintgits College of Engineering (06 October 2026).

---

## 1. System Definition & Governing Differential Equations

The reactor is an ideally mixed continuous stirred-tank reactor (CSTR) carrying out a single irreversible liquid-phase exothermic reaction $A \rightarrow B$.

### 1.1 Species Balance (Reactant Concentration $C_A$)
From first-principles mass conservation (Section 3):

$$\frac{dC_A}{dt} = \frac{C_{Af} - C_A}{\tau} - k(T) C_A$$

Where:
- $C_A$: Reactant concentration in the reactor $[ \text{kmol} \cdot \text{m}^{-3} ]$
- $C_{Af}$: Reactant concentration in the inlet feed $[ \text{kmol} \cdot \text{m}^{-3} ]$
- $\tau = \frac{V}{Q}$: Mean reactor residence time $[ \text{min} ]$
- $k(T)$: Arrhenius reaction rate constant $[ \text{min}^{-1} ]$

### 1.2 Energy Balance (Reactor Temperature $T$)
From first-principles sensible thermal energy conservation (Section 5):

$$\frac{dT}{dt} = \frac{T_f - T}{\tau} + \beta k(T) C_A - U(T - T_c)$$

Where:
- $T$: Reactor bulk temperature $[ \text{K} ]$
- $T_f$: Feed inlet temperature $[ \text{K} ]$
- $T_c$: Cooling jacket/coil coolant temperature $[ \text{K} ]$
- $\beta = \frac{-\Delta H_{rxn}}{\rho C_p}$: Heat of reaction release parameter $[ \text{K} \cdot \text{m}^3 \cdot \text{kmol}^{-1} ]$
- $U = \frac{UA}{\rho C_p V}$: Normalized overall cooling heat transfer coefficient $[ \text{min}^{-1} ]$

### 1.3 Arrhenius Kinetics
From Section 4:

$$k(T) = A \exp\left( -\frac{E/R}{T} \right)$$

$$\frac{dk}{dT} = k(T) \frac{E/R}{T^2} > 0$$

Where:
- $A$: Kinetic pre-exponential frequency factor $[ \text{min}^{-1} ]$
- $E/R$: Activation temperature $[ \text{K} ]$

---

## 2. Thermal Quantities and Acceleration Dynamics

The rate of temperature change is broken into distinct physical mechanisms (Section 5.4):
- **Sensible flow enthalpy contribution**: $q_{flow} = \frac{T_f - T}{\tau} \quad [\text{K} \cdot \text{min}^{-1}]$
- **Reaction heat generation**: $q_{gen} = \beta k(T) C_A \quad [\text{K} \cdot \text{min}^{-1}]$
- **Jacket heat removal**: $q_{rem} = U (T - T_c) \quad [\text{K} \cdot \text{min}^{-1}]$
- **Net thermal drive**: $q_{net} = q_{gen} - q_{rem} \quad [\text{K} \cdot \text{min}^{-1}]$
- Net heating rate: $\frac{dT}{dt} = q_{flow} + q_{net}$

### Thermal Acceleration (Section 6)
Differentiating the energy balance reveals the competition between Arrhenius amplification and damping:

$$\frac{d^2T}{dt^2} = \left[ -\left( \frac{1}{\tau} + U \right) + \beta C_A k'(T) \right] \dot{T} + \beta k(T) \left[ \frac{C_{Af} - C_A}{\tau} - k(T) C_A \right]$$

When Arrhenius amplification $\beta C_A k'(T)$ overcomes cooling/flow damping $\left(\frac{1}{\tau} + U\right)$, thermal runaway rapidly accelerates.

---

## 3. Numerical Integration Method

From Section 9.2:
- **Method**: Explicit Midpoint Runge-Kutta method (RK2)
- **Time step**: $\Delta t = 0.1\text{ min}$ (6.0 seconds)
- **Integration steps**:
  1. $k_{1,C} = \frac{C_{Af} - C_{A,n}}{\tau} - k(T_n) C_{A,n}$
  2. $k_{1,T} = \frac{T_f(t_n) - T_n}{\tau} + \beta k(T_n) C_{A,n} - U(t_n)(T_n - T_c)$
  3. $C_{A,n+1/2} = C_{A,n} + \frac{\Delta t}{2} k_{1,C}$
  4. $T_{n+1/2} = T_n + \frac{\Delta t}{2} k_{1,T}$
  5. $k_{2,C} = \frac{C_{Af} - C_{A,n+1/2}}{\tau} - k(T_{n+1/2}) C_{A,n+1/2}$
  6. $k_{2,T} = \frac{T_f(t_n + \Delta t / 2) - T_{n+1/2}}{\tau} + \beta k(T_{n+1/2}) C_{A,n+1/2} - U(t_n + \Delta t / 2)(T_{n+1/2} - T_c)$
  7. $C_{A,n+1} = \max(0, C_{A,n} + \Delta t \cdot k_{2,C})$
  8. $T_{n+1} = T_n + \Delta t \cdot k_{2,T}$

---

## 4. Disturbance Models

### 4.1 Loss of Cooling Capacity (Section 8.1)
$$U(t) = U_0 [ 1 - f_{loss} H(t - t_d) ]$$
Where $f_{loss} \in [0, 1]$ is the fraction of cooling lost at disturbance onset time $t_d$.

### 4.2 Hot-Feed Disturbance (Section 8.2)
$$T_f(t) = T_{f,0} + \Delta T_f H(t - t_d)$$

---

## 5. Machine Learning Requirements

### 5.1 Early Warning Target Definition (Section 12)
- **Prediction horizon**: $H = 3.0\text{ min}$ strictly.
- **Critical runaway temperature threshold**: $T_{event} = 390.0\text{ K}$.
- **Target variable**:
  $$y_i = \mathbb{I}\left( \max_{t_i \le t \le t_i + H} T(t) \ge 390.0\text{ K} \right)$$
- The target is forward-looking and never provided to the model as an input feature.

### 5.2 The 14 Input Features (Section 13, Eq. 94)
1. $T_{obs}$: Current measured reactor temperature $[ \text{K} ]$
2. $C_A$: Reactant concentration $[ \text{kmol} \cdot \text{m}^{-3} ]$
3. $\dot{T}$: Instantaneous heating rate $[ \text{K} \cdot \text{min}^{-1} ]$
4. $\ddot{T}$: Thermal acceleration $[ \text{K} \cdot \text{min}^{-2} ]$
5. $T_{max,1m}$: Maximum temperature over trailing 1-min window $[ \text{K} ]$
6. $s_{T,1m}$: Trailing 1-min temperature slope $[ \text{K} \cdot \text{min}^{-1} ]$
7. $q_{gen}$: Reaction heat generation $[ \text{K} \cdot \text{min}^{-1} ]$
8. $q_{rem}$: Cooling heat removal $[ \text{K} \cdot \text{min}^{-1} ]$
9. $q_{net}$: Net thermal drive $[ \text{K} \cdot \text{min}^{-1} ]$
10. $T_{obs} - T_c$: Reactor-to-coolant temperature difference $[ \text{K} ]$
11. $U$: Current cooling heat transfer coefficient $[ \text{min}^{-1} ]$
12. $C_{Af}$: Feed concentration $[ \text{kmol} \cdot \text{m}^{-3} ]$
13. $T_f$: Current feed temperature $[ \text{K} ]$
14. $\tau$: Mean residence time $[ \text{min} ]$

### 5.3 Random Forest Configuration (Appendix A)
- Estimators: 120 trees
- Max depth: 8
- Min samples per leaf: 12
- Max features: `"sqrt"`
- Class weight: `"balanced_subsample"`
- Random seed: 42

### 5.4 Probability Bands & Hybrid Alarm Logic (Section 17)
- **SAFE**: $P_{RF} < 0.35$
- **WARNING**: $0.35 \le P_{RF} < 0.70$
- **CRITICAL**: $P_{RF} \ge 0.70$
- **Hybrid rule**: $S_{hybrid} = \max(S_{physics}, S_{RF})$, where $S_{physics} = 2$ if $T \ge 390\text{ K}$ or $\dot{T} \ge 12\text{ K/min}$.
