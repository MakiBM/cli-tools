import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { search } from "@makibm/cli-kit";

const expandHome = (input: string): string =>
  input === "~" || input.startsWith("~/") ? path.join(os.homedir(), input.slice(1)) : input;

interface PathPromptOptions {
  message: string;
  /** Keep only files whose name passes this test (directories always pass). */
  fileFilter?: (name: string) => boolean;
}

/**
 * Interactive path prompt with filesystem autocompletion: type a partial path and
 * pick from matching entries. Directories are suffixed with the path separator so
 * you can drill deeper by selecting and continuing to type.
 */
export const pathPrompt = (options: PathPromptOptions): Promise<string> =>
  search<string>({
    message: options.message,
    source: (term) => {
      const raw = expandHome(term ?? "");
      const endsWithSep = raw.endsWith(path.sep) || raw.endsWith("/");
      const dir = raw === "" ? "." : endsWithSep ? raw : path.dirname(raw) || ".";
      const prefix = raw === "" || endsWithSep ? "" : path.basename(raw);

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return [];
      }

      return entries
        .filter((e) => e.name.startsWith(prefix))
        .filter((e) => e.isDirectory() || !options.fileFilter || options.fileFilter(e.name))
        .sort(
          (x, y) =>
            Number(y.isDirectory()) - Number(x.isDirectory()) || x.name.localeCompare(y.name),
        )
        .map((e) => {
          const full = path.join(dir, e.name);
          const value = e.isDirectory() ? full + path.sep : full;
          return { name: value, value };
        });
    },
  });
