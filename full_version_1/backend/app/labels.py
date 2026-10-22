"""Future-event target labeling for thermal runaway early warning.

Constructs the binary target variable 'target_critical_15m' using a 15-minute
forward-looking prediction horizon:
  target_critical_15m = 1 if the reactor temperature reaches or exceeds 390 K
  at any point in the next 15 minutes, excluding the current instant (t in (t_i, t_i + H]).

  Otherwise, label is 0 only when the complete next 15 minutes are available
  and no critical crossing occurs during that interval.

  Incomplete future windows (where remaining trajectory duration < 15.0 min
  and no crossing occurred) are excluded from training and evaluation.
"""

from __future__ import annotations
from typing import Tuple
import numpy as np
import pandas as pd


HORIZON_MINUTES: float = 15.0
CRITICAL_TEMPERATURE_K: float = 390.0
TARGET_COLUMN: str = "target_critical_15m"


def compute_future_event_labels(
    temperatures: np.ndarray,
    times: np.ndarray,
    horizon: float = HORIZON_MINUTES,
    critical_temp: float = CRITICAL_TEMPERATURE_K,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute binary indicator target_critical_15m and valid_mask.
    
    Parameters:
      temperatures: 1D array of reactor temperatures T(t)
      times: 1D array of timestamps t
      horizon: prediction horizon H (default 15.0 min)
      critical_temp: runaway threshold (default 390.0 K)
      
    Returns:
      labels: 1D integer array (0 or 1)
      valid_mask: 1D boolean array indicating whether the future window is complete/valid
    """
    n = len(temperatures)
    labels = np.zeros(n, dtype=int)
    valid_mask = np.zeros(n, dtype=bool)
    
    if n == 0:
        return labels, valid_mask
        
    t_end = float(times[-1])
    
    for i in range(n):
        t_curr = float(times[i])
        t_window_end = t_curr + horizon
        
        # Strictly future points within (t_curr, t_curr + horizon]
        future_indices = [
            j for j in range(i + 1, n)
            if times[j] <= t_window_end + 1e-6
        ]
        
        if len(future_indices) > 0:
            max_future_T = float(np.max(temperatures[future_indices]))
        else:
            max_future_T = -np.inf
            
        if max_future_T >= critical_temp:
            # Critical crossing occurs within next 15 minutes
            labels[i] = 1
            valid_mask[i] = True
        else:
            # No crossing occurred.
            # Only valid 0 if the trajectory continues for the full horizon
            if t_end >= t_window_end - 1e-6:
                labels[i] = 0
                valid_mask[i] = True
            else:
                # Incomplete future window without crossing -> must exclude
                labels[i] = 0
                valid_mask[i] = False
                
    return labels, valid_mask


def label_trajectory_dataframe(
    df: pd.DataFrame,
    horizon: float = HORIZON_MINUTES,
    critical_temp: float = CRITICAL_TEMPERATURE_K,
    temp_col: str = "temperature_obs",
    time_col: str = "Time (min)",
) -> pd.DataFrame:
    """Add target_critical_15m and valid_window_15m columns to a trajectory DataFrame."""
    res = df.copy()
    
    t_col = time_col if time_col in res.columns else ("time_min" if "time_min" in res.columns else res.columns[0])
    if temp_col not in res.columns:
        if "Reactor Temp (K)" in res.columns:
            temp_col = "Reactor Temp (K)"
        elif "T_true" in res.columns:
            temp_col = "T_true"
        elif "T" in res.columns:
            temp_col = "T"
            
    temps = res[temp_col].to_numpy()
    times = res[t_col].to_numpy()
    
    labels, valid = compute_future_event_labels(
        temps, times, horizon=horizon, critical_temp=critical_temp
    )
    
    res[TARGET_COLUMN] = labels
    res["valid_window_15m"] = valid
    
    # Backward compatible aliases
    res["critical_within_15min"] = labels
    res["critical_within_3min"] = labels
    res["target_critical"] = labels
    
    return res
