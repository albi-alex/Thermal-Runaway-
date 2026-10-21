import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import type { NavPage } from "./components/Sidebar";
import { Header } from "./components/Header";
import { HomePage } from "./pages/HomePage";
import { UserInputsPage } from "./pages/UserInputsPage";
import { SimulationPage } from "./pages/SimulationPage";
import type { CSTRState } from "./types";
import {
  fetchSimulationState,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  resetSimulation,
  stepSimulation,
  injectCoolingDisturbance,
  injectFeedTempDisturbance,
  restoreCooling,
  updateSettings,
} from "./api";

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<NavPage>("home");
  const [state, setState] = useState<CSTRState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stepIntervalRef = useRef<number | null>(null);

  // Initial load
  const loadInitialData = async () => {
    try {
      const initialState = await fetchSimulationState();
      setState(initialState);
      setErrorMsg(null);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Cannot connect to simulation backend. Make sure the FastAPI backend is running on port 8000.");
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Simulation execution loop
  useEffect(() => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }

    if (state?.is_running && !state?.is_paused) {
      const speed = state.simulation_speed || 1.0;
      // Interval: 150ms divided by speed, minimum 20ms
      const intervalMs = Math.max(20, Math.round(150 / speed));

      stepIntervalRef.current = window.setInterval(async () => {
        try {
          const nextState = await stepSimulation(1);
          setState(nextState);
        } catch (e) {
          console.error("Step error:", e);
        }
      }, intervalMs);
    }

    return () => {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
      }
    };
  }, [state?.is_running, state?.is_paused, state?.simulation_speed]);

  // Action Handlers
  const handleStart = async () => {
    try {
      const s = await startSimulation(undefined, state?.simulation_speed || 1.0);
      setState(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePause = async () => {
    try {
      const s = await pauseSimulation();
      setState(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async () => {
    try {
      const s = await resumeSimulation();
      setState(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = async () => {
    try {
      const s = await resetSimulation();
      setState(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleInjectCooling = async (floss: number) => {
    try {
      const res = await injectCoolingDisturbance(floss);
      if (res.state) setState(res.state);
    } catch (e) {
      console.error(e);
    }
  };

  const handleInjectFeedTemp = async (deltaTf: number) => {
    try {
      const res = await injectFeedTempDisturbance(deltaTf);
      if (res.state) setState(res.state);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreCooling = async () => {
    try {
      const res = await restoreCooling();
      if (res.state) setState(res.state);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeedChange = async (spd: number) => {
    try {
      const s = await updateSettings({ simulation_speed: spd });
      setState(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyInputs = async (settings: Record<string, any>) => {
    try {
      const s = await updateSettings(settings);
      setState(s);
    } catch (e) {
      console.error("Apply inputs error:", e);
      throw e;
    }
  };

  const handleStartSimulation = async (settings?: Record<string, any>) => {
    try {
      if (settings) {
        await updateSettings(settings);
      }
      // Ensure simulation resets to time zero with new configured parameters
      const resetState = await resetSimulation();
      const s = await startSimulation(undefined, resetState?.simulation_speed || state?.simulation_speed || 1.0);
      setState(s);
    } catch (e) {
      console.error("Start simulation error:", e);
      throw e;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Persistent Left Sidebar: Exactly 3 Navigation Pages */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} state={state} />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Consistent Top Header */}
        <Header
          state={state}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
        />

        {/* Global Connection Alert if Backend Unreachable */}
        {errorMsg && (
          <div className="bg-red-950/80 border-b border-red-500/40 text-red-200 px-6 py-2.5 text-xs font-mono flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={loadInitialData}
              className="px-2.5 py-1 rounded bg-red-800 text-white text-[11px] font-bold hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === "home" && (
            <HomePage
              state={state}
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === "inputs" && (
            <UserInputsPage
              state={state}
              onApplyInputs={handleApplyInputs}
              onStartSimulation={handleStartSimulation}
              onNavigate={setCurrentPage}
            />
          )}

          {currentPage === "simulation" && (
            <SimulationPage
              state={state}
              onStart={handleStart}
              onPause={handlePause}
              onReset={handleReset}
              onInjectCooling={handleInjectCooling}
              onInjectFeedTemp={handleInjectFeedTemp}
              onRestoreCooling={handleRestoreCooling}
              onSpeedChange={handleSpeedChange}
              onNavigate={setCurrentPage}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
