import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type AiTool = { id: string; name: string };

type Candidate = AiTool & { paths: (home: string, env: NodeJS.ProcessEnv) => (string | undefined)[] };

/**
 * The AI coding tools whose local logs tudi-cli reads (cli/pkg/ai), found by the same folders the CLI reads. Only the
 * ones people use most are listed in the window; tudi-cli reads every tool it knows whether it is listed or not.
 */
const CANDIDATES: Candidate[] = [
  { id: 'claude-code', name: 'Claude Code', paths: (home, env) => [env.CLAUDE_CONFIG_DIR, join(home, '.claude', 'projects')] },
  { id: 'codex', name: 'Codex', paths: (home, env) => [env.CODEX_HOME, join(home, '.codex', 'sessions')] },
  { id: 'gemini-cli', name: 'Gemini CLI', paths: home => [join(home, '.gemini', 'tmp')] },
  {
    id: 'antigravity-agent',
    name: 'Antigravity Agent',
    paths: home => ['antigravity', 'antigravity-ide', 'antigravity-cli'].map(app => join(home, '.gemini', app)),
  },
  { id: 'copilot-cli', name: 'Copilot CLI', paths: home => [join(home, '.copilot', 'session-state')] },
  {
    id: 'opencode',
    name: 'opencode',
    paths: (home, env) => [
      env.XDG_DATA_HOME && join(env.XDG_DATA_HOME, 'opencode'),
      join(home, '.local', 'share', 'opencode'),
      join(home, 'Library', 'Application Support', 'opencode'),
      join(home, 'AppData', 'Local', 'opencode'),
      join(home, 'AppData', 'Roaming', 'opencode'),
    ],
  },
  { id: 'amp', name: 'Amp', paths: home => [join(home, '.cache', 'amp', 'logs', 'threads')] },
];

/** The listed AI tools that have left logs on this computer. */
export function findAiTools(home = homedir(), env: NodeJS.ProcessEnv = process.env, exists: (path: string) => boolean = existsSync): AiTool[] {
  return CANDIDATES.filter(tool => tool.paths(home, env).some(path => path !== undefined && path !== '' && exists(path))).map(({ id, name }) => ({ id, name }));
}
