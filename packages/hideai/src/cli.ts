import { checkbox, confirm, formatHelp, renderLogo } from "@makibm/cli-kit";
import pc from "picocolors";
import { AGENTS } from "./agents.js";
import { installHook, uninstallHook, setBlockList, getBlockList } from "./install.js";
import { printBanner, printArt } from "./banner.js";

const HELP = `${renderLogo("HIDEAI", {
  subtitle: "Block AI assistant trailers from your git commits.",
})}\n\n${formatHelp({
  usage: "hideai [command]",
  commands: [
    { name: "(default)", summary: "Interactive setup - pick which AI agents to block" },
    { name: "install", summary: "Same as default" },
    { name: "uninstall", summary: "Remove the hideai commit-msg hook and config" },
    { name: "list", summary: "Show all known agents" },
    { name: "status", summary: "Show which agents are currently blocked in this repo" },
    { name: "help", summary: "Show this help" },
  ],
})}`;

async function interactiveInstall(): Promise<void> {
  console.clear();
  printBanner();

  const current = new Set(getBlockList());
  const picked = await checkbox<string>({
    message: "Block commits containing trailers from:",
    pageSize: 20,
    choices: AGENTS.map((a) => ({
      name: a.label,
      value: a.key,
      checked: current.size === 0 ? a.key === "claude" : current.has(a.key),
    })),
  });

  setBlockList(picked);
  const r = installHook();

  console.log("");
  console.log(`${pc.green("✔")} Hook installed at ${pc.cyan(r.path)}`);
  if (r.underHooksPath) {
    console.log(pc.dim("  (written under core.hooksPath)"));
  }
  if (r.replaced) {
    console.log(
      pc.yellow("  ! Replaced an existing commit-msg hook - backup at <path>.pre-hideai"),
    );
  }
  if (picked.length === 0) {
    console.log(
      pc.yellow("  ! Block list is empty - nothing will be blocked. Re-run to pick agents."),
    );
  } else {
    console.log(`${pc.green("✔")} Blocking: ${pc.cyan(picked.join(", "))}`);
  }
}

function listAgents(): void {
  printArt();
  console.log(pc.bold("Known agents:"));
  for (const a of AGENTS) {
    console.log(`  ${pc.cyan(a.key.padEnd(10))} ${a.label}`);
  }
}

function showStatus(): void {
  printArt();
  const blocked = getBlockList();
  if (blocked.length === 0) {
    console.log(pc.dim("No agents blocked in this repo. Run `hideai` to configure."));
    return;
  }
  console.log(`${pc.bold("Blocked")} (in this repo): ${pc.cyan(blocked.join(", "))}`);
}

async function doUninstall(): Promise<void> {
  const ok = await confirm({ message: "Remove hideai hook and config?", default: true });
  if (!ok) return;
  const r = uninstallHook();
  if (r.removed) {
    console.log(`${pc.green("✔")} Hook removed from ${pc.cyan(r.path)}`);
  } else {
    console.log(pc.dim("No hideai hook found."));
  }
}

interface CliError extends Error {
  exitCode: number;
}

export async function run(args: string[]): Promise<void> {
  const [cmd] = args;
  switch (cmd) {
    case undefined:
    case "install":
      return interactiveInstall();
    case "uninstall":
      return doUninstall();
    case "list":
      return listAgents();
    case "status":
      return showStatus();
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      return;
    default: {
      console.error(`Unknown command: ${cmd}`);
      console.error(HELP);
      const err = new Error() as CliError;
      err.exitCode = 2;
      throw err;
    }
  }
}
