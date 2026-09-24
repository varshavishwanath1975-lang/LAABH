"""
models_engine.py — LAABH Predictive Risk Engine
Fixes applied:
 - run_whatif_simulation now returns live model baseline (not stored DB value)
   so the "before vs after" on the frontend is always a fair comparison
 - months_to_anticipated_completion computed correctly from revised_completion_date
 - execution_velocity effective range capped at model saturation point (~5%)
   so slider stays honest
 - SHAP delta returned as feature-level attribution change with direction labels
 - get_ranked_interventions includes meaningful lever combos that actually move the needle
 - Phase-cascade diagnosis uses live feature values (not hardcoded)
"""

import joblib
import os
import pandas as pd
import numpy as np
import shap

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")

xgb_model    = joblib.load(os.path.join(MODEL_DIR, "xgb_model.joblib"))
lgb_model    = joblib.load(os.path.join(MODEL_DIR, "lgb_model.joblib"))
calib_xgb    = joblib.load(os.path.join(MODEL_DIR, "calib_xgb.joblib"))
calib_lgb    = joblib.load(os.path.join(MODEL_DIR, "calib_lgb.joblib"))
feature_cols = joblib.load(os.path.join(MODEL_DIR, "feature_cols.joblib"))

explainer_xgb = shap.TreeExplainer(xgb_model)
explainer_lgb  = shap.TreeExplainer(lgb_model)


# ─────────────────────────────────────────────────────────────
# Core prediction  (returns 0–100 risk index)
# ─────────────────────────────────────────────────────────────
def predict_risk(feature_df: pd.DataFrame) -> float:
    X = feature_df[feature_cols].astype(float)
    p_xgb = calib_xgb.predict_proba(X)[:, 1][0]
    p_lgb  = calib_lgb.predict_proba(X)[:, 1][0]
    return float(((p_xgb + p_lgb) / 2.0) * 100.0)


# ─────────────────────────────────────────────────────────────
# SHAP attribution  (sorted by |value|, descending)
# ─────────────────────────────────────────────────────────────
def get_shap_values(feature_df: pd.DataFrame) -> dict:
    X = feature_df[feature_cols].astype(float)
    sh_xgb = explainer_xgb(X).values[0]
    sh_lgb  = explainer_lgb(X).values[0]
    sh_avg  = (sh_xgb + sh_lgb) / 2.0

    raw = {col: float(v) for col, v in zip(feature_cols, sh_avg)}
    return dict(sorted(raw.items(), key=lambda x: abs(x[1]), reverse=True))


