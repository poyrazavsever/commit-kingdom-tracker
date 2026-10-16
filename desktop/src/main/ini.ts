/**
 * Sets (or with null removes) keys in one section of an INI text and leaves every other line as it was, so the
 * member's own tudi-cli settings survive. Adds the section when it is missing.
 */
export function setIniValues(text: string, section: string, values: Record<string, string | null>): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text === '' ? [] : text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const pending = new Map(Object.entries(values));
  const header = (line: string) => /^\s*\[([^\]]+)\]\s*$/.exec(line)?.[1].trim().toLowerCase();

  let start = lines.findIndex(line => header(line) === section.toLowerCase());
  if (start === -1) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(`[${section}]`);
    start = lines.length - 1;
  }
  let end = lines.findIndex((line, index) => index > start && header(line) !== undefined);
  if (end === -1) end = lines.length;

  for (let index = end - 1; index > start; index--) {
    const key = /^\s*([^=;#\s][^=]*?)\s*=/.exec(lines[index])?.[1].toLowerCase();
    if (key === undefined || !pending.has(key)) continue;
    const value = pending.get(key);
    pending.delete(key);
    if (value === null || value === undefined) {
      lines.splice(index, 1);
      end--;
    } else {
      lines[index] = `${key} = ${value}`;
    }
  }

  // New keys go after the section's last setting, before the blank lines that separate it from the next one.
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === '') insertAt--;
  const added = [...pending].filter(([, value]) => value !== null).map(([key, value]) => `${key} = ${value}`);
  lines.splice(insertAt, 0, ...added);
  return lines.join(eol) + eol;
}

export function readIniValue(text: string, section: string, key: string): string | undefined {
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header) {
      inSection = header[1].trim().toLowerCase() === section.toLowerCase();
      continue;
    }
    const pair = /^\s*([^=;#\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line);
    if (inSection && pair && pair[1].toLowerCase() === key.toLowerCase()) return pair[2];
  }
  return undefined;
}
