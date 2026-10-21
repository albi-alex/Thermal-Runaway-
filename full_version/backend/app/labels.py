"""Future-event target labeling for thermal runaway early warning.

Constructs the binary target variable 'critical_within_3min' using a 3-minute
forward-looking prediction horizon as specified in Section 12 of the faculty notes:
  y_i = 1 if max_{t in [t_i, t_i + H]} T(t) >= T_critical else 0, where H = 3.0 min.
"""

from __future__ import annotations
import numpy as np
import pandas as pd


HORIZON_MINUTES: float = 3.0
CRITICAL_TEMPERATURE_K: float = 390.0


def compute_future_event_labels(
    temperatures: np.ndarray,
    times: np.ndarray,
    horizon: float = HORIZON_MINUTES,
    critical_temp: float = CRITICAL_TEMPERATURE_K,
    dt: float = 0.1,
) -> np.ndarray:
    """Compute binary indicator y_i for whether T reaches critical_temp within horizon.
    
    Parameters:
      temperatures: 1D array of reactor temperatures T(t)
      times: 1D array of timestamps t
      horizon: prediction horizon H (default 3.0 min)
      critical_temp: runaway threshold (default 390.0 K)
      dt: integration step size (default 0.1 min)
      
    Returns:
      labels: 1D integer array (0 or 1)
    """
    n = len(temperatures)
    labels = np.zeros(n, dtype=int)
    steps_ahead = int(round(horizon / dt))
    
    for i in range(n):
        end_idx = min(n, i + steps_ahead + 1)
        max_future_T = np.max(temperatures[i:end_idx])
        if max_future_T >= critical_temp:
            labels[i] = 1
            
    return labels


def label_trajectory_dataframe(
    df: pd.DataFrame,
    horizon: float = HORIZON_MINUTES,
    critical_temp: float = CRITICAL_TEMPERATURE_K,
    dt: float = 0.1,
) -> pd.DataFrame:
    """Add 'critical_within_3min' target column to a trajectory DataFrame."""
    res = df.copy()
    temps = res["temperature_K"].to_numpy()
    times = res["time_min"].to_numpy()
    res["critical_within_3min"] = compute_future_event_labels(
        temps, times, horizon=horizon, critical_temp=critical_temp, dt=dt
    )
    return res
