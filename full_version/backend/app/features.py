"""Feature engineering pipeline for CSTR thermal runaway early warning.

Extracts the 14 physics-guided and dynamic features defined in Section 13 of the
faculty notes. Adheres strictly to causal backward differences (no lookahead or centered
derivatives) as required by Section 13.1, Appendix B, and project requirements.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from app.physics import CSTRParameters, reaction_rate_constant


FEATURE_NAMES: List[str] = [
    "temperature_obs",
    "concentration",
    "heating_rate",
    "thermal_acceleration",
    "trailing_temp_max",
    "trailing_temp_slope",
    "heat_generation",
    "heat_removal",
    "net_thermal_drive",
    "reactor_coolant_temp_diff",
    "cooling_coefficient",
    "feed_concentration",
    "feed_temperature",
    "residence_time",
]

FEATURE_DESCRIPTIONS: Dict[str, str] = {
    "temperature_obs": "Current observed reactor temperature [K]",
    "concentration": "Current reactant concentration CA [kmol/m^3]",
    "heating_rate": "Causal instantaneous heating rate dT/dt [K/min]",
    "thermal_acceleration": "Causal thermal acceleration d^2T/dt^2 [K/min^2]",
    "trailing_temp_max": "Maximum observed temperature in trailing 1-min window [K]",
    "trailing_temp_slope": "Causal 1-min trailing temperature slope [K/min]",
    "heat_generation": "Mechanistic heat generation beta * k(T) * CA [K/min]",
    "heat_removal": "Mechanistic heat removal U * (T - Tc) [K/min]",
    "net_thermal_drive": "Net thermal drive q_gen - q_rem [K/min]",
    "reactor_coolant_temp_diff": "Reactor-to-coolant temperature driving force T - Tc [K]",
    "cooling_coefficient": "Available cooling capacity U [min^-1]",
    "feed_concentration": "Feed reactant concentration CAf [kmol/m^3]",
    "feed_temperature": "Current feed temperature Tf [K]",
    "residence_time": "Reactor residence time tau = V / Q [min]",
}


def compute_features_online(
    history: List[Dict[str, Any]],
    params: CSTRParameters,
    dt: float = 0.1,
    window_steps: int = 10,
) -> Optional[Dict[str, float]]:
    """Compute the 14 causal features from an online rolling state history.
    
    Requires at least 3 state observations for heating rate and thermal acceleration.
    Uses window_steps (default 10 steps = 1.0 min at dt=0.1) for trailing max and slope.
    Returns None if history has fewer than 3 records.
    """
    if len(history) < 3:
        return None
        
    curr = history[-1]
    prev1 = history[-2]
    prev2 = history[-3]
    
    T_curr = float(curr.get("T_obs", curr.get("T", 300.0)))
    T_prev1 = float(prev1.get("T_obs", prev1.get("T", 300.0)))
    T_prev2 = float(prev2.get("T_obs", prev2.get("T", 300.0)))
    
    CA = float(curr.get("CA", 1.0))
    U = float(curr.get("U", params.U0))
    Tf = float(curr.get("Tf", params.Tf))
    Tc = float(curr.get("Tc", params.Tc))
    CAf = float(curr.get("CAf", params.CAf))
    tau = float(curr.get("tau", params.tau))
    beta = float(curr.get("beta", params.beta))
    A = float(curr.get("A", params.A))
    E_over_R = float(curr.get("E_over_R", params.E_over_R))
    
    # Strictly causal backward derivatives
    dT_dt = (T_curr - T_prev1) / dt
    dT_dt_prev = (T_prev1 - T_prev2) / dt
    d2T_dt2 = (dT_dt - dT_dt_prev) / dt
    
    # Trailing 1-minute window (up to window_steps + 1 samples)
    w_start = max(0, len(history) - (window_steps + 1))
    sub_history = history[w_start:]
    sub_temps = [float(h.get("T_obs", h.get("T", 300.0))) for h in sub_history]
    
    T_max_1m = float(np.max(sub_temps))
    m = len(sub_temps) - 1
    if m > 0:
        s_T_1m = (sub_temps[-1] - sub_temps[0]) / (m * dt)
    else:
        s_T_1m = dT_dt
        
    # Mechanistic thermal terms
    k = reaction_rate_constant(T_curr, A, E_over_R)
    q_gen = beta * k * CA
    q_rem = U * (T_curr - Tc)
    q_net = q_gen - q_rem
    T_minus_Tc = T_curr - Tc
    
    return {
        "temperature_obs": round(T_curr, 4),
        "concentration": round(CA, 5),
        "heating_rate": round(dT_dt, 5),
        "thermal_acceleration": round(d2T_dt2, 5),
        "trailing_temp_max": round(T_max_1m, 4),
        "trailing_temp_slope": round(s_T_1m, 5),
        "heat_generation": round(q_gen, 5),
        "heat_removal": round(q_rem, 5),
        "net_thermal_drive": round(q_net, 5),
        "reactor_coolant_temp_diff": round(T_minus_Tc, 4),
        "cooling_coefficient": round(U, 4),
        "feed_concentration": round(CAf, 4),
        "feed_temperature": round(Tf, 4),
        "residence_time": round(tau, 4),
    }


def compute_features_trajectory(
    df: pd.DataFrame,
    dt: float = 0.1,
    window_steps: int = 10,
) -> pd.DataFrame:
    """Compute the 14 features for an entire trajectory DataFrame offline.
    
    Ensures exact causal calculations with no future leakage:
      - heating_rate = T_obs.diff() / dt
      - thermal_acceleration = heating_rate.diff() / dt
      - trailing_temp_max = T_obs.rolling(window=10, min_periods=1).max()
      - trailing_temp_slope = (T_obs - T_obs.shift(10)) / (10 * dt)
    """
    res = df.copy()
    
    T_obs = res["temperature_obs"]
    
    # Causal derivatives
    res["heating_rate"] = T_obs.diff() / dt
    res["thermal_acceleration"] = res["heating_rate"].diff() / dt
    
    # Trailing window
    res["trailing_temp_max"] = T_obs.rolling(window=window_steps + 1, min_periods=1).max()
    shift_steps = window_steps
    res["trailing_temp_slope"] = (T_obs - T_obs.shift(shift_steps)) / (shift_steps * dt)
    # Fill early shift points with instantaneous rate to avoid NaN
    res["trailing_temp_slope"] = res["trailing_temp_slope"].fillna(res["heating_rate"])
    
    # Kinetic rate
    k_series = res.apply(
        lambda row: reaction_rate_constant(row["temperature_obs"], row["A"], row["E_over_R"]),
        axis=1
    )
    res["heat_generation"] = res["beta"] * k_series * res["concentration"]
    res["heat_removal"] = res["cooling_coefficient"] * (res["temperature_obs"] - res["Tc"])
    res["net_thermal_drive"] = res["heat_generation"] - res["heat_removal"]
    res["reactor_coolant_temp_diff"] = res["temperature_obs"] - res["Tc"]
    
    return res
