"""Scenario definitions, presets, and disturbance models for CSTR simulation.

Supports:
- Loss of cooling capacity U(t) = U0 * (1 - floss * H(t - td))
- Hot-feed disturbance Tf(t) = Tf0 + delta_Tf * H(t - td)
- Cooling restoration
- Reproducible presets matching faculty working notes
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from app.physics import CSTRParameters


@dataclass
class DisturbanceConfig:
    """Configuration for injected disturbances."""
    # Cooling disturbance
    floss: float = 0.0          # Fractional cooling loss in [0, 1]
    t_cooling_disturb: float = 10.0  # Time disturbance starts [min]
    t_cooling_restore: Optional[float] = None # Time cooling is restored [min]
    
    # Hot feed disturbance
    delta_Tf: float = 0.0       # Step increase in feed temperature [K]
    t_feed_disturb: float = 10.0    # Time feed disturbance starts [min]


@dataclass
class ScenarioPreset:
    """Pre-configured simulation scenario."""
    id: str
    name: str
    description: str
    params: CSTRParameters
    disturbance: DisturbanceConfig
    T0: float
    CA0: float
    expected_outcome: str


def get_scenario_presets() -> Dict[str, ScenarioPreset]:
    """Returns available simulation presets."""
    return {
        "faculty_cooling_loss": ScenarioPreset(
            id="faculty_cooling_loss",
            name="Faculty Worked Cooling Failure (Sec. 22)",
            description=(
                "Exact parameters from Section 22 of faculty notes. "
                "U0=1.1, 82% cooling loss injected at 10.0 min. "
                "Demonstrates Arrhenius acceleration and early warning at ~13.3 min before 390 K crossing."
            ),
            params=CSTRParameters(
                A=7.2e10,
                E_over_R=8750.0,
                beta=200.0,
                tau=5.0,
                CAf=1.0,
                Tf=300.0,
                Tc=300.0,
                U0=1.1,
                T_critical=390.0,
            ),
            disturbance=DisturbanceConfig(
                floss=0.82,
                t_cooling_disturb=10.0,
                t_cooling_restore=None,
                delta_Tf=0.0,
            ),
            T0=305.0,
            CA0=0.88,
            expected_outcome="Thermal Runaway at ~16.1 min with AI Early Warning at ~13.3 min",
        ),
        "stable_nominal": ScenarioPreset(
            id="stable_nominal",
            name="Normal Stable Operation",
            description=(
                "Nominal operating conditions with steady heat removal. "
                "Reactor settles into a stable low-temperature operating branch."
            ),
            params=CSTRParameters(
                A=7.2e10,
                E_over_R=8750.0,
                beta=200.0,
                tau=5.0,
                CAf=1.0,
                Tf=300.0,
                Tc=300.0,
                U0=1.1,
                T_critical=390.0,
            ),
            disturbance=DisturbanceConfig(
                floss=0.0,
                t_cooling_disturb=10.0,
                delta_Tf=0.0,
            ),
            T0=305.0,
            CA0=0.88,
            expected_outcome="Stable steady state; safe operating condition",
        ),
        "moderate_recoverable": ScenarioPreset(
            id="moderate_recoverable",
            name="Moderate Partial Cooling Loss (45%)",
            description=(
                "Partial cooling capacity loss (45% at 5.0 min). "
                "Temperature increases but cooling capacity remains sufficient to avoid runaway."
            ),
            params=CSTRParameters(
                A=7.2e10,
                E_over_R=8750.0,
                beta=200.0,
                tau=5.0,
                CAf=1.0,
                Tf=300.0,
                Tc=300.0,
                U0=1.1,
                T_critical=390.0,
            ),
            disturbance=DisturbanceConfig(
                floss=0.45,
                t_cooling_disturb=5.0,
                delta_Tf=0.0,
            ),
            T0=305.0,
            CA0=0.88,
            expected_outcome="Elevated temperature plateau without reaching 390 K",
        ),
        "hot_feed_step": ScenarioPreset(
            id="hot_feed_step",
            name="Hot-Feed Temperature Step (+18 K)",
            description=(
                "Feed temperature increases by 18 K at 6.0 min. "
                "Increases direct sensible heating and accelerates reaction rate."
            ),
            params=CSTRParameters(
                A=7.2e10,
                E_over_R=8750.0,
                beta=200.0,
                tau=5.0,
                CAf=1.0,
                Tf=300.0,
                Tc=300.0,
                U0=1.1,
                T_critical=390.0,
            ),
            disturbance=DisturbanceConfig(
                floss=0.0,
                delta_Tf=18.0,
                t_feed_disturb=6.0,
            ),
            T0=305.0,
            CA0=0.88,
            expected_outcome="Elevated operating state; tests sensitivity to feed variations",
        ),
        "training_envelope_runaway": ScenarioPreset(
            id="training_envelope_runaway",
            name="Training-Distribution Runaway",
            description=(
                "Representative scenario generated within the exact Section 10 parameter envelope "
                "(Tf0=325 K, U0=0.32, beta=135, tau=5.5 min) with 75% cooling loss at 8 min."
            ),
            params=CSTRParameters(
                A=1.5e10,
                E_over_R=8700.0,
                beta=135.0,
                tau=5.5,
                CAf=1.0,
                Tf=325.0,
                Tc=300.0,
                U0=0.32,
                T_critical=390.0,
            ),
            disturbance=DisturbanceConfig(
                floss=0.75,
                t_cooling_disturb=8.0,
            ),
            T0=326.0,
            CA0=0.85,
            expected_outcome="Runaway strictly within the offline training distribution envelope",
        ),
    }
