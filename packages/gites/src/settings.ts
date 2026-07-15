import { select, input, confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { git, gitRun, remoteBranches } from "./git.js";
import { gitesRemote, assertBackupRemoteDistinct } from "./remotes.js";
import { workPrefix, setWorkPrefix, listWorkBranches } from "./feature.js";
import { worktreeEnabled } from "./worktree.js";
import { legacyConfigPresent, migrateLegacyConfig } from "./migrate.js";
import { withSpinner } from "./spinner.js";

export async function applyPrefixRename(oldPrefix: string, newPrefix: string): Promise<void> {
  const remote = gitesRemote();
  const onRemote = remoteBranches(remote);
  if (onRemote.size > 0) assertBackupRemoteDistinct();
  for (const oldWork of listWorkBranches(oldPrefix)) {
    const newWork = `${newPrefix}${oldWork.slice(oldPrefix.length)}`;
    await gitRun("branch", "-m", oldWork, newWork);
    if (onRemote.has(oldWork)) {
      await gitRun("push", "-u", remote, newWork);
      await gitRun("push", remote, "--delete", oldWork);
    }
  }
}

async function changePrefix(): Promise<void> {
  const current = workPrefix();
  const next = await input({ message: "Work-branch prefix:", default: current });
  if (!next || next === current) return;

  const branches = listWorkBranches(current);
  if (branches.length > 0) {
    console.log("");
    console.log("Will rename (local + backup remote, origin untouched):");
    for (const b of branches) console.log(`  ${b} -> ${next}${b.slice(current.length)}`);
    const ok = await confirm({
      message: `Rename ${branches.length} work branch(es)?`,
      default: true,
    });
    if (ok) await withSpinner("Renaming work branches", () => applyPrefixRename(current, next));
  }

  setWorkPrefix(next);
  console.log(pc.green(`Work-branch prefix set to '${next}'.`));
}

type Action = "prefix" | "worktree" | "remote" | "migrate" | "back";

export async function settingsMenu(): Promise<void> {
  for (;;) {
    const prefix = workPrefix();
    const wt = worktreeEnabled();
    const remote = gitesRemote();

    const choices: Array<{ name: string; value: Action }> = [
      { name: `Branch prefix (current: ${prefix})`, value: "prefix" },
      { name: `Default worktrees (current: ${wt ? "on" : "off"})`, value: "worktree" },
      { name: `Backup remote (current: ${remote})`, value: "remote" },
    ];
    if (legacyConfigPresent()) {
      choices.push({ name: "Migrate legacy gitpace config", value: "migrate" });
    }
    choices.push({ name: "Back", value: "back" });

    const action = await select<Action>({ message: "Settings", choices, pageSize: 20 });

    switch (action) {
      case "prefix":
        await changePrefix();
        break;
      case "worktree": {
        const on = await confirm({
          message: "Default new features to their own worktree?",
          default: wt,
        });
        git("config", "gites.worktree", String(on));
        break;
      }
      case "remote": {
        const name = await input({ message: "Backup remote name:", default: remote });
        if (name && name !== remote) git("config", "gites.remote", name);
        break;
      }
      case "migrate":
        migrateLegacyConfig();
        console.log(pc.green("Legacy gitpace config migrated. Prefix kept as 'gitpace-'."));
        break;
      case "back":
        return;
    }
  }
}
