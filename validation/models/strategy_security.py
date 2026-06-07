from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import Field

from .common import ApprovedException, Formatting, StrictModel


class Scope(StrictModel):
    level: str
    compliance_frameworks_required_by_default: bool


class RuntimeTopology(StrictModel):
    public: List[str]
    internal: List[str]
    privileged_local: Optional[List[str]] = None
    constraints: Optional[List[str]] = None


class BoundaryRule(StrictModel):
    reachable_components: Optional[List[str]] = None
    allowed_paths: Optional[List[str]] = None
    maintenance_execution: Optional[List[str]] = None
    constraints: List[str]


class TrustBoundaries(StrictModel):
    public_boundary: BoundaryRule
    private_service_boundary: BoundaryRule
    privileged_local_boundary: BoundaryRule


class AuthenticationAccessModel(StrictModel):
    authentication_type: str
    token_storage: str
    required_access_paths: List[str]
    constraints: List[str]


class TokenModel(StrictModel):
    required_token_purposes: List[str]
    constraints: List[str]


class SecurityDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["security"]
    formatting: Formatting
    scope: Scope
    runtime_topology: RuntimeTopology
    trust_boundaries: TrustBoundaries
    approved_exceptions: Optional[List[ApprovedException]] = None
    authentication_access_model: AuthenticationAccessModel
    token_model: TokenModel
    secret_handling_rules: List[str]
    service_exposure_rules: Dict[str, str]
    security_invariants: List[str]
    review_security_focus: List[str]
    out_of_scope_by_default: List[str]
