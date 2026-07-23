# layt

Deterministic image **layout slicer**. It cuts a screenshot or mockup into
layout regions purely by the **whitespace between blocks** - no ML, no guessing.
Reads `png`, `jpg/jpeg`, `webp`, `gif`, `avif`, `tiff` and `svg` (decoded with
[sharp](https://sharp.pixelplumbing.com/)).

Under the hood it runs a **recursive XY-cut**. Each region derives its own
background from its dominant color, marks every pixel that differs from it as
ink, sums that into horizontal and vertical projection profiles, finds the widest
background gutter, cuts there, and recurses - alternating orientation naturally.
Deriving the background **per region** is what lets it descend through nested
backgrounds (a cream card over a dark page: the page splits first, then the card
is analyzed against cream). The same image always yields the same boxes.

Each region is reported as `x, y, width, height`. By default it also writes a
PNG crop per region plus a `<name>.layt.json` manifest with the full nested tree.

It sees **blocks separated by background**, not buttons or headings. Elements
that overlap, sit on a full-bleed photo, or share no clean gutter won't split -
that gap is exactly what the ML models (OmniParser, DocLayout-YOLO, ...) fill.

## Usage

```bash
# Interactive: pick an image (path autocompletion), choose output dir + filename
npx @makibm/layt

# Slice an image, write crops + manifest to ./<name>-layt
npx @makibm/layt shot.png
npx @makibm/layt mockup.webp

# Custom output directory and base filename
npx @makibm/layt shot.png -o ./slices -n home

# For agents: print the layout as JSON to stdout, write nothing
npx @makibm/layt shot.png --json

# Only write the manifest, skip the slice PNGs
npx @makibm/layt shot.png --no-crops
```

## Options

| Flag                | Meaning                                                        |
| ------------------- | -------------------------------------------------------------- |
| `-o, --out <dir>`   | Output directory (default `./.layt`)                           |
| `-n, --name <base>` | Base filename for slices + manifest (default: image name)      |
| `--min-gap <px>`    | Cut gutter size, also the floor when scaling (default 16)      |
| `--max-gap <px>`    | Ceiling for the scaled cut gutter (default 40)                 |
| `--gap-scale <f>`   | Scale the gutter with region size; 0 = off (default 0)         |
| `--min-size <px>`   | Regions smaller than this are not split further (default 24)   |
| `--tolerance <n>`   | Per-channel background tolerance, 0-255 (default 45)           |
| `--noise <f>`       | Gutter noise floor as a fraction of line length (default 0.03) |
| `--bg <auto\|#hex>` | Background color reported in the manifest (default `auto`)     |
| `--json`            | Print the layout as JSON to stdout, write no files             |
| `--no-crops`        | Write only the manifest, skip the slice PNGs                   |
| `--no-color`        | Disable ANSI colors                                            |
| `-h, --help`        | Show help                                                      |

`--tolerance` absorbs background noise/gradients (raise it if a textured or dark
background is mistaken for content); `--noise` lets a sparse element crossing a
gutter (a header label in a wide margin) still count as a cut.

By default the cut gutter is a constant `--min-gap` (clean section-level slices).
Set `--gap-scale` (e.g. `0.02`, usually with a lower `--min-gap 8`) to scale the
gutter with region size: the whole page still needs a wide gutter, but small
regions accept thin ones, splitting finer down to element/line level. Note this
cannot separate two neighbors that share no clean background gutter - e.g. two
photos butted together over a thin, uneven seam. That is the limit of whitespace
slicing; telling those apart needs the ML models (OmniParser, DocLayout-YOLO).

Running `layt` with no arguments opens the interactive TUI. Passing an image (or
any flag) runs headless, so an agent can drive the whole thing from the CLI.

## Manifest

`<name>.layt.json`:

```json
{
  "source": "/abs/path/shot.png",
  "width": 1440,
  "height": 900,
  "background": "#ffffff",
  "count": 4,
  "slices": [{ "index": 1, "file": "shot-001.png", "x": 20, "y": 20, "width": 260, "height": 40 }],
  "tree": { "x": 0, "y": 0, "width": 1440, "height": 900, "children": [] }
}
```

## Requirements

- Node.js ≥ 20
- Input in any format sharp can decode: png, jpg/jpeg, webp, gif, avif, tiff, svg.
  Slice crops are always written as PNG (lossless).

## License

MIT
