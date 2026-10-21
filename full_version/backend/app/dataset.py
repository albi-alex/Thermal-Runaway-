"""Dataset processing, validation, and physics-guided augmentation for CSTR early warning.

Preserves the primary dataset cstr_synthetic_dataset.csv. To address extreme class
imbalance (only 1 runaway trajectory in the raw data), generates verified physics-guided
trajectories using the CSTR ODEs under varied operating conditions (cooling loss, hot feed,
coolant temperature, residence times). Evaluates models using strict trajectory-level
group splitting to prevent temporal leakage.
"""

from __future__ import annotations
import os
from typing import Tuple, Dict, Any, List
import numpy as np
import pandas as pd

from app.physics import reaction_rate_constant, CSTRParameters, explicit_midpoint_step, heat_terms
from app.features import FEATURE_NAMES, compute_features_trajectory


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DEFAULT_CSV_PATH = os.path.join(DATA_DIR, "cstr_synthetic_dataset.csv")
AUGMENTED_CSV_PATH = os.path.join(DATA_DIR, "cstr_augmented_dataset.csv")

# Standard 14 physics-guided features
DATASET_FEATURE_NAMES: List[str] = list(FEATURE_NAMES)


def inspect_dataset(csv_path: str = DEFAULT_CSV_PATH) -> Dict[str, Any]:
    """Inspect cstr_synthetic_dataset.csv in detail."""
    if not os.path.exists(csv_path):
        fallback_docs = r"C:\Users\lenovo\Documents\cstr_synthetic_dataset.csv"
        if os.path.exists(fallback_docs):
            import shutil
            os.makedirs(os.path.dirname(csv_path), exist_ok=True)
            shutil.copy(fallback_docs, csv_path)
        else:
            raise FileNotFoundError(
                f"Primary dataset not found at {csv_path}. Please place cstr_synthetic_dataset.csv in backend/data/."
            )

    df_raw = pd.read_csv(csv_path)
    col_names = list(df_raw.columns)
    row_count = len(df_raw)
    duplicates_count = int(df_raw.duplicated().sum())
    missing_counts = {col: int(df_raw[col].isnull().sum()) for col in col_names}
    
    time_col = "Time (min)" if "Time (min)" in df_raw.columns else col_names[0]
    min_time = float(df_raw[time_col].min())
    max_time = float(df_raw[time_col].max())
    
    df_dedup = df_raw.drop_duplicates().sort_values(by=time_col)
    time_diffs = df_dedup[time_col].diff().dropna()
    median_dt = float(time_diffs.median()) if len(time_diffs) > 0 else 0.0
    
    coolant_col = "Coolant Temp (K)" if "Coolant Temp (K)" in df_raw.columns else None
    unique_coolants = [int(x) for x in sorted(df_raw[coolant_col].unique())] if coolant_col else []
    
    temp_col = "Reactor Temp (K)" if "Reactor Temp (K)" in df_raw.columns else None
    min_temp = float(df_raw[temp_col].min()) if temp_col else 0.0
    max_temp = float(df_raw[temp_col].max()) if temp_col else 0.0
    
    condition_col = "Condition" if "Condition" in df_raw.columns else None
    condition_counts = {k: int(v) for k, v in df_raw[condition_col].value_counts().items()} if condition_col else {}
    
    critical_count_raw = condition_counts.get("Critical", 0)
    critical_count_dedup = int((df_dedup[temp_col] >= 390.0).sum()) if temp_col else 0
    
    inspection = {
        "file_path": csv_path,
        "row_count": row_count,
        "column_count": len(col_names),
        "columns": col_names,
        "data_types": {col: str(df_raw[col].dtype) for col in col_names},
        "missing_values": missing_counts,
        "duplicate_rows": duplicates_count,
        "unique_rows": row_count - duplicates_count,
        "time_min": min_time,
        "time_max": max_time,
        "total_duration_minutes": max_time - min_time,
        "sampling_interval_minutes": round(median_dt, 5),
        "sampling_interval_seconds": round(median_dt * 60, 2),
        "coolant_temp_trajectories": unique_coolants,
        "reactor_temp_range_K": [round(min_temp, 2), round(max_temp, 2)],
        "condition_counts": condition_counts,
        "critical_rows_dedup": critical_count_dedup,
        "critical_temperature_390K_reached": bool(max_temp >= 390.0),
        "sufficient_15min_future_coverage": bool(max_time >= 15.0),
        "imbalance_explanation": (
            f"The primary dataset cstr_synthetic_dataset.csv contains only 3 operational trajectories "
            f"(Tc = 290 K, 300 K, 305 K). Only the Tc = 305 K trajectory enters thermal runaway ({critical_count_dedup} unique critical points, "
            f"representing ~0.93% of unique rows). To prevent severe minority underfitting and enable robust trajectory-level evaluation "
            f"without temporal leakage, physics-guided supplementary trajectories are synthesized using the exact CSTR ODEs."
        ),
    }
    return inspection


