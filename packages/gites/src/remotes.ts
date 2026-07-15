import { getConfig, gitTry } from "./git.js";

export function originRemote(): string {
  return getConfig("gites.origin") || "origin";
}

export function gitesRemote(): string {
  return getConfig("gites.remote") || "gites";
}

// Safety gate before any destructive push to the backup remote: refuse if the
// backup remote is (or points at) origin, so cleanup/rename can never hit it.
export function assertBackupRemoteDistinct(): void {
  const origin = originRemote();
  const backup = gitesRemote();
  if (backup === origin) {
    throw new Error(`backup remote '${backup}' is the same as origin - refusing to modify it.`);
  }
  const originUrl = gitTry("remote", "get-url", origin);
  const backupUrl = gitTry("remote", "get-url", backup);
  if (originUrl && backupUrl && originUrl === backupUrl) {
    throw new Error(
      `backup remote '${backup}' points at origin (${originUrl}) - refusing to modify it.`,
    );
  }
}
