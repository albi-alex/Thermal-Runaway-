import React from "react";
import { Play, Pause, RotateCcw, Clock, ShieldCheck, Flame, AlertOctagon } from "lucide-react";
import type { CSTRState } from "../types";

interface HeaderProps {
  state: CSTRState | null;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  activePresetName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  onStart,
  onPause,
  onReset,
  activePresetName,
}) => {
  const isRunning = state?.is_running ?? false;
  const isPaused = state?.is_paused ?? false;
  const time = state ? state.time.toFixed(1) : "0.0";
  const temp = state ? state.T.toFixed(1) : "305.0";
  const isRunaway = state ? state.T >= state.T_critical : false;

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Title */}
      <div className="flex items-center space-x-3">
        <div>
          <h1 className="text-base font-bold text-slate-100 tracking-tight leading-tight flex items-center space-x-2">
            <span>Thermal Runaway Early Warning System</span>
            {isRunaway && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white animate-pulse">
                <Flame className="w-3.5 h-3.5" />
                <span>THERMAL RUNAWAY</span>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 font-mono flex items-center space-x-2">
            <span className="text-slate-300 font-sans">Physics-Based Reactor Simulation and ML Early Warning</span>
            <span>•</span>
            <span>Critical: <strong className="text-red-400">390.0 K</strong></span>
            <span>•</span>
            <span>Horizon: <strong className="text-cyan-400">15.0 min</strong></span>
          </p>
        </div>
      </div>

      {/* Quick Controls & Telemetry */}
      <div className="flex items-center space-x-4">
        {/* Simulation Time */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 font-mono text-sm">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400 text-xs">t =</span>
          <span className="text-slate-100 font-bold">{time}</span>
          <span className="text-slate-400 text-xs">min</span>
        </div>

        {/* Reactor Temperature Pill */}
        <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm ${
          isRunaway 
            ? "bg-red-500/20 border-red-500 text-red-200" 
            : state?.warning?.hybrid_category === "CRITICAL"
            ? "bg-red-500/10 border-red-500/40 text-red-300"
            : state?.warning?.hybrid_category === "WARNING"
            ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
            : "bg-slate-800/80 border-slate-700 text-slate-200"
        }`}>
          <span className="text-xs text-slate-400">T:</span>
          <span className="font-bold">{temp} K</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5 border-l border-slate-800 pl-4">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-700/20 transition-colors"
              title="Start simulation"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPaused ? "Resume" : "Start"}</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-700/20 transition-colors"
              title="Pause simulation"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
            title="Reset to t=0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
