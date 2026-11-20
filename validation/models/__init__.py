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
    "specs/design/api-contract.yaml": ApiContractDoc,
    "specs/design/glossary.yaml": GlossaryDoc,
    "specs/design/domain-model.yaml": DomainModelDoc,
    "specs/design/persistence-model.yaml": PersistenceModelDoc,
    "specs/design/workout-capabilities.yaml": WorkoutCapabilitiesDoc,
    "specs/design/workout-use-cases.yaml": WorkoutUseCasesDoc,
    "specs/design/workout-use-cases-to-domain-model.yaml": WorkoutUseCasesToDomainModelDoc,
    "specs/design/workout-insights-capabilities.yaml": WorkoutInsightsCapabilitiesDoc,
    "specs/design/workout-insights-use-cases.yaml": WorkoutInsightsUseCasesDoc,
    "specs/design/workout-insights-use-cases-to-domain-model.yaml": WorkoutInsightsUseCasesToDomainModelDoc,
    "specs/strategy/security.yaml": SecurityDoc,
    "specs/strategy/commit-policy.yaml": CommitPolicyDoc,
    "specs/strategy/tech-stack.yaml": TechStackDoc,
    "specs/strategy/test-strategy.yaml": TestStrategyDoc,
    "specs/strategy/engineering-guardrails.yaml": EngineeringGuardrailsDoc,
    "specs/strategy/quality-gates.yaml": QualityGatesDoc,
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
