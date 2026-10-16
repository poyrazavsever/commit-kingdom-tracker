import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Summary } from '../main/api';
import { moodOf, shouldCheer } from '../main/mood';

const now = new Date('2026-10-16T12:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

test('Tudi watches while heartbeats flow, waits after three minutes and sleeps after thirty', () => {
  assert.equal(moodOf(ago(1), now), 'watching');
  assert.equal(moodOf(ago(3), now), 'watching');
  assert.equal(moodOf(ago(4), now), 'waiting');
  assert.equal(moodOf(ago(30), now), 'waiting');
  assert.equal(moodOf(ago(31), now), 'sleeping');
  assert.equal(moodOf(null, now), 'sleeping');
});

const summary = (date: string, rewardedMinutes: number) => ({ today: { date, rewardedMinutes } }) as Summary;

test('Tudi cheers for the first rewarded minute of the day, not on start-up and not again', () => {
  assert.equal(shouldCheer(null, summary('2026-10-16', 5)), false);
  assert.equal(shouldCheer(summary('2026-10-16', 0), summary('2026-10-16', 1)), true);
  assert.equal(shouldCheer(summary('2026-10-16', 1), summary('2026-10-16', 4)), false);
  assert.equal(shouldCheer(summary('2026-10-15', 90), summary('2026-10-16', 2)), true);
  assert.equal(shouldCheer(summary('2026-10-16', 0), summary('2026-10-16', 0)), false);
});
