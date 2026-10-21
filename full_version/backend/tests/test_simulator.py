"""Unit tests for stateful CSTR simulator and disturbance tracking."""

import pytest
from app.simulator import CSTRSimulator
from app.physics import CSTRParameters


def test_simulator_initialization():
    sim = CSTRSimulator(preset_id="faculty_cooling_loss", seed=42)
    assert sim.time == 0.0
    assert sim.T == 305.0
    assert sim.CA == 0.88
    assert len(sim.history) == 1
    assert sim.is_running is False
    assert sim.is_paused is False


def test_simulator_stepping():
    sim = CSTRSimulator(preset_id="faculty_cooling_loss", seed=42)
    state = sim.step(num_steps=5)
    
    # 5 steps of 0.1 min -> time = 0.5 min
    assert state["time"] == pytest.approx(0.5)
    assert len(sim.history) == 6
    assert state["T"] > 250.0
    assert state["CA"] > 0.0


def test_cooling_disturbance_and_restoration():
    sim = CSTRSimulator(preset_id="faculty_cooling_loss", seed=42)
    sim.step(10)  # advance to 1.0 min
    
    # Inject 80% cooling loss
    res = sim.inject_cooling_failure(floss=0.80)
    assert res["floss"] == 0.80
    assert sim.current_floss == 0.80
    assert sim.t_disturbance == 1.0
    assert sim.get_effective_U(sim.time) == pytest.approx(sim.params.U0 * 0.20)
    
    # Step under cooling failure
    sim.step(10)
    assert sim.history[-1]["U"] == pytest.approx(sim.params.U0 * 0.20)
    
    # Restore cooling
    restore_res = sim.restore_cooling()
    assert restore_res["floss"] == 0.0
    assert sim.current_floss == 0.0
    assert sim.get_effective_U(sim.time) == pytest.approx(sim.params.U0)


def test_feed_temperature_disturbance():
    sim = CSTRSimulator(preset_id="faculty_cooling_loss", seed=42)
    sim.step(5)
    
    res = sim.increase_feed_temperature(delta_Tf=20.0)
    assert res["delta_Tf"] == 20.0
    assert sim.get_effective_Tf(sim.time) == pytest.approx(sim.params.Tf + 20.0)


def test_reproducibility():
    sim1 = CSTRSimulator(preset_id="faculty_cooling_loss", seed=123)
    sim1.step(20)
    
    sim2 = CSTRSimulator(preset_id="faculty_cooling_loss", seed=123)
    sim2.step(20)
    
    assert sim1.time == sim2.time
    assert sim1.T == pytest.approx(sim2.T)
    assert sim1.CA == pytest.approx(sim2.CA)
    assert sim1.T_obs == pytest.approx(sim2.T_obs)
