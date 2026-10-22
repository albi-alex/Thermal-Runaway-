"""Pydantic schemas for CSTR Thermal Runaway Early Warning API."""

from __future__ import annotations
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class StartSimulationRequest(BaseModel):
    preset_id: Optional[str] = Field("faculty_cooling_loss", description="Preset scenario ID")
    speed: Optional[float] = Field(1.0, description="Simulation speed factor")


class StepRequest(BaseModel):
    num_steps: int = Field(1, ge=1, le=100, description="Number of 0.1-min steps to advance")


class CoolingDisturbanceRequest(BaseModel):
    floss: float = Field(0.82, ge=0.0, le=1.0, description="Fractional cooling capacity loss [0.0 - 1.0]")


class FeedTempDisturbanceRequest(BaseModel):
    delta_Tf: float = Field(15.0, ge=-50.0, le=100.0, description="Feed temperature change [K]")


class SimulationSettingsRequest(BaseModel):
    T0: Optional[float] = Field(None, ge=250.0, le=450.0, description="Initial reactor temperature [K]")
    CA0: Optional[float] = Field(None, ge=0.01, le=5.0, description="Initial reactant concentration [kmol/m^3]")
    Tf: Optional[float] = Field(None, ge=250.0, le=420.0, description="Feed temperature [K]")
    CAf: Optional[float] = Field(None, ge=0.1, le=5.0, description="Feed concentration [kmol/m^3]")
    Tc: Optional[float] = Field(None, ge=250.0, le=350.0, description="Coolant temperature [K]")
    tau: Optional[float] = Field(None, ge=0.5, le=30.0, description="Residence time [min]")
    U0: Optional[float] = Field(None, ge=0.05, le=5.0, description="Cooling coefficient [min^-1]")
    T_critical: Optional[float] = Field(390.0, ge=320.0, le=500.0, description="Critical runaway temperature [K]")
    simulation_speed: Optional[float] = Field(1.0, ge=0.1, le=20.0, description="Simulation playback speed")
    floss: Optional[float] = Field(None, ge=0.0, le=1.0, description="Cooling capacity loss fraction")
    delta_Tf: Optional[float] = Field(None, ge=-50.0, le=100.0, description="Feed temperature offset [K]")


class PredictRequest(BaseModel):
    features: Dict[str, float] = Field(..., description="Dictionary containing the 14 features")


class WarningResponse(BaseModel):
    runaway_probability_15m: float
    rf_probability: float
    rf_category: str
    rf_severity: int
    estimated_time_to_critical_min: Optional[float]
    predicted_crossing_time_min: Optional[float]
    time_to_event_method: str
    time_to_event_confidence: str
    time_to_event_uncertainty_interval: Optional[List[float]]
    time_to_event_category: str
    time_to_event_assumptions: str
    physics_category: str
    physics_limit_triggered: bool
    physics_reason: Optional[str]
    overall_status: str
    overall_severity: int
    hybrid_category: str
    hybrid_severity: int
    current_temperature: float
    heating_rate: float
    distance_to_critical: float
    prediction_horizon_min: float
    message: str
    action_recommendation: str


class EventsResponse(BaseModel):
    t_disturbance: Optional[float]
    disturbance_description: Optional[str]
    t_first_warning: Optional[float]
    t_critical_warning: Optional[float]
    t_critical_crossing: Optional[float]
    lead_time: Optional[float]


class SimulationStateResponse(BaseModel):
    time: float
    T: float
    T_obs: float
    CA: float
    reaction_rate_constant: float
    reaction_rate: float
    q_flow: float
    q_gen: float
    q_rem: float
    q_net: float
    dT_dt: float
    U: float
    U0: float
    floss: float
    Tf: float
    Tc: float
    CAf: float
    tau: float
    T_critical: float
    is_running: bool
    is_paused: bool
    simulation_speed: float
    model_loaded: bool
    runaway_probability_15m: float = 0.0
    estimated_time_to_critical_min: Optional[float] = None
    overall_status: str = "SAFE"
    events: EventsResponse
    warning: Optional[WarningResponse]
    features: Optional[Dict[str, float]]
    history: List[Dict[str, Any]]
