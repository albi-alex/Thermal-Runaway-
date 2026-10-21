import React from "react";
import { 
  Home, 
  Activity, 
  Sliders, 
  Mail, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";
import type { CSTRState } from "../types";

export type NavPage = "home" | "inputs" | "simulation";

interface SidebarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  state: CSTRState | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, state }) => {
  const navItems: Array<{ id: NavPage; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: "home", label: "Home", icon: <Home className="w-5 h-5" /> },
    { id: "inputs", label: "User Inputs", icon: <Sliders className="w-5 h-5" /> },
    { 
      id: "simulation", 
      label: "CSTR Simulation", 
      icon: <Activity className="w-5 h-5" />, 
      badge: state?.is_running ? "RUNNING" : state?.is_paused ? "PAUSED" : undefined 
    },
  ];

  const getStatusColor = () => {
    if (!state) return "bg-slate-700";
    if (state.T >= state.T_critical) return "bg-red-500 animate-pulse";
    if (state.warning?.hybrid_category === "CRITICAL") return "bg-red-500";
    if (state.warning?.hybrid_category === "WARNING") return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand / Logo */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-100 tracking-tight leading-snug">Thermal Runaway</div>
            <div className="text-[10px] text-cyan-400 font-mono tracking-wider">EARLY WARNING SYSTEM</div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? "text-cyan-400" : "text-slate-400"}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded tracking-wide ${
                      item.badge === "RUNNING"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse"
                        : item.badge === "PAUSED"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Persistent System Status Box */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 m-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400 font-medium">Reactor Thermal Status</span>
          <span className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
            <span className="font-mono font-semibold text-slate-200">
              {state ? state.warning?.hybrid_category || "NOMINAL" : "CONNECTING"}
            </span>
          </span>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex justify-between py-1 border-t border-slate-800">
          <span>Prediction Horizon:</span>
          <span className="text-cyan-400 font-semibold">15.0 min</span>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex justify-between py-1 border-t border-slate-800">
          <span>Random Forest:</span>
          <span className="text-emerald-400 font-semibold flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 inline" /> <span>120 Trees</span>
          </span>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex justify-between py-1 border-t border-slate-800">
          <span>Runaway Threshold:</span>
          <span className="text-red-400 font-semibold">390.0 K</span>
        </div>
      </div>
    </aside>
  );
};
