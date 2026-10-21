"""Unit tests for the 14 causal features."""

import pytest
import numpy as np
import pandas as pd
from app.features import (
    FEATURE_NAMES,
    compute_features_online,
    compute_features_trajectory,
)
from app.physics import CSTRParameters


def test_feature_names_count():
    assert len(FEATURE_NAMES) == 14
    expected = [
        "temperature_obs",
        "concentration",
        "heating_rate",
        "thermal_acceleration",
        "trailing_temp_max",
        "trailing_temp_slope",
        "heat_generation",
        "heat_removal",
        "net_thermal_drive",
        "reactor_coolant_temp_diff",
        "cooling_coefficient",
        "feed_concentration",
        "feed_temperature",
        "residence_time",
    ]
    assert FEATURE_NAMES == expected


def test_online_features_causality():
    params = CSTRParameters()
    # Create history with known temperatures
    history = [
        {"T_obs": 300.0, "CA": 1.0, "U": 1.1, "Tf": 300.0, "Tc": 300.0, "CAf": 1.0, "tau": 5.0, "beta": 200.0, "A": 7.2e10, "E_over_R": 8750.0},
        {"T_obs": 301.0, "CA": 0.98, "U": 1.1, "Tf": 300.0, "Tc": 300.0, "CAf": 1.0, "tau": 5.0, "beta": 200.0, "A": 7.2e10, "E_over_R": 8750.0},
        {"T_obs": 303.0, "CA": 0.95, "U": 1.1, "Tf": 300.0, "Tc": 300.0, "CAf": 1.0, "tau": 5.0, "beta": 200.0, "A": 7.2e10, "E_over_R": 8750.0},
    ]
    
    feats = compute_features_online(history, params, dt=0.1)
    assert feats is not None
    assert set(feats.keys()) == set(FEATURE_NAMES)
    
    # dT/dt = (303.0 - 301.0) / 0.1 = 20.0
    assert feats["heating_rate"] == pytest.approx(20.0)
    # prev dT/dt = (301.0 - 300.0) / 0.1 = 10.0
    # d2T/dt2 = (20.0 - 10.0) / 0.1 = 100.0
    assert feats["thermal_acceleration"] == pytest.approx(100.0)
    assert feats["trailing_temp_max"] == pytest.approx(303.0)


def test_trajectory_features_match_online():
    params = CSTRParameters()
    dt = 0.1
    times = [0.0, 0.1, 0.2]
    temps = [300.0, 301.0, 303.0]
    cas = [1.0, 0.98, 0.95]
    
    df = pd.DataFrame({
        "time_min": times,
        "temperature_obs": temps,
        "concentration": cas,
        "cooling_coefficient": [1.1, 1.1, 1.1],
        "feed_temperature": [300.0, 300.0, 300.0],
        "feed_concentration": [1.0, 1.0, 1.0],
        "residence_time": [5.0, 5.0, 5.0],
        "Tc": [300.0, 300.0, 300.0],
        "beta": [200.0, 200.0, 200.0],
        "A": [7.2e10, 7.2e10, 7.2e10],
        "E_over_R": [8750.0, 8750.0, 8750.0],
    })
    
    featured_df = compute_features_trajectory(df, dt=dt)
    for col in FEATURE_NAMES:
        assert col in featured_df.columns
    assert featured_df["heating_rate"].iloc[-1] == pytest.approx(20.0)
