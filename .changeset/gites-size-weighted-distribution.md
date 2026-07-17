---
"@makibm/gites": minor
---

Rework ship time distribution around a working-hours "canvas" and commit size:

- Commits are spread across the session as a canvas of per-day windows with the
  overnight gaps removed. The first day anchors to the first commit's real time,
  the newest commit lands at `now` (never in the future), other days run to 18:00
  and non-first days start at a jittered ~08:00.
- Placement is size-weighted: the gap before each commit is 80% proportional to its
  lines changed and 20% random, so larger commits get more time before them.
- Times get natural seconds instead of `:00`.
- Editor arrows are canvas-aware: left/right shifts a commit by 15 minutes, rolling
  across day boundaries and clamping to the canvas; the per-commit editor's date
  field hops to the adjacent working day.

Fixes the previous behavior that crammed commits into a tiny window and stamped some
in the future.
