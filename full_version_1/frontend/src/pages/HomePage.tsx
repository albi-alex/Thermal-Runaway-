import React from "react";
import { 
  ArrowRight, 
  Activity, 
  Thermometer, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  TrendingUp, 
  Sliders, 
  Gauge,
  Flame,
  Droplets,
  Layers
} from "lucide-react";
import type { CSTRState } from "../types";
import type { NavPage } from "../components/Sidebar";

interface HomePageProps {
  state: CSTRState | null;
  onNavigate: (page: NavPage) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ state, onNavigate }) => {
  const isRunning = state?.is_running ?? false;
  const isPaused = state?.is_paused ?? false;

  const currentTemp = state?.T ?? 305.0;
  const criticalTemp = state?.T_critical ?? 390.0;
  const tempMargin = criticalTemp - currentTemp;
  const isRunaway = currentTemp >= criticalTemp;

  const rfProb = state?.warning?.runaway_probability_15m ?? state?.warning?.rf_probability ?? 0.0;
  const probPct = Math.round(rfProb * 100);
  const overallStatus = state?.warning?.overall_status ?? "SAFE";
  const tteMin = state?.warning?.estimated_time_to_critical_min;

  const dT_dt = state?.dT_dt ?? 0.0;
  const q_net = state?.q_net ?? 0.0;
  const q_gen = state?.q_gen ?? 0.0;
  const q_rem = state?.q_rem ?? 0.0;
  const CA = state?.CA ?? 0.88;
  const Tc = state?.Tc ?? 300.0;
  const Tf = state?.Tf ?? 300.0;
  const tau = state?.tau ?? 5.0;
  const U = state?.U ?? 1.1;

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>RUNNING</span>
        </span>
      );
    }
    if (isPaused) {
      return (
        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>PAUSED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
        <span>IDLE (READY)</span>
      </span>
    );
  };

  const getCategoryBadge = () => {
    switch (overallStatus) {
      case "THERMAL RUNAWAY DETECTED":
        return (
          <div className="flex items-center space-x-2 text-rose-400 font-extrabold animate-pulse">
            <Flame className="w-5 h-5 text-rose-500 animate-bounce" />
            <span className="text-lg font-mono tracking-wide">RUNAWAY DETECTED</span>
          </div>
        );
      case "CRITICAL":
        return (
          <div className="flex items-center space-x-2 text-red-400 font-bold">
            <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="text-xl font-mono tracking-wide">CRITICAL RISK</span>
          </div>
        );
      case "HIGH RISK":
        return (
          <div className="flex items-center space-x-2 text-orange-400 font-bold">
            <AlertOctagon className="w-5 h-5 text-orange-500 animate-pulse" />
            <span className="text-xl font-mono tracking-wide">HIGH RISK</span>
          </div>
        );
      case "WARNING":
        return (
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" />
            <span className="text-xl font-mono tracking-wide">EARLY WARNING</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 text-emerald-400 font-bold">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-xl font-mono tracking-wide">SAFE</span>
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* 1. Header: Compact Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Thermal Runaway Early Warning System
          </h1>
          <p className="text-sm text-cyan-400 font-medium mt-0.5">
            Physics-Based Reactor Simulation and ML Early Warning
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            Sim Time: <strong className="text-slate-100">{(state?.time ?? 0.0).toFixed(1)} min</strong>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* 2. Primary Process Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current Reactor Temperature */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>REACTOR TEMPERATURE</span>
            <Thermometer className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className={`text-3xl font-extrabold font-mono tracking-tight ${
              isRunaway ? "text-red-400 animate-pulse" : currentTemp > 330 ? "text-amber-400" : "text-cyan-300"
            }`}>
              {currentTemp.toFixed(1)} K
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1 flex justify-between">
              <span>{(currentTemp - 273.15).toFixed(1)} °C</span>
              <span className={dT_dt > 0 ? "text-amber-400" : "text-slate-400"}>
                {dT_dt >= 0 ? "+" : ""}{dT_dt.toFixed(2)} K/min
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2: Critical Temperature Threshold */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>CRITICAL THRESHOLD</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono tracking-tight text-red-400">
              {criticalTemp.toFixed(1)} K
            </div>
            <div className="text-xs font-mono mt-1 flex justify-between">
              <span className="text-slate-400">{(criticalTemp - 273.15).toFixed(1)} °C limit</span>
              <span className={`font-semibold ${tempMargin <= 10 ? "text-red-400 font-bold" : "text-slate-300"}`}>
                {tempMargin > 0 ? `Δ ${tempMargin.toFixed(1)} K margin` : "EXCEEDED!"}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 3: Current Risk Category & Time-to-Event */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>OVERALL RISK STATUS</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            {getCategoryBadge()}
            <div className="text-xs text-slate-400 font-mono mt-2 flex justify-between">
              <span>Time to 390K:</span>
              <span className={`font-semibold ${tteMin != null && tteMin <= 5.0 ? "text-red-400" : tteMin != null && tteMin <= 10.0 ? "text-orange-400" : "text-emerald-400"}`}>
                {tteMin != null ? `~${tteMin.toFixed(1)} min` : "None in 15m"}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 4: ML Warning Probability */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>RUNAWAY PROBABILITY</span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">15-MIN HORIZON</span>
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono tracking-tight text-slate-100">
              {probPct}%
            </div>
            {/* Probability Progress Bar with 35% and 70% threshold indicators */}
            <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-2">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                style={{ left: "35%" }}
                title="Warning (35%)"
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                style={{ left: "70%" }}
                title="Critical (70%)"
              />
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  overallStatus === "CRITICAL" || overallStatus === "THERMAL RUNAWAY DETECTED"
                    ? "bg-red-500 animate-pulse"
                    : overallStatus === "HIGH RISK"
                    ? "bg-orange-500"
                    : overallStatus === "WARNING"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(3, probPct))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Prediction & Thermal Acceleration Summary */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>PREDICTIVE THERMAL MONITORING & PROJECTIONS</span>
          </h2>
          <span className="text-xs font-mono text-cyan-400">
            Random Forest 15-Minute Horizon Model
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Instantaneous Heating Rate</span>
            <span className={`text-lg font-bold ${dT_dt > 5 ? "text-red-400" : dT_dt > 0 ? "text-amber-400" : "text-slate-200"}`}>
              {dT_dt >= 0 ? "+" : ""}{dT_dt.toFixed(2)} K/min
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">dT/dt derivative</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Net Thermal Drive</span>
            <span className={`text-lg font-bold ${q_net > 0 ? "text-red-400" : "text-cyan-300"}`}>
              {q_net >= 0 ? "+" : ""}{q_net.toFixed(2)} K/min
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">q_gen - q_rem</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Heat Generation</span>
            <span className="text-lg font-bold text-amber-400">
              {q_gen.toFixed(2)} K/min
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Arrhenius kinetics</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Heat Removal Capacity</span>
            <span className="text-lg font-bold text-blue-400">
              {q_rem.toFixed(2)} K/min
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Jacket cooling</span>
          </div>
        </div>

        {/* Operator Recommendation Message */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-400 font-mono text-[11px] block">SYSTEM ASSESSMENT:</span>
            <p className="text-slate-200 font-medium">
              {state?.warning?.message || "Reactor operating within safe parameters."}
            </p>
          </div>
          {state?.warning?.action_recommendation && (
            <div className="text-right pl-4">
              <span className="text-[10px] font-mono text-cyan-400 block">ACTION:</span>
              <span className="text-xs text-cyan-300 font-semibold">{state.warning.action_recommendation}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Current Operating Conditions Snapshot */}
      <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
          <span>ACTIVE OPERATING CONDITIONS</span>
          <button
            onClick={() => onNavigate("inputs")}
            className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Modify Sliders</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Coolant Temp (Tc)</span>
            <strong className="text-slate-200 text-sm">{Tc.toFixed(1)} K</strong>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Feed Temp (Tf)</span>
            <strong className="text-slate-200 text-sm">{Tf.toFixed(1)} K</strong>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Reactant (CA)</span>
            <strong className="text-slate-200 text-sm">{CA.toFixed(4)} kmol/m³</strong>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Residence Time (τ)</span>
            <strong className="text-slate-200 text-sm">{tau.toFixed(1)} min</strong>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">Cooling Coeff (U)</span>
            <strong className="text-cyan-300 text-sm">{U.toFixed(3)} min⁻¹</strong>
          </div>
        </div>
      </div>

      {/* 5. Navigation Entry Points */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <button
          onClick={() => onNavigate("simulation")}
          className="w-full sm:w-auto flex items-center justify-center space-x-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-600/25 transition-all transform hover:scale-[1.01] cursor-pointer"
        >
          <span>Open CSTR Simulation</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onNavigate("inputs")}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-sm border border-slate-700 transition-colors cursor-pointer"
        >
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Adjust User Inputs</span>
        </button>
      </div>
    </div>
  );
};

export default HomePage;