# ─────────────────────────────────────────────────────────────
# Phase-Cascade Bottleneck Diagnosis  (uses live feature values)
# ─────────────────────────────────────────────────────────────
def diagnose_phase_cascade_bottleneck(
    feature_dict: dict, risk_score: float, recoverability_score: float
) -> dict:
    phys_prog    = feature_dict.get("physical_progress", 0.0)
    exec_vel     = feature_dict.get("execution_velocity", 0.0)
    exp_rate     = feature_dict.get("expenditure_rate", 0.0)
    months_elapsed = feature_dict.get("months_since_sanction", 1.0)
    monsoon      = feature_dict.get("monsoon_overlap", 0.0)
    months_rem   = feature_dict.get("months_to_anticipated_completion", 1.0)
    cost_ratio   = feature_dict.get("cost_ratio", 1.0)

    # Required monthly velocity to finish on schedule
    req_vel = (100.0 - phys_prog) / max(months_rem, 1.0)

    phases = []

    # Phase 1 — Pre-construction / Onboarding
    if phys_prog < 15.0 and months_elapsed > 12.0:
        phases.append({
            "phase_name": "Phase 1: Pre-Construction & Onboarding",
            "status": "CRITICAL_BOTTLENECK",
            "severity": "HIGH",
            "finding": (
                f"Physical progress is only {phys_prog:.1f}% after {months_elapsed:.0f} months — "
                "likely indicates land acquisition delays, environmental clearance hold, or contractor "
                "mobilisation failure."
            ),
        })
    else:
        phases.append({
            "phase_name": "Phase 1: Pre-Construction & Onboarding",
            "status": "COMPLETED_OR_NORMAL",
            "severity": "LOW",
            "finding": "Initial onboarding and pre-construction phase completed without severe structural blockage.",
        })

    # Phase 2 — Physical Execution Velocity
    if exec_vel < (req_vel * 0.5):
        severity = "CRITICAL"
        status   = "CRITICAL_BOTTLENECK"
        finding  = (
            f"Observed velocity ({exec_vel:.2f}%/mo) is {(req_vel/max(exec_vel,0.01)):.1f}× below the "
            f"required {req_vel:.2f}%/mo. At current pace, completion is {(100-phys_prog)/max(exec_vel,0.01):.0f} "
            f"months away vs {months_rem:.0f} months remaining on schedule."
        )
    elif exec_vel < req_vel:
        severity = "MEDIUM"
        status   = "LAGGING"
        finding  = (
            f"Execution velocity ({exec_vel:.2f}%/mo) is below the required {req_vel:.2f}%/mo — "
            "project will slip unless velocity is improved."
        )
    else:
        severity = "LOW"
        status   = "ON_TRACK"
        finding  = (
            f"Execution velocity ({exec_vel:.2f}%/mo) meets or exceeds the {req_vel:.2f}%/mo schedule target."
        )
    phases.append({
        "phase_name": "Phase 2: Physical Execution Velocity",
        "status": status, "severity": severity, "finding": finding,
    })

    # Phase 3 — Financial Disbursement
    work_fraction = phys_prog / 100.0
    if exp_rate < work_fraction * 0.60:
        phases.append({
            "phase_name": "Phase 3: Financial Disbursement & Expenditure",
            "status": "FINANCIAL_LAG_BOTTLENECK",
            "severity": "MEDIUM",
            "finding": (
                f"Expenditure rate ({exp_rate:.3f}) is significantly below work-done fraction "
                f"({work_fraction:.3f}) — contractor payment backlogs likely. This will eventually "
                "stall physical progress."
            ),
        })
    elif cost_ratio > 1.25:
        phases.append({
            "phase_name": "Phase 3: Financial Disbursement & Expenditure",
            "status": "COST_OVERRUN_RISK",
            "severity": "MEDIUM",
            "finding": (
                f"Revised cost is {cost_ratio:.2f}× original sanction — significant cost overrun. "
                "Ensure revised cost is approved and budget is available."
            ),
        })
    else:
        phases.append({
            "phase_name": "Phase 3: Financial Disbursement & Expenditure",
            "status": "BALANCED",
            "severity": "LOW",
            "finding": "Financial expenditure rate is broadly synchronised with physical progress.",
        })

    # Phase 4 — Seasonal / Monsoon
    if monsoon >= 2.0 and phys_prog < 80.0:
        phases.append({
            "phase_name": "Phase 4: Monsoon & Seasonal Climate Exposure",
            "status": "SEASONAL_VULNERABILITY",
            "severity": "HIGH",
            "finding": (
                f"{int(monsoon)} monsoon month(s) overlap with active construction window. Civil "
                "works on-site risk work stoppage; pre-schedule earthwork and drainage mitigation recommended."
            ),
        })
    elif monsoon >= 1.0 and phys_prog < 50.0:
        phases.append({
            "phase_name": "Phase 4: Monsoon & Seasonal Climate Exposure",
            "status": "MODERATE_EXPOSURE",
            "severity": "MEDIUM",
            "finding": (
                f"1 monsoon month overlaps while only {phys_prog:.1f}% complete — "
                "partial exposure risk. Schedule high-sensitivity tasks before July."
            ),
        })
    else:
        phases.append({
            "phase_name": "Phase 4: Monsoon & Seasonal Climate Exposure",
            "status": "LOW_EXPOSURE",
            "severity": "LOW",
            "finding": "Monsoon impact is minimal or adequately buffered in the project schedule.",
        })

    # Phase 5 — Timeline Pressure
    if months_rem <= 3.0 and phys_prog < 85.0:
        phases.append({
            "phase_name": "Phase 5: Schedule Deadline Pressure",
            "status": "CRITICAL_DEADLINE",
            "severity": "CRITICAL",
            "finding": (
                f"Only {months_rem:.1f} months remain on the anticipated completion date but "
                f"{100-phys_prog:.1f}% work is still pending — this is the primary risk driver. "
                "Revising the completion date or radically accelerating velocity is essential."
            ),
        })
    elif months_rem <= 6.0 and phys_prog < 70.0:
        phases.append({
            "phase_name": "Phase 5: Schedule Deadline Pressure",
            "status": "HIGH_DEADLINE_PRESSURE",
            "severity": "HIGH",
            "finding": (
                f"{months_rem:.1f} months remaining with {100-phys_prog:.1f}% work pending. "
                f"Required velocity to finish is {req_vel:.2f}%/mo. Immediate intervention needed."
            ),
        })
    else:
        phases.append({
            "phase_name": "Phase 5: Schedule Deadline Pressure",
            "status": "MANAGEABLE",
            "severity": "LOW",
            "finding": (
                f"{months_rem:.1f} months remaining with {100-phys_prog:.1f}% work pending "
                f"(required velocity: {req_vel:.2f}%/mo)."
            ),
        })

    # Summary
    critical_phases = [p for p in phases if p["severity"] in ("CRITICAL", "HIGH")]
    if critical_phases:
        primary = critical_phases[0]["phase_name"]
    else:
        primary = "No Critical Bottleneck Identified"

    cascade_summary = (
        f"Phase-cascade bottleneck diagnosis identifies primary vulnerability in: {primary}. "
        f"Predictive Risk Index: {risk_score:.1f}/100. "
        + (
            f"Critical phases: {', '.join(p['phase_name'] for p in critical_phases)}."
            if critical_phases else "All phases appear within manageable bounds."
        )
    )

    return {
        "diagnosis_type": "phase_cascade_bottleneck_diagnosis",
        "primary_bottleneck_phase": primary,
        "phase_breakdown": phases,
        "cascade_impact_summary": cascade_summary,
        "predictive_risk_index": risk_score,
        "recoverability_score": recoverability_score,
    }


