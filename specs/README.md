# Specifications

Product and engineering specifications. They are the source of truth for
behavior, domain and engineering rules; code and tests follow them. Pydantic
models in `validation/models` validate every YAML file; run `make check-framework`.

## Design (`design/`)

What the product does and how it is modeled. Read in this order:

1. `domain-context.md`: narrative domain overview
2. `glossary.yaml`: shared vocabulary and identifiers
3. `workout-capabilities.yaml`, `workout-use-cases.yaml`, `workout-insights-*.yaml`, `configurator-use-cases.yaml`: capabilities and use cases
4. `domain-model.yaml`, `persistence-model.yaml`, `*-to-domain-model.yaml`: entities, storage and use-case mappings
5. `api-contract.yaml`: OpenAPI contract, source for generated API models
6. `workout-ui-smoke-test.yaml`: UI smoke scenarios

## Strategy (`strategy/`)

Rules for how the product is built:

- `tech-stack.yaml`: technologies and architectural intent
- `engineering-guardrails.yaml`: repository and code rules
- `test-strategy.yaml`, `quality-gates.yaml`: tests and quality bars
- `security.yaml`: security requirements
- `commit-policy.yaml`: commit and versioning rules

Change a specification in the same commit as the behavior it describes.
