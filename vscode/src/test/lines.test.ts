import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LineCounter, lineDelta } from '../lines';

const at = (start: number, end: number, text: string) => ({ text, range: { start: { line: start }, end: { line: end } } });

test('an edit counts the lines it adds minus the lines it removes', () => {
  assert.equal(lineDelta(at(3, 3, 'const a = 1;\nconst b = 2;\n')), 2);
  assert.equal(lineDelta(at(3, 6, '')), -3);
  assert.equal(lineDelta(at(3, 3, 'x')), 0);
  assert.equal(lineDelta(at(1, 2, 'one\ntwo\nthree')), 1);
});

test('lines gather per file until that file sends a heartbeat', () => {
  const lines = new LineCounter();
  lines.add('/p/a.ts', [at(0, 0, 'a\n'), at(1, 1, 'b\n')]);
  lines.add('/p/b.ts', [at(0, 1, '')]);
  lines.add('/p/a.ts', [at(2, 2, 'c\n')]);
  assert.equal(lines.take('/p/a.ts'), 3);
  assert.equal(lines.take('/p/a.ts'), 0);
  assert.equal(lines.take('/p/b.ts'), -1);
});
