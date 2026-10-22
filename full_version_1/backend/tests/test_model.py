"""Unit tests for Random Forest model loading, inference, and warning logic."""

import pytest
from app.predict import Predictor
from app.warning_logic import classify_warning, SAFE_THRESHOLD, CRITICAL_THRESHOLD
from app.features import FEATURE_NAMES


def test_model_loaded():
    predictor = Predictor.get_instance()
    assert predictor.is_loaded is True
    assert predictor.model is not None
    assert predictor.metadata is not None
    assert predictor.metadata["prediction_horizon_minutes"] == 15.0


def test_model_prediction():
    predictor = Predictor.get_instance()
    # Sample feature dictionary
    dummy_feats = {feat: 1.0 for feat in FEATURE_NAMES}
    dummy_feats["temperature_obs"] = 310.0
    dummy_feats["cooling_coefficient"] = 1.1
    
    prob = predictor.predict_probability(dummy_feats)
    assert prob is not None
    assert 0.0 <= prob <= 1.0


def test_warning_logic_bands():
    # Safe band: < 0.35
    w_safe = classify_warning(rf_probability=0.20, current_temperature=305.0)
    assert w_safe.rf_category == "SAFE"
    assert w_safe.hybrid_category == "SAFE"
    assert w_safe.distance_to_critical == pytest.approx(85.0)
    
    # Warning band: 0.35 to 0.70
    w_warn = classify_warning(rf_probability=0.55, current_temperature=320.0)
    assert w_warn.rf_category == "WARNING"
    assert w_warn.hybrid_category == "WARNING"
    
    # Critical band: >= 0.70
    w_crit = classify_warning(rf_probability=0.85, current_temperature=340.0)
    assert w_crit.rf_category == "CRITICAL"
    assert w_crit.hybrid_category == "CRITICAL"


def test_hybrid_logic_overrides_ml():
    # If temperature reaches 392 K even if RF says 0.10, physics forces CRITICAL
    w_override = classify_warning(rf_probability=0.10, current_temperature=392.0)
    assert w_override.rf_category == "SAFE"
    assert w_override.physics_category == "CRITICAL"
    assert w_override.physics_limit_triggered is True
    assert w_override.hybrid_category == "CRITICAL"
    assert w_override.overall_status == "THERMAL RUNAWAY DETECTED"
    assert "recovering" in w_override.message.lower() or "critical-temperature threshold" in w_override.message.lower()


def test_warning_time_to_event_messages():
    # Test Time-to-Event in (5, 10] min -> HIGH RISK
    w_high_risk = classify_warning(
        rf_probability=0.75,
        current_temperature=345.0,
        estimated_time_to_critical_min=8.4,
    )
    assert w_high_risk.overall_status == "HIGH RISK"
    assert "approximately 8 minutes" in w_high_risk.message

    # Test Time-to-Event <= 5 min -> CRITICAL
    w_crit_tte = classify_warning(
        rf_probability=0.90,
        current_temperature=370.0,
        estimated_time_to_critical_min=3.2,
    )
    assert w_crit_tte.overall_status == "CRITICAL"
    assert "approximately 3 minutes" in w_crit_tte.message
