"""Integration tests for FastAPI endpoints using TestClient."""

import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True


def test_simulation_state_endpoint():
    res = client.get("/api/simulation/state")
    assert res.status_code == 200
    data = res.json()
    assert "time" in data
    assert "T" in data
    assert "CA" in data
    assert "events" in data
    assert "warning" in data


def test_simulation_step_endpoint():
    res = client.post("/api/simulation/step", json={"num_steps": 3})
    assert res.status_code == 200
    data = res.json()
    assert data["time"] >= 0.3


def test_cooling_disturbance_endpoint():
    res = client.post("/api/simulation/disturb/cooling", json={"floss": 0.75})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["disturbance"]["floss"] == 0.75


def test_presets_endpoint():
    res = client.get("/api/simulation/presets")
    assert res.status_code == 200
    presets = res.json()
    assert len(presets) >= 4
    preset_ids = [p["id"] for p in presets]
    assert "faculty_cooling_loss" in preset_ids


def test_evaluation_endpoint():
    res = client.get("/api/evaluation")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Evaluated"
    assert "data" in data
    assert "state_metrics" in data["data"]
    assert "event_metrics" in data["data"]


def test_model_info_endpoint():
    res = client.get("/api/model/info")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Trained"
    assert data["data"]["prediction_horizon_minutes"] == 15.0
