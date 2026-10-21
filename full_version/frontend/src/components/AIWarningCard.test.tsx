import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AIWarningCard } from "./AIWarningCard";
import type { WarningAssessment } from "../types";

describe("AIWarningCard Component", () => {
  it("renders SAFE condition accurately", () => {
    const safeWarning: WarningAssessment = {
      rf_probability: 0.15,
      rf_category: "SAFE",
      rf_severity: 0,
      physics_category: "SAFE",
      physics_limit_triggered: false,
      physics_reason: null,
      hybrid_category: "SAFE",
      hybrid_severity: 0,
      current_temperature: 305.0,
      distance_to_critical: 85.0,
      prediction_horizon_min: 3.0,
      message: "Reactor operating within safe parameters.",
      action_recommendation: "Continue standard monitoring.",
    };

    render(<AIWarningCard warning={safeWarning} />);
    
    expect(screen.getByText("15%")).toBeDefined();
    expect(screen.getAllByText("SAFE").length).toBeGreaterThan(0);
    expect(screen.getByText("3-MIN HORIZON")).toBeDefined();
    expect(screen.getByText("85.0 K")).toBeDefined();
  });

  it("renders WARNING condition accurately", () => {
    const warningState: WarningAssessment = {
      rf_probability: 0.52,
      rf_category: "WARNING",
      rf_severity: 1,
      physics_category: "SAFE",
      physics_limit_triggered: false,
      physics_reason: null,
      hybrid_category: "WARNING",
      hybrid_severity: 1,
      current_temperature: 315.0,
      distance_to_critical: 75.0,
      prediction_horizon_min: 3.0,
      message: "EARLY WARNING — Increased risk of thermal runaway within next 3 minutes.",
      action_recommendation: "Verify coolant valve position.",
    };

    render(<AIWarningCard warning={warningState} />);
    
    expect(screen.getByText("52%")).toBeDefined();
    expect(screen.getAllByText("WARNING").length).toBeGreaterThan(0);
    expect(screen.getByText("EARLY WARNING")).toBeDefined();
  });

  it("renders CRITICAL condition and physics override", () => {
    const critWarning: WarningAssessment = {
      rf_probability: 0.88,
      rf_category: "CRITICAL",
      rf_severity: 2,
      physics_category: "CRITICAL",
      physics_limit_triggered: true,
      physics_reason: "Reactor temperature reached 392 K.",
      hybrid_category: "CRITICAL",
      hybrid_severity: 2,
      current_temperature: 392.0,
      distance_to_critical: -2.0,
      prediction_horizon_min: 3.0,
      message: "EMERGENCY RUNAWAY — Reactor temperature crossed critical limit!",
      action_recommendation: "Trigger emergency shutdown.",
    };

    render(<AIWarningCard warning={critWarning} />);
    
    expect(screen.getByText("88%")).toBeDefined();
    expect(screen.getAllByText("CRITICAL").length).toBeGreaterThan(0);
    expect(screen.getByText(/Reactor temperature reached 392 K/)).toBeDefined();
  });
});
