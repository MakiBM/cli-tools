import { checkbox, confirm, input, menu, printBanner } from "@makibm/cli-kit";
import { scan } from "./scan.js";
import { renderHits } from "./render.js";
import { TailwindNotFoundError } from "./theme-loader.js";

const SUBTITLE = "Find Tailwind v4 arbitrary-value classes and suggest the matching default token.";

/** Interactive terminal menu: pick paths, toggle options, run the scan. */
export async function runTui(): Promise<void> {
  printBanner("TWIXER", { subtitle: SUBTITLE });

  while (true) {
    const action = await menu<"scan" | "paths" | "quit">({
      message: "What do you want to do?",
      choices: [
        { name: "Scan the current directory", value: "scan" },
        { name: "Scan specific paths...", value: "paths" },
        { name: "Quit", value: "quit" },
      ],
    });
    if (action === "quit") return;

    let patterns = ["."];
    if (action === "paths") {
      const raw = await input({ message: "Paths or globs (space-separated):", default: "." });
      patterns = raw.trim().split(/\s+/).filter(Boolean);
      if (!patterns.length) patterns = ["."];
    }

    const chosen = new Set(
      await checkbox<string>({
        message: "Options (space to toggle):",
        choices: [
          { name: "Group results by class", value: "group" },
          { name: "Suggest nearest token when no exact match (--round)", value: "round" },
          { name: "Show classes with no replacement (--all)", value: "all" },
          { name: "Don't honor .gitignore", value: "no-gitignore" },
        ],
      }),
    );

    try {
      const result = scan({
        patterns,
        round: chosen.has("round"),
        all: chosen.has("all"),
        useGitignore: !chosen.has("no-gitignore"),
      });
      console.log("");
      console.log(
        renderHits(result, { color: Boolean(process.stdout.isTTY), group: chosen.has("group") }),
      );
      console.log("");
    } catch (error) {
      if (error instanceof TailwindNotFoundError) {
        console.error(`Error: ${error.message}`);
      } else {
        throw error;
      }
    }

    if (!(await confirm({ message: "Run another scan?", default: false }))) return;
  }
}
