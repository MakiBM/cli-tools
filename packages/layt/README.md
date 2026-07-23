# layt

Deterministic image **layout slicer**. It cuts a screenshot or mockup into
layout regions purely by the **whitespace between blocks** - no ML, no guessing.
Reads `png`, `jpg/jpeg`, `webp`, `gif`, `avif`, `tiff` and `svg` (decoded with
[sharp](https://sharp.pixelplumbing.com/)).

Under the hood it runs a **recursive XY-cut**: it builds an ink mask (everything
that differs from the background color), sums it into horizontal and vertical
projection profiles, finds the widest empty gutter, cuts there, and recurses -
alternating orientation naturally. The same image always yields the same boxes.

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

| Flag                | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `-o, --out <dir>`   | Output directory (default `./<name>-layt`)                   |
| `-n, --name <base>` | Base filename for slices + manifest (default: image name)    |
| `--min-gap <px>`    | Min whitespace gutter that counts as a cut (default 16)      |
| `--min-size <px>`   | Regions smaller than this are not split further (default 24) |
| `--threshold <n>`   | Per-channel ink threshold, 0-255 (default 12)                |
| `--bg <auto\|#hex>` | Background color (default `auto` = dominant color)           |
| `--json`            | Print the layout as JSON to stdout, write no files           |
| `--no-crops`        | Write only the manifest, skip the slice PNGs                 |
| `--no-color`        | Disable ANSI colors                                          |
| `-h, --help`        | Show help                                                    |

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
