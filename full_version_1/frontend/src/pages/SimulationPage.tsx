import React, { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  AlertTriangle, 
  ShieldCheck, 
  FastForward, 
  Clock, 
  Thermometer, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Sliders,
  Zap,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ReferenceLine, 
  CartesianGrid 
} from "recharts";
import { AnimatedReactor } from "../components/AnimatedReactor";
import type { CSTRState } from "../types";
import type { NavPage } from "../components/Sidebar";

interface SimulationPageProps {
  state: CSTRState | null;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onInjectCooling: (floss: number) => void;
  onInjectFeedTemp: (deltaTf: number) => void;
  onRestoreCooling: () => void;
  onSpeedChange: (speed: number) => void;
  onUpdateSettings?: (settings: Record<string, any>) => Promise<void>;
  onNavigate?: (page: NavPage) => void;
}

export const SimulationPage: React.FC<SimulationPageProps> = ({
  state,
  onStart,
  onPause,
  onReset,
  onInjectCooling,
  onInjectFeedTemp,
  onRestoreCooling,
  onSpeedChange,
  onUpdateSettings,
  onNavigate,
}) => {
  const isRunning = state?.is_running ?? false;
  const isPaused = state?.is_paused ?? false;
  const currentSpeed = state?.simulation_speed ?? 1.0;
  const history = state?.history ?? [];
  const events = state?.events;

  const currentT = state?.T ?? 305.0;
  const currentCA = state?.CA ?? 0.88;
  const criticalT = state?.T_critical ?? 390.0;
  const dTdt = state?.dT_dt ?? 0.0;
  const marginToCrit = criticalT - currentT;

  const rfProb = state?.warning?.runaway_probability_15m ?? state?.warning?.rf_probability ?? 0.0;
  const probPct = Math.round(rfProb * 100);
  const overallStatus = state?.warning?.overall_status ?? "SAFE";
  const tteMin = state?.warning?.estimated_time_to_critical_min;
  const alertMsg = state?.warning?.message ?? "Stable operation — no critical crossing predicted within 15 minutes.";
  const actionRec = state?.warning?.action_recommendation ?? "Continue standard process monitoring.";

  // Local control inputs (synced with state without interrupting simulation)
  const [localTc, setLocalTc] = useState<number>(state?.Tc ?? 300.0);
  const [localTf, setLocalTf] = useState<number>(state?.Tf ?? 300.0);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Sync inputs on initial mount or when simulation is reset
  useEffect(() => {
    if (state && state.time === 0.0) {
      setLocalTc(state.Tc);
      setLocalTf(state.Tf);
    }
  }, [state?.time]);

  // Handle dynamic Coolant Temperature change without resetting
  const handleTcChange = async (newTc: number) => {
    setLocalTc(newTc);
    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ Tc: Number(newTc) });
      } catch (err) {
        console.error("Failed to update Tc:", err);
      }
    }
  };

  // Handle dynamic Feed Temperature change without resetting
  const handleTfChange = async (newTf: number) => {
    setLocalTf(newTf);
    if (onUpdateSettings) {
      try {
        await onUpdateSettings({ Tf: Number(newTf) });
      } catch (err) {
        console.error("Failed to update Tf:", err);
      }
    }
  };

  // Status visual styles
  const statusStyles: Record<string, {
    border: string;
    badgeBg: string;
    text: string;
    icon: React.ReactNode;
  }> = {
    SAFE: {
      border: "border-emerald-500/40",
      badgeBg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
      text: "text-emerald-400",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    },
    WARNING: {
      border: "border-amber-500/50",
      badgeBg: "bg-amber-500/20 border-amber-500/50 text-amber-300",
      text: "text-amber-400",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />,
    },
    "HIGH RISK": {
      border: "border-orange-500/60 shadow-lg shadow-orange-950/40",
      badgeBg: "bg-orange-500/25 border-orange-500/60 text-orange-200 animate-pulse",
      text: "text-orange-400",
      icon: <AlertCircle className="w-5 h-5 text-orange-400 animate-bounce" />,
    },
    CRITICAL: {
      border: "border-red-500/70 shadow-lg shadow-red-950/50",
      badgeBg: "bg-red-500/30 border-red-500/70 text-red-100 animate-pulse",
      text: "text-red-400",
      icon: <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />,
    },
    "THERMAL RUNAWAY DETECTED": {
      border: "border-rose-500 shadow-xl shadow-rose-950/60 animate-pulse",
      badgeBg: "bg-rose-600 text-white font-black border-rose-400 animate-bounce",
      text: "text-rose-400",
      icon: <Flame className="w-5 h-5 text-rose-300 animate-pulse" />,
    },
  };

  const currentStyle = statusStyles[overallStatus] || statusStyles.SAFE;

  // Format Time-to-390K readout
  const tteReadout = overallStatus === "THERMAL RUNAWAY DETECTED"
    ? "Threshold reached"
    : tteMin != null
    ? `~${tteMin.toFixed(1)} min`
    : "> 15 min (Stable)";

  // Format chart data with probability percentage
  const chartData = history.map((h) => ({
    ...h,
    prob_pct: Math.round(((h.runaway_probability_15m ?? h.rf_probability ?? 0.0) * 100) * 10) / 10,
  }));

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      {/* ========================================================================= */}
      {/* SECTION A: REACTOR STATUS (Top Metric Cards)                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* 1. Overall Status Card */}
        <div className={`col-span-2 md:col-span-1 bg-slate-900 border ${currentStyle.border} rounded-xl p-3.5 shadow-md flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>REACTOR STATUS</span>
            {currentStyle.icon}
          </div>
          <div className="mt-2">
            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${currentStyle.badgeBg}`}>
              {overallStatus}
            </span>
          </div>
        </div>

        {/* 2. Current Reactor Temperature */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>REACTOR TEMP</span>
            <Thermometer className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-1">
            <div className={`text-2xl font-black font-mono ${marginToCrit <= 10 ? "text-red-400 animate-pulse" : currentT > 320 ? "text-amber-300" : "text-slate-100"}`}>
              {currentT.toFixed(1)} <span className="text-sm font-normal text-slate-400">K</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              {marginToCrit > 0 ? `Δ ${marginToCrit.toFixed(1)} K to 390K` : "390K EXCEEDED"}
            </div>
          </div>
        </div>

        {/* 3. Heating Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>HEATING RATE</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-1">
            <div className={`text-2xl font-black font-mono ${dTdt >= 12.0 ? "text-red-400 font-extrabold" : dTdt > 3.0 ? "text-amber-300" : "text-slate-100"}`}>
              {dTdt >= 0 ? "+" : ""}{dTdt.toFixed(2)} <span className="text-xs font-normal text-slate-400">K/min</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              Limit: 12.0 K/min
            </div>
          </div>
        </div>

        {/* 4. 15-Minute Runaway Risk Probability */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>15-MIN RISK (RF)</span>
            <span className="text-xs font-mono font-bold text-cyan-400">{probPct}%</span>
          </div>
          <div className="mt-1">
            <div className="text-2xl font-black font-mono text-slate-100">
              {probPct}%
            </div>
            {/* Compact Progress Bar */}
            <div className="relative w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1.5">
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
                  probPct >= 70 ? "bg-red-500" : probPct >= 35 ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(3, probPct))}%` }}
              />
            </div>
          </div>
        </div>

        {/* 5. Estimated Time to Critical */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>TIME TO 390K</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-1">
            <div className={`text-xl font-black font-mono ${
              tteMin != null && tteMin <= 5.0 ? "text-red-400 animate-pulse" :
              tteMin != null && tteMin <= 10.0 ? "text-orange-400" :
              tteMin != null && tteMin <= 15.0 ? "text-amber-300" : "text-emerald-400"
            }`}>
              {tteReadout}
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              {tteMin != null ? "Physics ODE forward proj." : "Safe operating branch"}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION B: REACTOR CONTROLS & ANIMATED REACTOR                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Animated CSTR Reactor (Col span 6) */}
        <div className="lg:col-span-6">
          <div className="w-full">
            <AnimatedReactor state={state} showDetails={false} className="w-full shadow-xl" />
          </div>
        </div>

        {/* Right: Essential Compact Reactor Controls (Col span 6) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Reactor Controls & Operating Inputs
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Sim Time: <strong className="text-cyan-300 font-bold">{(state?.time ?? 0.0).toFixed(1)} min</strong>
            </span>
          </div>

          {/* Primary Simulation Actions & Speed */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              {!isRunning ? (
                <button
                  onClick={onStart}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isPaused ? "Resume" : "Start"}</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={onReset}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
                title="Reset simulation to t=0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
              <span className="text-[10px] font-mono text-slate-500 px-1.5">Speed:</span>
              {[1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onSpeedChange(spd)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                    currentSpeed === spd
                      ? "bg-cyan-500 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Grid: Coolant & Feed Temperature */}
          <div className="space-y-3 pt-1">
            {/* Input 1: Coolant Temperature (Tc) */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Coolant Temperature (Tc)</span>
                </span>
                <span className="text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {localTc.toFixed(1)} K
                </span>
              </div>
              <input
                type="range"
                min="280.0"
                max="325.0"
                step="0.5"
                value={localTc}
                onChange={(e) => handleTcChange(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>280.0 K (Strong cooling)</span>
                <span className="text-slate-400">Baseline: 300.0 K</span>
                <span>325.0 K (Weak cooling)</span>
              </div>
            </div>

            {/* Input 2: Feed Stream Temperature (Tf) */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Feed Temperature (Tf)</span>
                </span>
                <span className="text-blue-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {localTf.toFixed(1)} K
                </span>
              </div>
              <input
                type="range"
                min="280.0"
                max="330.0"
                step="0.5"
                value={localTf}
                onChange={(e) => handleTfChange(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>280.0 K (Chilled)</span>
                <span className="text-slate-400">Baseline: 300.0 K</span>
                <span>330.0 K (Hot Feed)</span>
              </div>
            </div>
          </div>

          {/* Quick Operating Disturbance Shortcuts */}
          <div className="pt-1">
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>TEST DISTURBANCE SCENARIOS:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => { onRestoreCooling(); onInjectFeedTemp(0); }}
                disabled={!isRunning}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-40 transition-colors cursor-pointer text-center"
              >
                Normal (100%)
              </button>
              <button
                onClick={() => onInjectCooling(0.50)}
                disabled={!isRunning}
                className="p-2 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 text-xs font-semibold border border-amber-800/60 disabled:opacity-40 transition-colors cursor-pointer text-center"
              >
                Reduced (-50%)
              </button>
              <button
                onClick={() => onInjectCooling(0.82)}
                disabled={!isRunning}
                className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs font-semibold border border-red-800/70 disabled:opacity-40 transition-colors cursor-pointer text-center"
              >
                Failure (-82%)
              </button>
              <button
                onClick={() => onInjectFeedTemp(15.0)}
                disabled={!isRunning}
                className="p-2 rounded-lg bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 text-xs font-semibold border border-orange-800/60 disabled:opacity-40 transition-colors cursor-pointer text-center"
              >
                Hot Feed (+15K)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION D: ALERTS & PREDICTION DETAILS                                    */}
      {/* ========================================================================= */}
      <div className={`bg-slate-900 border ${currentStyle.border} rounded-2xl p-4 shadow-xl space-y-3`}>
        {/* Concise Primary Dynamic Alert Message */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
              {currentStyle.icon}
            </div>
            <div>
              <div className="text-xs text-slate-400 font-mono flex items-center space-x-2">
                <span>ONLINE PREDICTIVE ALERT</span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-400 font-semibold">{overallStatus}</span>
              </div>
              <p className="text-sm font-semibold text-slate-100 mt-0.5 leading-snug">
                {alertMsg}
              </p>
              {actionRec && (
                <p className="text-xs text-cyan-300 mt-1 flex items-center space-x-1.5 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span><strong>Recommended Operator Action:</strong> {actionRec}</span>
                </p>
              )}
            </div>
          </div>

          {/* Toggle Collapsible Technical Diagnostics Button */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="self-end sm:self-center flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700/80 transition-colors cursor-pointer"
          >
            <span>{showDiagnostics ? "Hide Diagnostics" : "Technical Details"}</span>
            {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Technical Details / Model Information Section */}
        {showDiagnostics && (
          <div className="pt-3 border-t border-slate-800 space-y-3 animate-fadeIn">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Reactant (CA)</span>
                <strong className="text-slate-200">{currentCA.toFixed(4)} kmol/m³</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Cooling Coeff (U)</span>
                <strong className="text-blue-300">{(state?.U ?? 1.1).toFixed(3)} min⁻¹</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Heat Generation (q_gen)</span>
                <strong className="text-amber-400">{(state?.q_gen ?? 0.0).toFixed(2)} K/min</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Heat Removal (q_rem)</span>
                <strong className="text-cyan-300">{(state?.q_rem ?? 0.0).toFixed(2)} K/min</strong>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div><strong>Forecast Horizon:</strong> 15.0 minutes (Random Forest Classifier + Physics Midpoint RK2 Projection)</div>
              <div><strong>Assumptions:</strong> Constant feed temp (Tf={localTf.toFixed(1)}K), jacket temp (Tc={localTc.toFixed(1)}K), and cooling coefficient.</div>
              <div><strong>Milestones:</strong> Disturbance: {events?.t_disturbance != null ? `${events.t_disturbance.toFixed(1)}m` : "None"} | 1st Warning: {events?.t_first_warning != null ? `${events.t_first_warning.toFixed(1)}m` : "None"} | 390K Crossing: {events?.t_critical_crossing != null ? `${events.t_critical_crossing.toFixed(1)}m` : "None"}</div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION C: LIVE GRAPHS (Clean Responsive 2-Column Grid)                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Graph 1: Reactor Temperature vs Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-200 flex items-center space-x-1.5">
                <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                <span>REACTOR TEMPERATURE vs TIME</span>
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {currentT.toFixed(1)} K
            </span>
          </div>

          <div className="h-60 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  unit="m"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v) => Number(v).toFixed(1)}
                />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.floor(Math.min(295, isNaN(dataMin) ? 295 : dataMin - 5)),
                    (dataMax: number) => Math.ceil(Math.max(400, isNaN(dataMax) ? 400 : dataMax + 10)),
                  ]}
                  unit=" K"
                  stroke="#64748b"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                  formatter={(val: any) => [`${Number(val).toFixed(2)} K`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />

                {/* 390.0 K Critical Runaway Threshold Line */}
                <ReferenceLine
                  y={390}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: "Critical: 390.0 K", fill: "#ef4444", fontSize: 10, position: "top" }}
                />

                {/* Event Markers */}
                {events?.t_disturbance != null && (
                  <ReferenceLine
                    x={events.t_disturbance}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: "Disturbance", fill: "#f59e0b", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}
                {events?.t_first_warning != null && (
                  <ReferenceLine
                    x={events.t_first_warning}
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "1st Warning", fill: "#06b6d4", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}
                {events?.t_critical_crossing != null && (
                  <ReferenceLine
                    x={events.t_critical_crossing}
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "Crossed 390K", fill: "#ef4444", fontSize: 9, position: "insideBottomLeft" }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="T"
                  name="Reactor Temp (T) [K]"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="T_obs"
                  name="Measured Temp [K]"
                  stroke="#64748b"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: 15-Minute Runaway Risk Probability vs Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-200 flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>15-MIN RUNAWAY RISK (RF) vs TIME</span>
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              P = {probPct}%
            </span>
          </div>

          <div className="h-60 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  unit="m"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v) => Number(v).toFixed(1)}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  stroke="#64748b"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                  formatter={(val: any) => [`${Number(val).toFixed(1)}%`, "Runaway Risk"]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />

                {/* 35% Warning Reference Line */}
                <ReferenceLine
                  y={35}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{ value: "Warning (35%)", fill: "#f59e0b", fontSize: 9, position: "insideTopRight" }}
                />

                {/* 70% Critical Reference Line */}
                <ReferenceLine
                  y={70}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{ value: "Critical (70%)", fill: "#ef4444", fontSize: 9, position: "insideTopRight" }}
                />

                {events?.t_first_warning != null && (
                  <ReferenceLine
                    x={events.t_first_warning}
                    stroke="#06b6d4"
                    strokeDasharray="3 3"
                    label={{ value: "Warning Issued", fill: "#06b6d4", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="prob_pct"
                  name="Runaway Prob (15m) [%]"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 3: Heat Generation vs Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-200 flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>HEAT GENERATION vs TIME</span>
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              q_gen: {(state?.q_gen ?? 0.0).toFixed(2)} K/min
            </span>
          </div>

          <div className="h-60 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  unit=" min"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v) => Number(v).toFixed(1)}
                />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.min(0, Math.floor(isNaN(dataMin) ? 0 : dataMin - 1)),
                    (dataMax: number) => Math.ceil(Math.max(25, isNaN(dataMax) ? 25 : dataMax * 1.15)),
                  ]}
                  stroke="#64748b"
                  fontSize={11}
                  unit=" K/min"
                  width={70}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                  formatter={(val: any) => [`${Number(val).toFixed(2)} K/min`, "Heat Generation"]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />

                {events?.t_disturbance != null && (
                  <ReferenceLine
                    x={events.t_disturbance}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: "Disturbance", fill: "#f59e0b", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}
                {events?.t_first_warning != null && (
                  <ReferenceLine
                    x={events.t_first_warning}
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "1st Warning", fill: "#06b6d4", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}
                {events?.t_critical_crossing != null && (
                  <ReferenceLine
                    x={events.t_critical_crossing}
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "Crossed 390K", fill: "#ef4444", fontSize: 9, position: "insideBottomLeft" }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="q_gen"
                  name="Heat Generation (q_gen = β·k·CA) [K/min]"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 4: Heat Removal vs Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-200 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>HEAT REMOVAL vs TIME</span>
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              q_rem: {(state?.q_rem ?? 0.0).toFixed(2)} K/min
            </span>
          </div>

          <div className="h-60 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  unit=" min"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v) => Number(v).toFixed(1)}
                />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.min(0, Math.floor(isNaN(dataMin) ? 0 : dataMin - 1)),
                    (dataMax: number) => Math.ceil(Math.max(25, isNaN(dataMax) ? 25 : dataMax * 1.15)),
                  ]}
                  stroke="#64748b"
                  fontSize={11}
                  unit=" K/min"
                  width={70}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                  formatter={(val: any) => [`${Number(val).toFixed(2)} K/min`, "Heat Removal"]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />

                {events?.t_disturbance != null && (
                  <ReferenceLine
                    x={events.t_disturbance}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: "Disturbance", fill: "#f59e0b", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}
                {events?.t_first_warning != null && (
                  <ReferenceLine
                    x={events.t_first_warning}
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "1st Warning", fill: "#06b6d4", fontSize: 9, position: "insideTopLeft" }}
                  />
                )}
                {events?.t_critical_crossing != null && (
                  <ReferenceLine
                    x={events.t_critical_crossing}
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "Crossed 390K", fill: "#ef4444", fontSize: 9, position: "insideBottomLeft" }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="q_rem"
                  name="Heat Removal (q_rem = U·(T - Tc)) [K/min]"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;