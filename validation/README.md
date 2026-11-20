# Validation

The `framework` Please Behave Rule runs at pre-commit, pre-push, check and
release-candidate. For targeted diagnosis use `make check-framework`.

It retains Pydantic project/example contracts and cross-file design consistency.

See `agent/meta/framework-verification.md` for the inventory and `.please/README.md`
for preparation, Git hooks and execution points.
