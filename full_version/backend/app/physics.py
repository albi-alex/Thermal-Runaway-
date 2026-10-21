"""Physics engine for Continuous Stirred-Tank Reactor (CSTR).

Implements species balance, energy balance, Arrhenius kinetics, heat generation/removal
terms, local Jacobian stability analysis, and the explicit midpoint (RK2) numerical integration
method as specified in the faculty CSTR Thermal Runaway notes.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Callable, Optional, Tuple
import numpy as np


@dataclass
class CSTRParameters:
    """Nominal and physical parameters for the exothermic CSTR."""
    # Arrhenius kinetics
    A: float = 7.2e10           # Pre-exponential factor [min^-1]
    E_over_R: float = 8750.0    # Activation temperature E/R [K]
    
    # Thermal and reaction properties
    beta: float = 200.0         # Heat of reaction factor -Delta_H / (rho * Cp) [K m^3 / kmol]
    tau: float = 5.0            # Residence time V / Q [min]
    
    # Operating & feed conditions
    CAf: float = 1.0            # Feed reactant concentration [kmol / m^3]
    Tf: float = 300.0           # Feed temperature [K]
    Tc: float = 300.0           # Coolant temperature [K]
    
    # Cooling parameters
    U0: float = 1.1             # Initial cooling coefficient UA / (rho * Cp * V) [min^-1]
    
    # Safety thresholds
    T_critical: float = 390.0   # Critical runaway temperature [K]
    dT_hard_limit: float = 12.0 # Hard heating-rate physical alarm limit [K / min]


def reaction_rate_constant(T: float, A: float, E_over_R: float) -> float:
    """Calculate Arrhenius reaction rate constant k(T) = A * exp(-(E/R) / T).
    
    Units: min^-1.
    Guards against zero or negative temperature values.
    """
    if T <= 0.0:
        return 0.0
    return float(A * math.exp(-E_over_R / T))


def reaction_rate_derivative(T: float, A: float, E_over_R: float) -> float:
    """Analytical derivative dk/dT = k(T) * (E/R) / T^2.
    
    Units: min^-1 K^-1.
    """
    if T <= 0.0:
        return 0.0
    k = reaction_rate_constant(T, A, E_over_R)
    return float(k * E_over_R / (T ** 2))


def heat_terms(
    CA: float,
    T: float,
    params: CSTRParameters,
    U_val: Optional[float] = None,
    Tf_val: Optional[float] = None,
    Tc_val: Optional[float] = None,
) -> Tuple[float, float, float, float]:
    """Calculate flow, heat generation, heat removal, and net thermal drive terms.
    
    All terms are in units of K min^-1:
      q_flow = (Tf - T) / tau
      q_gen  = beta * k(T) * CA
      q_rem  = U * (T - Tc)
      q_net  = q_gen - q_rem
      dT_dt  = q_flow + q_net
      
    Returns:
      (q_flow, q_gen, q_rem, q_net)
    """
    U = params.U0 if U_val is None else U_val
    Tf = params.Tf if Tf_val is None else Tf_val
    Tc = params.Tc if Tc_val is None else Tc_val
    k = reaction_rate_constant(T, params.A, params.E_over_R)
    
    q_flow = (Tf - T) / params.tau
    q_gen = params.beta * k * CA
    q_rem = U * (T - Tc)
    q_net = q_gen - q_rem
    
    return q_flow, q_gen, q_rem, q_net


def derivatives(
    t: float,
    CA: float,
    T: float,
    params: CSTRParameters,
    U_val: Optional[float] = None,
    Tf_val: Optional[float] = None,
    Tc_val: Optional[float] = None,
) -> Tuple[float, float]:
    """Compute state derivatives dCA/dt and dT/dt.
    
    Species balance:
      dCA/dt = (CAf - CA)/tau - k(T) * CA
      
    Energy balance:
      dT/dt = (Tf - T)/tau + beta * k(T) * CA - U * (T - Tc)
      
    Returns:
      (dCA_dt [kmol m^-3 min^-1], dT_dt [K min^-1])
    """
    U = params.U0 if U_val is None else U_val
    Tf = params.Tf if Tf_val is None else Tf_val
    Tc = params.Tc if Tc_val is None else Tc_val
    k = reaction_rate_constant(T, params.A, params.E_over_R)
    
    dCA_dt = (params.CAf - CA) / params.tau - k * CA
    dT_dt = (Tf - T) / params.tau + params.beta * k * CA - U * (T - Tc)
    
    return dCA_dt, dT_dt


def explicit_midpoint_step(
    t: float,
    CA: float,
    T: float,
    dt: float,
    params: CSTRParameters,
    U_func: Optional[Callable[[float], float]] = None,
    Tf_func: Optional[Callable[[float], float]] = None,
) -> Tuple[float, float]:
    """Perform one step using the explicit midpoint integration method (RK2).
    
    As defined in Section 9.2 of the faculty notes:
      k1 = f(t_n, x_n)
      x_{mid} = x_n + (dt / 2) * k1
      k2 = f(t_n + dt / 2, x_{mid})
      x_{n+1} = x_n + dt * k2
      
    Includes adaptive internal sub-stepping for numerical stiffness stability
    when high reaction rates k(T) occur during thermal runaway, keeping the
    numerical scheme bounded and physically authentic (CA >= 0, 100 <= T <= 600 K).
    """
    U_curr = U_func(t) if U_func is not None else params.U0
    k_curr = reaction_rate_constant(T, params.A, params.E_over_R)
    char_rate = max(1.0, k_curr + 1.0 / params.tau + U_curr)
    
    # Adaptive sub-step count based on stiffness timescale (RK2 stability threshold: char_rate * sub_dt <= 0.08)
    n_sub = max(1, min(250, int(math.ceil(char_rate * dt / 0.08))))
    sub_dt = dt / n_sub
    
    c_curr = float(CA)
    t_curr = float(T)
    t_clock = float(t)
    
    for _ in range(n_sub):
        u_step = U_func(t_clock) if U_func is not None else params.U0
        tf_step = Tf_func(t_clock) if Tf_func is not None else params.Tf
        
        # 1. Slope at beginning of sub-step
        k1_C, k1_T = derivatives(t_clock, c_curr, t_curr, params, U_val=u_step, Tf_val=tf_step)
        
        # 2. State at midpoint
        t_mid = t_clock + 0.5 * sub_dt
        k_step = reaction_rate_constant(t_curr, params.A, params.E_over_R)
        decay_1 = 1.0 / params.tau + k_step
        if decay_1 * sub_dt > 0.1:
            c_star_1 = (params.CAf / params.tau) / decay_1
            c_mid = c_star_1 + (c_curr - c_star_1) * math.exp(-0.5 * decay_1 * sub_dt)
        else:
            c_mid = max(1e-9, c_curr + 0.5 * sub_dt * k1_C)
        t_mid_val = max(100.0, min(600.0, t_curr + 0.5 * sub_dt * k1_T))
        
        u_mid = U_func(t_mid) if U_func is not None else params.U0
        tf_mid = Tf_func(t_mid) if Tf_func is not None else params.Tf
        
        # 3. Slope at midpoint
        k2_C, k2_T = derivatives(t_mid, c_mid, t_mid_val, params, U_val=u_mid, Tf_val=tf_mid)
        
        # 4. Advance full sub-step
        k_mid = reaction_rate_constant(t_mid_val, params.A, params.E_over_R)
        decay_2 = 1.0 / params.tau + k_mid
        if decay_2 * sub_dt > 0.1:
            c_star_2 = (params.CAf / params.tau) / decay_2
            c_curr = c_star_2 + (c_curr - c_star_2) * math.exp(-decay_2 * sub_dt)
        else:
            c_curr = max(1e-9, c_curr + sub_dt * k2_C)
        t_curr = max(100.0, min(600.0, t_curr + sub_dt * k2_T))
        t_clock += sub_dt
        
    return c_curr, t_curr


def jacobian(
    CA: float,
    T: float,
    params: CSTRParameters,
    U_val: Optional[float] = None,
) -> np.ndarray:
    """Calculate the 2x2 analytical Jacobian matrix J for the CSTR ODEs.
    
    From Eq. (62) of the faculty notes:
      J_11 = -1/tau - k(T)
      J_12 = -CA * k'(T)
      J_21 = beta * k(T)
      J_22 = -1/tau + beta * CA * k'(T) - U
    """
    U = params.U0 if U_val is None else U_val
    k = reaction_rate_constant(T, params.A, params.E_over_R)
    dk_dT = reaction_rate_derivative(T, params.A, params.E_over_R)
    
    J11 = -1.0 / params.tau - k
    J12 = -CA * dk_dT
    J21 = params.beta * k
    J22 = -1.0 / params.tau + params.beta * CA * dk_dT - U
    
    return np.array([[J11, J12], [J21, J22]], dtype=float)


def jacobian_eigenvalues(
    CA: float,
    T: float,
    params: CSTRParameters,
    U_val: Optional[float] = None,
) -> Tuple[complex, complex, float, float]:
    """Calculate eigenvalues, trace, and determinant of the Jacobian.
    
    Returns:
      (lambda_1, lambda_2, trace, determinant)
    """
    J = jacobian(CA, T, params, U_val=U_val)
    tr = float(np.trace(J))
    det = float(np.linalg.det(J))
    eigvals = np.linalg.eigvals(J)
    return complex(eigvals[0]), complex(eigvals[1]), tr, det
