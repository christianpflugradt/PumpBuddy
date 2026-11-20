from __future__ import annotations

from .design_api_contract import ApiContractDoc
from .design_domain_model import DomainModelDoc
from .design_glossary import GlossaryDoc
from .design_workout_insights_capabilities import WorkoutInsightsCapabilitiesDoc
from .design_workout_insights_use_cases import WorkoutInsightsUseCasesDoc
from .design_workout_insights_use_cases_to_domain_model import (
    WorkoutInsightsUseCasesToDomainModelDoc,
)
from .design_persistence_model import PersistenceModelDoc
from .design_workout_capabilities import WorkoutCapabilitiesDoc
from .design_workout_use_cases import WorkoutUseCasesDoc
from .design_workout_use_cases_to_domain_model import WorkoutUseCasesToDomainModelDoc
from .strategy_engineering_guardrails import EngineeringGuardrailsDoc
from .strategy_quality_gates import QualityGatesDoc
from .strategy_commit_policy import CommitPolicyDoc
from .strategy_security import SecurityDoc
from .strategy_tech_stack import TechStackDoc
from .strategy_test_strategy import TestStrategyDoc

MODEL_REGISTRY = {
    "agent/design/api-contract.yaml": ApiContractDoc,
    "agent/design/glossary.yaml": GlossaryDoc,
    "agent/design/domain-model.yaml": DomainModelDoc,
    "agent/design/persistence-model.yaml": PersistenceModelDoc,
    "agent/design/workout-capabilities.yaml": WorkoutCapabilitiesDoc,
    "agent/design/workout-use-cases.yaml": WorkoutUseCasesDoc,
    "agent/design/workout-use-cases-to-domain-model.yaml": WorkoutUseCasesToDomainModelDoc,
    "agent/design/workout-insights-capabilities.yaml": WorkoutInsightsCapabilitiesDoc,
    "agent/design/workout-insights-use-cases.yaml": WorkoutInsightsUseCasesDoc,
    "agent/design/workout-insights-use-cases-to-domain-model.yaml": WorkoutInsightsUseCasesToDomainModelDoc,
    "agent/strategy/security.yaml": SecurityDoc,
    "agent/strategy/commit-policy.yaml": CommitPolicyDoc,
    "agent/strategy/tech-stack.yaml": TechStackDoc,
    "agent/strategy/test-strategy.yaml": TestStrategyDoc,
    "agent/strategy/engineering-guardrails.yaml": EngineeringGuardrailsDoc,
    "agent/strategy/quality-gates.yaml": QualityGatesDoc,
}

__all__ = [
    "ApiContractDoc",
    "DomainModelDoc",
    "EngineeringGuardrailsDoc",
    "QualityGatesDoc",
    "GlossaryDoc",
    "MODEL_REGISTRY",
    "PersistenceModelDoc",
    "CommitPolicyDoc",
    "SecurityDoc",
    "TechStackDoc",
    "TestStrategyDoc",
    "WorkoutCapabilitiesDoc",
    "WorkoutInsightsCapabilitiesDoc",
    "WorkoutInsightsUseCasesDoc",
    "WorkoutInsightsUseCasesToDomainModelDoc",
    "WorkoutUseCasesDoc",
    "WorkoutUseCasesToDomainModelDoc",
]
