from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import Formatting, StrictModel


class Status(StrictModel):
    lifecycle: str
    owner: str
    applies_to: List[str]


class ArchitectureIntent(StrictModel):
    goals: List[str]


class RuntimeTopology(StrictModel):
    public: List[str]
    internal: List[str]
    constraints: List[str]


class Contract(StrictModel):
    canonical_contract: str
    development_model: str


class TechnologyBaseline(StrictModel):
    languages: List[str]
    frontend: List[str]
    backend: List[str]
    data: List[str]
    contract: Contract
    infrastructure: List[str]


class RuleSet(StrictModel):
    forbidden: List[str]
    required: List[str]


class AccessModel(StrictModel):
    auth_direction: str
    expected_access_paths: List[str]
    constraints: List[str]


class TestingBaseline(StrictModel):
    unit_and_integration: List[str]
    end_to_end: List[str]
    strategy_constraints: List[str]


class VersionPolicy(StrictModel):
    rules: List[str]


class AgentUsageRules(StrictModel):
    must: List[str]
    may_skip_for: List[str]


class TechStackDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["tech_stack"]
    formatting: Formatting
    status: Status
    architecture_intent: ArchitectureIntent
    runtime_topology: RuntimeTopology
    technology_baseline: TechnologyBaseline
    hard_constraints: RuleSet
    access_model: AccessModel
    testing_baseline: TestingBaseline
    version_policy: VersionPolicy
    agent_usage_rules: AgentUsageRules
