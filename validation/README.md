# Validation

The `framework` Please Behave Rule runs at pre-commit, pre-push, check and
release-candidate. For targeted diagnosis use `make check-framework`.

It retains Pydantic project/example contracts, cross-file design consistency,
execution item invariants, Makefile command policy, ShellCheck,
workspace-cleanliness self-tests and all 13 task script/context contracts.
ShellCheck is required.

See `agent/meta/framework-verification.md` for the inventory and `.please/README.md`
for preparation, Git hooks and execution points.
