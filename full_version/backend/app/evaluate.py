"""Comprehensive evaluation pipeline for the CSTR thermal runaway model.

Computes state-level metrics, threshold-free performance (ROC AUC, PR AUC, Brier score),
probability calibration, feature importance, and event-level lead time statistics on
the held-out test trajectories as derived in Sections 18, 19, and 20 of the faculty notes.
"""

from __future__ import annotations
import json
from typing import Dict, Any, List
import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    roc_curve,
    precision_recall_curve,
)
from app.features import FEATURE_NAMES, FEATURE_DESCRIPTIONS


def evaluate_model_on_test_set(
    model: Any,
    test_df: pd.DataFrame,
    threshold: float = 0.35,
    critical_temp: float = 390.0,
) -> Dict[str, Any]:
    """Compute all state-level and event-level metrics on held-out test data."""
    X_test = test_df[FEATURE_NAMES]
    y_test = test_df["critical_within_3min"].to_numpy().astype(int)
    
    # Model probabilities for positive class (Eq. 127)
    probs = model.predict_proba(X_test)[:, 1]
    y_pred = (probs >= threshold).astype(int)
    
    # State-level confusion matrix (Section 18)
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    
    total = int(len(y_test))
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    accuracy = float((tp + tn) / total) if total > 0 else 0.0
    f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    
    # Threshold-free metrics (Section 19)
    try:
        roc_auc = float(roc_auc_score(y_test, probs))
    except Exception:
        roc_auc = None
        
    try:
        avg_precision = float(average_precision_score(y_test, probs))
    except Exception:
        avg_precision = None
        
    brier = float(brier_score_loss(y_test, probs))
    
    # ROC curve (subsample for compact JSON)
    fpr_arr, tpr_arr, _ = roc_curve(y_test, probs)
    step_roc = max(1, len(fpr_arr) // 50)
    roc_points = [
        {"fpr": round(float(fpr_arr[i]), 4), "tpr": round(float(tpr_arr[i]), 4)}
        for i in range(0, len(fpr_arr), step_roc)
    ]
    if roc_points[-1]["fpr"] != 1.0 or roc_points[-1]["tpr"] != 1.0:
        roc_points.append({"fpr": 1.0, "tpr": 1.0})
        
    # Precision-Recall curve
    prec_arr, rec_arr, _ = precision_recall_curve(y_test, probs)
    step_pr = max(1, len(prec_arr) // 50)
    pr_points = [
        {"recall": round(float(rec_arr[i]), 4), "precision": round(float(prec_arr[i]), 4)}
        for i in range(0, len(rec_arr), step_pr)
    ]
    
    # Calibration bins (10 bins) (Eq. 164-165)
    bin_edges = np.linspace(0.0, 1.0, 11)
    calibration_bins = []
    for b in range(10):
        low, high = bin_edges[b], bin_edges[b + 1]
        in_bin = (probs >= low) & (probs <= high if b == 9 else probs < high)
        n_in_bin = int(np.sum(in_bin))
        if n_in_bin > 0:
            mean_pred = float(np.mean(probs[in_bin]))
            emp_pos = float(np.mean(y_test[in_bin]))
        else:
            mean_pred = float((low + high) / 2)
            emp_pos = 0.0
        calibration_bins.append({
            "bin": f"[{low:.1f}, {high:.1f}]",
            "bin_center": round(float((low + high) / 2), 3),
            "mean_pred": round(mean_pred, 4),
            "fraction_positive": round(emp_pos, 4),
            "count": n_in_bin,
        })
        
    # Feature Importances (Section 16.6)
    importances = model.feature_importances_
    feature_importance_list = [
        {
            "feature": feat,
            "importance": round(float(imp), 5),
            "description": FEATURE_DESCRIPTIONS.get(feat, ""),
        }
        for feat, imp in sorted(zip(FEATURE_NAMES, importances), key=lambda x: x[1], reverse=True)
    ]
    
    # Event-level detection & lead time (Section 20)
    test_df_eval = test_df.copy()
    test_df_eval["pred_prob"] = probs
    
    runaway_trajectories = 0
    alerted_trajectories = 0
    timely_alerted = 0
    lead_times: List[float] = []
    
    for _, group in test_df_eval.groupby("scenario_id"):
        t_arr = group["time_min"].to_numpy()
        T_arr = group["temperature_obs"].to_numpy()
        p_arr = group["pred_prob"].to_numpy()
        
        # Did it reach critical runaway temp?
        crit_indices = np.where(T_arr >= critical_temp)[0]
        warn_indices = np.where(p_arr >= threshold)[0]
        
        is_runaway = len(crit_indices) > 0
        if is_runaway:
            runaway_trajectories += 1
            t_crit = float(t_arr[crit_indices[0]])
            
            if len(warn_indices) > 0:
                alerted_trajectories += 1
                t_warn = float(t_arr[warn_indices[0]])
                lead_time = t_crit - t_warn
                lead_times.append(lead_time)
                if lead_time > 0:
                    timely_alerted += 1
                    
    event_recall = float(alerted_trajectories / runaway_trajectories) if runaway_trajectories > 0 else 1.0
    timely_event_recall = float(timely_alerted / runaway_trajectories) if runaway_trajectories > 0 else 1.0
    
    lead_time_stats = {
        "median": round(float(np.median(lead_times)), 2) if lead_times else 0.0,
        "mean": round(float(np.mean(lead_times)), 2) if lead_times else 0.0,
        "min": round(float(np.min(lead_times)), 2) if lead_times else 0.0,
        "max": round(float(np.max(lead_times)), 2) if lead_times else 0.0,
        "std": round(float(np.std(lead_times)), 2) if lead_times else 0.0,
        "count": len(lead_times),
    }
    
    # Lead time histogram bins
    lead_bins = []
    if lead_times:
        counts, edges = np.histogram(lead_times, bins=8)
        for i in range(len(counts)):
            lead_bins.append({
                "range": f"{edges[i]:.1f}-{edges[i+1]:.1f} min",
                "center": round(float((edges[i] + edges[i+1]) / 2), 2),
                "count": int(counts[i]),
            })
            
    num_test_scenarios = int(test_df["scenario_id"].nunique())
    
    report = {
        "summary": {
            "total_test_states": total,
            "total_test_trajectories": num_test_scenarios,
            "runaway_trajectories": runaway_trajectories,
            "positive_states": int(tp + fn),
            "negative_states": int(tn + fp),
            "warning_threshold": threshold,
            "prediction_horizon_min": 3.0,
            "critical_temperature_K": critical_temp,
        },
        "confusion_matrix": {
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        },
        "state_metrics": {
            "recall": round(recall, 6),
            "precision": round(precision, 6),
            "specificity": round(specificity, 6),
            "false_alarm_rate": round(far, 6),
            "accuracy": round(accuracy, 6),
            "f1_score": round(f1, 6),
            "roc_auc": round(roc_auc, 6) if roc_auc is not None else None,
            "average_precision": round(avg_precision, 6) if avg_precision is not None else None,
            "brier_score": round(brier, 6),
        },
        "event_metrics": {
            "event_recall": round(event_recall, 4),
            "timely_event_recall": round(timely_event_recall, 4),
            "lead_time": lead_time_stats,
            "lead_time_distribution": lead_bins,
        },
        "feature_importances": feature_importance_list,
        "calibration": calibration_bins,
        "curves": {
            "roc": roc_points,
            "precision_recall": pr_points,
        },
    }
    
    return report
