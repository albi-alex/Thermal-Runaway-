import React from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  TrendingUp, 
  Flame, 
  Zap,
  Info,
  Activity,
  CheckCircle2
} from "lucide-react";
import type { WarningAssessment, SimulationEvents } from "../types";

interface AIWarningCardProps {
  warning: WarningAssessment | null;
  events?: SimulationEvents;
  compact?: boolean;
}

export const AIWarningCard: React.FC<AIWarningCardProps> = ({
  warning,
  events,
  compact = false,
}) => {
  const prob = warning?.runaway_probability_15m ?? warning?.rf_probability ?? 0.0;
  const pct = Math.round(prob * 100);
  const overallStatus = warning?.overall_status ?? warning?.hybrid_category ?? "SAFE";
  const currentT = warning?.current_temperature ?? 305.0;
  const dTdt = warning?.heating_rate ?? 0.0;
  const dist = warning?.distance_to_critical ?? (390.0 - currentT);
  const horizon = warning?.prediction_horizon_min ?? 15.0;
  const t_warn = events?.t_first_warning;
  const leadTime = events?.lead_time;
  
  const tteMin = warning?.estimated_time_to_critical_min;
  const tteInterval = warning?.time_to_event_uncertainty_interval;
  const tteMethod = warning?.time_to_event_method ?? "Physics forward simulation";
  const tteConf = warning?.time_to_event_confidence ?? "HIGH";

  // Visual styling mapped to overall status hierarchy
  const statusStyles: Record<string, {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    barColor: string;
    icon: React.ReactNode;
    title: string;
  }> = {
    SAFE: {
      bg: "bg-emerald-950/20",
      border: "border-emerald-500/30",
      badgeBg: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
      badgeText: "text-emerald-300",
      barColor: "bg-emerald-500",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      title: "SAFE CONDITION",
    },
    WARNING: {
      bg: "bg-amber-950/25",
      border: "border-amber-500/40",
      badgeBg: "bg-amber-500/20 border-amber-500/50 text-amber-300",
      badgeText: "text-amber-300",
      barColor: "bg-amber-500",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />,
      title: "EARLY WARNING",
    },
    "HIGH RISK": {
      bg: "bg-orange-950/30",
      border: "border-orange-500/50",
      badgeBg: "bg-orange-500/25 border-orange-500/60 text-orange-200 animate-pulse",
      badgeText: "text-orange-300",
      barColor: "bg-orange-500",
      icon: <AlertOctagon className="w-5 h-5 text-orange-400 animate-bounce" />,
      title: "HIGH RISK",
    },
    CRITICAL: {
      bg: "bg-red-950/35",
      border: "border-red-500/60 shadow-lg shadow-red-950/50",
      badgeBg: "bg-red-500/30 border-red-500/70 text-red-100 animate-pulse",
      badgeText: "text-red-200",
      barColor: "bg-red-500",
      icon: <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" />,
      title: "CRITICAL",
    },
    "THERMAL RUNAWAY DETECTED": {
      bg: "bg-rose-950/50",
      border: "border-rose-500 shadow-xl shadow-rose-950/70 animate-pulse",
      badgeBg: "bg-rose-600 text-white font-extrabold border-rose-400 animate-bounce",
      badgeText: "text-rose-200",
      barColor: "bg-rose-600",
      icon: <Flame className="w-5 h-5 text-rose-300 animate-pulse" />,
      title: "RUNAWAY DETECTED",
    },
  };

  const currentStyle = statusStyles[overallStatus] || statusStyles.SAFE;

  // Format Time-to-Event string
  let tteDisplay = "No crossing predicted in 15m";
  if (overallStatus === "THERMAL RUNAWAY DETECTED") {
    tteDisplay = "Threshold reached";
  } else if (tteMin !== null && tteMin !== undefined) {
    if (tteInterval && tteInterval.length === 2) {
      tteDisplay = `~${tteMin.toFixed(1)} min [${tteInterval[0].toFixed(1)}-${tteInterval[1].toFixed(1)}m]`;
    } else {
      tteDisplay = `~${tteMin.toFixed(1)} min`;
    }
  }

  return (
    <div className={`rounded-2xl border ${currentStyle.border} ${currentStyle.bg} bg-slate-900/90 p-5 shadow-xl transition-all duration-300`}>
      {/* Header Row: Status Badge & ML Probability */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
            {currentStyle.icon}
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono tracking-wider flex items-center space-x-2">
              <span>ONLINE RUNAWAY FORECASTER</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold border border-cyan-800/60">
                {horizon.toFixed(0)}-MIN HORIZON
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-sm font-bold text-slate-100 mr-1">
                {currentStyle.title}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${currentStyle.badgeBg}`}>
                {overallStatus}
              </span>
            </div>
          </div>
        </div>

        {/* 15-Minute Machine Learning Probability */}
        <div className="text-right">
          <div className="text-2xl font-black font-mono tracking-tight text-slate-100 flex items-baseline justify-end space-x-1">
            <span>{pct}%</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Runaway Probability</div>
        </div>
      </div>

      {/* Probability Gauge Bar with 0.35 and 0.70 thresholds */}
      <div className="space-y-1 mb-3.5">
        <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex items-center">
          {/* Threshold markers */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
            style={{ left: "35%" }}
            title="Warning Threshold (P >= 0.35)"
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
            style={{ left: "70%" }}
            title="Critical Threshold (P >= 0.70)"
          />

          {/* Probability Bar */}
          <div
            className={`h-full rounded-full transition-all duration-300 ${currentStyle.barColor}`}
            style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
          />
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
          <span>0% (Safe)</span>
          <span className="text-amber-400 font-semibold">35% (Warning)</span>
          <span className="text-red-400 font-semibold">70% (Critical)</span>
          <span>100%</span>
        </div>
      </div>

      {/* Contextual Warning & Operator Action */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 mb-3.5 text-xs">
        <p className="text-slate-100 font-medium leading-relaxed flex items-start space-x-2">
          <span className="shrink-0 mt-0.5">{currentStyle.icon}</span>
          <span className="font-semibold text-slate-100">
            {warning?.message || "SAFE — No critical-temperature event predicted within the next 15 minutes."}
          </span>
        </p>

        {warning?.action_recommendation && (
          <div className="text-cyan-300 mt-2 pt-2 border-t border-slate-800/60 flex items-start space-x-2 text-[11px]">
            <Info className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
            <span>
              <strong className="text-cyan-200">Recommended Action:</strong> {warning.action_recommendation}
            </span>
          </div>
        )}
      </div>

      {/* Physics Hard Safety Limit Alert if triggered */}
      {warning?.physics_limit_triggered && (
        <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2 mb-3.5">
          <Flame className="w-4 h-4 shrink-0 text-red-400 animate-pulse" />
          <span><strong>Physical Limit Triggered:</strong> {warning.physics_reason}</span>
        </div>
      )}

      {/* Key Process & Online Prediction Grid */}
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
          {/* Estimated Time to 390 K */}
          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Physics Time to 390K</span>
            <span className={`font-bold block mt-0.5 text-xs ${
              tteMin != null && tteMin <= 5.0 ? "text-red-400 font-black animate-pulse" :
              tteMin != null && tteMin <= 10.0 ? "text-orange-300 font-bold" :
              tteMin != null && tteMin <= 15.0 ? "text-amber-300" : "text-emerald-400"
            }`}>
              {tteDisplay}
            </span>
          </div>

          {/* Distance to 390K */}
          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Distance to 390K</span>
            <span className={`font-bold block mt-0.5 text-xs ${dist < 10 ? "text-red-400" : "text-slate-200"}`}>
              {dist > 0 ? `${dist.toFixed(1)} K` : "Crossed!"}
            </span>
          </div>

          {/* Reactor Temp & Heating Rate */}
          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Temp & Rate</span>
            <span className="font-bold text-slate-100 block mt-0.5 text-xs">
              {currentT.toFixed(1)} K{" "}
              <span className={`text-[10px] ${dTdt > 5 ? "text-red-400" : dTdt > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                ({dTdt >= 0 ? "+" : ""}{dTdt.toFixed(1)} K/min)
              </span>
            </span>
          </div>

          {/* Lead Time or Warning */}
          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Lead Time</span>
            <span className="font-bold block mt-0.5 text-xs">
              {leadTime !== null && leadTime !== undefined ? (
                <span className="text-emerald-300 font-bold">+{leadTime.toFixed(1)} min</span>
              ) : t_warn !== null && t_warn !== undefined ? (
                <span className="text-cyan-300">Warned at t={t_warn.toFixed(1)}m</span>
              ) : (
                <span className="text-slate-500">None</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Scientific Footnote */}
      <div className="mt-2.5 text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span>*Forward projection assumes current cooling capacity and feed temperature persist.</span>
        <span className="text-slate-400 font-semibold">T_crit = 390.0 K</span>
      </div>
    </div>
  );
};