def generate_supplementary_trajectories(seed: int = 42) -> pd.DataFrame:
    """Generate physics-based trajectories covering diverse normal and runaway scenarios."""
    scenarios = [
        # Safe / Nominal / Low-Risk Scenarios
        {"id": "sim_safe_nominal_1", "T0": 305.0, "CA0": 0.88, "Tc": 300.0, "Tf": 300.0, "U0": 1.1, "floss": 0.0, "tau": 5.0},
        {"id": "sim_safe_cold_coolant", "T0": 300.0, "CA0": 0.90, "Tc": 290.0, "Tf": 300.0, "U0": 1.1, "floss": 0.0, "tau": 5.0},
        {"id": "sim_safe_chilled_feed", "T0": 305.0, "CA0": 0.85, "Tc": 295.0, "Tf": 290.0, "U0": 1.1, "floss": 0.0, "tau": 5.0},
        {"id": "sim_safe_fast_flow", "T0": 305.0, "CA0": 0.88, "Tc": 300.0, "Tf": 300.0, "U0": 1.1, "floss": 0.0, "tau": 3.0},
        {"id": "sim_safe_high_heat_transfer", "T0": 310.0, "CA0": 0.80, "Tc": 298.0, "Tf": 300.0, "U0": 1.3, "floss": 0.0, "tau": 5.0},
        {"id": "sim_safe_dilute_feed", "T0": 305.0, "CA0": 0.50, "Tc": 300.0, "Tf": 300.0, "U0": 1.0, "floss": 0.0, "tau": 5.0},
        {"id": "sim_safe_mild_coolant_rise", "T0": 305.0, "CA0": 0.85, "Tc": 302.0, "Tf": 300.0, "U0": 1.1, "floss": 0.0, "tau": 5.0},
        {"id": "sim_safe_slight_cooling_loss", "T0": 305.0, "CA0": 0.85, "Tc": 298.0, "Tf": 300.0, "U0": 1.1, "floss": 0.20, "tau": 5.0},
        {"id": "sim_safe_slow_flow", "T0": 302.0, "CA0": 0.80, "Tc": 295.0, "Tf": 295.0, "U0": 1.2, "floss": 0.0, "tau": 7.0},
        {"id": "sim_safe_steady_state_test", "T0": 305.0, "CA0": 0.88, "Tc": 300.0, "Tf": 300.0, "U0": 1.1, "floss": 0.10, "tau": 5.0},
        
        # High-Risk / Runaway Scenarios
        {"id": "sim_runaway_cooling_failure_82", "T0": 305.0, "CA0": 0.88, "Tc": 300.0, "Tf": 300.0, "U0": 1.1, "floss": 0.82, "tau": 5.0},
        {"id": "sim_runaway_cooling_failure_70", "T0": 305.0, "CA0": 0.88, "Tc": 300.0, "Tf": 300.0, "U0": 1.1, "floss": 0.70, "tau": 5.0},
        {"id": "sim_runaway_cooling_failure_60", "T0": 308.0, "CA0": 0.88, "Tc": 302.0, "Tf": 305.0, "U0": 1.1, "floss": 0.60, "tau": 5.0},
        {"id": "sim_runaway_hot_feed_and_cooling_loss", "T0": 310.0, "CA0": 0.90, "Tc": 300.0, "Tf": 325.0, "U0": 1.1, "floss": 0.50, "tau": 5.0},
        {"id": "sim_runaway_high_coolant_temp", "T0": 315.0, "CA0": 0.88, "Tc": 312.0, "Tf": 305.0, "U0": 1.0, "floss": 0.0, "tau": 5.0},
        {"id": "sim_runaway_hot_start", "T0": 340.0, "CA0": 0.95, "Tc": 305.0, "Tf": 310.0, "U0": 1.1, "floss": 0.30, "tau": 5.0},
        {"id": "sim_runaway_concentrated_feed", "T0": 310.0, "CA0": 1.20, "Tc": 302.0, "Tf": 305.0, "U0": 1.1, "floss": 0.40, "tau": 5.0},
        {"id": "sim_runaway_near_adiabatic", "T0": 305.0, "CA0": 0.88, "Tc": 300.0, "Tf": 300.0, "U0": 1.1, "floss": 0.90, "tau": 5.0},
        {"id": "sim_runaway_slow_flow_loss", "T0": 308.0, "CA0": 0.90, "Tc": 304.0, "Tf": 310.0, "U0": 1.1, "floss": 0.65, "tau": 8.0},
        {"id": "sim_runaway_extreme_disturbance", "T0": 315.0, "CA0": 1.00, "Tc": 308.0, "Tf": 320.0, "U0": 1.0, "floss": 0.75, "tau": 6.0},
    ]

    dfs = []
    dt = 0.1
    t_end = 15.0
    rng = np.random.default_rng(seed)

    for sc in scenarios:
        params = CSTRParameters(
            Tc=sc["Tc"],
            Tf=sc["Tf"],
            tau=sc["tau"],
            U0=sc["U0"],
        )
        eff_U = sc["U0"] * (1.0 - sc["floss"])
        
        t = 0.0
        T = sc["T0"]
        CA = sc["CA0"]
        
        rows = []
        while t <= t_end + 1e-5:
            noise = float(rng.normal(0, 0.15))
            T_obs = T + noise
            
            rows.append({
                "trajectory_id": sc["id"],
                "Time (min)": round(t, 2),
                "temperature_obs": T_obs,
                "T_true": T,
                "concentration": CA,
                "coolant_temp": sc["Tc"],
                "Tc": sc["Tc"],
                "cooling_coefficient": eff_U,
                "feed_temperature": sc["Tf"],
                "feed_concentration": params.CAf,
                "residence_time": sc["tau"],
                "A": params.A,
                "E_over_R": params.E_over_R,
                "beta": params.beta,
            })
            
            CA, T = explicit_midpoint_step(
                t, CA, T, dt, params,
                U_func=lambda _: eff_U,
                Tf_func=lambda _: sc["Tf"]
            )
            t = round(t + dt, 2)
            
        df_sc = pd.DataFrame(rows)
        df_feats = compute_features_trajectory(df_sc, dt=dt)
        
        # Causal forward target: critical threshold 390 K reached within remaining trajectory
        fut_max = df_feats["T_true"][::-1].cummax()[::-1]
        df_feats["target_critical"] = (fut_max >= 390.0).astype(int)
        dfs.append(df_feats)

    return pd.concat(dfs, ignore_index=True)


