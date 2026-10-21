"""Unit tests for future-event target labeling."""

import pytest
import numpy as np
from app.labels import compute_future_event_labels


def test_3min_horizon_labels():
    dt = 0.1
    # 50 time steps = 5.0 minutes
    times = np.linspace(0.0, 5.0, 51)
    
    # Temperature stays 305 K until 3.0 min (step 30), then shoots to 395 K at 3.5 min (step 35)
    temps = np.full(51, 305.0)
    temps[35:] = 395.0
    
    # Critical temp = 390.0, horizon = 3.0 min (30 steps)
    labels = compute_future_event_labels(temps, times, horizon=3.0, critical_temp=390.0, dt=dt)
    
    # Step 35 reaches 395 K
    # Any step i where 35 in [i, i + 30] should be 1
    # So i from 5 to 35 should have label 1
    # Steps before 5 (e.g. step 4) look ahead up to step 34, so max temp is 305 K -> label 0
    assert labels[4] == 0
    assert labels[5] == 1
    assert labels[20] == 1
    assert labels[35] == 1
    assert labels[40] == 1  # already at 395 K


def test_no_runaway_labels():
    dt = 0.1
    times = np.linspace(0.0, 10.0, 101)
    temps = np.full(101, 310.0)  # Always safe
    
    labels = compute_future_event_labels(temps, times, horizon=3.0, critical_temp=390.0, dt=dt)
    assert np.all(labels == 0)