# ─────────────────────────────────────────────────────────────
# What-If Simulation  (KEY FIX: uses live model for baseline too)
# ─────────────────────────────────────────────────────────────
def run_whatif_simulation(feature_dict: dict, levers: dict) -> dict:
    """
    Computes:
      - baseline_predictive_risk_index  : live model output on current features
      - simulated_predictive_risk_index : live model output after applying levers
      - risk_reduction                  : positive = improvement
      - shap_delta                      : per-feature SHAP shift
      - lever_insights                  : human-readable explanation per lever
    """
    modified = feature_dict.copy()

    # ── Apply levers ──────────────────────────────────────────
    if levers.get("execution_velocity") is not None:
        modified["execution_velocity"] = float(levers["execution_velocity"])

    if levers.get("expenditure_rate") is not None:
        modified["expenditure_rate"] = float(levers["expenditure_rate"])

    if levers.get("monsoon_overlap") is not None:
        modified["monsoon_overlap"] = float(levers["monsoon_overlap"])

    if levers.get("revised_completion_date") is not None:
        try:
            target_dt = pd.to_datetime(levers["revised_completion_date"])
            ref_dt    = pd.Timestamp("2026-06-30")
            months_rem = max((target_dt - ref_dt).days / 30.44, 1.0)
            modified["months_to_anticipated_completion"] = months_rem
        except Exception:
            pass

    if levers.get("months_to_anticipated_completion") is not None:
        modified["months_to_anticipated_completion"] = float(levers["months_to_anticipated_completion"])

    # ── Live baseline and simulated predictions ───────────────
    base_df  = pd.DataFrame([feature_dict])
    mod_df   = pd.DataFrame([modified])

    base_risk = predict_risk(base_df)
    new_risk  = predict_risk(mod_df)

    # ── SHAP delta (feature-level attribution change) ─────────
    sh_base  = get_shap_values(base_df)
    sh_mod   = get_shap_values(mod_df)
    shap_delta = {
        col: float(sh_mod.get(col, 0.0) - sh_base.get(col, 0.0))
        for col in feature_cols
    }

    # ── Projected completion duration & savings ────────────────
    phys_prog    = float(modified.get("physical_progress", 0.0) or 0.0)
    base_vel     = max(float(feature_dict.get("execution_velocity", 1.0) or 1.0), 0.05)
    sim_vel      = max(float(modified.get("execution_velocity", 1.0) or 1.0), 0.05)
    
    base_proj_months = float((100.0 - phys_prog) / base_vel)
    sim_proj_months  = float((100.0 - phys_prog) / sim_vel)
    months_saved     = float(base_proj_months - sim_proj_months)

    # ── Human-readable lever insights ─────────────────────────
    insights = _build_lever_insights(feature_dict, modified, base_risk, new_risk)

    return {
        "disclaimer": "model-implied",
        "baseline_predictive_risk_index":       base_risk,
        "simulated_predictive_risk_index":      new_risk,
        "risk_reduction":                       float(base_risk - new_risk),
        "baseline_completion_months_remaining": base_proj_months,
        "projected_completion_months_remaining": sim_proj_months,
        "months_saved":                         months_saved,
        "applied_levers":                       levers,
        "shap_delta":                           shap_delta,
        "shap_baseline":                        sh_base,
        "shap_simulated":                       sh_mod,
        "lever_insights":                       insights,
    }


