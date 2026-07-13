import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp

# ==================================================
# PARAMETERS (FROM PDF – THERMAL RUNAWAY CSTR)
# ==================================================
q = 100.0        # L/min
V = 100.0        # L
CAi = 1.0        # mol/L
Ti = 350.0       # K

rho = 1000.0     # g/L
Cp = 0.239       # J/g/K

dH = 5e4         # J/mol (exothermic)
ER = 8750.0      # K
k0 = 7.2e10      # 1/min

UA = 5e4         # J/min/K

# ==================================================
# REACTION RATE
# ==================================================
def k(T):
    return k0 * np.exp(-ER / T)

# ==================================================
# CSTR MODEL
# ==================================================
def cstr(t, y, Tc):
    CA, T = y
    rA = k(T) * CA

    dCA = (q/V)*(CAi - CA) - rA

    dT = (
        q*rho*Cp*(Ti - T)
        + dH*V*rA
        + UA*(Tc - T)
    ) / (V*rho*Cp)

    return [dCA, dT]

# ==================================================
# SIMULATION SETTINGS
# ==================================================
t_span = (0, 10)
t_eval = np.linspace(0, 10, 1000)
y0 = [0.5, 350.0]

coolant_temps = [290, 300, 305]

solutions = {}
dataset = []

# ==================================================
# RUN SIMULATIONS
# ==================================================
for Tc in coolant_temps:
    sol = solve_ivp(
        cstr,
        t_span,
        y0,
        args=(Tc,),
        method='BDF',
        t_eval=t_eval
    )
    solutions[Tc] = sol

    for i in range(len(sol.t)):
        label = "Critical" if sol.y[1][i] >= 410 else "Safe"
        dataset.append([
            sol.t[i],
            Tc,
            sol.y[1][i],
            sol.y[0][i],
            label
        ])

# ==================================================
# CREATE DATASET (10,000 ROWS)
# ==================================================
df = pd.DataFrame(
    dataset,
    columns=["Time (min)", "Coolant Temp (K)", "Reactor Temp (K)", "CA (mol/L)", "Condition"]
)

df = df.sample(n=10000, replace=True, random_state=42)
df.to_csv("CSTR_synthetic_dataset.csv", index=False)

# ==================================================
# PLOT 1: TEMPERATURE
# ==================================================
plt.figure(figsize=(8,5))
for Tc in coolant_temps:
    plt.plot(
        solutions[Tc].t,
        solutions[Tc].y[1],
        label=f"{Tc} K"
    )

plt.xlabel("Time (min)")
plt.ylabel("Reactor Temperature (K)")
plt.title("CSTR Temperature Response")
plt.legend()
plt.grid()
plt.show()

# ==================================================
# PLOT 2: CONCENTRATION
# ==================================================
plt.figure(figsize=(8,5))
for Tc in coolant_temps:
    plt.plot(
        solutions[Tc].t,
        solutions[Tc].y[0],
        label=f"{Tc} K"
    )

plt.xlabel("Time (min)")
plt.ylabel("Reactant A Concentration (mol/L)")
plt.title("CSTR Concentration Response")
plt.legend()
plt.grid()
plt.show()