import React from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  TrendingUp, 
  CheckCircle, 
  Flame, 
  Zap,
  Info 
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
  const prob = warning?.rf_probability ?? 0.0;
  const pct = Math.round(prob * 100);
  const category = warning?.rf_category ?? "SAFE";
  const hybridCategory = warning?.hybrid_category ?? "SAFE";
  const dist = warning?.distance_to_critical ?? 85.0;
  const currentT = warning?.current_temperature ?? 305.0;
  const horizon = warning?.prediction_horizon_min ?? 3.0;
  const t_warn = events?.t_first_warning;
  const t_crit = events?.t_critical_crossing;
  const leadTime = events?.lead_time;

  // Visual styles per category
  const badgeConfig = {
    SAFE: {
      bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
      bar: "bg-emerald-500",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      title: "SAFE CONDITION",
    },
    WARNING: {
      bg: "bg-amber-500/15 border-amber-500/30 text-amber-300",
      bar: "bg-amber-500",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />,
      title: "EARLY WARNING",
    },
    CRITICAL: {
      bg: "bg-red-500/20 border-red-500/40 text-red-200 animate-pulse",
      bar: "bg-red-500",
      icon: <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" />,
      title: "CRITICAL RISK",
    },
  }[hybridCategory] || {
    bg: "bg-slate-800 border-slate-700 text-slate-300",
    bar: "bg-slate-500",
    icon: <ShieldCheck className="w-5 h-5 text-slate-400" />,
    title: "NORMAL",
  };

  return (
    <div className={`bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl ${
      hybridCategory === "CRITICAL" ? "border-red-500/50 shadow-red-950/30" : ""
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
            {badgeConfig.icon}
          </div>
          <div>
            <div className="text-xs text-slate-400 font-mono tracking-wider flex items-center space-x-1.5">
              <span>RANDOM FOREST CLASSIFIER</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-800/60">
                {horizon.toFixed(0)}-MIN HORIZON
              </span>
            </div>
            <div className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>{badgeConfig.title}</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono border font-semibold ${badgeConfig.bg}`}>
                {hybridCategory}
              </span>
            </div>
          </div>
        </div>

        {/* Probability display */}
        <div className="text-right">
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
            {pct}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono">Runaway Probability</div>
        </div>
      </div>

      {/* Probability Gauge Bar */}
      <div className="space-y-1 mb-3">
        <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex items-center">
          {/* Threshold markers */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
            style={{ left: "35%" }}
            title="Warning Threshold (0.35)"
          ></div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
            style={{ left: "70%" }}
            title="Critical Threshold (0.70)"
          ></div>

          {/* Probability Bar */}
          <div
            className={`h-full rounded-full transition-all duration-300 ${badgeConfig.bar}`}
            style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
          ></div>
        </div>

        {/* Scale labels */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
          <span>0%</span>
          <span className="text-amber-400/80">0.35 (Warning)</span>
          <span className="text-red-400/80">0.70 (Critical)</span>
          <span>100%</span>
        </div>
      </div>

      {/* Model Assessment Message */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-3 text-xs">
        <p className="text-slate-200 font-medium leading-relaxed">
          {warning?.message || "Reactor operating within safe parameters."}
        </p>
        {warning?.action_recommendation && (
          <p className="text-cyan-400 mt-1.5 flex items-start space-x-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><strong>Operator Action:</strong> {warning.action_recommendation}</span>
          </p>
        )}
      </div>

      {/* Separate Physics Hard Limit Callout if triggered */}
      {warning?.physics_limit_triggered && (
        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2 mb-3">
          <Flame className="w-4 h-4 shrink-0 text-red-400" />
          <span><strong>Physical Limit Triggered:</strong> {warning.physics_reason}</span>
        </div>
      )}

      {/* Milestone Timestamps (Compact Grid) */}
      {!compact && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-slate-500 block">Distance to 390K:</span>
            <span className={`font-bold ${dist < 10 ? "text-red-400" : "text-slate-200"}`}>
              {dist > 0 ? `${dist.toFixed(1)} K` : "Crossed!"}
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-slate-500 block">1st AI Warning:</span>
            <span className="font-bold text-cyan-300">
              {t_warn !== null && t_warn !== undefined ? `${t_warn.toFixed(1)} min` : "None"}
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-slate-500 block">Warning Lead Time:</span>
            <span className={`font-bold ${leadTime ? "text-emerald-400" : "text-slate-400"}`}>
              {leadTime !== null && leadTime !== undefined ? `+${leadTime.toFixed(1)} min` : "Pending"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
