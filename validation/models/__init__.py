from __future__ import annotations

from .design_api_contract import ApiContractDoc
from .design_domain_model import DomainModelDoc
from .design_glossary import GlossaryDoc
from .design_persistence_model import PersistenceModelDoc
from .design_workout_capabilities import WorkoutCapabilitiesDoc
from .design_workout_use_cases import WorkoutUseCasesDoc
from .design_workout_use_cases_to_domain_model import WorkoutUseCasesToDomainModelDoc
from .execution_workflow_policy import WorkflowPolicyDoc
from .execution_workflow_state import WorkflowStateDoc
from .execution_task_context import TaskContextDoc
from .execution_config import ExecutionConfigDoc
from .execution_task_spec import TaskSpecDoc
from .strategy_engineering_guardrails import EngineeringGuardrailsDoc
from .strategy_plan import PlanDoc
from .strategy_security import SecurityDoc
from .strategy_tech_stack import TechStackDoc
from .strategy_test_strategy import TestStrategyDoc
from .template_extended_review_findings import ExtendedReviewFindingsTemplateDoc
from .template_item_template import BacklogItemTemplateDoc
from .template_plan_item_template import PlanItemTemplateDoc

MODEL_REGISTRY = {
    "agent/design/api-contract.yaml": ApiContractDoc,
    "agent/design/glossary.yaml": GlossaryDoc,
    "agent/design/domain-model.yaml": DomainModelDoc,
    "agent/design/persistence-model.yaml": PersistenceModelDoc,
    "agent/design/workout-capabilities.yaml": WorkoutCapabilitiesDoc,
    "agent/design/workout-use-cases.yaml": WorkoutUseCasesDoc,
    "agent/design/workout-use-cases-to-domain-model.yaml": WorkoutUseCasesToDomainModelDoc,
    "agent/execution/plan.yaml": PlanDoc,
    "agent/strategy/security.yaml": SecurityDoc,
    "agent/strategy/tech-stack.yaml": TechStackDoc,
    "agent/strategy/test-strategy.yaml": TestStrategyDoc,
    "agent/strategy/engineering-guardrails.yaml": EngineeringGuardrailsDoc,
    "agent/execution/workflow-policy.yaml": WorkflowPolicyDoc,
    "agent/execution/workflow-state.yaml": WorkflowStateDoc,
    "agent/execution/execution-config.yaml": ExecutionConfigDoc,
    "agent/execution/task-context/discuss-plan.yaml": TaskContextDoc,
    "agent/execution/task-context/refine-plan.yaml": TaskContextDoc,
    "agent/execution/task-context/plan-item.yaml": TaskContextDoc,
    "agent/execution/task-context/implement-item.yaml": TaskContextDoc,
    "agent/execution/task-context/review-item.yaml": TaskContextDoc,
    "agent/execution/task-context/finalize-plan.yaml": TaskContextDoc,
    "agent/execution/task-context/review-architecture.yaml": TaskContextDoc,
    "agent/execution/task-context/review-consistency.yaml": TaskContextDoc,
    "agent/execution/task-context/review-quality.yaml": TaskContextDoc,
    "agent/execution/task-context/review-security.yaml": TaskContextDoc,
    "agent/execution/task-context/review-technology.yaml": TaskContextDoc,
    "agent/execution/task-spec/discuss-plan.yaml": TaskSpecDoc,
    "agent/execution/task-spec/refine-plan.yaml": TaskSpecDoc,
    "agent/execution/task-spec/plan-item.yaml": TaskSpecDoc,
    "agent/execution/task-spec/implement-item.yaml": TaskSpecDoc,
    "agent/execution/task-spec/review-item.yaml": TaskSpecDoc,
    "agent/execution/task-spec/finalize-plan.yaml": TaskSpecDoc,
    "agent/execution/task-spec/review-architecture.yaml": TaskSpecDoc,
    "agent/execution/task-spec/review-consistency.yaml": TaskSpecDoc,
    "agent/execution/task-spec/review-quality.yaml": TaskSpecDoc,
    "agent/execution/task-spec/review-security.yaml": TaskSpecDoc,
    "agent/execution/task-spec/review-technology.yaml": TaskSpecDoc,
    "agent/templates/item-template.yaml": BacklogItemTemplateDoc,
    "agent/templates/plan-item-template.yaml": PlanItemTemplateDoc,
    "agent/templates/extended-review-findings-template.yaml": ExtendedReviewFindingsTemplateDoc,
}

__all__ = [
    "ApiContractDoc",
    "DomainModelDoc",
    "EngineeringGuardrailsDoc",
    "GlossaryDoc",
    "MODEL_REGISTRY",
    "PersistenceModelDoc",
    "PlanDoc",
    "ExtendedReviewFindingsTemplateDoc",
    "WorkflowPolicyDoc",
    "WorkflowStateDoc",
    "ExecutionConfigDoc",
    "TaskContextDoc",
    "TaskSpecDoc",
    "BacklogItemTemplateDoc",
    "SecurityDoc",
    "TechStackDoc",
    "TestStrategyDoc",
    "WorkoutCapabilitiesDoc",
    "WorkoutUseCasesDoc",
    "WorkoutUseCasesToDomainModelDoc",
    "PlanItemTemplateDoc",
]
