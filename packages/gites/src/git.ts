import { execFileSync, spawnSync, spawn } from "node:child_process";

export interface GitError extends Error {
  exitCode: number;
}

export function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).replace(/\n$/, "");
}

export function gitTry(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).replace(/\n$/, "");
  } catch {
    return "";
  }
}

export function gitOk(...args: string[]): boolean {
  return spawnSync("git", args, { stdio: "ignore" }).status === 0;
}

function isVerbose(): boolean {
  return Boolean(process.env.GITES_VERBOSE);
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

function spawnGit(args: string[]): Promise<GitResult> {
  const stdio: "inherit" | ["inherit", "pipe", "pipe"] = isVerbose()
    ? "inherit"
    : ["inherit", "pipe", "pipe"];
  const child = spawn("git", args, { stdio });
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  if (!isVerbose()) {
    child.stdout?.on("data", (d: Buffer) => out.push(d));
    child.stderr?.on("data", (d: Buffer) => err.push(d));
  }
  return new Promise((resolve) => {
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
  });
}

export async function gitRun(...args: string[]): Promise<void> {
  const r = await spawnGit(args);
  if (r.code !== 0) {
    if (!isVerbose()) {
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
    }
    const err = new Error(`git ${args.join(" ")} failed`) as GitError;
    err.exitCode = r.code;
    throw err;
  }
}

export async function gitRunAllowFail(...args: string[]): Promise<boolean> {
  const r = await spawnGit(args);
  if (r.code !== 0 && !isVerbose()) {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
  return r.code === 0;
}

export function branchExists(name: string): boolean {
  return gitOk("show-ref", "--verify", "--quiet", `refs/heads/${name}`);
}

export function currentBranch(): string {
  return gitTry("symbolic-ref", "--short", "HEAD");
}

export function isGitRepo(): boolean {
  return gitOk("rev-parse", "--is-inside-work-tree");
}

export function hasRemote(name: string): boolean {
  const remotes = gitTry("remote").split("\n").filter(Boolean);
  return remotes.includes(name);
}

export function getConfig(key: string): string {
  return gitTry("config", key);
}

export function setConfig(key: string, value: string): void {
  git("config", key, value);
}

export function repoRoot(): string {
  return git("rev-parse", "--show-toplevel");
}
