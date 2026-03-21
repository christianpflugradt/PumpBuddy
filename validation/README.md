# Validation

Structured contract validation for the agent framework.

## Run

```bash
agent/scripts/check/validate-docs.sh
```

This command runs:

- Pydantic validation for registered project contracts
- Pydantic validation for registered example contracts
- cross-file design consistency checks
- execution item invariant checks
- shell script lint (shellcheck; local run skips if shellcheck is unavailable)

For the full, completeness-oriented verification inventory, see:

- `agent/meta/framework-verification.md`
