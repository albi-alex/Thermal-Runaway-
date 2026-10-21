"""Interactive CSTR simulation engine.

Integrates the CSTR ODEs using explicit midpoint RK2 (dt = 0.1 min), tracks dynamic
disturbances, updates online causal features, evaluates Random Forest early warning
probabilities, and monitors critical threshold crossings and lead times.
"""

from __future__ import annotations
import math
from typing import Dict, Any, List, Optional
import numpy as np

from app.physics import (
    CSTRParameters,
    explicit_midpoint_step,
    heat_terms,
    reaction_rate_constant,
)
from app.features import compute_features_online
from app.predict import Predictor
from app.warning_logic import classify_warning, WarningAssessment
from app.scenarios import get_scenario_presets, ScenarioPreset


class CSTRSimulator:
    """Stateful simulation of an exothermic CSTR with online ML inference."""
    
    def __init__(self, preset_id: str = "faculty_cooling_loss", seed: int = 42):
        self.preset_id = preset_id
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.predictor = Predictor.get_instance()
        
        self.dt = 0.1  # Integration time step [min]
        self.sigma_T = 0.15  # Default measurement noise std dev [K]
        
        # State variables
        self.time = 0.0
        self.T0 = 305.0
        self.CA0 = 0.88
        self.T = 305.0
        self.T_obs = 305.0
        self.CA = 0.88
        
        # Operating conditions
        self.current_floss = 0.0
        self.current_delta_Tf = 0.0
        self.cooling_restored = False
        
        # Simulation lifecycle
        self.is_running = False
        self.is_paused = False
        self.simulation_speed = 1.0
        
        # Milestone tracking
        self.t_disturbance: Optional[float] = None
        self.disturbance_description: Optional[str] = None
        self.t_first_warning: Optional[float] = None
        self.t_critical_warning: Optional[float] = None
        self.t_critical_crossing: Optional[float] = None
        self.lead_time: Optional[float] = None
        
        # Rolling state history
        self.history: List[Dict[str, Any]] = []
        self.max_history_len = 2000
        
        # Current warning assessment
        self.current_assessment: Optional[WarningAssessment] = None
        self.current_features: Optional[Dict[str, float]] = None
        
        # Load default preset
        self.load_preset(preset_id)

    def load_preset(self, preset_id: str) -> bool:
        presets = get_scenario_presets()
        preset = presets.get(preset_id, presets.get("faculty_cooling_loss"))
        if not preset:
            return False
            
        self.preset_id = preset.id
        self.T0 = preset.T0
        self.CA0 = preset.CA0
        self.params = CSTRParameters(
            A=preset.params.A,
            E_over_R=preset.params.E_over_R,
            beta=preset.params.beta,
            tau=preset.params.tau,
            CAf=preset.params.CAf,
            Tf=preset.params.Tf,
            Tc=preset.params.Tc,
            U0=preset.params.U0,
            T_critical=preset.params.T_critical,
        )
        self.reset(T0=preset.T0, CA0=preset.CA0)
        return True

    def reset(self, T0: Optional[float] = None, CA0: Optional[float] = None):
        """Reset simulation state to time zero."""
        self.time = 0.0
        self.T = T0 if T0 is not None else getattr(self, "T0", 305.0)
        self.T_obs = self.T + float(self.rng.normal(0.0, self.sigma_T))
        self.CA = CA0 if CA0 is not None else getattr(self, "CA0", 0.88)
        
        self.current_floss = getattr(self, "base_floss", 0.0)
        self.current_delta_Tf = getattr(self, "base_delta_Tf", 0.0)
        self.cooling_restored = bool(self.current_floss == 0.0)
        
        self.is_running = False
        self.is_paused = False
        
        if self.current_floss > 0:
            self.t_disturbance = 0.0
            pct = int(round(self.current_floss * 100))
            self.disturbance_description = f"Cooling Condition: -{pct}% capacity at 0.0 min"
        elif self.current_delta_Tf != 0:
            self.t_disturbance = 0.0
            self.disturbance_description = f"Hot Feed: {self.current_delta_Tf:+.1f} K at 0.0 min"
        else:
            self.t_disturbance = None
            self.disturbance_description = None

        self.t_first_warning = None
        self.t_critical_warning = None
        self.t_critical_crossing = None
        self.lead_time = None
        
        self.history.clear()
        
        eff_U = self.get_effective_U(0.0)
        eff_Tf = self.get_effective_Tf(0.0)
        
        # Record initial baseline state
        q_flow, q_gen, q_rem, q_net = heat_terms(
            self.CA, self.T, self.params, U_val=eff_U, Tf_val=eff_Tf
        )
        
        initial_record = {
            "time": 0.0,
            "T": round(self.T, 3),
            "T_obs": round(self.T_obs, 3),
            "CA": round(self.CA, 5),
            "U": round(eff_U, 4),
            "Tf": round(eff_Tf, 2),
            "Tc": round(self.params.Tc, 2),
            "CAf": round(self.params.CAf, 4),
            "tau": round(self.params.tau, 2),
            "beta": round(self.params.beta, 2),
            "A": self.params.A,
            "E_over_R": self.params.E_over_R,
            "q_flow": round(q_flow, 4),
            "q_gen": round(q_gen, 4),
            "q_rem": round(q_rem, 4),
            "q_net": round(q_net, 4),
            "dT_dt": 0.0,
            "rf_probability": 0.0,
            "rf_category": "SAFE",
            "hybrid_category": "SAFE",
        }
        self.history.append(initial_record)
        
        self.current_assessment = classify_warning(
            rf_probability=0.0,
            current_temperature=self.T_obs,
            heating_rate=0.0,
            critical_temp=self.params.T_critical,
        )
        self.current_features = None

    def configure(
        self,
        T0: Optional[float] = None,
        CA0: Optional[float] = None,
        Tf: Optional[float] = None,
        Tc: Optional[float] = None,
        CAf: Optional[float] = None,
        tau: Optional[float] = None,
        U0: Optional[float] = None,
        floss: Optional[float] = None,
        delta_Tf: Optional[float] = None,
        speed: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Configure simulation parameters from user inputs."""
        if T0 is not None:
            self.T0 = float(T0)
            if self.time == 0.0:
                self.T = self.T0
                self.T_obs = self.T0
        if CA0 is not None:
            self.CA0 = float(CA0)
            if self.time == 0.0:
                self.CA = self.CA0
        if Tf is not None:
            self.params.Tf = float(Tf)
        if Tc is not None:
            self.params.Tc = float(Tc)
        if CAf is not None:
            self.params.CAf = float(CAf)
        if tau is not None:
            self.params.tau = float(tau)
        if U0 is not None:
            self.params.U0 = float(U0)
        if floss is not None:
            self.current_floss = min(1.0, max(0.0, float(floss)))
            self.base_floss = self.current_floss
            if self.current_floss > 0:
                self.cooling_restored = False
                self.t_disturbance = round(self.time, 2)
                pct = int(round(self.current_floss * 100))
                self.disturbance_description = f"Cooling Condition: -{pct}% capacity at {self.time:.1f} min"
            else:
                self.cooling_restored = True
        if delta_Tf is not None:
            self.current_delta_Tf = float(delta_Tf)
            self.base_delta_Tf = self.current_delta_Tf
            if self.current_delta_Tf != 0:
                self.t_disturbance = round(self.time, 2)
                self.disturbance_description = f"Hot Feed: {self.current_delta_Tf:+.1f} K at {self.time:.1f} min"
        if speed is not None:
            self.simulation_speed = float(speed)

        # Update initial baseline record in history if at time zero
        if self.time == 0.0:
            eff_U = self.get_effective_U(0.0)
            eff_Tf = self.get_effective_Tf(0.0)
            q_flow, q_gen, q_rem, q_net = heat_terms(
                self.CA, self.T, self.params, U_val=eff_U, Tf_val=eff_Tf
            )
            if self.history:
                self.history[0].update({
                    "T": round(self.T, 3),
                    "T_obs": round(self.T_obs, 3),
                    "CA": round(self.CA, 5),
                    "U": round(eff_U, 4),
                    "Tf": round(eff_Tf, 2),
                    "Tc": round(self.params.Tc, 2),
                    "CAf": round(self.params.CAf, 4),
                    "tau": round(self.params.tau, 2),
                    "q_flow": round(q_flow, 4),
                    "q_gen": round(q_gen, 4),
                    "q_rem": round(q_rem, 4),
                    "q_net": round(q_net, 4),
                })
            self.current_assessment = classify_warning(
                rf_probability=0.0,
                current_temperature=self.T_obs,
                heating_rate=0.0,
                critical_temp=self.params.T_critical,
                horizon_min=15.0,
            )
        return self.get_state()

    def inject_cooling_failure(self, floss: float = 0.82) -> Dict[str, Any]:
        """Inject cooling failure by reducing cooling coefficient U."""
        self.current_floss = min(1.0, max(0.0, float(floss)))
        self.cooling_restored = False
        self.t_disturbance = round(self.time, 2)
        pct = int(round(self.current_floss * 100))
        self.disturbance_description = f"Cooling Failure: -{pct}% capacity at {self.time:.1f} min"
        return {
            "time": self.t_disturbance,
            "floss": self.current_floss,
            "U_current": round(self.params.U0 * (1.0 - self.current_floss), 4),
            "description": self.disturbance_description,
        }

    def increase_feed_temperature(self, delta_Tf: float = 15.0) -> Dict[str, Any]:
        """Inject feed temperature disturbance."""
        self.current_delta_Tf = float(delta_Tf)
        self.t_disturbance = round(self.time, 2)
        self.disturbance_description = f"Hot Feed Disturbance: +{delta_Tf:.1f} K at {self.time:.1f} min"
        return {
            "time": self.t_disturbance,
            "delta_Tf": self.current_delta_Tf,
            "Tf_current": round(self.params.Tf + self.current_delta_Tf, 2),
            "description": self.disturbance_description,
        }

    def restore_cooling(self) -> Dict[str, Any]:
        """Restore cooling coefficient U back to nominal U0."""
        self.current_floss = 0.0
        self.cooling_restored = True
        desc = f"Cooling Restored to 100% capacity at {self.time:.1f} min"
        return {
            "time": round(self.time, 2),
            "floss": 0.0,
            "U_current": round(self.params.U0, 4),
            "description": desc,
        }

    def get_effective_U(self, t: float) -> float:
        return self.params.U0 * (1.0 - self.current_floss)

    def get_effective_Tf(self, t: float) -> float:
        return self.params.Tf + self.current_delta_Tf

    def step(self, num_steps: int = 1) -> Dict[str, Any]:
        """Advance simulation by num_steps."""
        for _ in range(num_steps):
            self._single_step()
        return self.get_state()

    def _single_step(self):
        t_curr = self.time
        U_eff = self.get_effective_U(t_curr)
        Tf_eff = self.get_effective_Tf(t_curr)
        
        # Advance explicit midpoint RK2
        CA_next, T_next = explicit_midpoint_step(
            t_curr,
            self.CA,
            self.T,
            self.dt,
            self.params,
            U_func=self.get_effective_U,
            Tf_func=self.get_effective_Tf,
        )
        
        self.time = round(self.time + self.dt, 2)
        self.CA = CA_next
        self.T = T_next
        
        # Add sensor noise
        noise = float(self.rng.normal(0.0, self.sigma_T))
        self.T_obs = self.T + noise
        
        # Compute thermal terms
        q_flow, q_gen, q_rem, q_net = heat_terms(
            self.CA, self.T, self.params, U_val=U_eff, Tf_val=Tf_eff
        )
        
        # Compute causal heating rate from observed temps
        prev_T_obs = self.history[-1]["T_obs"] if self.history else self.T_obs
        dT_dt = (self.T_obs - prev_T_obs) / self.dt
        
        # Record state for causal rolling history
        record = {
            "time": self.time,
            "T": round(self.T, 3),
            "T_obs": round(self.T_obs, 3),
            "CA": round(self.CA, 5),
            "U": round(U_eff, 4),
            "Tf": round(Tf_eff, 2),
            "Tc": round(self.params.Tc, 2),
            "CAf": round(self.params.CAf, 4),
            "tau": round(self.params.tau, 2),
            "beta": round(self.params.beta, 2),
            "A": self.params.A,
            "E_over_R": self.params.E_over_R,
            "q_flow": round(q_flow, 4),
            "q_gen": round(q_gen, 4),
            "q_rem": round(q_rem, 4),
            "q_net": round(q_net, 4),
            "dT_dt": round(dT_dt, 4),
            "rf_probability": 0.0,
            "rf_category": "SAFE",
            "hybrid_category": "SAFE",
        }
        self.history.append(record)
        if len(self.history) > self.max_history_len:
            self.history.pop(0)
            
        # Online feature computation
        feats = compute_features_online(self.history, self.params, dt=self.dt, window_steps=10)
        self.current_features = feats
        
        rf_prob = 0.0
        if feats is not None and self.predictor.is_loaded:
            p = self.predictor.predict_probability(feats)
            if p is not None:
                rf_prob = p
                
        # Warning classification
        assessment = classify_warning(
            rf_probability=rf_prob,
            current_temperature=self.T_obs,
            heating_rate=dT_dt,
            critical_temp=self.params.T_critical,
        )
        self.current_assessment = assessment
        
        # Update history record with ML warning info
        record["rf_probability"] = round(rf_prob, 4)
        record["rf_category"] = assessment.rf_category
        record["hybrid_category"] = assessment.hybrid_category
        
        # Milestone tracking
        if rf_prob >= 0.35 and self.t_first_warning is None:
            self.t_first_warning = self.time
            
        if rf_prob >= 0.70 and self.t_critical_warning is None:
            self.t_critical_warning = self.time
            
        if self.T >= self.params.T_critical and self.t_critical_crossing is None:
            self.t_critical_crossing = self.time
            if self.t_first_warning is not None:
                self.lead_time = round(self.t_critical_crossing - self.t_first_warning, 2)

    def get_state(self) -> Dict[str, Any]:
        """Return full simulation state payload for API & frontend."""
        eff_U = self.get_effective_U(self.time)
        eff_Tf = self.get_effective_Tf(self.time)
        k_val = reaction_rate_constant(self.T, self.params.A, self.params.E_over_R)
        q_flow, q_gen, q_rem, q_net = heat_terms(
            self.CA, self.T, self.params, U_val=eff_U, Tf_val=eff_Tf
        )
        
        # Recent trajectory history (last 300 points for charts)
        chart_history = self.history[-300:] if len(self.history) > 300 else self.history
        
        assessment_dict = None
        if self.current_assessment:
            assessment_dict = {
                "rf_probability": self.current_assessment.rf_probability,
                "rf_category": self.current_assessment.rf_category,
                "rf_severity": self.current_assessment.rf_severity,
                "physics_category": self.current_assessment.physics_category,
                "physics_limit_triggered": self.current_assessment.physics_limit_triggered,
                "physics_reason": self.current_assessment.physics_reason,
                "hybrid_category": self.current_assessment.hybrid_category,
                "hybrid_severity": self.current_assessment.hybrid_severity,
                "current_temperature": self.current_assessment.current_temperature,
                "distance_to_critical": self.current_assessment.distance_to_critical,
                "prediction_horizon_min": self.current_assessment.prediction_horizon_min,
                "message": self.current_assessment.message,
                "action_recommendation": self.current_assessment.action_recommendation,
            }
            
        return {
            "time": self.time,
            "T": round(self.T, 2),
            "T_obs": round(self.T_obs, 2),
            "CA": round(self.CA, 4),
            "reaction_rate_constant": round(k_val, 5),
            "reaction_rate": round(k_val * self.CA, 5),
            "q_flow": round(q_flow, 3),
            "q_gen": round(q_gen, 3),
            "q_rem": round(q_rem, 3),
            "q_net": round(q_net, 3),
            "dT_dt": round(q_flow + q_net, 3),
            "U": round(eff_U, 4),
            "U0": round(self.params.U0, 4),
            "floss": round(self.current_floss, 3),
            "Tf": round(eff_Tf, 2),
            "Tc": round(self.params.Tc, 2),
            "CAf": round(self.params.CAf, 3),
            "tau": round(self.params.tau, 2),
            "T_critical": self.params.T_critical,
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "simulation_speed": self.simulation_speed,
            "model_loaded": self.predictor.is_loaded,
            "events": {
                "t_disturbance": self.t_disturbance,
                "disturbance_description": self.disturbance_description,
                "t_first_warning": self.t_first_warning,
                "t_critical_warning": self.t_critical_warning,
                "t_critical_crossing": self.t_critical_crossing,
                "lead_time": self.lead_time,
            },
            "warning": assessment_dict,
            "features": self.current_features,
            "history": chart_history,
        }
