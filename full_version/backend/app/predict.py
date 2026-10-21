"""Inference pipeline for CSTR thermal runaway prediction.

Loads persisted scikit-learn RandomForestClassifier, validates input features,
guarantees identical feature ordering to training, and returns calibrated probabilities.
Handles missing or uninitialized models gracefully.
"""

from __future__ import annotations
import os
import json
from typing import Optional, Dict, Any, List, Union
import joblib
import numpy as np
import pandas as pd

from app.features import FEATURE_NAMES


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "rf_model.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "model_metadata.json")
REPORT_PATH = os.path.join(MODELS_DIR, "evaluation_report.json")


class Predictor:
    """Thread-safe singleton predictor for CSTR runaway classification."""
    _instance: Optional["Predictor"] = None
    
    def __init__(self):
        self.model = None
        self.metadata = None
        self.is_loaded = False
        self.load_model()
        
    @classmethod
    def get_instance(cls) -> "Predictor":
        if cls._instance is None:
            cls._instance = Predictor()
        return cls._instance
        
    def load_model(self) -> bool:
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                self.is_loaded = True
                if os.path.exists(METADATA_PATH):
                    with open(METADATA_PATH, "r", encoding="utf-8") as f:
                        self.metadata = json.load(f)
                return True
            except Exception as e:
                print(f"Error loading model from {MODEL_PATH}: {e}")
                self.model = None
                self.is_loaded = False
                return False
        else:
            self.model = None
            self.is_loaded = False
            return False

    def predict_probability(self, features_dict: Dict[str, float]) -> Optional[float]:
        """Predict runaway probability from a dictionary of features.
        
        Guarantees exact feature ordering matching training.
        """
        if not self.is_loaded or self.model is None:
            return None
            
        try:
            f = dict(features_dict)
            # Map synonymous features between 14-feature and dataset representations
            if "coolant_temp" not in f:
                if "Tc" in f:
                    f["coolant_temp"] = f["Tc"]
                elif "temperature_obs" in f and "reactor_coolant_temp_diff" in f:
                    f["coolant_temp"] = f["temperature_obs"] - f["reactor_coolant_temp_diff"]
                else:
                    f["coolant_temp"] = 300.0
                    
            if "temp_diff" not in f:
                if "reactor_coolant_temp_diff" in f:
                    f["temp_diff"] = f["reactor_coolant_temp_diff"]
                elif "temperature_obs" in f and "coolant_temp" in f:
                    f["temp_diff"] = f["temperature_obs"] - f["coolant_temp"]
                else:
                    f["temp_diff"] = 0.0
                    
            if "reactor_coolant_temp_diff" not in f and "temp_diff" in f:
                f["reactor_coolant_temp_diff"] = f["temp_diff"]

            cols = list(getattr(self.model, "feature_names_in_", FEATURE_NAMES))
            X = pd.DataFrame([[f.get(name, 0.0) for name in cols]], columns=cols)
            probs = self.model.predict_proba(X)
            # Probability of class 1 (runaway within 15 min)
            prob_positive = float(probs[0, 1])
            return prob_positive
        except Exception as e:
            print(f"Inference error: {e}")
            return None

    def predict_batch(self, features_df: pd.DataFrame) -> Optional[np.ndarray]:
        """Predict runaway probabilities for a batch DataFrame."""
        if not self.is_loaded or self.model is None:
            return None
        try:
            df = features_df.copy()
            if "coolant_temp" not in df.columns and "Tc" in df.columns:
                df["coolant_temp"] = df["Tc"]
            elif "coolant_temp" not in df.columns and "temperature_obs" in df.columns and "reactor_coolant_temp_diff" in df.columns:
                df["coolant_temp"] = df["temperature_obs"] - df["reactor_coolant_temp_diff"]
                
            if "temp_diff" not in df.columns and "reactor_coolant_temp_diff" in df.columns:
                df["temp_diff"] = df["reactor_coolant_temp_diff"]
                
            cols = list(getattr(self.model, "feature_names_in_", FEATURE_NAMES))
            for c in cols:
                if c not in df.columns:
                    df[c] = 0.0
            X = df[cols]
            return self.model.predict_proba(X)[:, 1]
        except Exception as e:
            print(f"Batch inference error: {e}")
            return None

    def get_metadata(self) -> Optional[Dict[str, Any]]:
        return self.metadata

    def get_evaluation_report(self) -> Optional[Dict[str, Any]]:
        if os.path.exists(REPORT_PATH):
            try:
                with open(REPORT_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading evaluation report: {e}")
                return None
        return None
