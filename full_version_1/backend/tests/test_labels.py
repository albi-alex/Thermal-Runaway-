"""Unit tests for future-event target labeling and 15-minute horizon masking."""

import pytest
import numpy as np
from app.labels import compute_future_event_labels, HORIZON_MINUTES, CRITICAL_TEMPERATURE_K


def test_15min_horizon_labels():
    # 250 time steps = 25.0 minutes (dt = 0.1 min)
    times = np.linspace(0.0, 25.0, 251)
    
    # Temperature stays 305 K until 18.0 min (step 180), then shoots to 395 K at 20.0 min (step 200)
    temps = np.full(251, 305.0)
    temps[200:] = 395.0
    
    # Critical temp = 390.0, horizon = 15.0 min
    labels, valid = compute_future_event_labels(
        temps, times, horizon=15.0, critical_temp=390.0
    )
    
    # Step 200 reaches 395 K (at t = 20.0 min)
    # A step at t_i has runaway within (t_i, t_i + 15.0] if 20.0 in (t_i, t_i + 15.0] -> t_i in [5.0, 20.0)
    # For t_i = 4.0 min (step 40): 4.0 + 15.0 = 19.0 min < 20.0 min -> label 0
    # For t_i = 6.0 min (step 60): 6.0 + 15.0 = 21.0 min >= 20.0 min -> label 1
    assert labels[40] == 0
    assert labels[60] == 1
    assert labels[180] == 1
    assert labels[200] == 1  # already at 395 K
    
    # Check valid window mask:
    # Trajectory ends at 25.0 min. Any t_i > 10.0 min has incomplete 15-min future window UNLESS runaway already reached.
    # For safe steps (before step 200), t > 10.0 min (step 100) has t_max - t_i < 15.0 min
    # At step 60 (t=6.0 min), window of 15 min ends at 21.0 min <= 25.0 min -> valid == True
    assert valid[60] == True


def test_no_runaway_labels():
    # 30.0 minutes of safe operation
    times = np.linspace(0.0, 30.0, 301)
    temps = np.full(301, 310.0)  # Always safe
    
    labels, valid = compute_future_event_labels(
        temps, times, horizon=15.0, critical_temp=390.0
    )
    # All labels should be 0 (no runaway)
    assert np.all(labels == 0)
    
    # Points with t <= 15.0 min have full 15-min future windows -> valid == True
    # Points with t > 15.0 min have < 15 min remaining and never reached runaway -> valid == False
    assert np.all(valid[times <= 15.0] == True)
    assert np.all(valid[times > 15.0] == False)
