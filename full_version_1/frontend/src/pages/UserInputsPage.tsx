import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  Play, 
  Check, 
  RotateCcw, 
  Flame, 
  AlertTriangle, 
  ShieldCheck, 
  Thermometer, 
  Droplets, 
  Clock, 
  Layers,
  ArrowRight,
  Info
} from "lucide-react";
import type { CSTRState } from "../types";
import type { NavPage } from "../components/Sidebar";

interface UserInputsPageProps {
  state: CSTRState | null;
  onApplyInputs: (settings: Record<string, any>) => Promise<void>;
  onStartSimulation: (settings?: Record<string, any>) => Promise<void>;
  onNavigate: (page: NavPage) => void;
}

export const UserInputsPage: React.FC<UserInputsPageProps> = ({
  state,
  onApplyInputs,
  onStartSimulation,
  onNavigate,
}) => {
  // Documented default values
  const defaultValues = {
    T0: 305.0,
    Tf: 300.0,
    Tc: 300.0,
    CA0: 0.88,
    tau: 5.0,
    coolingCondition: "normal" as "normal" | "reduced" | "failure",
    hotFeed: false,
  };

  // State sliders
  const [T0, setT0] = useState<number>(state?.T ?? defaultValues.T0);
  const [Tf, setTf] = useState<number>(state?.Tf ?? defaultValues.Tf);
  const [Tc, setTc] = useState<number>(state?.Tc ?? defaultValues.Tc);
  const [CA0, setCA0] = useState<number>(state?.CA ?? defaultValues.CA0);
  const [tau, setTau] = useState<number>(state?.tau ?? defaultValues.tau);

  // Scenario states
  const [coolingCondition, setCoolingCondition] = useState<"normal" | "reduced" | "failure">("normal");
  const [hotFeed, setHotFeed] = useState<boolean>(false);

  // Status message
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Sync with state if available on mount or reset to time zero
  useEffect(() => {
    if (state && state.time === 0.0) {
      setT0(state.T);
      setCA0(state.CA);
      setTf(state.Tf);
      setTc(state.Tc);
      setTau(state.tau);
      if (state.floss >= 0.80) {
        setCoolingCondition("failure");
      } else if (state.floss >= 0.40) {
        setCoolingCondition("reduced");
      } else {
        setCoolingCondition("normal");
      }
    }
  }, [state?.time]);

  const getFlossValue = (cond: "normal" | "reduced" | "failure") => {
    switch (cond) {
      case "failure": return 0.82; // 82% loss = 18% capacity
      case "reduced": return 0.50; // 50% loss = 50% capacity
      default: return 0.0; // 0% loss = 100% capacity
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setAppliedMessage(null);
    try {
      const floss = getFlossValue(coolingCondition);
      const deltaTf = hotFeed ? 15.0 : 0.0;
      await onApplyInputs({
        T0: Number(T0),
        Tf: Number(Tf),
        Tc: Number(Tc),
        CA0: Number(CA0),
        tau: Number(tau),
        floss,
        delta_Tf: deltaTf,
      });
      setAppliedMessage("Operating inputs successfully applied to reactor simulation.");
      setTimeout(() => setAppliedMessage(null), 4000);
    } catch (e: any) {
      console.error(e);
      setAppliedMessage("Error applying inputs. Please check backend connection.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleStartWithInputs = async () => {
    try {
      const floss = getFlossValue(coolingCondition);
      const deltaTf = hotFeed ? 15.0 : 0.0;
      await onStartSimulation({
        T0: Number(T0),
        Tf: Number(Tf),
        Tc: Number(Tc),
        CA0: Number(CA0),
        tau: Number(tau),
        floss,
        delta_Tf: deltaTf,
      });
      onNavigate("simulation");
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleResetDefaults = async () => {
    setT0(defaultValues.T0);
    setTf(defaultValues.Tf);
    setTc(defaultValues.Tc);
    setCA0(defaultValues.CA0);
    setTau(defaultValues.tau);
    setCoolingCondition("normal");
    setHotFeed(false);

    try {
      await onApplyInputs({
        T0: defaultValues.T0,
        Tf: defaultValues.Tf,
        Tc: defaultValues.Tc,
        CA0: defaultValues.CA0,
        tau: defaultValues.tau,
        floss: 0.0,
        delta_Tf: 0.0,
      });
      setAppliedMessage("Reset to documented standard operating baseline.");
      setTimeout(() => setAppliedMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-semibold mb-1">
          <Sliders className="w-4 h-4" />
          <span>REACTOR CONFIGURATION</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          User Operating Inputs
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Set reactor parameters using the sliders below. Applied values directly configure the physics ODEs and initial conditions.
        </p>
      </div>

      {/* Confirmation Alert */}
      {appliedMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-200 text-xs font-mono flex items-center space-x-2 animate-fadeIn">
          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{appliedMessage}</span>
        </div>
      )}

      {/* Main Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Slider 1: Initial Reactor Temperature */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Thermometer className="w-4 h-4 text-cyan-400" />
              <span>Initial Reactor Temperature (T₀)</span>
            </span>
            <span className="text-base font-mono font-bold text-cyan-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {T0.toFixed(1)} K
            </span>
          </div>
          <input
            type="range"
            min="290.0"
            max="360.0"
            step="0.5"
            value={T0}
            onChange={(e) => setT0(Number(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>290.0 K (Cold)</span>
            <span className="text-slate-400">Baseline: 305.0 K</span>
            <span>360.0 K (Near runaway)</span>
          </div>
        </div>

        {/* Slider 2: Feed Temperature */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Droplets className="w-4 h-4 text-blue-400" />
              <span>Feed Stream Temperature (T_f)</span>
            </span>
            <span className="text-base font-mono font-bold text-blue-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {Tf.toFixed(1)} K
            </span>
          </div>
          <input
            type="range"
            min="280.0"
            max="340.0"
            step="0.5"
            value={Tf}
            onChange={(e) => setTf(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>280.0 K (Chilled)</span>
            <span className="text-slate-400">Baseline: 300.0 K</span>
            <span>340.0 K (Hot feed)</span>
          </div>
        </div>

        {/* Slider 3: Coolant Jacket Temperature */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Coolant Temperature (T_c)</span>
            </span>
            <span className="text-base font-mono font-bold text-emerald-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {Tc.toFixed(1)} K
            </span>
          </div>
          <input
            type="range"
            min="285.0"
            max="320.0"
            step="0.5"
            value={Tc}
            onChange={(e) => setTc(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>285.0 K (Strong cooling)</span>
            <span className="text-slate-400">Baseline: 300.0 K</span>
            <span>320.0 K (Weak cooling)</span>
          </div>
        </div>

        {/* Slider 4: Initial Reactant Concentration */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Initial Reactant (CA₀)</span>
            </span>
            <span className="text-base font-mono font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {CA0.toFixed(3)} kmol/m³
            </span>
          </div>
          <input
            type="range"
            min="0.20"
            max="1.50"
            step="0.01"
            value={CA0}
            onChange={(e) => setCA0(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>0.20 (Dilute)</span>
            <span className="text-slate-400">Baseline: 0.88 kmol/m³</span>
            <span>1.50 (Concentrated)</span>
          </div>
        </div>

        {/* Slider 5: Residence Time */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Reactor Residence Time (τ = V / Q)</span>
            </span>
            <span className="text-base font-mono font-bold text-purple-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {tau.toFixed(1)} min
            </span>
          </div>
          <input
            type="range"
            min="1.0"
            max="15.0"
            step="0.1"
            value={tau}
            onChange={(e) => setTau(Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>1.0 min (Fast throughput)</span>
            <span className="text-slate-400">Documented Baseline: 5.0 min</span>
            <span>15.0 min (Slow throughput)</span>
          </div>
        </div>
      </div>

      {/* Scenario Selectors: Cooling Condition & Hot Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cooling Condition Selector */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
          <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Cooling Condition Selector</span>
          </span>
          <p className="text-xs text-slate-400">
            Sets the available heat transfer coefficient U across the cooling jacket.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => setCoolingCondition("normal")}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                coolingCondition === "normal"
                  ? "bg-emerald-950/70 border-emerald-500/80 text-emerald-300 shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Normal Cooling</span>
              <span className="text-[10px] font-mono opacity-80">100% capacity</span>
            </button>

            <button
              onClick={() => setCoolingCondition("reduced")}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                coolingCondition === "reduced"
                  ? "bg-amber-950/70 border-amber-500/80 text-amber-300 shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Reduced Cooling</span>
              <span className="text-[10px] font-mono opacity-80">50% capacity</span>
            </button>

            <button
              onClick={() => setCoolingCondition("failure")}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                coolingCondition === "failure"
                  ? "bg-red-950/70 border-red-500/80 text-red-300 shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Flame className="w-4 h-4 text-red-400" />
              <span>Cooling Failure</span>
              <span className="text-[10px] font-mono opacity-80">-82% capacity</span>
            </button>
          </div>
        </div>

        {/* Hot Feed Scenario Toggle */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3">
          <span className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Feed Temperature Scenario</span>
          </span>
          <p className="text-xs text-slate-400">
            Injects thermal disturbance into the reactor feed stream.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setHotFeed(false)}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                !hotFeed
                  ? "bg-slate-800 border-slate-600 text-slate-200 shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Standard Feed (ΔTf = 0 K)</span>
              <span className="text-[10px] font-mono opacity-80">{Tf.toFixed(1)} K</span>
            </button>

            <button
              onClick={() => setHotFeed(true)}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all cursor-pointer ${
                hotFeed
                  ? "bg-amber-950/70 border-amber-500/80 text-amber-300 shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Hot-Feed Step (+15 K)</span>
              <span className="text-[10px] font-mono opacity-80">{(Tf + 15).toFixed(1)} K</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons: Apply Inputs, Start Simulation, Reset Defaults */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
        <button
          onClick={handleResetDefaults}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Defaults</span>
        </button>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isApplying ? "Applying..." : "Apply Inputs"}</span>
          </button>

          <button
            onClick={handleStartWithInputs}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Simulation</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserInputsPage;
