import * as vscode from 'vscode';
import { CliSettings, runCli, sendHeartbeat } from './cli';
import { HeartbeatGate } from './gate';

const TODAY_EVERY_MS = 5 * 60 * 1000;

/**
 * Tudi Tracker for VS Code, Cursor, Windsurf and VSCodium (ADR-024): reports coding to tudi-cli, which strips
 * everything private before anything leaves the computer. The extension itself never reads file contents.
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

  const beat = (document: vscode.TextDocument | undefined, isWrite: boolean) => {
    if (!document || document.uri.scheme !== 'file') return;
    if (gate.shouldSend(document.uri.fsPath, isWrite, Date.now())) sendHeartbeat(document.uri.fsPath, isWrite, settings());
  };

  const refreshToday = async () => {
    try {
      const today = await runCli(['--today'], settings());
      status.text = `$(flame) ${today || 'Tudi'}`;
      status.tooltip = 'Tudi Tracker: today';
    } catch {
      status.text = '$(flame) Tudi: link';
      status.tooltip = 'Tudi Tracker is not linked yet. Click to see how.';
    }
  };

  context.subscriptions.push(
    status,
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.contentChanges.length > 0 && event.document === vscode.window.activeTextEditor?.document) beat(event.document, false);
    }),
    vscode.workspace.onDidSaveTextDocument(document => beat(document, true)),
    vscode.window.onDidChangeActiveTextEditor(editor => beat(editor?.document, false)),
    vscode.commands.registerCommand('tudi.link', async () => {
      const code = await vscode.window.showInputBox({ title: 'Link this computer to Tudi Daily', prompt: 'The 8-character code from the app (Kod Kulesi → Bilgisayarını bağla)', placeHolder: 'ABCD-EFGH', ignoreFocusOut: true });
      if (!code) return;
      try {
        await runCli(['--link', code.trim()], settings());
        vscode.window.showInformationMessage('Tudi Tracker is linked. Your coding counts from now on.');
        void refreshToday();
      } catch (error) {
        vscode.window.showErrorMessage(`Tudi Tracker could not link: ${(error as Error).message}`);
      }
    }),
    vscode.commands.registerCommand('tudi.today', () => refreshToday()),
  );

  void refreshToday();
  const timer = setInterval(() => void refreshToday(), TODAY_EVERY_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

export function deactivate(): void {}
