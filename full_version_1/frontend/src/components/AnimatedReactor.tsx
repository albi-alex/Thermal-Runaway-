import React, { useMemo } from "react";
import { Flame, AlertTriangle, ShieldCheck, Thermometer, Wind, Droplets } from "lucide-react";
import type { CSTRState } from "../types";

interface AnimatedReactorProps {
  state: CSTRState | null;
  className?: string;
  showDetails?: boolean;
}

export const AnimatedReactor: React.FC<AnimatedReactorProps> = ({
  state,
  className = "",
  showDetails = true,
}) => {
  const T = state?.T ?? 305.0;
  const T_obs = state?.T_obs ?? T;
  const CA = state?.CA ?? 0.88;
  const CAf = state?.CAf ?? 1.0;
  const Tf = state?.Tf ?? 300.0;
  const Tc = state?.Tc ?? 300.0;
  const U = state?.U ?? 1.1;
  const U0 = state?.U0 ?? 1.1;
  const floss = state?.floss ?? 0.0;
  const q_gen = state?.q_gen ?? 0.0;
  const q_rem = state?.q_rem ?? 0.0;
  const q_net = state?.q_net ?? 0.0;
  const dT_dt = state?.dT_dt ?? 0.0;
  const isRunning = state?.is_running ?? false;
  const isRunaway = T >= (state?.T_critical ?? 390.0);
  const p_rf = state?.warning?.rf_probability ?? 0.0;

  // Fluid color interpolation based on reactor temperature
  const fluidColors = useMemo(() => {
    if (T < 312) {
      return { start: "#0284c7", end: "#0369a1", glow: "rgba(2, 132, 199, 0.2)" }; // Cool Blue
    } else if (T < 325) {
      return { start: "#0d9488", end: "#0f766e", glow: "rgba(13, 148, 136, 0.25)" }; // Teal-Emerald
    } else if (T < 345) {
      return { start: "#d97706", end: "#b45309", glow: "rgba(217, 119, 6, 0.3)" }; // Amber-Gold
    } else if (T < 375) {
      return { start: "#ea580c", end: "#c2410c", glow: "rgba(234, 88, 12, 0.4)" }; // Hot Orange
    } else {
      return { start: "#dc2626", end: "#991b1b", glow: "rgba(220, 38, 38, 0.6)" }; // Critical Red
    }
  }, [T]);

  // Thermometer height mapping (300 K -> 0%, 410 K -> 100%)
  const thermoPercent = Math.min(100, Math.max(0, ((T - 295) / (415 - 295)) * 100));
  const critPercent = ((390 - 295) / (415 - 295)) * 100; // ~79.2%

  // Cooling jacket visual state
  const coolingCapacityPct = Math.max(0, Math.round((1 - floss) * 100));
  const jacketActive = isRunning && coolingCapacityPct > 20;

  return (
    <div className={`relative bg-slate-900/80 rounded-2xl border border-slate-800 p-6 flex flex-col items-center select-none ${className}`}>
      {/* Header bar within reactor card */}
      <div className="w-full flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-ping"></div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
            CSTR Physical Vessel Simulation
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="text-slate-400">Cooling:</span>
          <span className={`font-bold px-2 py-0.5 rounded ${
            coolingCapacityPct < 50
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
          }`}>
            {coolingCapacityPct}% ({U.toFixed(3)} min⁻¹)
          </span>
        </div>
      </div>

      {/* Main Reactor Graphic & Thermal Column */}
      <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6">
        {/* SVG Reactor Schematic */}
        <div className="relative w-full max-w-[620px] aspect-[480/410] flex-1">
          <svg viewBox="0 0 480 420" className="w-full h-full drop-shadow-2xl">
            <defs>
              {/* Dynamic Liquid Gradient */}
              <linearGradient id="reactorLiquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={fluidColors.start} stopOpacity="0.9" />
                <stop offset="100%" stopColor={fluidColors.end} stopOpacity="0.95" />
              </linearGradient>

              {/* Vessel Metallic Gradient */}
              <linearGradient id="vesselSteelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="25%" stopColor="#64748b" />
                <stop offset="70%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              {/* Cooling Jacket Gradient */}
              <linearGradient id="coolingJacketGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={jacketActive ? "#0284c7" : "#475569"} stopOpacity={jacketActive ? 0.35 : 0.15} />
                <stop offset="50%" stopColor={jacketActive ? "#38bdf8" : "#64748b"} stopOpacity={jacketActive ? 0.2 : 0.1} />
                <stop offset="100%" stopColor={jacketActive ? "#0284c7" : "#475569"} stopOpacity={jacketActive ? 0.35 : 0.15} />
              </linearGradient>

              {/* Pipe Flow Pattern */}
              <pattern id="flowPatternInlet" width="20" height="12" patternUnits="userSpaceOnUse">
                <line x1="0" y1="6" x2="10" y2="6" stroke="#38bdf8" strokeWidth="3" strokeDasharray="6,4">
                  {isRunning && (
                    <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />
                  )}
                </line>
              </pattern>

              {/* Glow Filter for Runaway */}
              <filter id="runawayGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* --- FEED INLET (Top-Left Pipe) --- */}
            <g id="feed-inlet">
              <path
                d="M 50 70 L 160 70 L 160 110"
                fill="none"
                stroke="#475569"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 50 70 L 160 70 L 160 110"
                fill="none"
                stroke={isRunning ? "#38bdf8" : "#64748b"}
                strokeWidth="8"
                strokeDasharray="6,4"
              >
                {isRunning && (
                  <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
                )}
              </path>
              <rect x="35" y="58" width="8" height="24" rx="2" fill="#94a3b8" />
              <text x="50" y="50" fill="#94a3b8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                Feed: CAf={CAf.toFixed(1)}, Tf={Tf.toFixed(0)}K
              </text>
            </g>

            {/* --- PRODUCT OUTLET (Bottom-Right Pipe) --- */}
            <g id="product-outlet">
              <path
                d="M 320 340 L 320 370 L 430 370"
                fill="none"
                stroke="#475569"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 320 340 L 320 370 L 430 370"
                fill="none"
                stroke={fluidColors.start}
                strokeWidth="8"
                strokeDasharray="6,4"
              >
                {isRunning && (
                  <animate attributeName="stroke-dashoffset" from="0" to="20" dur="1s" repeatCount="indefinite" />
                )}
              </path>
              <rect x="430" y="358" width="8" height="24" rx="2" fill="#94a3b8" />
              <text x="350" y="400" fill="#94a3b8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                Outlet: CA={CA.toFixed(2)}, T={T.toFixed(1)}K
              </text>
            </g>

            {/* --- COOLING JACKET (Outer Layer around bottom 65%) --- */}
            <g id="cooling-jacket">
              {/* Outer Jacket Shell */}
              <path
                d="M 125 180 L 125 310 C 125 375, 355 375, 355 310 L 355 180 Z"
                fill="url(#coolingJacketGrad)"
                stroke={jacketActive ? "#0ea5e9" : "#475569"}
                strokeWidth="3"
                strokeDasharray={jacketActive ? "none" : "4,4"}
              />

              {/* Coolant Inlet Pipe (Bottom Left) */}
              <path d="M 70 310 L 125 310" stroke="#475569" strokeWidth="12" fill="none" />
              <path
                d="M 70 310 L 125 310"
                stroke={jacketActive ? "#06b6d4" : "#64748b"}
                strokeWidth="6"
                strokeDasharray="5,3"
              >
                {jacketActive && (
                  <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.8s" repeatCount="indefinite" />
                )}
              </path>
              <text x="40" y="335" fill="#06b6d4" fontSize="10" fontFamily="monospace">
                Coolant In (Tc={Tc.toFixed(0)}K)
              </text>

              {/* Coolant Outlet Pipe (Top Right) */}
              <path d="M 355 200 L 410 200" stroke="#475569" strokeWidth="12" fill="none" />
              <path
                d="M 355 200 L 410 200"
                stroke={jacketActive ? "#38bdf8" : "#64748b"}
                strokeWidth="6"
                strokeDasharray="5,3"
              >
                {jacketActive && (
                  <animate attributeName="stroke-dashoffset" from="0" to="16" dur="0.8s" repeatCount="indefinite" />
                )}
              </path>
              <text x="365" y="190" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                Coolant Out
              </text>
            </g>

            {/* --- MAIN REACTOR VESSEL (Walls & Head) --- */}
            <g id="reactor-vessel">
              {/* Top Dish / Flange */}
              <ellipse cx="240" cy="110" rx="95" ry="25" fill="#1e293b" stroke="#64748b" strokeWidth="3" />

              {/* Vessel Body Shadow & Base */}
              <path
                d="M 145 110 L 145 300 C 145 360, 335 360, 335 300 L 335 110"
                fill="none"
                stroke="#1e293b"
                strokeWidth="6"
              />

              {/* Liquid Contents with Dynamic Wave Top */}
              <g id="reactor-liquid" filter={isRunaway ? "url(#runawayGlow)" : undefined}>
                <path
                  d="M 147 160 
                     Q 190 155, 240 160 
                     T 333 160 
                     L 333 300 
                     C 333 355, 147 355, 147 300 Z"
                  fill="url(#reactorLiquidGrad)"
                  opacity="0.9"
                />

                {/* Gentle Surface Ripple */}
                {isRunning && (
                  <ellipse cx="240" cy="160" rx="92" ry="12" fill={fluidColors.start} opacity="0.6">
                    <animate
                      attributeName="ry"
                      values="12;14;12"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </ellipse>
                )}

                {/* Thermal convection eddies / bubbles (speed & count scale with reaction) */}
                {isRunning && (
                  <g opacity="0.6">
                    <circle cx="190" cy="270" r="3" fill="#ffffff">
                      <animate attributeName="cy" values="290;170" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="280" cy="280" r="4" fill="#ffffff">
                      <animate attributeName="cy" values="300;175" dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="220" cy="290" r="2.5" fill="#ffffff">
                      <animate attributeName="cy" values="300;165" dur="2.1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.9;0" dur="2.1s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}
              </g>

              {/* Vessel Glass / Transparent Shell Outline */}
              <path
                d="M 145 110 L 145 300 C 145 360, 335 360, 335 300 L 335 110"
                fill="none"
                stroke="#64748b"
                strokeWidth="4"
              />
            </g>

            {/* --- CENTRAL AGITATOR & IMPELLER --- */}
            <g id="agitator">
              {/* Drive Motor on Top */}
              <rect x="220" y="35" width="40" height="45" rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
              <rect x="228" y="25" width="24" height="10" rx="2" fill="#475569" />
              <line x1="225" y1="50" x2="255" y2="50" stroke="#0ea5e9" strokeWidth="2" opacity="0.6" />

              {/* Drive Shaft */}
              <line x1="240" y1="80" x2="240" y2="295" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />

              {/* Impeller Blades */}
              <g transform="translate(240, 295)">
                <ellipse
                  cx="0"
                  cy="0"
                  rx="48"
                  ry="10"
                  fill="#475569"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  className={isRunning ? "animate-spin-slow origin-center" : ""}
                />
                <circle cx="0" cy="0" r="5" fill="#f8fafc" />
              </g>
            </g>

            {/* --- DIGITAL CORE OVERLAY (Temperature in Center) --- */}
            <g transform="translate(240, 235)">
              <rect
                x="-65"
                y="-26"
                width="130"
                height="52"
                rx="10"
                fill="#030712"
                fillOpacity="0.85"
                stroke={isRunaway ? "#ef4444" : fluidColors.start}
                strokeWidth="2"
                className={isRunaway ? "animate-pulse" : ""}
              />
              <text x="0" y="-4" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                CORE TEMP
              </text>
              <text
                x="0"
                y="18"
                textAnchor="middle"
                fill={isRunaway ? "#f87171" : "#f8fafc"}
                fontSize="20"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {T.toFixed(1)} K
              </text>
            </g>
          </svg>
        </div>

        {/* --- VERTICAL INDUSTRIAL THERMAL COLUMN GAUGE --- */}
        <div className="w-32 bg-slate-950/70 rounded-xl border border-slate-800 p-3.5 flex flex-col items-center justify-between shrink-0">
          <div className="text-[11px] font-mono font-bold text-slate-300 flex items-center space-x-1 mb-2">
            <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
            <span>THERMOMETER</span>
          </div>

          {/* Bar Column Container */}
          <div className="relative w-12 h-64 bg-slate-900 rounded-full border-2 border-slate-700 overflow-hidden flex flex-col justify-end p-1">
            {/* Critical 390 K Marker Line */}
            <div
              className="absolute left-0 right-0 border-b-2 border-red-500 z-10 flex items-center"
              style={{ bottom: `${critPercent}%` }}
            >
              <span className="absolute -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            </div>

            {/* Rising Fluid Column */}
            <div
              className={`w-full rounded-full transition-all duration-300 ${
                isRunaway ? "bg-red-600 animate-pulse" : ""
              }`}
              style={{
                height: `${thermoPercent}%`,
                background: isRunaway
                  ? "#ef4444"
                  : `linear-gradient(to top, #0284c7, #10b981, #f59e0b, #ef4444)`,
              }}
            ></div>
          </div>

          {/* Scale Labels */}
          <div className="w-full mt-2 text-[10px] font-mono space-y-1">
            <div className="flex justify-between items-center text-red-400 font-bold">
              <span>CRIT:</span>
              <span>390.0 K</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>CURR:</span>
              <span className="font-bold text-slate-200">{T.toFixed(1)} K</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>DIFF:</span>
              <span className={390 - T < 10 ? "text-red-400 font-bold" : "text-cyan-400"}>
                {(390.0 - T).toFixed(1)} K
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Dynamic Physics Metrics Bar */}
      {showDetails && (
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 font-mono text-center">
            <div className="text-[10px] text-slate-400">Reactant (CA)</div>
            <div className="text-sm font-bold text-cyan-300">{CA.toFixed(4)} kmol/m³</div>
            <div className="text-[10px] text-slate-500">Conv: {Math.max(0, ((1 - CA / CAf) * 100)).toFixed(1)}%</div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 font-mono text-center">
            <div className="text-[10px] text-slate-400">Heating Rate (dT/dt)</div>
            <div className={`text-sm font-bold ${dT_dt > 5 ? "text-red-400" : dT_dt > 0 ? "text-amber-300" : "text-slate-300"}`}>
              {dT_dt >= 0 ? "+" : ""}{dT_dt.toFixed(2)} K/min
            </div>
            <div className="text-[10px] text-slate-500">Thermal Drive</div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 font-mono text-center">
            <div className="text-[10px] text-slate-400">Heat Generation (q_gen)</div>
            <div className="text-sm font-bold text-amber-400">{q_gen.toFixed(2)} K/min</div>
            <div className="text-[10px] text-slate-500">Arrhenius Release</div>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 font-mono text-center">
            <div className="text-[10px] text-slate-400">Heat Removal (q_rem)</div>
            <div className="text-sm font-bold text-blue-400">{q_rem.toFixed(2)} K/min</div>
            <div className="text-[10px] text-slate-500">Jacket Removal</div>
          </div>
        </div>
      )}
    </div>
  );
};
