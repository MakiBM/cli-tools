---
"@makibm/gites": minor
---

Ship time editing overhaul: the schedule screen now adjusts a commit's time with
left/right arrows in 15-minute steps, and Enter opens a per-commit editor with
separate prefilled Date and Time fields (left/right shift time ±15m or date ±1d,
Tab switches field). When `live` has no prior commits the session window now
starts at the first commit staged in gites instead of a hardcoded 10:00. Worktree
setup also copies `.env*` files nested in workspaces (e.g. `apps/shell/.env.local`),
not just top-level ones.
