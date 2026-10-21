"""FastAPI application for CSTR Thermal Runaway Early Warning System.

Provides endpoints for interactive simulation control, disturbance injection,
real-time state streaming, Random Forest inference, and model evaluation metrics.
"""

from __future__ import annotations
import os
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.simulator import CSTRSimulator
from app.predict import Predictor
from app.scenarios import get_scenario_presets
from app.train import train_and_evaluate
from app.schemas import (
    StartSimulationRequest,
    StepRequest,
    CoolingDisturbanceRequest,
    FeedTempDisturbanceRequest,
    SimulationSettingsRequest,
    PredictRequest,
    SimulationStateResponse,
)


app = FastAPI(
    title="Thermal Runaway Early Warning System",
    description="Physics-Based Reactor Simulation and ML Early Warning",
    version="1.0.0",
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global simulator instance
simulator = CSTRSimulator()
predictor = Predictor.get_instance()


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "cstr-thermal-runaway-backend",
        "model_loaded": predictor.is_loaded,
        "current_time": simulator.time,
        "is_running": simulator.is_running,
    }


@app.get("/api/simulation/state", response_model=SimulationStateResponse)
def get_simulation_state():
    """Retrieve current CSTR state, history, features, and warning assessment."""
    return simulator.get_state()


@app.post("/api/simulation/start", response_model=SimulationStateResponse)
def start_simulation(req: Optional[StartSimulationRequest] = None):
    """Start or resume the simulation."""
    if req and req.speed:
        simulator.simulation_speed = req.speed
    simulator.is_running = True
    simulator.is_paused = False
    return simulator.get_state()


@app.post("/api/simulation/pause", response_model=SimulationStateResponse)
def pause_simulation():
    """Pause the simulation."""
    simulator.is_paused = True
    simulator.is_running = False
    return simulator.get_state()


@app.post("/api/simulation/resume", response_model=SimulationStateResponse)
def resume_simulation():
    """Resume the paused simulation."""
    simulator.is_paused = False
    simulator.is_running = True
    return simulator.get_state()


@app.post("/api/simulation/reset", response_model=SimulationStateResponse)
def reset_simulation(preset_id: Optional[str] = None):
    """Reset the simulation to time zero with current user configured inputs."""
    simulator.reset()
    return simulator.get_state()


@app.post("/api/simulation/step", response_model=SimulationStateResponse)
def step_simulation(req: StepRequest):
    """Advance the simulation by N steps (0.1 min per step)."""
    return simulator.step(num_steps=req.num_steps)


@app.post("/api/simulation/disturb/cooling")
def inject_cooling_disturbance(req: CoolingDisturbanceRequest):
    """Inject a cooling capacity loss disturbance (floss in [0, 1])."""
    res = simulator.inject_cooling_failure(floss=req.floss)
    return {"status": "success", "disturbance": res, "state": simulator.get_state()}


@app.post("/api/simulation/disturb/feed_temp")
def inject_feed_temp_disturbance(req: FeedTempDisturbanceRequest):
    """Inject a feed temperature step increase disturbance."""
    res = simulator.increase_feed_temperature(delta_Tf=req.delta_Tf)
    return {"status": "success", "disturbance": res, "state": simulator.get_state()}


@app.post("/api/simulation/disturb/restore_cooling")
def restore_cooling_action():
    """Restore cooling capacity to 100% (floss = 0)."""
    res = simulator.restore_cooling()
    return {"status": "success", "action": res, "state": simulator.get_state()}


@app.get("/api/simulation/presets")
def list_presets():
    """List available pre-configured CSTR simulation scenarios."""
    presets = get_scenario_presets()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "expected_outcome": p.expected_outcome,
            "T0": p.T0,
            "CA0": p.CA0,
            "Tf": p.params.Tf,
            "Tc": p.params.Tc,
            "U0": p.params.U0,
            "floss": p.disturbance.floss,
            "delta_Tf": p.disturbance.delta_Tf,
        }
        for p in presets.values()
    ]


@app.post("/api/simulation/preset/{preset_id}", response_model=SimulationStateResponse)
def select_preset(preset_id: str):
    """Load a specific preset and reset simulation."""
    success = simulator.load_preset(preset_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' not found.")
    return simulator.get_state()


@app.post("/api/simulation/settings", response_model=SimulationStateResponse)
def update_settings(settings: SimulationSettingsRequest):
    """Update custom simulation parameters."""
    return simulator.configure(
        T0=settings.T0,
        CA0=settings.CA0,
        Tf=settings.Tf,
        Tc=settings.Tc,
        CAf=settings.CAf,
        tau=settings.tau,
        U0=settings.U0,
        floss=settings.floss,
        delta_Tf=settings.delta_Tf,
        speed=settings.simulation_speed,
    )


@app.post("/api/predict")
def predict_runaway(req: PredictRequest):
    """Generate early warning prediction from arbitrary feature vector."""
    if not predictor.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model is not trained or loaded. Please train the model first.",
        )
    prob = predictor.predict_probability(req.features)
    if prob is None:
        raise HTTPException(status_code=400, detail="Invalid features provided.")
        
    T_curr = req.features.get("temperature_obs", 300.0)
    dT_dt = req.features.get("heating_rate", 0.0)
    from app.warning_logic import classify_warning
    assessment = classify_warning(prob, T_curr, dT_dt)
    return {
        "rf_probability": prob,
        "warning": assessment,
    }


@app.get("/api/evaluation")
def get_evaluation_metrics():
    """Retrieve held-out test evaluation report and ROC/PR curves."""
    report = predictor.get_evaluation_report()
    if report is None:
        return {
            "status": "Not evaluated",
            "message": "Model has not been trained or evaluated yet.",
        }
    return {
        "status": "Evaluated",
        "data": report,
    }


@app.get("/api/model/info")
def get_model_info():
    """Retrieve model metadata, hyperparameters, and feature list."""
    meta = predictor.get_metadata()
    if meta is None:
        return {
            "status": "Not trained",
            "message": "No model metadata found.",
        }
    return {
        "status": "Trained",
        "data": meta,
    }


@app.post("/api/model/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    """Trigger model training on demand in background."""
    def run_training():
        train_and_evaluate(force_regenerate=True)
        predictor.load_model()
    background_tasks.add_task(run_training)
    return {"status": "Training started in background."}


# Mount built React frontend if dist directory exists
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static_frontend")

