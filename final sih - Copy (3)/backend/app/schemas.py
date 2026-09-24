from pydantic import BaseModel, Field, ConfigDict, model_validator, Extra
from typing import Optional, Dict, Any, List

class LoginRequest(BaseModel):
    username: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = Field(..., description="admin, ministry_officer, agency_pm, analyst, viewer")
    ministry: Optional[str] = None
    agency: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    ministry: Optional[str] = None
    agency: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

ALLOWED_WHATIF_LEVERS = {
    "execution_velocity",
    "expenditure_rate",
    "revised_completion_date",
    "months_to_anticipated_completion",
    "monsoon_overlap"
}

class WhatIfRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')  # Rejects any unapproved lever with 422!
    
    execution_velocity: Optional[float] = Field(None, ge=0.0, le=50.0)
    expenditure_rate: Optional[float] = Field(None, ge=0.0, le=5.0)
    revised_completion_date: Optional[str] = None
    months_to_anticipated_completion: Optional[float] = Field(None, ge=0.1, le=120.0)
    monsoon_overlap: Optional[float] = Field(None, ge=0.0, le=3.0)

class ScenarioCreate(BaseModel):
    project_id: int
    scenario_name: str
    input_levers: Dict[str, Any]
    result: Dict[str, Any]

class ExportRequest(BaseModel):
    format: str = "csv"
    project_ids: Optional[List[int]] = None
