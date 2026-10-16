import type { Summary } from './api';

/** What the always-on-top Tudi is doing (ADR-027 §6, brief: Tudi Desktop). */
export type Mood = 'watching' | 'waiting' | 'sleeping' | 'cheering';

/** tudi-cli sends at most every two minutes, so up to three minutes of silence is still coding. */
export const WATCHING_FOR_MS = 3 * 60_000;
export const ASLEEP_AFTER_MS = 30 * 60_000;
/** The whole celebration stays under the 1.5 s choreography limit (Rehber - Ekrandan Ürüne §4). */
export const CHEER_MS = 1_500;

export function moodOf(lastHeartbeatAt: string | null | undefined, now: Date): Exclude<Mood, 'cheering'> {
  if (!lastHeartbeatAt) return 'sleeping';
  const age = now.getTime() - new Date(lastHeartbeatAt).getTime();
  if (age <= WATCHING_FOR_MS) return 'watching';
  if (age <= ASLEEP_AFTER_MS) return 'waiting';
  return 'sleeping';
}

/**
 * Tudi cheers when the day's first rewarded minute arrives (Ürün/Tudi Tracker: “İlk dakikan geldi”). Not on start-up:
 * a day that already had minutes before Tudi Desktop opened is not news. The daily code goal joins in Etap 3.
 */
export function shouldCheer(previous: Summary | null, next: Summary): boolean {
  if (!previous) return false;
  const before = previous.today.date === next.today.date ? previous.today.rewardedMinutes : 0;
  return before === 0 && next.today.rewardedMinutes > 0;
}
