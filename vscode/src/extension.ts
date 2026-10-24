import { unwatchFile, watchFile } from 'node:fs';
import * as vscode from 'vscode';
import { CliSettings, runCli, sendHeartbeat } from './cli';
import { configPath, isSignedIn, SETUP_URL } from './config';
import { HeartbeatGate } from './gate';
import { LineCounter } from './lines';

const TODAY_EVERY_MS = 5 * 60 * 1000;

/**
 * Commit Kingdom Tracker for VS Code, Cursor, Windsurf, VSCodium and Antigravity (ADR-024): reports coding to tudi-cli, which
 * strips everything private before anything leaves the computer. The extension itself never reads file contents.
 * Signing in belongs to Commit Kingdom Desktop (ADR-027): it writes the key to tudi-cli's config and installs tudi-cli; until
 * then the extension sends nothing and points to Commit Kingdom Desktop.
 */
export function activate(context: vscode.ExtensionContext): void {
  const gate = new HeartbeatGate();
  const lines = new LineCounter();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  status.command = 'tudi.today';
  status.text = '$(flame) Kingdom';
  status.tooltip = 'Commit Kingdom Tracker';
  status.show();

  const settings = (): CliSettings => {
    const config = vscode.workspace.getConfiguration('tudi');
    const version = (context.extension.packageJSON as { version: string }).version;
    return { cliPath: config.get<string>('cliPath', ''), apiUrl: config.get<string>('apiUrl', ''), plugin: `vscode/${vscode.version} tudi-vscode/${version}` };
  };

  let signedIn = isSignedIn();

  const beat = (document: vscode.TextDocument | undefined, isWrite: boolean) => {
    if (!signedIn || !document || document.uri.scheme !== 'file') return;
    const file = document.uri.fsPath;
    // Lines gather between heartbeats and go with the next one for this file.
    if (gate.shouldSend(file, isWrite, Date.now())) sendHeartbeat(file, isWrite, settings(), lines.take(file));
  };

  const refreshToday = async () => {
    signedIn = isSignedIn();
    if (!signedIn) {
      status.text = '$(flame) Commit Kingdom: set up';
      status.tooltip = 'Install Commit Kingdom Desktop and sign in to count your coding.';
      status.command = 'tudi.setup';
      return;
    }
    status.command = 'tudi.today';
    try {
      const today = await runCli(['--today'], settings());
      status.text = `$(flame) ${today || 'Kingdom'}`;
      status.tooltip = 'Commit Kingdom Tracker: today';
    } catch {
      // Signed in, but tudi-cli is missing or cannot answer: Commit Kingdom Desktop installs and updates it.
      status.text = '$(flame) Kingdom';
      status.tooltip = 'Commit Kingdom Tracker: open Commit Kingdom Desktop to finish setting up.';
    }
  };

  context.subscriptions.push(
    status,
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length === 0 || event.document !== vscode.window.activeTextEditor?.document) return;
      if (event.document.uri.scheme === 'file') lines.add(event.document.uri.fsPath, event.contentChanges);
      beat(event.document, false);
    }),
    vscode.workspace.onDidSaveTextDocument(document => beat(document, true)),
    vscode.window.onDidChangeActiveTextEditor(editor => beat(editor?.document, false)),
    vscode.commands.registerCommand('tudi.setup', () => vscode.env.openExternal(vscode.Uri.parse(SETUP_URL))),
    vscode.commands.registerCommand('tudi.today', () => refreshToday()),
  );

  void refreshToday();
  const timer = setInterval(() => void refreshToday(), TODAY_EVERY_MS);
  // Signing in or out in Commit Kingdom Desktop shows up within a few seconds.
  const config = configPath();
  watchFile(config, { interval: 5000 }, () => void refreshToday());
  context.subscriptions.push({ dispose: () => clearInterval(timer) }, { dispose: () => unwatchFile(config) });
}

export function deactivate(): void {}
