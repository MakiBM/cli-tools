import * as fs from "node:fs";
import * as path from "node:path";
import { globSync } from "glob";
import {
  NAMESPACE_ALIASES,
  type NamespaceKey,
  type Table,
  type Theme,
  createTheme,
} from "./tw-defaults.js";
import { normalizeValue } from "./matching.js";

export interface ThemeAddition {
  ns: NamespaceKey;
  name: string;
  normValue: string;
  rawValue: string;
  source: string;
}

/** Parse `--namespace-name: value;` declarations from one CSS file into the theme. */
export const loadThemeFromCss = (theme: Theme, file: string, additions: ThemeAddition[]): void => {
  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const declRe = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  const aliasesDesc = Object.keys(NAMESPACE_ALIASES).sort((a, b) => b.length - a.length);
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(content)) !== null) {
    const fullName = m[1];
    const rawValue = m[2].trim();
    // v4: bare `--spacing: 0.25rem;` sets the spacing multiplier.
    if (fullName === "spacing") {
      const norm = normalizeValue(rawValue);
      const mPx = norm.match(/^(-?\d*\.?\d+)px$/);
      if (mPx) theme.spacingBase.px = parseFloat(mPx[1]);
      continue;
    }
    // Skip companion declarations like `--text-sm--line-height`.
    if (fullName.includes("--")) continue;
    for (const alias of aliasesDesc) {
      if (fullName.startsWith(`${alias}-`)) {
        const name = fullName.slice(alias.length + 1);
        if (!name) break;
        const nsKey = NAMESPACE_ALIASES[alias];
        const table: Table = theme.namespaces[nsKey];
        const normValue = normalizeValue(rawValue);
        if (!Object.prototype.hasOwnProperty.call(table, normValue)) {
          table[normValue] = name;
        }
        const varKey = `var(--${fullName})`;
        if (!Object.prototype.hasOwnProperty.call(table, varKey)) {
          table[varKey] = name;
        }
        additions.push({ ns: nsKey, name, normValue, rawValue, source: file });
        break;
      }
    }
  }
};

/** Walk up from each search root to find the installed tailwindcss/theme.css. */
export const findTailwindThemeCss = (roots: string[]): string | null => {
  for (const root of roots) {
    let dir = path.resolve(root);
    while (true) {
      const p = path.join(dir, "node_modules", "tailwindcss", "theme.css");
      if (fs.existsSync(p)) return p;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
};

export interface LoadThemeOptions {
  roots: string[];
  ignore: string[];
  useGitignore: boolean;
  isGitIgnored: (absFile: string) => boolean;
  useUserTheme: boolean;
  themeFiles: string[];
  /** Explicit framework theme.css. `undefined` = auto-resolve, `null` = skip. */
  tailwindThemeCss?: string | null;
}

export class TailwindNotFoundError extends Error {
  constructor() {
    super("tailwindcss not found in node_modules. Install it (npm i tailwindcss) and re-run.");
    this.name = "TailwindNotFoundError";
  }
}

/** Build a fresh theme from framework defaults plus user CSS. */
export const loadTheme = (
  options: LoadThemeOptions,
): { theme: Theme; additions: ThemeAddition[] } => {
  const theme = createTheme();
  const additions: ThemeAddition[] = [];

  const framework =
    options.tailwindThemeCss === undefined
      ? findTailwindThemeCss(options.roots)
      : options.tailwindThemeCss;
  if (options.tailwindThemeCss === undefined && framework === null) {
    throw new TailwindNotFoundError();
  }
  if (framework) loadThemeFromCss(theme, framework, additions);

  if (options.useUserTheme) {
    const userCssFiles = new Set<string>();
    for (const root of options.roots) {
      for (const f of globSync(path.join(root, "**/*.css"), {
        ignore: options.ignore,
        nodir: true,
        absolute: true,
      })) {
        if (options.useGitignore && options.isGitIgnored(f)) continue;
        userCssFiles.add(f);
      }
    }
    for (const f of options.themeFiles) {
      try {
        userCssFiles.add(path.resolve(f));
      } catch {}
    }
    for (const f of userCssFiles) loadThemeFromCss(theme, f, additions);
  }

  if (theme.spacingBase.px == null) theme.spacingBase.px = 4;
  return { theme, additions };
};
