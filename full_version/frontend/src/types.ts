export interface SimulationEvents {
  t_disturbance: number | null;
  disturbance_description: string | null;
  t_first_warning: number | null;
  t_critical_warning: number | null;
  t_critical_crossing: number | null;
  lead_time: number | null;
}

export interface WarningAssessment {
  rf_probability: number;
  rf_category: "SAFE" | "WARNING" | "CRITICAL";
  rf_severity: number;
  physics_category: string;
  physics_limit_triggered: boolean;
  physics_reason: string | null;
  hybrid_category: "SAFE" | "WARNING" | "CRITICAL";
  hybrid_severity: number;
  current_temperature: number;
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
    total_test_states: number;
    total_test_trajectories: number;
    runaway_trajectories: number;
    positive_states: number;
    negative_states: number;
    warning_threshold: number;
    prediction_horizon_min: number;
    critical_temperature_K: number;
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
    roc_auc: number;
    average_precision: number;
    brier_score: number;
  };
  event_metrics: {
    event_recall: number;
    timely_event_recall: number;
    lead_time: {
      median: number;
      mean: number;
      min: number;
      max: number;
      std: number;
      count: number;
    };
    lead_time_distribution: Array<{
      range: string;
      center: number;
      count: number;
    }>;
  };
  feature_importances: Array<{
    feature: string;
    importance: number;
    description: string;
  }>;
  calibration: Array<{
    bin: string;
    bin_center: number;
    mean_pred: number;
    fraction_positive: number;
    count: number;
  }>;
  curves: {
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
