import pytest
from fastapi.testclient import TestClient
import numpy as np
import shap
import joblib
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app

client = TestClient(app)

def get_auth_token(username, password):
    res = client.post("/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]

# --- TEST 1: MINISTRY OFFICER RBAC ISOLATION ---
def test_ministry_officer_cannot_fetch_other_ministry_project():
    """
    Asserts that a ministry_officer for 'Ministry of Civil Aviation' cannot fetch
    a project belonging to 'Ministry of Railways' (returns 403 Forbidden).
    """
    token = get_auth_token("civil_aviation_officer", "officer123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Fetch civil aviation officer's own projects
    res_my = client.get("/projects", headers=headers)
    assert res_my.status_code == 200
    my_projects = res_my.json()["data"]
    assert len(my_projects) > 0
    my_pid = my_projects[0]["id"]
    
    # Verify own project fetch succeeds
    res_own = client.get(f"/projects/{my_pid}", headers=headers)
    assert res_own.status_code == 200
    
    # 2. Find a Railways project using admin token
    admin_token = get_auth_token("admin_user", "admin123")
    res_railways = client.get("/projects?search=Railways", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_railways.status_code == 200
    railways_projects = res_railways.json()["data"]
    
    railways_pid = None
    for p in railways_projects:
        if p["line_ministry"] == "Ministry of Railways":
            railways_pid = p["id"]
            break
            
    assert railways_pid is not None, "Railways project should exist in database"
    
    # 3. Ministry officer attempts to fetch Railways project -> MUST RETURN 403 FORBIDDEN
    res_forbidden = client.get(f"/projects/{railways_pid}", headers=headers)
    assert res_forbidden.status_code == 403
    assert "Access denied" in res_forbidden.json()["detail"]

# --- TEST 2: LOCKED FIELD / UNAPPROVED LEVER RETURNS 422 ---
def test_whatif_locked_field_returns_422():
    """
    Asserts that passing an unapproved or locked field (e.g., 'unapproved_lever', 'schedule_slip_months')
    in a What-If request returns HTTP 422 Unprocessable Entity due to strict Pydantic extra='forbid'.
    """
    token = get_auth_token("analyst_user", "analyst123")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get a valid project ID
    res_proj = client.get("/projects", headers=headers)
    pid = res_proj.json()["data"][0]["id"]
    
    # Case A: Valid what-if request succeeds
    valid_payload = {"execution_velocity": 3.5, "monsoon_overlap": 1.0}
    res_valid = client.post(f"/projects/{pid}/whatif", json=valid_payload, headers=headers)
    assert res_valid.status_code == 200
    assert res_valid.json()["disclaimer"] == "model-implied"
    
    # Case B: Locked/unapproved lever 'unapproved_lever' -> MUST RETURN 422
    invalid_payload_1 = {"execution_velocity": 3.5, "unapproved_lever": 100.0}
    res_invalid_1 = client.post(f"/projects/{pid}/whatif", json=invalid_payload_1, headers=headers)
    assert res_invalid_1.status_code == 422
    
    # Case C: Locked feature 'schedule_slip_months' -> MUST RETURN 422
    invalid_payload_2 = {"execution_velocity": 3.5, "schedule_slip_months": 5.0}
    res_invalid_2 = client.post(f"/projects/{pid}/whatif", json=invalid_payload_2, headers=headers)
    assert res_invalid_2.status_code == 422

# --- TEST 3: SHAP ADDITIVITY HOLDS ---
def test_shap_additivity_holds():
    """
    Asserts SHAP additivity: base_value + sum(shap_values) == raw model prediction margin.
    """
    model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
    xgb_model = joblib.load(os.path.join(model_dir, "xgb_model.joblib"))
    lgb_model = joblib.load(os.path.join(model_dir, "lgb_model.joblib"))
    feature_cols = joblib.load(os.path.join(model_dir, "feature_cols.joblib"))
    
    # Sample synthetic test row matching feature schema
    sample_data = np.random.rand(5, len(feature_cols))
    
    # XGBoost TreeExplainer Additivity
    explainer_xgb = shap.TreeExplainer(xgb_model)
    shap_vals_xgb = explainer_xgb(sample_data)
    xgb_raw_preds = xgb_model.predict(sample_data, output_margin=True)
    xgb_shap_sums = shap_vals_xgb.values.sum(axis=1) + explainer_xgb.expected_value
    assert np.allclose(xgb_raw_preds, xgb_shap_sums, atol=1e-4), "XGBoost SHAP additivity failed"
    
    # LightGBM TreeExplainer Additivity
    explainer_lgb = shap.TreeExplainer(lgb_model)
    shap_vals_lgb = explainer_lgb(sample_data)
    lgb_raw_preds = lgb_model.predict(sample_data, raw_score=True)
    lgb_shap_sums = shap_vals_lgb.values.sum(axis=1) + explainer_lgb.expected_value
    assert np.allclose(lgb_raw_preds, lgb_shap_sums, atol=1e-4), "LightGBM SHAP additivity failed"

# --- ADDITIONAL API COMPLIANCE TESTS ---
def test_phase_cascade_bottleneck_diagnosis_format():
    token = get_auth_token("analyst_user", "analyst123")
    headers = {"Authorization": f"Bearer {token}"}
    
    res_proj = client.get("/projects", headers=headers)
    pid = res_proj.json()["data"][0]["id"]
    
    res_diag = client.get(f"/projects/{pid}/diagnosis", headers=headers)
    assert res_diag.status_code == 200
    diag = res_diag.json()
    
    assert "phase_cascade_bottleneck_diagnosis" in diag
    assert diag["phase_cascade_bottleneck_diagnosis"]["diagnosis_type"] == "phase_cascade_bottleneck_diagnosis"
    assert "domino" not in str(diag).lower()
    assert "dependency graph" not in str(diag).lower()

def test_ranked_interventions_disclaimer():
    token = get_auth_token("analyst_user", "analyst123")
    headers = {"Authorization": f"Bearer {token}"}
    
    res_proj = client.get("/projects", headers=headers)
    pid = res_proj.json()["data"][0]["id"]
    
    res_interv = client.get(f"/projects/{pid}/interventions/ranked", headers=headers)
    assert res_interv.status_code == 200
    data = res_interv.json()
    assert data["disclaimer"] == "model-implied"
    assert len(data["ranked_interventions"]) > 0
