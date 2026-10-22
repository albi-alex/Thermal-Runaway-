export interface SimulationEvents {
  t_disturbance: number | null;
  disturbance_description: string | null;
  t_first_warning: number | null;
  t_critical_warning: number | null;
  t_critical_crossing: number | null;
  lead_time: number | null;
}

export interface WarningAssessment {
  runaway_probability_15m?: number;
  rf_probability: number;
  rf_category: "SAFE" | "WARNING" | "CRITICAL";
  rf_severity: number;
  estimated_time_to_critical_min?: number | null;
  predicted_crossing_time_min?: number | null;
  time_to_event_method?: string;
  time_to_event_confidence?: string;
  time_to_event_uncertainty_interval?: number[] | null;
  time_to_event_category?: string;
  time_to_event_assumptions?: string;
  physics_category: string;
  physics_limit_triggered: boolean;
  physics_reason: string | null;
  overall_status?: "SAFE" | "WARNING" | "HIGH RISK" | "CRITICAL" | "THERMAL RUNAWAY DETECTED";
  overall_severity?: number;
  hybrid_category: "SAFE" | "WARNING" | "CRITICAL";
  hybrid_severity: number;
  current_temperature: number;
  heating_rate?: number;
  distance_to_critical: number;
  prediction_horizon_min: number;
  message: string;
  action_recommendation: string;
}

export interface HistoryRecord {
  time: number;
  T: number;
  T_obs: number;
  CA: number;
  U: number;
  Tf: number;
  Tc: number;
  q_gen: number;
  q_rem: number;
  q_net: number;
  dT_dt: number;
  rf_probability: number;
  runaway_probability_15m?: number;
  estimated_time_to_critical_min?: number | null;
  overall_status?: string;
  rf_category: string;
  hybrid_category: string;
}

export interface CSTRState {
  time: number;
  T: number;
  T_obs: number;
  CA: number;
  reaction_rate_constant: number;
  reaction_rate: number;
  q_flow: number;
  q_gen: number;
  q_rem: number;
  q_net: number;
  dT_dt: number;
  U: number;
  U0: number;
  floss: number;
  Tf: number;
  Tc: number;
  CAf: number;
  tau: number;
  T_critical: number;
  is_running: boolean;
  is_paused: boolean;
  simulation_speed: number;
  model_loaded: boolean;
  events: SimulationEvents;
  warning: WarningAssessment | null;
  features: Record<string, number> | null;
  history: HistoryRecord[];
}

export interface PresetInfo {
  id: string;
  name: string;
  description: string;
  expected_outcome: string;
  T0: number;
  CA0: number;
  Tf: number;
  Tc: number;
  U0: number;
  floss: number;
  delta_Tf: number;
}

export interface EvaluationReport {
  summary: {
    total_test_states?: number;
    total_test_trajectories?: number;
    critical_events_evaluated?: number;
    safe_trajectories_evaluated?: number;
    runaway_trajectories?: number;
    positive_states?: number;
    negative_states?: number;
    warning_threshold?: number;
    prediction_horizon_min?: number;
    critical_temperature_K?: number;
    primary_dataset?: string;
    total_rows?: number;
    unique_rows?: number;
    train_rows?: number;
    test_rows?: number;
    test_positives?: number;
    test_negatives?: number;
  };
  confusion_matrix: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  state_metrics: {
    recall: number;
    precision: number;
    specificity: number;
    false_alarm_rate: number;
    accuracy: number;
    f1_score: number;
    roc_auc: number | null;
    average_precision?: number | null;
    brier_score?: number;
  };
  event_metrics?: {
    total_critical_events?: number;
    warned_before_crossing?: number;
    warned_at_or_after_only?: number;
    event_recall?: number;
    timely_event_recall?: number;
    lead_time?: {
      mean_lead_time_min?: number;
      median_lead_time_min?: number;
      min_lead_time_min?: number;
      max_lead_time_min?: number;
      pct_warned_ge_15m?: number;
      pct_warned_ge_10m?: number;
      pct_warned_ge_5m?: number;
      median?: number;
      mean?: number;
      min?: number;
      max?: number;
      std?: number;
      count?: number;
    };
    critical_events_details?: Array<{
      trajectory_id: string;
      actual_crossing_time_min: number;
      first_ml_warning_time_min: number | null;
      measured_lead_time_min: number | null;
      warned_before_crossing: boolean;
      warned_ge_15m: boolean;
      warned_ge_10m: boolean;
      warned_ge_5m: boolean;
    }>;
    safe_trajectories_false_alarm_rate?: number;
    safe_trajectories_details?: Array<{
      trajectory_id: string;
      safe_points_count: number;
      false_alarm_points: number;
      false_alarm_rate: number;
    }>;
  };
  physics_time_to_event_evaluation?: {
    mean_absolute_error_min: number;
    median_absolute_error_min: number;
    evaluated_samples: number;
    method: string;
    limitations: string;
  };
  feature_importances: Array<{
    feature: string;
    importance: number;
    description: string;
  }>;
  calibration?: Array<{
    bin: string;
    bin_center: number;
    mean_pred: number;
    fraction_positive: number;
    count: number;
  }>;
  curves?: {
    roc: Array<{ fpr: number; tpr: number }>;
    precision_recall: Array<{ recall: number; precision: number }>;
  };
}

export interface ModelMetadata {
  model_type: string;
  title: string;
  training_timestamp: string;
  features: string[];
  hyperparameters: Record<string, any>;
  prediction_horizon_minutes: number;
  critical_temperature_K: number;
  warning_threshold: number;
  training_rows: number;
  training_trajectories: number;
  test_rows: number;
  test_trajectories: number;
  fit_time_seconds: number;
}