def process_raw_dataset(csv_path: str = DEFAULT_CSV_PATH) -> pd.DataFrame:
    """Process original cstr_synthetic_dataset.csv into standard features with trajectory IDs."""
    df_raw = pd.read_csv(csv_path)
    df_clean = df_raw.drop_duplicates().sort_values(by=["Coolant Temp (K)", "Time (min)"]).reset_index(drop=True)
    
    params = CSTRParameters()
    processed_trajectories: List[pd.DataFrame] = []
    
    for tc, group in df_clean.groupby("Coolant Temp (K)"):
        g = group.sort_values(by="Time (min)").copy()
        tc_val = float(tc)
        
        g["trajectory_id"] = f"raw_dataset_Tc_{int(tc_val)}"
        g["temperature_obs"] = g["Reactor Temp (K)"]
        g["concentration"] = g["CA (mol/L)"]
        g["cooling_coefficient"] = params.U0
        g["feed_temperature"] = params.Tf
        g["feed_concentration"] = params.CAf
        g["residence_time"] = params.tau
        g["Tc"] = tc_val
        g["beta"] = params.beta
        g["A"] = params.A
        g["E_over_R"] = params.E_over_R
        
        # Compute 14 causal features using trajectory time steps
        t_series = g["Time (min)"]
        dt = float(t_series.diff().median()) if len(t_series) > 1 else 0.01001
        dt = max(0.001, dt)
        
        df_feats = compute_features_trajectory(g, dt=dt)
        
        # Causal target
        future_max = df_feats["temperature_obs"][::-1].cummax()[::-1]
        df_feats["target_critical"] = (future_max >= 390.0).astype(int)
        
        processed_trajectories.append(df_feats)
        
    return pd.concat(processed_trajectories, ignore_index=True)


def load_and_process_dataset(
    csv_path: str = DEFAULT_CSV_PATH,
    augmented_path: str = AUGMENTED_CSV_PATH,
    test_ratio: float = 0.20,
    force_regenerate: bool = False,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """Load primary dataset, combine with physics trajectories, and split by trajectory.
    
    Preserves cstr_synthetic_dataset.csv untouched and stores the augmented data
    in cstr_augmented_dataset.csv.
    """
    inspection = inspect_dataset(csv_path)
    
    # Process primary dataset
    df_primary = process_raw_dataset(csv_path)
    
    # Generate or load augmented dataset
    if os.path.exists(augmented_path) and not force_regenerate:
        df_sim = pd.read_csv(augmented_path)
    else:
        df_sim = generate_supplementary_trajectories()
        os.makedirs(os.path.dirname(augmented_path), exist_ok=True)
        df_sim.to_csv(augmented_path, index=False)
        print(f"Generated and saved augmented trajectories to {augmented_path}")
        
    # Combine datasets
    common_cols = [c for c in FEATURE_NAMES if c in df_primary.columns and c in df_sim.columns]
    all_cols = ["trajectory_id", "Time (min)"] + common_cols + ["target_critical"]
    
    combined_df = pd.concat([df_primary[all_cols], df_sim[all_cols]], ignore_index=True)
    
    # Trajectory-level train/test split: completely hold out test trajectories
    # Guaranteed that test trajectories have never been seen in train
    all_trajectories = sorted(combined_df["trajectory_id"].unique())
    
    # Select balanced test trajectories (2 safe scenarios, 2 runaway scenarios)
    held_out_test_trajectories = [
        "sim_safe_steady_state_test",
        "sim_safe_mild_coolant_rise",
        "sim_runaway_cooling_failure_82",
        "sim_runaway_high_coolant_temp",
    ]
    
    test_mask = combined_df["trajectory_id"].isin(held_out_test_trajectories)
    train_mask = ~test_mask
    
    train_df = combined_df[train_mask].copy().reset_index(drop=True)
    test_df = combined_df[test_mask].copy().reset_index(drop=True)
    
    return train_df, test_df, inspection
