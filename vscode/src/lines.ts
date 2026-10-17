/** The part of a VS Code text change the line count needs (vscode.TextDocumentContentChangeEvent). */
export type LineChange = { text: string; range: { start: { line: number }; end: { line: number } } };

/** Net lines one edit adds (negative when it removes more than it adds), counted the way tudi-cli counts AI lines. */
export function lineDelta(change: LineChange): number {
  const added = change.text.split('\n').length - 1;
  const removed = change.range.end.line - change.range.start.line;
  return added - removed;
}

/**
 * The person's line changes per file since that file's last heartbeat. tudi-cli gets them as --human-line-changes,
 * so the server can tell a person's minutes from an AI tool's (ADR-024): without them every slice looks human.
 */
export class LineCounter {
  private readonly pending = new Map<string, number>();

  add(file: string, changes: readonly LineChange[]): void {
    const delta = changes.reduce((sum, change) => sum + lineDelta(change), 0);
    if (delta !== 0) this.pending.set(file, (this.pending.get(file) ?? 0) + delta);
  }

  /** Returns and clears what has gathered for the file. */
  take(file: string): number {
    const lines = this.pending.get(file) ?? 0;
    this.pending.delete(file);
    return lines;
  }
}
