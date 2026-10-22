"""Comprehensive evaluation pipeline for the CSTR 15-minute thermal runaway model.

Computes:
  1. State-level metrics: Precision, Recall, F1, Accuracy, Specificity, ROC AUC, PR AUC, Brier score.
  2. Confusion matrix.
  3. Event-level lead time statistics on held-out test trajectories:
     - First ML warning time (P_RF >= 0.35) for each event.
     - Actual 390 K crossing time.
     - Measured lead time (t_crossing - t_warn).
     - Percentage of events warned >= 15 min, >= 10 min, >= 5 min in advance.
     - False alarm frequency on safe trajectories.
     - Cases where warning occurred only at or after threshold (lead time <= 0).
  4. Accuracy and limitations of the physics-based time-to-event estimator against ground truth.
"""

from __future__ import annotations
import os
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
    classification_report,
)

from app.features import FEATURE_NAMES, FEATURE_DESCRIPTIONS
from app.labels import TARGET_COLUMN, HORIZON_MINUTES, CRITICAL_TEMPERATURE_K
from app.physics import forward_simulate_time_to_critical, CSTRParameters


def evaluate_model_on_test_set(
    model: Any,
    test_df: pd.DataFrame,
    threshold: float = 0.35,
    critical_temp: float = CRITICAL_TEMPERATURE_K,
    horizon_min: float = HORIZON_MINUTES,
) -> Dict[str, Any]:
    """Compute all state-level, event-level lead time, and physics time-to-event metrics."""
    X_test = test_df[FEATURE_NAMES]
    target_col = TARGET_COLUMN if TARGET_COLUMN in test_df.columns else "target_critical"
    y_test = test_df[target_col].to_numpy().astype(int)
    
    # 1. Model probabilities (positive class: runaway within 15 min)
    probs = model.predict_proba(X_test)[:, 1]
    y_pred = (probs >= threshold).astype(int)
    
    # State-level confusion matrix
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    
    total = int(len(y_test))
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    accuracy = float((tp + tn) / total) if total > 0 else 0.0
    f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    
    try:
        roc_auc = float(roc_auc_score(y_test, probs))
    except Exception:
        roc_auc = None
        
    try:
        avg_precision = float(average_precision_score(y_test, probs))
    except Exception:
        avg_precision = None
        
    brier = float(brier_score_loss(y_test, probs))
    
    # ROC curve
    fpr_arr, tpr_arr, _ = roc_curve(y_test, probs)
    step_roc = max(1, len(fpr_arr) // 50)
    roc_points = [
        {"fpr": round(float(fpr_arr[i]), 4), "tpr": round(float(tpr_arr[i]), 4)}
        for i in range(0, len(fpr_arr), step_roc)
    ]
    if roc_points[-1]["fpr"] != 1.0 or roc_points[-1]["tpr"] != 1.0:
        roc_points.append({"fpr": 1.0, "tpr": 1.0})
        
    # PR curve
    prec_arr, rec_arr, _ = precision_recall_curve(y_test, probs)
    step_pr = max(1, len(prec_arr) // 50)
    pr_points = [
        {"recall": round(float(rec_arr[i]), 4), "precision": round(float(prec_arr[i]), 4)}
        for i in range(0, len(rec_arr), step_pr)
    ]
    
    # Calibration bins
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
        
    # Feature Importances
    importances = model.feature_importances_
    feature_importance_list = [
        {
            "feature": feat,
            "importance": round(float(imp), 5),
            "description": FEATURE_DESCRIPTIONS.get(feat, ""),
        }
        for feat, imp in sorted(zip(FEATURE_NAMES, importances), key=lambda x: x[1], reverse=True)
    ]
    
    # 2. Event-level lead time & early warning evaluation
    test_df_eval = test_df.copy()
    test_df_eval["pred_prob"] = probs
    
    traj_col = "trajectory_id" if "trajectory_id" in test_df_eval.columns else "scenario_id"
    time_col = "Time (min)" if "Time (min)" in test_df_eval.columns else "time_min"
    
    events_evaluated: List[Dict[str, Any]] = []
    safe_trajectories_evaluated: List[Dict[str, Any]] = []
    
    total_critical_events = 0
    warned_at_all = 0
    warned_before_crossing = 0
    warned_ge_15m = 0
    warned_ge_10m = 0
    warned_ge_5m = 0
    warned_at_or_after_only = 0
    all_lead_times: List[float] = []
    
    total_safe_states = 0
    safe_false_alarm_states = 0
    
    # Physics time-to-event offline tracking
    tte_errors: List[float] = []
    
    for traj_id, group in test_df_eval.groupby(traj_col):
        t_arr = group[time_col].to_numpy()
        T_arr = group["temperature_obs"].to_numpy()
        p_arr = group["pred_prob"].to_numpy()
        ca_arr = group["concentration"].to_numpy()
        
        # Ground-truth crossing
        crit_indices = np.where(T_arr >= critical_temp)[0]
        has_runaway = len(crit_indices) > 0
        
        # ML qualifying warnings (P_RF >= threshold)
        warn_indices = np.where(p_arr >= threshold)[0]
        
        if has_runaway:
            total_critical_events += 1
            idx_crit = crit_indices[0]
            t_crit = float(t_arr[idx_crit])
            
            if len(warn_indices) > 0:
                warned_at_all += 1
                idx_warn = warn_indices[0]
                t_warn = float(t_arr[idx_warn])
                lead_time = round(t_crit - t_warn, 2)
                
                if lead_time > 0.0:
                    warned_before_crossing += 1
                    all_lead_times.append(lead_time)
                    if lead_time >= 15.0:
                        warned_ge_15m += 1
                    if lead_time >= 10.0:
                        warned_ge_10m += 1
                    if lead_time >= 5.0:
                        warned_ge_5m += 1
                else:
                    warned_at_or_after_only += 1
            else:
                t_warn = None
                lead_time = None
                warned_at_or_after_only += 1
                
            events_evaluated.append({
                "trajectory_id": str(traj_id),
                "actual_crossing_time_min": round(t_crit, 2),
                "first_ml_warning_time_min": round(t_warn, 2) if t_warn is not None else None,
                "measured_lead_time_min": lead_time,
                "warned_before_crossing": bool(lead_time is not None and lead_time > 0),
                "warned_ge_15m": bool(lead_time is not None and lead_time >= 15.0),
                "warned_ge_10m": bool(lead_time is not None and lead_time >= 10.0),
                "warned_ge_5m": bool(lead_time is not None and lead_time >= 5.0),
            })
            
            # Physics time-to-event accuracy on ground-truth trajectory before crossing
            params_sample = CSTRParameters()
            for step_i in range(0, idx_crit, max(1, idx_crit // 10)):
                t_pt = float(t_arr[step_i])
                T_pt = float(T_arr[step_i])
                CA_pt = float(ca_arr[step_i])
                gt_time_rem = t_crit - t_pt
                
                if gt_time_rem <= horizon_min:
                    tc_val = (
                        float(group["Tc"].iloc[step_i])
                        if "Tc" in group.columns
                        else float(group["temperature_obs"].iloc[step_i] - group["reactor_coolant_temp_diff"].iloc[step_i])
                    )
                    tte_res = forward_simulate_time_to_critical(
                        current_T=T_pt,
                        current_CA=CA_pt,
                        current_time=t_pt,
                        params=params_sample,
                        eff_U=float(group["cooling_coefficient"].iloc[step_i]),
                        eff_Tf=float(group["feed_temperature"].iloc[step_i]),
                        eff_Tc=tc_val,
                        horizon_min=horizon_min,
                        critical_temp=critical_temp,
                    )
                    if tte_res.estimated_time_to_critical_min is not None:
                        err = abs(tte_res.estimated_time_to_critical_min - gt_time_rem)
                        tte_errors.append(err)
        else:
            # Safe trajectory
            n_safe_pts = len(p_arr)
            n_fa_pts = int(np.sum(p_arr >= threshold))
            total_safe_states += n_safe_pts
            safe_false_alarm_states += n_fa_pts
            
            safe_trajectories_evaluated.append({
                "trajectory_id": str(traj_id),
                "safe_points_count": n_safe_pts,
                "false_alarm_points": n_fa_pts,
                "false_alarm_rate": round(n_fa_pts / n_safe_pts, 4) if n_safe_pts > 0 else 0.0,
            })
            
    pct_ge_15m = round((warned_ge_15m / total_critical_events) * 100, 1) if total_critical_events > 0 else 0.0
    pct_ge_10m = round((warned_ge_10m / total_critical_events) * 100, 1) if total_critical_events > 0 else 0.0
    pct_ge_5m = round((warned_ge_5m / total_critical_events) * 100, 1) if total_critical_events > 0 else 0.0
    overall_fa_rate = round(safe_false_alarm_states / total_safe_states, 6) if total_safe_states > 0 else 0.0
    
    lead_time_stats = {
        "mean_lead_time_min": round(float(np.mean(all_lead_times)), 2) if all_lead_times else 0.0,
        "median_lead_time_min": round(float(np.median(all_lead_times)), 2) if all_lead_times else 0.0,
        "min_lead_time_min": round(float(np.min(all_lead_times)), 2) if all_lead_times else 0.0,
        "max_lead_time_min": round(float(np.max(all_lead_times)), 2) if all_lead_times else 0.0,
        "pct_warned_ge_15m": pct_ge_15m,
        "pct_warned_ge_10m": pct_ge_10m,
        "pct_warned_ge_5m": pct_ge_5m,
        "warned_before_crossing_count": warned_before_crossing,
        "warned_at_or_after_only_count": warned_at_or_after_only,
    }
    
    physics_tte_eval = {
        "mean_absolute_error_min": round(float(np.mean(tte_errors)), 2) if tte_errors else 0.0,
        "median_absolute_error_min": round(float(np.median(tte_errors)), 2) if tte_errors else 0.0,
        "evaluated_samples": len(tte_errors),
        "method": "physics_forward_simulation",
        "limitations": (
            "The physics forward simulation accurately forecasts time-to-critical under the condition "
            "that current cooling capacity and feed temperature remain constant. If unmodelled disturbances "
            "or active cooling restoration occurs in the future, the projected time will dynamically adjust."
        ),
    }
    
    return {
        "summary": {
            "total_test_states": total,
            "total_test_trajectories": int(test_df_eval[traj_col].nunique()),
            "critical_events_evaluated": total_critical_events,
            "safe_trajectories_evaluated": len(safe_trajectories_evaluated),
            "warning_threshold": threshold,
            "prediction_horizon_min": horizon_min,
            "critical_temperature_K": critical_temp,
        },
        "state_metrics": {
            "accuracy": round(accuracy, 6),
            "recall": round(recall, 6),
            "precision": round(precision, 6),
            "specificity": round(specificity, 6),
            "false_alarm_rate": round(far, 6),
            "f1_score": round(f1, 6),
            "roc_auc": round(roc_auc, 6) if roc_auc is not None else None,
            "average_precision": round(avg_precision, 6) if avg_precision is not None else None,
            "brier_score": round(brier, 6),
        },
        "confusion_matrix": {
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        },
        "event_metrics": {
            "total_critical_events": total_critical_events,
            "warned_before_crossing": warned_before_crossing,
            "warned_at_or_after_only": warned_at_or_after_only,
            "lead_time": lead_time_stats,
            "critical_events_details": events_evaluated,
            "safe_trajectories_false_alarm_rate": overall_fa_rate,
            "safe_trajectories_details": safe_trajectories_evaluated,
        },
        "physics_time_to_event_evaluation": physics_tte_eval,
        "feature_importances": feature_importance_list,
        "calibration": calibration_bins,
        "curves": {
            "roc": roc_points,
            "precision_recall": pr_points,
        },
    }
