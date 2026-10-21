"""Warning logic and decision classification for CSTR thermal runaway.

Implements the 3 probability bands and hybrid decision layer from Section 17 of the
faculty notes:
  - SAFE: P_RF < 0.35
  - WARNING: 0.35 <= P_RF < 0.70
  - CRITICAL: P_RF >= 0.70
  
Physical thresholds:
  - Temperature hard limit: T >= 390.0 K
  - Instantaneous heating rate limit: dT/dt >= 12.0 K/min
  
Hybrid status:
  - S_hybrid = max(S_physics, S_RF)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Any


SAFE_THRESHOLD: float = 0.35
CRITICAL_THRESHOLD: float = 0.70
DEFAULT_CRITICAL_TEMP: float = 390.0
DEFAULT_HEATING_RATE_LIMIT: float = 12.0


@dataclass
class WarningAssessment:
    """Detailed evaluation of AI warning and physical reactor state."""
    # Machine Learning status
    rf_probability: float
    rf_category: str           # "SAFE", "WARNING", "CRITICAL"
    rf_severity: int           # 0, 1, 2
    
    # Physics hard limit status
    physics_category: str      # "SAFE", "CRITICAL"
    physics_severity: int      # 0 or 2
    physics_limit_triggered: bool
    physics_reason: Optional[str]
    
    # Hybrid overall status
    hybrid_category: str       # "SAFE", "WARNING", "CRITICAL"
    hybrid_severity: int       # 0, 1, 2
    
    # Context
    current_temperature: float
    distance_to_critical: float # 390 K - T (positive if below threshold)
    prediction_horizon_min: float
    message: str
    action_recommendation: str


def classify_warning(
    rf_probability: float,
    current_temperature: float,
    heating_rate: float = 0.0,
    critical_temp: float = DEFAULT_CRITICAL_TEMP,
    heating_rate_limit: float = DEFAULT_HEATING_RATE_LIMIT,
    horizon_min: float = 15.0,
) -> WarningAssessment:
    """Classify the current reactor state into warning levels."""
    p = max(0.0, min(1.0, float(rf_probability)))
    
    # RF status
    if p < SAFE_THRESHOLD:
        rf_cat = "SAFE"
        rf_sev = 0
    elif p < CRITICAL_THRESHOLD:
        rf_cat = "WARNING"
        rf_sev = 1
    else:
        rf_cat = "CRITICAL"
        rf_sev = 2
        
    # Physics hard limit
    physics_triggered = False
    physics_reason = None
    physics_cat = "SAFE"
    physics_sev = 0
    
    if current_temperature >= critical_temp:
        physics_triggered = True
        physics_reason = f"Reactor temperature ({current_temperature:.1f} K) has reached or exceeded critical threshold ({critical_temp:.1f} K)."
        physics_cat = "CRITICAL"
        physics_sev = 2
    elif heating_rate >= heating_rate_limit:
        physics_triggered = True
        physics_reason = f"Instantaneous heating rate ({heating_rate:.2f} K/min) exceeds physical limit ({heating_rate_limit:.1f} K/min)."
        physics_cat = "CRITICAL"
        physics_sev = 2
        
    # Hybrid decision: S_hybrid = max(S_physics, S_RF)
    hybrid_sev = max(rf_sev, physics_sev)
    cat_map = {0: "SAFE", 1: "WARNING", 2: "CRITICAL"}
    hybrid_cat = cat_map[hybrid_sev]
    
    dist_to_crit = round(critical_temp - current_temperature, 2)
    
    # Formulate contextual message
    if physics_triggered and current_temperature >= critical_temp:
        msg = f"EMERGENCY RUNAWAY — Reactor temperature {current_temperature:.1f} K crossed critical limit {critical_temp:.1f} K!"
        rec = "Trigger emergency shutdown (ESD), flood cooling jacket, and dump quench liquid."
    elif rf_cat == "CRITICAL":
        msg = f"HIGH RISK CRITICAL ALERT — High probability ({p:.1%}) of thermal runaway within next {horizon_min:.0f} minutes."
        rec = "Increase coolant flow to maximum, prepare feed cut-off, and monitor temperature slope."
    elif rf_cat == "WARNING":
        msg = f"EARLY WARNING — Increased risk ({p:.1%}) of thermal runaway within the next {horizon_min:.0f} minutes."
        rec = "Verify coolant valve position, check jacket inlet temperature, and reduce feed preheat."
    else:
        msg = f"NOMINAL — Reactor operating within safe parameters (runaway risk: {p:.1%})."
        rec = "Continue standard monitoring."
        
    return WarningAssessment(
        rf_probability=round(p, 4),
        rf_category=rf_cat,
        rf_severity=rf_sev,
        physics_category=physics_cat,
        physics_severity=physics_sev,
        physics_limit_triggered=physics_triggered,
        physics_reason=physics_reason,
        hybrid_category=hybrid_cat,
        hybrid_severity=hybrid_sev,
        current_temperature=round(current_temperature, 2),
        distance_to_critical=dist_to_crit,
        prediction_horizon_min=horizon_min,
        message=msg,
        action_recommendation=rec,
    )
