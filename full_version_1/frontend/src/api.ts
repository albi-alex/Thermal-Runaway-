import type { CSTRState, PresetInfo, EvaluationReport, ModelMetadata } from "./types";

const API_BASE = "http://localhost:8000/api";

export async function fetchSimulationState(): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/state`);
  if (!res.ok) throw new Error("Failed to fetch simulation state");
  return res.json();
}

export async function startSimulation(presetId?: string, speed?: number): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset_id: presetId, speed: speed || 1.0 }),
  });
  if (!res.ok) throw new Error("Failed to start simulation");
  return res.json();
}

export async function pauseSimulation(): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/pause`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to pause simulation");
  return res.json();
}

export async function resumeSimulation(): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/resume`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to resume simulation");
  return res.json();
}

export async function resetSimulation(presetId?: string): Promise<CSTRState> {
  const url = presetId
    ? `${API_BASE}/simulation/reset?preset_id=${encodeURIComponent(presetId)}`
    : `${API_BASE}/simulation/reset`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset simulation");
  return res.json();
}

export async function stepSimulation(numSteps: number = 1): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ num_steps: numSteps }),
  });
  if (!res.ok) throw new Error("Failed to step simulation");
  return res.json();
}

export async function injectCoolingDisturbance(floss: number = 0.82): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/disturb/cooling`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ floss }),
  });
  if (!res.ok) throw new Error("Failed to inject cooling disturbance");
  return res.json();
}

export async function injectFeedTempDisturbance(deltaTf: number = 15.0): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/disturb/feed_temp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta_Tf: deltaTf }),
  });
  if (!res.ok) throw new Error("Failed to inject feed temperature disturbance");
  return res.json();
}

export async function restoreCooling(): Promise<any> {
  const res = await fetch(`${API_BASE}/simulation/disturb/restore_cooling`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to restore cooling");
  return res.json();
}

export async function fetchPresets(): Promise<PresetInfo[]> {
  const res = await fetch(`${API_BASE}/simulation/presets`);
  if (!res.ok) throw new Error("Failed to fetch presets");
  return res.json();
}

export async function selectPreset(presetId: string): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/preset/${encodeURIComponent(presetId)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to select preset");
  return res.json();
}

export async function updateSettings(settings: Record<string, any>): Promise<CSTRState> {
  const res = await fetch(`${API_BASE}/simulation/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function fetchEvaluation(): Promise<{ status: string; data?: EvaluationReport }> {
  const res = await fetch(`${API_BASE}/evaluation`);
  if (!res.ok) throw new Error("Failed to fetch evaluation");
  return res.json();
}

export async function fetchModelInfo(): Promise<{ status: string; data?: ModelMetadata }> {
  const res = await fetch(`${API_BASE}/model/info`);
  if (!res.ok) throw new Error("Failed to fetch model info");
  return res.json();
}

export async function triggerRetrain(): Promise<any> {
  const res = await fetch(`${API_BASE}/model/retrain`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to trigger retrain");
  return res.json();
}
