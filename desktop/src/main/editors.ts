import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The Tudi Tracker extension on the VS Code Marketplace and Open VSX. */
export const EXTENSION_ID = 'tudidaily.tudi-tracker';

export type EditorId = 'vscode' | 'vscode-insiders' | 'cursor' | 'windsurf' | 'vscodium' | 'antigravity';
export type EditorCandidate = { id: EditorId; name: string; cli: string };
export type Editor = EditorCandidate & { hasExtension: boolean };

/**
 * Where the VS Code family keeps its command-line launcher. Found by install location, not PATH: Cursor, for one,
 * puts its own `code` on PATH, so `code` alone would install into the wrong editor.
 */
export function editorCandidates(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): EditorCandidate[] {
  if (platform === 'win32') {
    const local = join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'Programs');
    const programs = env.ProgramFiles ?? 'C:\\Program Files';
    return [
      { id: 'vscode', name: 'VS Code', cli: [join(local, 'Microsoft VS Code', 'bin', 'code.cmd'), join(programs, 'Microsoft VS Code', 'bin', 'code.cmd')] },
      { id: 'vscode-insiders', name: 'VS Code Insiders', cli: [join(local, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd'), join(programs, 'Microsoft VS Code Insiders', 'bin', 'code-insiders.cmd')] },
      { id: 'cursor', name: 'Cursor', cli: [join(local, 'cursor', 'resources', 'app', 'bin', 'cursor.cmd')] },
      { id: 'windsurf', name: 'Windsurf', cli: [join(local, 'Windsurf', 'bin', 'windsurf.cmd')] },
      { id: 'vscodium', name: 'VSCodium', cli: [join(local, 'VSCodium', 'bin', 'codium.cmd'), join(programs, 'VSCodium', 'bin', 'codium.cmd')] },
      { id: 'antigravity', name: 'Antigravity', cli: [join(local, 'Antigravity IDE', 'bin', 'antigravity-ide.cmd')] },
    ].flatMap(first);
  }
  if (platform === 'darwin') {
    const app = (bundle: string, bin: string) => ['/Applications', join(home, 'Applications')].map(root => join(root, bundle, 'Contents', 'Resources', 'app', 'bin', bin));
    return [
      { id: 'vscode', name: 'VS Code', cli: app('Visual Studio Code.app', 'code') },
      { id: 'vscode-insiders', name: 'VS Code Insiders', cli: app('Visual Studio Code - Insiders.app', 'code') },
      { id: 'cursor', name: 'Cursor', cli: app('Cursor.app', 'cursor') },
      { id: 'windsurf', name: 'Windsurf', cli: app('Windsurf.app', 'windsurf') },
      { id: 'vscodium', name: 'VSCodium', cli: app('VSCodium.app', 'codium') },
    ].flatMap(first);
  }
  return [];
}

/** Keeps the editor when one of its launcher paths exists, with that path. */
function first(editor: { id: string; name: string; cli: string[] }): EditorCandidate[] {
  const cli = editor.cli.find(path => existsSync(path));
  return cli ? [{ id: editor.id as EditorId, name: editor.name, cli }] : [];
}

export type RunEditorCli = (cli: string, args: string[]) => Promise<string>;

/** Each installed editor, and whether the Tudi Tracker extension is already in it. */
export async function findEditors(run: RunEditorCli = runEditorCli, candidates = editorCandidates()): Promise<Editor[]> {
  return Promise.all(
    candidates.map(async editor => {
      try {
        const listed = (await run(editor.cli, ['--list-extensions'])).split(/\r?\n/).map(line => line.trim().toLowerCase());
        return { ...editor, hasExtension: listed.includes(EXTENSION_ID) };
      } catch {
        return { ...editor, hasExtension: false };
      }
    }),
  );
}

/**
 * Installs the extension from the editor's own marketplace. TUDI_VSIX points a development build at a local .vsix
 * until the extension is published.
 */
export async function installExtension(editor: EditorCandidate, run: RunEditorCli = runEditorCli, source = process.env.TUDI_VSIX || EXTENSION_ID): Promise<void> {
  await run(editor.cli, ['--install-extension', source, '--force']);
}

/** Editor launchers on Windows are .cmd files, which Node only starts through cmd.exe. */
export function runEditorCli(cli: string, args: string[]): Promise<string> {
  const windows = process.platform === 'win32';
  const quote = (value: string) => `"${value.replace(/"/g, '')}"`;
  const [file, argv] = windows ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${[cli, ...args].map(quote).join(' ')}"`]] : [cli, args];
  // Tudi Desktop is itself Electron; the editor's launcher must not inherit that.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Promise((resolve, reject) => {
    execFile(file, argv, { timeout: 120_000, windowsHide: true, windowsVerbatimArguments: windows, env }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message).trim()));
      else resolve(stdout);
    });
  });
}
