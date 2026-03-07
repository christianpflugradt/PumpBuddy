# To-do: Lightweight AI Agent Development Framework

Goal: Build a step-by-step, generally reusable, lightweight framework that is token-efficient without becoming over-specified.

## Phase 1 - Base Structure and Core Templates

- [ ] Create directory structure (`agent/meta`, `agent/strategy`, `agent/design`, `agent/execution`, `agent/templates`, `scripts`)
- [ ] Create base template for `agent/meta/rationale.md`
- [ ] Create base template for `agent/meta/agent-setup.md`
- [ ] Create base template for `agent/meta/agent-tasks.md`
- [ ] Create base template for `agent/strategy/milestones.md`
- [ ] Create base template for `agent/strategy/capabilities.md`
- [ ] Create base template for `agent/strategy/tech-stack.md`
- [ ] Create base template for `agent/strategy/engineering-guardrails.md`
- [ ] Create base template for `agent/strategy/test-strategy.md`
- [ ] Create base template for `agent/design/use-cases.md`
- [ ] Create base template for `agent/design/domain-model.md`
- [ ] Create optional base template for `agent/design/api-contract.md`
- [ ] Create base template for `agent/templates/item-template.md`

## Phase 2 - Execution Item Template (Lightweight)

- [ ] Define a minimal, generic item template (no mandatory overhead)
- [ ] Keep only a small set of core fields (for example: goal, scope, acceptance criteria, references)
- [ ] Document a short rule for "enough context" (not maximum context)

## Phase 3 - Scripts with Standard Content

- [ ] Create `scripts/get-next-item.sh` with standard baseline logic
- [ ] Create `scripts/update-milestone-summary.sh` with standard baseline logic
- [ ] Create `scripts/build-agent-prompt.sh` with standard baseline logic
- [ ] Create `scripts/run-agent.sh` with standard baseline logic
- [ ] In all scripts: add header, usage text, safe defaults, and clear exit codes
- [ ] Add optional commit step as a flag (for example: `--commit`)
- [ ] Add optional push step as a flag (for example: `--push`, only with commit)
- [ ] Keep automatic push disabled by default
- [ ] Make scripts executable (`chmod +x scripts/*.sh`)

## Phase 4 - Validation and Usability

- [ ] Add a short README section: "How to start in 5 minutes"
- [ ] Run one end-to-end test flow with a sample item
- [ ] Verify the flow is understandable without extra explanation
- [ ] Remove anything that does not provide clear value

## Open Guiding Questions (Balance over Overspecification)

- [ ] Which fields are truly required for stable agent execution?
- [ ] Where are conventions sufficient instead of strict rules?
- [ ] Which rules reduce rework meaningfully without adding framework weight?
