import { select, Separator, input, confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { gitTry, currentBranch, isGitRepo } from "./git.js";
import { activeFeature, listFeatures, canAttach, workBranch, baseBranch } from "./feature.js";
import { worktreeEnabled, worktreePath } from "./worktree.js";
import { originRemote } from "./remotes.js";
import { needsSetup, setupWizard } from "./setup.js";
import { startFeature } from "./start-feature.js";
import { attach } from "./attach.js";
import { switchFeature } from "./switch.js";
import { ship } from "./ship.js";
import { resync } from "./resync.js";
import { changeBase } from "./rebase-base.js";
import { pickBranch } from "./pick-branch.js";
import { printArt } from "./banner.js";
import { accent } from "./colors.js";

async function newBranchWizard(): Promise<void> {
  const name = await input({ message: "Branch name (on origin):" });
  if (!name) {
    console.log(pc.yellow("No name provided."));
    await sleep(1000);
    return;
  }
  const base = await pickBranch({ message: "Base branch:", exclude: [name] });
  const worktree = await confirm({ message: "Own worktree?", default: worktreeEnabled() });
  console.log("");
  console.log(accent(`  Base:           ${base}`));
  console.log(accent(`  Live branch:    ${name}  (local until first ship)`));
  console.log(accent(`  Working branch: ${workBranch(name)}`));
  if (worktree) {
    console.log(accent(`  Worktree:       ${worktreePath(name)}`));
  }
  if (base !== "main") {
    console.log("");
    console.log(
      pc.yellow(
        `  Tip: PR chain — point this PR at '${base}'. Merge '${base}' with a merge/rebase-merge (not squash) so this rebase stays clean; then 'Change base' re-parents onto the grandparent.`,
      ),
    );
  }
  console.log("");
  const ok = await confirm({ message: `Create these branches from '${base}'?`, default: true });
  if (!ok) return;
  await startFeature(name, base, worktree);
}

async function attachWizard(): Promise<void> {
  const current = currentBranch();
  console.log("");
  console.log(accent(`  Base:           origin/${current}`));
  console.log(accent(`  Origin branch:  ${current} (already exists)`));
  console.log(accent(`  Working branch: ${workBranch(current)} (new)`));
  console.log("");
  const ok = await confirm({
    message: `Attach to '${current}' and create local-${current} from it?`,
    default: true,
  });
  if (!ok) return;
  await attach();
}

type MenuAction = "new" | "attach" | "switch" | "ship" | "resync" | "rebase" | "setup" | "quit";

export async function tui(): Promise<void> {
  if (!isGitRepo()) throw new Error("not inside a git repo.");

  if (needsSetup()) await setupWizard();

  for (;;) {
    console.clear();
    printArt();

    const current = currentBranch() || "detached";
    const active = activeFeature();
    const features = listFeatures();

    console.log(`  Branch: ${current}`);
    const base = active ? baseBranch(active) : "main";
    if (active) {
      const workCount = gitTry("rev-list", "--count", `${active}..${workBranch(active)}`) || "0";
      const featureCount = gitTry("rev-list", "--count", `${base}..${active}`) || "0";
      console.log(
        `  Active: ${active} → ${base} (${workCount} unshipped, ${featureCount} shipped)`,
      );
    }
    if (features.length > 0) {
      console.log(`  Features: ${features.join(", ")}`);
    }
    if (!active && features.length === 0) {
      console.log("  No features yet");
    }
    if (active && base !== "main") {
      console.log(
        pc.yellow(
          `  Tip: PR chain — '${active}' targets '${base}'. Prefer merge/rebase-merge over squash for '${base}'. After it merges, 'Change base' re-parents onto its base.`,
        ),
      );
    }
    console.log("");

    const showSwitch = features.length > 1 || (features.length === 1 && features[0] !== active);

    const choices: Array<{ name: string; value: MenuAction } | InstanceType<typeof Separator>> = [];
    if (active) {
      choices.push({ name: "Ship commits", value: "ship" });
      choices.push({
        name: `Resync from ${originRemote()}/${active}`,
        value: "resync",
      });
      choices.push({ name: `Change base (currently ${base})`, value: "rebase" });
    }
    if (showSwitch) choices.push({ name: "Switch feature", value: "switch" });
    if (canAttach()) {
      choices.push({ name: `Attach (from origin/${current})`, value: "attach" });
    }
    if (choices.length > 0) choices.push(new Separator());
    choices.push({ name: "New feature", value: "new" });
    choices.push({ name: "Re-run setup", value: "setup" });
    choices.push({ name: "Quit", value: "quit" });

    const action = await select<MenuAction>({ message: "Select an action", choices, pageSize: 20 });

    try {
      switch (action) {
        case "new":
          await newBranchWizard();
          await sleep(1000);
          break;
        case "attach":
          await attachWizard();
          await sleep(1000);
          break;
        case "switch":
          await switchFeature();
          await sleep(1000);
          break;
        case "ship":
          await ship();
          await pressAnyKey();
          break;
        case "resync":
          await resync();
          await pressAnyKey();
          break;
        case "rebase":
          await changeBase();
          await pressAnyKey();
          break;
        case "setup":
          await setupWizard();
          await sleep(1000);
          break;
        case "quit":
          return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(pc.red(msg));
      await pressAnyKey();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pressAnyKey(): Promise<void> {
  return new Promise((resolve) => {
    console.log("");
    console.log("Press any key to continue...");
    if (!process.stdin.isTTY) return resolve();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}