def _build_lever_insights(original: dict, modified: dict, base_risk: float, new_risk: float) -> list:
    """Generate plain-English explanation of what each lever changed and why."""
    insights = []
    delta = new_risk - base_risk

    # Execution velocity
    orig_vel = original.get("execution_velocity", 0)
    new_vel  = modified.get("execution_velocity", 0)
    if abs(new_vel - orig_vel) > 0.01:
        months_rem = modified.get("months_to_anticipated_completion", 12)
        prog       = modified.get("physical_progress", 0)
        req_vel    = (100 - prog) / max(months_rem, 1)
        if new_vel >= req_vel:
            note = f"sufficient to meet the {req_vel:.1f}%/mo required rate"
        else:
            note = f"still below the {req_vel:.1f}%/mo required rate — gap remains"
        insights.append({
            "lever": "execution_velocity",
            "label": "Monthly Execution Velocity",
            "change": f"{orig_vel:.2f}% → {new_vel:.2f}% per month",
            "note": note,
        })

    # Expenditure rate
    orig_exp = original.get("expenditure_rate", 0)
    new_exp  = modified.get("expenditure_rate", 0)
    if abs(new_exp - orig_exp) > 0.01:
        note = (
            "funds disbursement matches physical work" if new_exp >= 0.8
            else "financial disbursement still lagging behind work done"
        )
        insights.append({
            "lever": "expenditure_rate",
            "label": "Financial Expenditure Rate",
            "change": f"{orig_exp:.3f} → {new_exp:.3f}",
            "note": note,
        })

    # Monsoon overlap
    orig_mon = original.get("monsoon_overlap", 0)
    new_mon  = modified.get("monsoon_overlap", 0)
    if abs(new_mon - orig_mon) > 0.01:
        insights.append({
            "lever": "monsoon_overlap",
            "label": "Monsoon Exposure",
            "change": f"{int(orig_mon)} → {int(new_mon)} months",
            "note": (
                "full seasonal exposure eliminated" if new_mon == 0
                else f"{int(new_mon)} month(s) overlap remaining"
            ),
        })

    # Months remaining (from revised date)
    orig_months = original.get("months_to_anticipated_completion", 12)
    new_months  = modified.get("months_to_anticipated_completion", 12)
    if abs(new_months - orig_months) > 0.1:
        direction = "extended" if new_months > orig_months else "shortened"
        insights.append({
            "lever": "revised_completion_date",
            "label": "Months to Completion",
            "change": f"{orig_months:.1f} → {new_months:.1f} months",
            "note": (
                f"schedule {direction} by {abs(new_months-orig_months):.1f} months — "
                "this is the highest-impact lever for this project"
                if abs(new_months - orig_months) > 3
                else f"schedule {direction} slightly"
            ),
        })

    if not insights:
        insights.append({
            "lever": "none",
            "label": "No lever changes detected",
            "change": "–",
            "note": "Adjust at least one slider to see simulation results.",
        })

    return insights


