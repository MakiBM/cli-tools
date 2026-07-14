export interface AgentDef {
  key: string;
  label: string;
  pattern: string;
}

export const AGENTS: readonly AgentDef[] = [
  {
    key: 'claude',
    label: 'Claude / Claude Code (Anthropic)',
    pattern: 'co-authored-by:.*(claude|anthropic|noreply@anthropic)|generated with .*claude',
  },
  {
    key: 'openai',
    label: 'ChatGPT / GPT (OpenAI)',
    pattern: 'co-authored-by:.*(openai|chatgpt|gpt-?[0-9])',
  },
  {
    key: 'copilot',
    label: 'GitHub Copilot',
    pattern: 'co-authored-by:.*(github[- ]?copilot|copilot)',
  },
  {
    key: 'cursor',
    label: 'Cursor',
    pattern: 'co-authored-by:.*cursor|generated with .*cursor',
  },
  {
    key: 'windsurf',
    label: 'Windsurf (Codeium)',
    pattern: 'co-authored-by:.*windsurf|generated with .*windsurf',
  },
  {
    key: 'codeium',
    label: 'Codeium',
    pattern: 'co-authored-by:.*codeium',
  },
  {
    key: 'aider',
    label: 'Aider',
    pattern: 'co-authored-by:.*aider|^aider:',
  },
  {
    key: 'tabnine',
    label: 'Tabnine',
    pattern: 'co-authored-by:.*tabnine',
  },
  {
    key: 'gemini',
    label: 'Gemini / Google AI',
    pattern: 'co-authored-by:.*(gemini|google[- ]ai)',
  },
  {
    key: 'continue',
    label: 'Continue (continue.dev)',
    pattern: 'co-authored-by:.*continue\\.dev',
  },
  {
    key: 'devin',
    label: 'Devin (Cognition)',
    pattern: 'co-authored-by:.*devin',
  },
  {
    key: 'v0',
    label: 'v0 (Vercel)',
    pattern: 'co-authored-by:.*\\bv0\\b',
  },
  {
    key: 'bolt',
    label: 'Bolt (StackBlitz)',
    pattern: 'co-authored-by:.*bolt',
  },
  {
    key: 'lovable',
    label: 'Lovable',
    pattern: 'co-authored-by:.*lovable',
  },
  {
    key: 'replit',
    label: 'Replit Agent',
    pattern: 'co-authored-by:.*replit',
  },
];

export function getAgent(key: string): AgentDef | undefined {
  return AGENTS.find((a) => a.key === key);
}

/**
 * Whether a commit message trips an agent's pattern. Mirrors the bash hook's
 * `grep -iqE`: case-insensitive, line-based (^/$ per line, `.` excludes newline).
 */
export function matchesAgent(agent: AgentDef, message: string): boolean {
  return new RegExp(agent.pattern, 'im').test(message);
}

/** All configured agents (by key) whose patterns match the message. */
export function blockingAgents(message: string, keys: readonly string[]): AgentDef[] {
  const out: AgentDef[] = [];
  for (const key of keys) {
    const agent = getAgent(key);
    if (agent && matchesAgent(agent, message)) out.push(agent);
  }
  return out;
}
