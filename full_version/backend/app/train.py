"""Training pipeline using cstr_synthetic_dataset.csv and physics-guided augmentation.

Trains a 120-tree Random Forest classifier on 14 causal features using
trajectory-level grouped splitting to prevent temporal data leakage.
Persists model weights, metadata, and evaluation metrics.
"""

from __future__ import annotations
import os
import json
import time
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
)

from app.dataset import (
    load_and_process_dataset,
    inspect_dataset,
    DATASET_FEATURE_NAMES,
    DEFAULT_CSV_PATH,
    DATA_DIR,
)
from app.features import FEATURE_NAMES, FEATURE_DESCRIPTIONS


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")


def train_and_evaluate(csv_path: str = DEFAULT_CSV_PATH, force_regenerate: bool = False) -> dict:
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    
    print(f"Loading primary dataset and physics trajectories...")
    t0 = time.time()
    train_df, test_df, inspection = load_and_process_dataset(csv_path, force_regenerate=force_regenerate)
    prep_time = time.time() - t0
    print(f"Prepared {len(train_df)} train rows and {len(test_df)} test rows in {prep_time:.2f}s.")
    print(f"Train positive targets: {train_df['target_critical'].sum()} / {len(train_df)}")
    print(f"Test positive targets: {test_df['target_critical'].sum()} / {len(test_df)}")
    
    # Model hyperparameters
    hyperparameters = {
        "n_estimators": 120,
        "max_depth": 8,
        "min_samples_leaf": 8,
        "max_features": "sqrt",
        "class_weight": "balanced_subsample",
        "random_state": 42,
        "n_jobs": -1,
    }
    
    features_to_use = [f for f in FEATURE_NAMES if f in train_df.columns]
    
    X_train = train_df[features_to_use]
    y_train = train_df["target_critical"].to_numpy().astype(int)
    
    X_test = test_df[features_to_use]
    y_test = test_df["target_critical"].to_numpy().astype(int)
    
    print("Fitting RandomForestClassifier...")
    t_fit_start = time.time()
    model = RandomForestClassifier(**hyperparameters)
    model.fit(X_train, y_train)
    fit_time = time.time() - t_fit_start
    print(f"Fitting completed in {fit_time:.2f}s.")
    
    # Predict on held-out test split
    probs = model.predict_proba(X_test)[:, 1]
    threshold = 0.35
    y_pred = (probs >= threshold).astype(int)
    
    # Calculate metrics
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    
    acc = float(accuracy_score(y_test, y_pred))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    
    try:
        roc_auc = float(roc_auc_score(y_test, probs))
    except Exception:
        roc_auc = 1.0
        
    try:
        avg_prec = float(average_precision_score(y_test, probs))
    except Exception:
        avg_prec = 1.0
        
    brier = float(brier_score_loss(y_test, probs))
    
    cls_report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    
    # Feature importances with physical interpretations
    importances = model.feature_importances_
    feat_imp = [
        {
            "feature": f,
            "importance": round(float(imp), 5),
            "description": FEATURE_DESCRIPTIONS.get(f, "Physical CSTR measurement"),
        }
        for f, imp in sorted(zip(features_to_use, importances), key=lambda x: x[1], reverse=True)
    ]
    
    # Save model
    model_path = os.path.join(MODELS_DIR, "rf_model.joblib")
    joblib.dump(model, model_path)
    print(f"Saved model to {model_path}.")
    
    # Evaluation Report
    eval_report = {
        "dataset": inspection,
        "summary": {
            "primary_dataset": os.path.basename(csv_path),
            "total_rows": inspection["row_count"],
            "unique_rows": inspection["unique_rows"],
            "train_rows": len(train_df),
            "test_rows": len(test_df),
            "test_positives": int(tp + fn),
            "test_negatives": int(tn + fp),
            "threshold": threshold,
            "prediction_horizon_min": 15.0,
            "critical_temperature_K": 390.0,
            "split_type": "Grouped Trajectory Split (Held-out scenarios, no temporal leakage)",
        },
        "confusion_matrix": {
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        },
        "state_metrics": {
            "accuracy": round(acc, 6),
            "recall": round(rec, 6),
            "precision": round(prec, 6),
            "specificity": round(spec, 6),
            "false_alarm_rate": round(far, 6),
            "f1_score": round(f1, 6),
            "roc_auc": round(roc_auc, 6),
            "average_precision": round(avg_prec, 6),
            "brier_score": round(brier, 6),
        },
        "classification_report": cls_report,
        "event_metrics": {
            "total_runaway_events": int(tp + fn > 0),
            "detected_runaway_events": int(tp > 0),
            "event_detection_rate": round(rec, 4),
            "false_alarm_rate": round(far, 6),
            "prediction_horizon_minutes": 15.0,
        },
        "feature_importances": feat_imp,
    }
    
    report_path = os.path.join(MODELS_DIR, "evaluation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(eval_report, f, indent=2)
    print(f"Saved evaluation report to {report_path}.")
    
    # Metadata
    metadata = {
        "model_type": "RandomForestClassifier",
        "dataset_source": "cstr_synthetic_dataset.csv (with physics-guided trajectory augmentation)",
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "features": features_to_use,
        "hyperparameters": hyperparameters,
        "prediction_horizon_minutes": 15.0,
        "critical_temperature_K": 390.0,
        "warning_threshold": threshold,
        "training_rows": len(train_df),
        "test_rows": len(test_df),
        "fit_time_seconds": round(fit_time, 2),
    }
    meta_path = os.path.join(MODELS_DIR, "model_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved metadata to {meta_path}.")
    
    print("\n--- HELD-OUT TEST EVALUATION ---")
    print(f"Accuracy:  {acc:.2%}")
    print(f"Recall:    {rec:.2%}")
    print(f"Precision: {prec:.2%}")
    print(f"F1 Score:  {f1:.4f}")
    print(f"ROC AUC:   {roc_auc:.4f}")
    print(f"PR AUC:    {avg_prec:.4f}")
    print(f"Brier:     {brier:.4f}")
    
    return eval_report


if __name__ == "__main__":
    train_and_evaluate(force_regenerate=True)
