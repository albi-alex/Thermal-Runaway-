import React, { useState } from "react";
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
  Sparkles,
  Zap
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
  const isRunaway = currentT >= criticalT;

  const rfProb = state?.warning?.rf_probability ?? 0.0;
  const probPct = Math.round(rfProb * 100);
  const warningCat = state?.warning?.hybrid_category ?? "SAFE";

  const getOperatingState = () => {
    if (isRunaway) return { text: "Runaway (Threshold Exceeded)", color: "text-red-400 bg-red-950/60 border-red-800" };
    if (warningCat === "CRITICAL") return { text: "Runaway Imminent (High Risk)", color: "text-red-400 bg-red-950/60 border-red-800" };
    if (state?.floss && state.floss > 0) return { text: "Disturbed (Cooling Failure)", color: "text-amber-400 bg-amber-950/60 border-amber-800" };
    if (warningCat === "WARNING") return { text: "Disturbed (Elevated Risk)", color: "text-amber-400 bg-amber-950/60 border-amber-800" };
    return { text: "Normal Operation", color: "text-emerald-400 bg-emerald-950/60 border-emerald-800" };
  };

  const opState = getOperatingState();

  const handleNormalOperation = () => {
    onRestoreCooling();
    onInjectFeedTemp(0);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* 1. Header & Primary Simulation Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Playback Actions */}
        <div className="flex items-center space-x-2.5">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-700/25 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isPaused ? "Resume Simulation" : "Start Simulation"}</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-700/25 transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause Simulation</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
            title="Reset simulation to time zero"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset (t=0)</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1 ml-2">
            <span className="text-[10px] font-mono text-slate-400 px-2 flex items-center space-x-1">
              <FastForward className="w-3 h-3 text-cyan-400" />
              <span>Speed:</span>
            </span>
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => onSpeedChange(spd)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  currentSpeed === spd
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Operating Point Telemetry & User Inputs Shortcut */}
        <div className="flex items-center space-x-3">
          <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex items-center space-x-2">
            <span className="text-slate-400">Baseline:</span>
            <span className="text-cyan-300 font-semibold">T = {(state?.T ?? 305.0).toFixed(1)} K</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-300 font-semibold">Tc = {(state?.Tc ?? 300.0).toFixed(1)} K</span>
            <span className="text-slate-600">|</span>
            <span className="text-blue-300 font-semibold">Tf = {(state?.Tf ?? 300.0).toFixed(1)} K</span>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate("inputs")}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Configure Inputs</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Workspace: Prominent Large Reactor (Top/Center) with Controls & Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Large Animated Reactor + Operating Disturbance Controls (Col span 7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Large Animated CSTR Reactor */}
          <div className="w-full">
            <AnimatedReactor state={state} showDetails={false} className="w-full shadow-2xl" />
          </div>

          {/* Operating Controls Bar */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-slate-200 tracking-wider flex items-center space-x-2">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>OPERATING DISTURBANCE CONTROLS</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">Affects ODE heat terms</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Normal Operation */}
              <button
                onClick={handleNormalOperation}
                disabled={!isRunning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <span>Normal Ops</span>
                <span className="text-[10px] font-mono text-slate-400">100% cooling</span>
              </button>

              {/* Reduced Cooling */}
              <button
                onClick={() => onInjectCooling(0.50)}
                disabled={!isRunning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 text-xs font-semibold border border-amber-800/60 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 mb-1" />
                <span>Reduced Cooling</span>
                <span className="text-[10px] font-mono text-amber-400/80">-50% capacity</span>
              </button>

              {/* Cooling Failure */}
              <button
                onClick={() => onInjectCooling(0.82)}
                disabled={!isRunning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs font-semibold border border-red-800/70 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Flame className="w-4 h-4 text-red-400 mb-1" />
                <span>Cooling Failure</span>
                <span className="text-[10px] font-mono text-red-400/80">-82% capacity</span>
              </button>

              {/* Hot-Feed Scenario */}
              <button
                onClick={() => onInjectFeedTemp(15.0)}
                disabled={!isRunning}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-orange-950/50 hover:bg-orange-900/70 text-orange-300 text-xs font-semibold border border-orange-800/60 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Flame className="w-4 h-4 text-orange-400 mb-1" />
                <span>Hot Feed</span>
                <span className="text-[10px] font-mono text-orange-400/80">+15 K feed</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Process Values & ML Early Warning Output (Col span 5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Essential Process Values Dashboard */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-mono font-bold text-slate-200 tracking-wider">
                ESSENTIAL LIVE PROCESS VALUES
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-800/60 font-mono">
                15-MIN HORIZON
              </span>
            </div>

            {/* Metrics 4-Box Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              {/* Temperature */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">Reactor Temperature</span>
                <span className={`text-2xl font-extrabold ${isRunaway ? "text-red-400 animate-pulse" : currentT > 330 ? "text-amber-400" : "text-cyan-300"}`}>
                  {currentT.toFixed(1)} K
                </span>
                <span className="text-[10px] text-slate-500">{(currentT - 273.15).toFixed(1)} °C</span>
              </div>

              {/* Critical Limit */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">Critical Threshold</span>
                <span className="text-2xl font-extrabold text-red-400">
                  {criticalT.toFixed(1)} K
                </span>
                <span className={`text-[10px] font-semibold ${criticalT - currentT < 10 ? "text-red-400" : "text-slate-400"}`}>
                  {criticalT - currentT > 0 ? `Δ ${(criticalT - currentT).toFixed(1)} K margin` : "EXCEEDED!"}
                </span>
              </div>

              {/* Reactant Concentration */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">Reactant Conc (CA)</span>
                <span className="text-2xl font-extrabold text-slate-200">
                  {currentCA.toFixed(4)}
                </span>
                <span className="text-[10px] text-slate-500">kmol/m³</span>
              </div>

              {/* Operating State */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[11px] text-slate-400">Operating State</span>
                <span className={`text-xs font-bold px-2 py-1 rounded border inline-block mt-1 ${opState.color}`}>
                  {opState.text}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">Physics State</span>
              </div>
            </div>

            {/* ML Early Warning Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ML EARLY-WARNING STATUS</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                  warningCat === "CRITICAL"
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : warningCat === "WARNING"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}>
                  {warningCat}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold font-mono text-slate-100">
                  {probPct}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Runaway Risk within 15 min
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                  style={{ left: "35%" }}
                  title="Warning threshold (35%)"
                ></div>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                  style={{ left: "70%" }}
                  title="Critical threshold (70%)"
                ></div>
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    warningCat === "CRITICAL"
                      ? "bg-red-500 animate-pulse"
                      : warningCat === "WARNING"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(3, probPct))}%` }}
                ></div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-sans pt-1">
                {state?.warning?.message || "Reactor operating within safe parameters."}
              </p>
            </div>

            {/* Key Milestone Timestamps */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-[11px] grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Disturbance:</span>
                <span className="text-amber-400 font-semibold">
                  {events?.t_disturbance !== null && events?.t_disturbance !== undefined ? `${events.t_disturbance.toFixed(1)} min` : "None"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">AI Warning:</span>
                <span className="text-cyan-400 font-semibold">
                  {events?.t_first_warning !== null && events?.t_first_warning !== undefined ? `${events.t_first_warning.toFixed(1)} min` : "None"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">390 K Crossing:</span>
                <span className="text-red-400 font-semibold">
                  {events?.t_critical_crossing !== null && events?.t_critical_crossing !== undefined ? `${events.t_critical_crossing.toFixed(1)} min` : "Not crossed"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Lead Time:</span>
                <span className="text-emerald-400 font-bold">
                  {events?.lead_time !== null && events?.lead_time !== undefined ? `+${events.lead_time.toFixed(1)} min` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Three Scientific Graphs Section */}
      <div className="space-y-6 pt-2">
        <div className="border-b border-slate-800 pb-2">
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>SCIENTIFIC DYNAMICS: THREE PRIMARY PROCESS GRAPHS</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time ODE integration plots showing temperature, exothermic reaction generation, and cooling jacket heat removal.
          </p>
        </div>

        {/* Graph 1: Reactor Temperature vs Time */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                <span>GRAPH 1: REACTOR TEMPERATURE vs TIME</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Simulated temperature response with 390.0 K critical runaway limit.
              </p>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              T = {currentT.toFixed(1)} K
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  unit="m"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.floor(Math.min(290, isNaN(dataMin) ? 290 : dataMin - 5)),
                    (dataMax: number) => Math.ceil(Math.max(410, isNaN(dataMax) ? 410 : dataMax + 15)),
                  ]}
                  unit=" K"
                  stroke="#64748b"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "10px", fontSize: "12px", fontFamily: "monospace" }}
                  formatter={(val: any) => [`${Number(val).toFixed(2)} K`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

                {/* 390 K Critical Threshold */}
                <ReferenceLine
                  y={390}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: "Critical Threshold: 390.0 K", fill: "#ef4444", fontSize: 11, position: "top" }}
                />

                {events?.t_disturbance !== null && events?.t_disturbance !== undefined && (
                  <ReferenceLine
                    x={events.t_disturbance}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: "Disturbance", fill: "#f59e0b", fontSize: 10, position: "insideTopLeft" }}
                  />
                )}

                {events?.t_first_warning !== null && events?.t_first_warning !== undefined && (
                  <ReferenceLine
                    x={events.t_first_warning}
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: "Early Warning", fill: "#06b6d4", fontSize: 10, position: "insideTopLeft" }}
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
                  name="Measured Temp (T_obs) [K]"
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2-Column Grid for Graph 2 & Graph 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graph 2: Heat Generation vs Time */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>GRAPH 2: HEAT GENERATION vs TIME</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  q_gen = β · k(T) · CA [K/min] (Arrhenius kinetic surge)
                </p>
              </div>
              <span className="text-[11px] font-mono text-amber-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {(state?.q_gen ?? 0.0).toFixed(2)} K/min
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    unit="m"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(v) => v.toFixed(1)}
                  />
                  <YAxis
                    domain={[
                      0,
                      (dataMax: number) => Math.ceil(Math.max(30, isNaN(dataMax) ? 30 : dataMax * 1.15)),
                    ]}
                    stroke="#64748b"
                    fontSize={11}
                    unit=" K/m"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "10px", fontSize: "12px", fontFamily: "monospace" }}
                    formatter={(val: any) => [`${Number(val).toFixed(2)} K/min`, "Heat Generation"]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  {events?.t_disturbance !== null && events?.t_disturbance !== undefined && (
                    <ReferenceLine
                      x={events.t_disturbance}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: "Disturbance", fill: "#f59e0b", fontSize: 10, position: "insideTopLeft" }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="q_gen"
                    name="Heat Generation (q_gen) [K/min]"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Graph 3: Heat Removal vs Time */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>GRAPH 3: HEAT REMOVAL vs TIME</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  q_rem = U · (T - Tc) [K/min] (Reflects cooling condition & Tc)
                </p>
              </div>
              <span className="text-[11px] font-mono text-blue-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {(state?.q_rem ?? 0.0).toFixed(2)} K/min
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    unit="m"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(v) => v.toFixed(1)}
                  />
                  <YAxis
                    domain={[
                      (dataMin: number) => Math.min(0, Math.floor(isNaN(dataMin) ? 0 : dataMin - 1)),
                      (dataMax: number) => Math.ceil(Math.max(20, isNaN(dataMax) ? 20 : dataMax * 1.15)),
                    ]}
                    stroke="#64748b"
                    fontSize={11}
                    unit=" K/m"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#090d16", borderColor: "#1e293b", borderRadius: "10px", fontSize: "12px", fontFamily: "monospace" }}
                    formatter={(val: any) => [`${Number(val).toFixed(2)} K/min`, "Heat Removal"]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  {events?.t_disturbance !== null && events?.t_disturbance !== undefined && (
                    <ReferenceLine
                      x={events.t_disturbance}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: "Disturbance", fill: "#f59e0b", fontSize: 10, position: "insideTopLeft" }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="q_rem"
                    name="Heat Removal (q_rem) [K/min]"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;
