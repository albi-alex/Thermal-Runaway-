"""Unit tests for CSTR physics equations and explicit midpoint RK2 integration."""

import math
import numpy as np
import pytest
from app.physics import (
    CSTRParameters,
    reaction_rate_constant,
    reaction_rate_derivative,
    heat_terms,
    derivatives,
    explicit_midpoint_step,
    jacobian,
    jacobian_eigenvalues,
)


def test_arrhenius_kinetics():
    A = 7.2e10
    E_over_R = 8750.0
    T = 305.0
    
    k = reaction_rate_constant(T, A, E_over_R)
    expected_k = A * math.exp(-E_over_R / T)
    assert pytest.approx(k, rel=1e-5) == expected_k
    assert k > 0.0
    
    # Derivative check
    dk_dT = reaction_rate_derivative(T, A, E_over_R)
    expected_dk_dT = k * E_over_R / (T ** 2)
    assert pytest.approx(dk_dT, rel=1e-5) == expected_dk_dT
    assert dk_dT > 0.0


def test_heat_terms_and_balances():
    params = CSTRParameters(
        A=7.2e10,
        E_over_R=8750.0,
        beta=200.0,
        tau=5.0,
        CAf=1.0,
        Tf=300.0,
        Tc=300.0,
        U0=1.1,
    )
    CA = 0.85
    T = 310.0
    
    q_flow, q_gen, q_rem, q_net = heat_terms(CA, T, params)
    
    assert q_flow == pytest.approx((params.Tf - T) / params.tau)
    k = reaction_rate_constant(T, params.A, params.E_over_R)
    assert q_gen == pytest.approx(params.beta * k * CA)
    assert q_rem == pytest.approx(params.U0 * (T - params.Tc))
    assert q_net == pytest.approx(q_gen - q_rem)
    
    # Check ODE derivatives match
    dCA_dt, dT_dt = derivatives(0.0, CA, T, params)
    assert dCA_dt == pytest.approx((params.CAf - CA) / params.tau - k * CA)
    assert dT_dt == pytest.approx(q_flow + q_net)


def test_explicit_midpoint_integration_step():
    params = CSTRParameters()
    dt = 0.1
    CA0 = 0.90
    T0 = 305.0
    
    CA1, T1 = explicit_midpoint_step(0.0, CA0, T0, dt, params)
    
    # Values should change smoothly and remain non-negative
    assert CA1 > 0.0
    assert T1 > 200.0
    assert isinstance(CA1, float)
    assert isinstance(T1, float)


def test_jacobian_and_stability():
    params = CSTRParameters()
    CA = 0.88
    T = 305.0
    
    J = jacobian(CA, T, params)
    assert J.shape == (2, 2)
    
    lam1, lam2, tr, det = jacobian_eigenvalues(CA, T, params)
    assert tr == pytest.approx(J[0, 0] + J[1, 1])
    assert det == pytest.approx(J[0, 0] * J[1, 1] - J[0, 1] * J[1, 0])
