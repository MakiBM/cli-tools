import { getConfig, setConfig, getConfigRegexp } from "./git.js";
import { installHook, isHookInstalled } from "./hook-install.js";

const LEGACY_PREFIX = "gitpace-";
const LEGACY_REMOTE = "gitpace";

export function legacyConfigPresent(): boolean {
  if (getConfig("gites.remote")) return false;
  if (getConfig("gitpace.branch")) return true;
  if (getConfig("remote.gitpace.url")) return true;
  return getConfigRegexp("^branch\\..*\\.gitpacebase$").length > 0;
}

export function migrateLegacyConfig(): void {
  setConfig("gites.workprefix", LEGACY_PREFIX);
  setConfig("gites.remote", LEGACY_REMOTE);

  const activeBranch = getConfig("gitpace.branch");
  if (activeBranch) setConfig("gites.branch", activeBranch);

  for (const [key, value] of getConfigRegexp("^branch\\..*\\.gitpacebase$")) {
    setConfig(key.replace(/\.gitpacebase$/, ".gitesbase"), value);
  }

  if (!isHookInstalled()) installHook();
}
