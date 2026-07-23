import * as path from "node:path";
import { confirm, input, printBanner } from "@makibm/cli-kit";
import { isSupported } from "./image.js";
import { layt, NotImageError } from "./layt.js";
import { SUBTITLE } from "./meta.js";
import { pathPrompt } from "./path-prompt.js";
import { renderResult } from "./render.js";

/** Interactive flow: pick an image, choose output dir + filename, slice. */
export async function runTui(): Promise<void> {
  printBanner("LAYT", { subtitle: SUBTITLE });

  while (true) {
    const image = await pathPrompt({ message: "Image to slice:", fileFilter: isSupported });
    const base = path.basename(image, path.extname(image));

    const out = (await input({ message: "Output directory:", default: `${base}-layt` })).trim();
    const name = (await input({ message: "Base filename:", default: base })).trim();
    const crops = await confirm({ message: "Write slice images?", default: true });

    try {
      const result = await layt({ input: image, out, name, crops });
      console.log("");
      console.log(renderResult(result, Boolean(process.stdout.isTTY)));
      console.log("");
    } catch (error) {
      if (error instanceof NotImageError) {
        console.error(`Error: ${error.message}`);
      } else {
        throw error;
      }
    }

    if (!(await confirm({ message: "Slice another image?", default: false }))) return;
  }
}
