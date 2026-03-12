# Finalize Plan Findings Template

Use this structure when the stakeholder does not approve plan finalization.

Create one complete execution-item draft per blocking finding.
The drafts will be converted into sequential `open-item-XX.md` files by `agent/scripts/finalize-plan-return.sh`.

Rules:

- keep each item focused on exactly one stakeholder finding
- describe the observed problem, the expected correction, and how acceptance will be checked
- reference only the documents or files needed for the follow-up item
- keep the draft compatible with `agent/templates/item-template.md`
- wrap each item in `<!-- ITEM -->` and `<!-- END ITEM -->`

```md
<!-- ITEM -->
# Short Finding Follow-Up Title

## Goal

Describe the concrete correction this follow-up item must achieve.

## Scope

- summarize the required fix or investigation for this single finding
- include any bounded validation or documentation updates that are necessary

## Acceptance Criteria

- describe the observable condition that proves the finding is resolved
- include at least one concrete verification step, command, or runtime check

## References

- `agent/strategy/plan.md`
- `path/to/relevant/file`

## Notes for Review

- Optional.
- Capture the stakeholder's observed failure, manual test result, or risk signal when that context helps review.
<!-- END ITEM -->
```
