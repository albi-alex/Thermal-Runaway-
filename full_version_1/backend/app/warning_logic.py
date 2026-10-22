"""Warning logic and decision classification for CSTR thermal runaway.

Combines:
  1. The 15-minute ML Random Forest probability (predict_proba).
  2. The physics forward-simulation time-to-event estimate.
  3. The physical safety thresholds (390.0 K temperature hard limit, 12.0 K/min heating rate limit).

Thresholds:
  - SAFE: P_RF < 0.35
  - WARNING: 0.35 <= P_RF < 0.70
  - CRITICAL: P_RF >= 0.70

Time-to-Event Categories:
  - (10, 15] min: EARLY WARNING
  - (5, 10] min: HIGH RISK
  - (0, 5] min: IMMINENT RISK / CRITICAL
  - T >= 390.0 K: THERMAL RUNAWAY DETECTED
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from app.physics import TimeToEventEstimate


SAFE_THRESHOLD: float = 0.35
CRITICAL_THRESHOLD: float = 0.70
DEFAULT_CRITICAL_TEMP: float = 390.0
DEFAULT_HEATING_RATE_LIMIT: float = 12.0


@dataclass
class WarningAssessment:
    """Comprehensive evaluation of AI warning, physics time-to-event, and hard limits."""
    # Machine Learning 15-min forecast
    runaway_probability_15m: float
    rf_probability: float  # alias
    rf_category: str       # "SAFE", "WARNING", "CRITICAL"
    rf_severity: int       # 0, 1, 2
    
    # Physics time-to-event estimate
    estimated_time_to_critical_min: Optional[float]
    predicted_crossing_time_min: Optional[float]
    time_to_event_method: str
    time_to_event_confidence: str
    time_to_event_uncertainty_interval: Optional[List[float]]
    time_to_event_category: str
    time_to_event_assumptions: str
    
    # Physical hard limit status
    physics_category: str      # "SAFE", "CRITICAL"
    physics_severity: int      # 0 or 3
    physics_limit_triggered: bool
    physics_reason: Optional[str]
    
    # Overall synthesized decision status
    overall_status: str        # "SAFE", "WARNING", "HIGH RISK", "CRITICAL", "THERMAL RUNAWAY DETECTED"
    overall_severity: int      # 0 (SAFE), 1 (WARNING), 2 (HIGH RISK), 3 (CRITICAL), 4 (RUNAWAY)
    hybrid_category: str       # alias matching overall_status category ("SAFE", "WARNING", "CRITICAL")
    hybrid_severity: int       # alias
    
    # Context
    current_temperature: float
    heating_rate: float
    distance_to_critical: float
    prediction_horizon_min: float
    message: str
    action_recommendation: str


def classify_warning(
    rf_probability: float,
    current_temperature: float,
    heating_rate: float = 0.0,
    time_to_event: Optional[TimeToEventEstimate] = None,
    critical_temp: float = DEFAULT_CRITICAL_TEMP,
    heating_rate_limit: float = DEFAULT_HEATING_RATE_LIMIT,
    horizon_min: float = 15.0,
    estimated_time_to_critical_min: Optional[float] = None,
) -> WarningAssessment:
    """Classify reactor state combining 15-min ML probability, physics time estimate, and limits."""
    p = max(0.0, min(1.0, float(rf_probability)))
    
    if time_to_event is None and estimated_time_to_critical_min is not None:
        t_val = float(estimated_time_to_critical_min)
        if t_val <= 5.0:
            cat = "CRITICAL_IMMINENT"
        elif t_val <= 10.0:
            cat = "HIGH_RISK"
        elif t_val <= 15.0:
            cat = "EARLY_WARNING"
        else:
            cat = "SAFE_BEYOND_HORIZON"
        time_to_event = TimeToEventEstimate(
            estimated_time_to_critical_min=round(t_val, 2),
            predicted_crossing_time_min=round(t_val, 2),
            time_to_event_method="physics_forward_simulation",
            time_to_event_confidence="HIGH",
            uncertainty_interval=[max(0.0, round(t_val - 0.2, 2)), round(t_val + 0.2, 2)],
            time_to_event_category=cat,
            is_critical_reached=bool(t_val <= 0.0),
            assumptions_note="Constant operational conditions.",
        )
    
    # 1. ML probability band
    if p < SAFE_THRESHOLD:
        rf_cat = "SAFE"
        rf_sev = 0
    elif p < CRITICAL_THRESHOLD:
        rf_cat = "WARNING"
        rf_sev = 1
    else:
        rf_cat = "CRITICAL"
        rf_sev = 2
        
    # 2. Physics hard safety limits
    physics_triggered = False
    physics_reason = None
    physics_cat = "SAFE"
    physics_sev = 0
    
    is_runaway_reached = current_temperature >= critical_temp
    
    if is_runaway_reached:
        physics_triggered = True
        physics_reason = f"Reactor temperature ({current_temperature:.1f} K) has reached or exceeded critical threshold ({critical_temp:.1f} K)."
        physics_cat = "CRITICAL"
        physics_sev = 4
    elif heating_rate >= heating_rate_limit:
        physics_triggered = True
        physics_reason = f"Instantaneous heating rate ({heating_rate:.2f} K/min) exceeds safety limit ({heating_rate_limit:.1f} K/min)."
        physics_cat = "CRITICAL"
        physics_sev = 3
        
    # 3. Time-to-event details
    if time_to_event is not None:
        t_rem = time_to_event.estimated_time_to_critical_min
        t_cross = time_to_event.predicted_crossing_time_min
        t_method = time_to_event.time_to_event_method
        t_conf = time_to_event.time_to_event_confidence
        t_interval = time_to_event.uncertainty_interval
        t_cat = time_to_event.time_to_event_category
        t_assump = time_to_event.assumptions_note
    else:
        t_rem = None
        t_cross = None
        t_method = "physics_forward_simulation"
        t_conf = "N/A"
        t_interval = None
        t_cat = "NONE"
        t_assump = "Forward simulation not executed."
        
    # 4. Conservative overall status synthesis
    if is_runaway_reached:
        overall_status = "THERMAL RUNAWAY DETECTED"
        overall_sev = 4
        hybrid_cat = "CRITICAL"
        msg = "THERMAL RUNAWAY DETECTED — The simulated reactor has reached the critical-temperature threshold."
        rec = "Trigger emergency shutdown (ESD), flood cooling jacket, and dump quench liquid."
    elif physics_triggered and heating_rate >= heating_rate_limit:
        overall_status = "CRITICAL"
        overall_sev = 3
        hybrid_cat = "CRITICAL"
        msg = f"CRITICAL — Extreme heating rate ({heating_rate:.1f} K/min >= {heating_rate_limit:.1f} K/min). Thermal runaway imminent."
        rec = "Maximize cooling flow immediately, prepare emergency quench, and throttle feed."
    elif t_rem is not None and t_rem <= 5.0:
        overall_status = "CRITICAL"
        overall_sev = 3
        hybrid_cat = "CRITICAL"
        msg = f"CRITICAL — Thermal runaway is predicted within approximately {t_rem:.0f} minutes."
        rec = "Maximize coolant flow immediately, prepare feed cut-off, and monitor temperature."
    elif t_rem is not None and t_rem <= 10.0:
        overall_status = "HIGH RISK"
        overall_sev = 2
        hybrid_cat = "CRITICAL" if p >= CRITICAL_THRESHOLD else "WARNING"
        msg = f"HIGH RISK — Thermal runaway is predicted within approximately {t_rem:.0f} minutes."
        rec = "Increase coolant valve opening, inspect cooling jacket temperature, and prepare mitigation."
    elif t_rem is not None and t_rem <= 15.0:
        overall_status = "WARNING"
        overall_sev = 1
        hybrid_cat = "WARNING"
        msg = f"EARLY WARNING — Possible thermal runaway within 10–15 minutes (estimated: ~{t_rem:.0f} min)."
        rec = "Inspect reactor cooling capacity and verify feed preheat controller."
    elif p >= CRITICAL_THRESHOLD and (current_temperature >= 325.0 or heating_rate >= 3.0):
        overall_status = "CRITICAL"
        overall_sev = 3
        hybrid_cat = "CRITICAL"
        msg = f"CRITICAL — High probability ({p:.1%}) of thermal runaway within next 15 minutes."
        rec = "Increase coolant flow to maximum, prepare feed cut-off, and monitor temperature slope."
    elif p >= SAFE_THRESHOLD:
        overall_status = "WARNING"
        overall_sev = 1
        hybrid_cat = "WARNING"
        msg = f"WARNING — Elevated probability of thermal runaway within the next 15 minutes ({p:.1%})."
        rec = "Verify coolant valve position, check jacket inlet temperature, and reduce feed preheat."
    else:
        overall_status = "SAFE"
        overall_sev = 0
        hybrid_cat = "SAFE"
        msg = "SAFE — No critical-temperature event predicted within the next 15 minutes."
        rec = "Continue standard process monitoring."
        
    dist_to_crit = round(critical_temp - current_temperature, 2)
    
    return WarningAssessment(
        runaway_probability_15m=round(p, 4),
        rf_probability=round(p, 4),
        rf_category=rf_cat,
        rf_severity=rf_sev,
        estimated_time_to_critical_min=t_rem,
        predicted_crossing_time_min=t_cross,
        time_to_event_method=t_method,
        time_to_event_confidence=t_conf,
        time_to_event_uncertainty_interval=t_interval,
        time_to_event_category=t_cat,
        time_to_event_assumptions=t_assump,
        physics_category=physics_cat,
        physics_severity=physics_sev,
        physics_limit_triggered=physics_triggered,
        physics_reason=physics_reason,
        overall_status=overall_status,
        overall_severity=overall_sev,
        hybrid_category=hybrid_cat,
        hybrid_severity=min(2, overall_sev),
        current_temperature=round(current_temperature, 2),
        heating_rate=round(heating_rate, 4),
        distance_to_critical=dist_to_crit,
        prediction_horizon_min=horizon_min,
        message=msg,
        action_recommendation=rec,
    )