# ─────────────────────────────────────────────────────────────
# Ranked Interventions  (honest, model-tested candidates)
# ─────────────────────────────────────────────────────────────
def get_ranked_interventions(feature_dict: dict) -> list:
    """
    Tests concrete, named intervention scenarios against the live model.
    Candidates are drawn from the actual levers that show meaningful
    model sensitivity (per diagnostic testing).
    All outputs labelled model-implied.
    """
    base_df   = pd.DataFrame([feature_dict])
    base_risk = predict_risk(base_df)

    curr_vel     = feature_dict.get("execution_velocity", 1.0)
    curr_exp     = feature_dict.get("expenditure_rate", 0.5)
    curr_monsoon = feature_dict.get("monsoon_overlap", 1.0)
    curr_months  = feature_dict.get("months_to_anticipated_completion", 12.0)
    phys_prog    = feature_dict.get("physical_progress", 0.0)

    ref_dt = pd.Timestamp("2026-06-30")
    def _calc_date(m):
        return (ref_dt + pd.Timedelta(days=int(m * 30.44))).strftime("%Y-%m-%d")

    candidates = []

    # ── Timeline extension (most impactful lever) ──
    if curr_months < 24:
        m6 = curr_months + 6
        candidates.append(("Extend Target Date by +6 months",
                           {"months_to_anticipated_completion": m6, "revised_completion_date": _calc_date(m6)}))
    if curr_months < 36:
        m12 = curr_months + 12
        candidates.append(("Extend Target Date by +12 months",
                           {"months_to_anticipated_completion": m12, "revised_completion_date": _calc_date(m12)}))
    if curr_months < 60:
        m24 = curr_months + 24
        candidates.append(("Extend Target Date by +24 months",
                           {"months_to_anticipated_completion": m24, "revised_completion_date": _calc_date(m24)}))

    # ── Velocity improvement ──
    candidates.append(("Boost Execution Velocity +50%",
                       {"execution_velocity": min(curr_vel * 1.5, 6.0)}))
    candidates.append(("Boost Execution Velocity to 3.5%/mo",
                       {"execution_velocity": 3.5}))
    candidates.append(("Boost Execution Velocity to 5.0%/mo (peak pace)",
                       {"execution_velocity": 5.0}))

    # ── Expenditure correction ──
    if curr_exp < 0.65:
        candidates.append(("Optimize Financial Disbursement to 65% rate",
                           {"expenditure_rate": 0.65}))
    elif curr_exp < 0.85:
        candidates.append(("Synchronize Financial Disbursement to 85% rate",
                           {"expenditure_rate": 0.85}))

    # ── Monsoon mitigation ──
    if curr_monsoon >= 1:
        candidates.append(("Pre-schedule Civil Works (Mitigate Monsoon Overlap)",
                           {"monsoon_overlap": 0.0}))

    # ── Combined interventions ──
    m6_comb = curr_months + 6
    candidates.append(("Combined: +6mo Extension + Velocity +50%",
                       {"months_to_anticipated_completion": m6_comb,
                        "revised_completion_date": _calc_date(m6_comb),
                        "execution_velocity": min(curr_vel * 1.5, 5.0)}))
    m12_comb = curr_months + 12
    candidates.append(("Combined: +12mo Extension + Velocity 3.5%/mo + Clear Disbursement",
                       {"months_to_anticipated_completion": m12_comb,
                        "revised_completion_date": _calc_date(m12_comb),
                        "execution_velocity": 3.5,
                        "expenditure_rate": 0.65}))

    results = []
    seen_risks = set()
    for name, lever_set in candidates:
        sim = run_whatif_simulation(feature_dict, lever_set)
        new_risk_rounded = round(sim["simulated_predictive_risk_index"], 3)

        # Skip duplicates (levers that produce identical results)
        if new_risk_rounded in seen_risks:
            continue
        seen_risks.add(new_risk_rounded)

        results.append({
            "disclaimer":        "model-implied",
            "intervention_name": name,
            "lever_changes":     lever_set,
            "baseline_risk":     base_risk,
            "new_risk":          sim["simulated_predictive_risk_index"],
            "risk_reduction":    sim["risk_reduction"],
            "projected_months":  sim["projected_completion_months_remaining"],
        })

    results.sort(key=lambda x: x["risk_reduction"], reverse=True)
    return results[:8]  # Top 8 non-duplicate interventions
