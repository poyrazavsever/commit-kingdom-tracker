import { unwatchFile, watchFile } from 'node:fs';
import * as vscode from 'vscode';
import { CliSettings, runCli, sendHeartbeat } from './cli';
import { configPath, isSignedIn, SETUP_URL } from './config';
import { HeartbeatGate } from './gate';

const TODAY_EVERY_MS = 5 * 60 * 1000;

/**
 * Tudi Tracker for VS Code, Cursor, Windsurf, VSCodium and Antigravity (ADR-024): reports coding to tudi-cli, which
 * strips everything private before anything leaves the computer. The extension itself never reads file contents.
 * Signing in belongs to Tudi Desktop (ADR-027): it writes the key to tudi-cli's config and installs tudi-cli; until
 * then the extension sends nothing and points to Tudi Desktop.
 */
export function activate(context: vscode.ExtensionContext): void {
  const gate = new HeartbeatGate();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  status.command = 'tudi.today';
  status.text = '$(flame) Tudi';
  status.tooltip = 'Tudi Tracker';
  status.show();

  const settings = (): CliSettings => {
    const config = vscode.workspace.getConfiguration('tudi');
    const version = (context.extension.packageJSON as { version: string }).version;
    return { cliPath: config.get<string>('cliPath', ''), apiUrl: config.get<string>('apiUrl', ''), plugin: `vscode/${vscode.version} tudi-vscode/${version}` };
  };

  let signedIn = isSignedIn();

  const beat = (document: vscode.TextDocument | undefined, isWrite: boolean) => {
    if (!signedIn || !document || document.uri.scheme !== 'file') return;
    if (gate.shouldSend(document.uri.fsPath, isWrite, Date.now())) sendHeartbeat(document.uri.fsPath, isWrite, settings());
  };

  const refreshToday = async () => {
    signedIn = isSignedIn();
    if (!signedIn) {
      status.text = '$(flame) Tudi: set up';
      status.tooltip = 'Install Tudi Desktop and sign in to count your coding.';
      status.command = 'tudi.setup';
      return;
    }
    status.command = 'tudi.today';
    try {
      const today = await runCli(['--today'], settings());
      status.text = `$(flame) ${today || 'Tudi'}`;
      status.tooltip = 'Tudi Tracker: today';
    } catch {
      // Signed in, but tudi-cli is missing or cannot answer: Tudi Desktop installs and updates it.
      status.text = '$(flame) Tudi';
      status.tooltip = 'Tudi Tracker: open Tudi Desktop to finish setting up.';
    }
  };

  context.subscriptions.push(
    status,
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length > 0 && event.document === vscode.window.activeTextEditor?.document) beat(event.document, false);
    }),
    vscode.workspace.onDidSaveTextDocument(document => beat(document, true)),
    vscode.window.onDidChangeActiveTextEditor(editor => beat(editor?.document, false)),
    vscode.commands.registerCommand('tudi.setup', () => vscode.env.openExternal(vscode.Uri.parse(SETUP_URL))),
    vscode.commands.registerCommand('tudi.today', () => refreshToday()),
  );

  void refreshToday();
  const timer = setInterval(() => void refreshToday(), TODAY_EVERY_MS);
  // Signing in or out in Tudi Desktop shows up within a few seconds.
  const config = configPath();
  watchFile(config, { interval: 5000 }, () => void refreshToday());
  context.subscriptions.push({ dispose: () => clearInterval(timer) }, { dispose: () => unwatchFile(config) });
}

export function deactivate(): void {}
