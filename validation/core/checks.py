from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Set

from validation.models import (
    DomainModelDoc,
    GlossaryDoc,
    PersistenceModelDoc,
    WorkoutInsightsCapabilitiesDoc,
    WorkoutInsightsUseCasesDoc,
    WorkoutInsightsUseCasesToDomainModelDoc,
    WorkoutCapabilitiesDoc,
    WorkoutUseCasesDoc,
    WorkoutUseCasesToDomainModelDoc,
)


@dataclass
class ValidationIssue:
    severity: str
    message: str


def _to_set(values: List[str]) -> Set[str]:
    return set(values)


def cross_file_checks(validated_docs: Dict[str, Any]) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    glossary: GlossaryDoc = validated_docs.get("agent/design/glossary.yaml")
    domain: DomainModelDoc = validated_docs.get("agent/design/domain-model.yaml")
    persistence: PersistenceModelDoc = validated_docs.get("agent/design/persistence-model.yaml")
    capabilities: WorkoutCapabilitiesDoc = validated_docs.get("agent/design/workout-capabilities.yaml")
    use_cases: WorkoutUseCasesDoc = validated_docs.get("agent/design/workout-use-cases.yaml")
    mapping: WorkoutUseCasesToDomainModelDoc = validated_docs.get(
        "agent/design/workout-use-cases-to-domain-model.yaml"
    )
    insights_capabilities: WorkoutInsightsCapabilitiesDoc = validated_docs.get(
        "agent/design/workout-insights-capabilities.yaml"
    )
    insights_use_cases: WorkoutInsightsUseCasesDoc = validated_docs.get(
        "agent/design/workout-insights-use-cases.yaml"
    )
    insights_mapping: WorkoutInsightsUseCasesToDomainModelDoc = validated_docs.get(
        "agent/design/workout-insights-use-cases-to-domain-model.yaml"
    )

    if not all([glossary, domain, persistence, capabilities, use_cases, mapping]):
        issues.append(
            ValidationIssue(
                severity="error",
                message="cross checks skipped because one or more core design documents failed earlier",
            )
        )
        return issues

    glossary_lifecycle = _to_set(glossary.token_sets.lifecycle_policy)
    domain_lifecycle = {item.id for item in domain.lifecycle_policies}
    persistence_lifecycle = {item.id for item in persistence.lifecycle_policy_implementation}

    if glossary_lifecycle != domain_lifecycle:
        issues.append(
            ValidationIssue(
                severity="error",
                message=(
                    "lifecycle policy drift between glossary and domain-model: "
                    f"glossary={sorted(glossary_lifecycle)}, domain={sorted(domain_lifecycle)}"
                ),
            )
        )

    if glossary_lifecycle != persistence_lifecycle:
        issues.append(
            ValidationIssue(
                severity="error",
                message=(
                    "lifecycle policy drift between glossary and persistence-model: "
                    f"glossary={sorted(glossary_lifecycle)}, persistence={sorted(persistence_lifecycle)}"
                ),
            )
        )

    glossary_modes = _to_set(glossary.token_sets.workout_mode)
    domain_mode_values = set()
    for value_set in domain.value_sets:
        if value_set.id == "WORKOUT_MODE":
            domain_mode_values.update(value_set.values)
    if domain_mode_values and domain_mode_values != glossary_modes:
        issues.append(
            ValidationIssue(
                severity="error",
                message=(
                    "workout_mode drift between glossary and domain-model value set: "
                    f"glossary={sorted(glossary_modes)}, domain={sorted(domain_mode_values)}"
                ),
            )
        )

    allowed_modes = glossary_modes | {"configured_gym_and_free"}

    capability_ids = {capability.id for capability in capabilities.capabilities}
    if insights_capabilities is not None:
        capability_ids.update({capability.id for capability in insights_capabilities.capabilities})
    glossary_capability_ids = _to_set(glossary.token_sets.capability_id)
    if capability_ids != glossary_capability_ids:
        issues.append(
            ValidationIssue(
                severity="error",
                message=(
                    "capability_id drift between glossary and workout capabilities authorities: "
                    f"glossary={sorted(glossary_capability_ids)}, capabilities={sorted(capability_ids)}"
                ),
            )
        )

    use_case_ids = {item.id for item in use_cases.use_cases}
    if insights_use_cases is not None:
        use_case_ids.update({item.id for item in insights_use_cases.use_cases})
    glossary_use_case_ids = _to_set(glossary.token_sets.use_case_id)
    if use_case_ids != glossary_use_case_ids:
        issues.append(
            ValidationIssue(
                severity="error",
                message=(
                    "use_case_id drift between glossary and workout use-case authorities: "
                    f"glossary={sorted(glossary_use_case_ids)}, use_cases={sorted(use_case_ids)}"
                ),
            )
        )

    capability_docs = [capabilities]
    if insights_capabilities is not None:
        capability_docs.append(insights_capabilities)
    for capability_doc in capability_docs:
        for capability in capability_doc.capabilities:
            unknown_modes = set(capability.modes) - glossary_modes
            if unknown_modes:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        message=f"capability {capability.id} uses unknown modes: {sorted(unknown_modes)}",
                    )
                )

    use_case_docs = [use_cases]
    if insights_use_cases is not None:
        use_case_docs.append(insights_use_cases)
    for use_case_doc in use_case_docs:
        for use_case in use_case_doc.use_cases:
            if use_case.mode not in allowed_modes:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        message=f"use case {use_case.id} has unknown mode '{use_case.mode}'",
                    )
                )

    mapping_use_case_ids = {item.use_case_id for item in mapping.mappings}
    if insights_mapping is not None:
        mapping_use_case_ids.update({item.use_case_id for item in insights_mapping.mappings})
    if mapping_use_case_ids != use_case_ids:
        issues.append(
            ValidationIssue(
                severity="error",
                message=(
                    "use-case mapping drift: mapping IDs differ from workout use-case authorities: "
                    f"mapping={sorted(mapping_use_case_ids)}, use_cases={sorted(use_case_ids)}"
                ),
            )
        )

    domain_entity_names = {entity.name for entity in domain.entities}
    mapping_docs = [mapping]
    if insights_mapping is not None:
        mapping_docs.append(insights_mapping)
    for mapping_doc in mapping_docs:
        for item in mapping_doc.mappings:
            for entity_name in item.primary_entities + item.supporting_entities:
                if entity_name not in domain_entity_names:
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            message=(
                                f"mapping {item.use_case_id} references unknown domain entity '{entity_name}'"
                            ),
                        )
                    )
            if item.mode not in allowed_modes:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        message=f"mapping {item.use_case_id} has unknown mode '{item.mode}'",
                    )
                )

    table_names = {table.name for table in persistence.tables}
    for mapping_doc in mapping_docs:
        for item in mapping_doc.mappings:
            impact = item.persistence_impact.model_dump(exclude_none=True)
            for operation, targets in impact.items():
                for target in targets:
                    if isinstance(target, str):
                        root = target.split("_by_")[0]
                        root_candidates = {root, f"{root}s"}
                        if not any(candidate in table_names for candidate in root_candidates):
                            issues.append(
                                ValidationIssue(
                                    severity="warning",
                                    message=(
                                        f"mapping {item.use_case_id} {operation} target '{target}' "
                                        "does not map cleanly to a persistence table"
                                    ),
                                )
                            )
                    elif isinstance(target, dict):
                        for key in target.keys():
                            if key not in table_names:
                                issues.append(
                                    ValidationIssue(
                                        severity="warning",
                                        message=(
                                            f"mapping {item.use_case_id} {operation} target '{key}' "
                                            "does not map to a persistence table"
                                        ),
                                    )
                                )

    return issues
