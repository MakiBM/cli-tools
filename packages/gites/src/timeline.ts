import { gitTry, gitOk } from "./git.js";
import { listFeatures } from "./feature.js";
import { originRemote } from "./remotes.js";

// Newest shipped commit across every gites feature (local live branches and their
// origin refs, commits beyond origin/main). Every ship starts after it, so the
// repo history reads as one person working serially - work branches carry real
// timestamps and are excluded.
export function timelineFloor(): Date | null {
  const origin = originRemote();
  let floor: Date | null = null;
  for (const name of listFeatures()) {
    for (const ref of [name, `${origin}/${name}`]) {
      if (!gitOk("rev-parse", "--verify", ref)) continue;
      const iso = gitTry("log", "-1", "--format=%cI", ref, "--not", `${origin}/main`);
      if (!iso) continue;
      const d = new Date(iso);
      if (!floor || d > floor) floor = d;
    }
  }
  return floor;
}
