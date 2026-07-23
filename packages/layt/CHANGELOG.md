# @makibm/layt

## 1.1.0

### Minor Changes

- Add an optional size-scaled cut gutter: `--gap-scale` (with `--min-gap` as the
  floor and `--max-gap` as the ceiling) makes the gutter that triggers a cut scale
  with each region, so the whole page still needs a wide gap while small regions
  split finer down to element/line level. Off by default (`gapScale: 0`), so the
  default output is unchanged.

## 1.0.1

### Patch Changes

- Slice nested layouts correctly. Each region now derives its background from its
  own dominant color (neighborhood-merged histogram mode) instead of a single
  global background, with a noise floor so a sparse element crossing a gutter does
  not block the cut, and a solid block is kept as a leaf instead of dropped. This
  fixes screenshots where a card sits on a differently colored page. Default output
  dir is now `./.layt`; `--threshold` is replaced by `--tolerance` and `--noise`.
