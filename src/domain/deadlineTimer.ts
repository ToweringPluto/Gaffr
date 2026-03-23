import type { Gameweek } from '../models';

// --- Types ---

export type DeadlineUrgency = 'normal' | 'warning' | 'locked';

export interface DeadlineCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export interface DeadlineState {
  countdown: DeadlineCountdown;
  urgency: DeadlineUrgency;
  deadlineUtc: string;       // ISO 8601 UTC
  deadlineLocal: string;     // ISO 8601 in manager's timezone
  gameweek: number;
  isLocked: boolean;
}

// --- Countdown Calculation ---

/**
 * Calculate the countdown between now and a deadline.
 * Returns a DeadlineCountdown with days/hours/minutes/seconds and totalMs.
 * If the deadline has passed, all values are 0 and totalMs is 0.
 */
export function calculateCountdown(
  now: Date,
  deadline: Date,
): DeadlineCountdown {
  const totalMs = Math.max(0, deadline.getTime() - now.getTime());

  if (totalMs === 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalMs };
}

// --- Urgency State Transitions ---

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Determine the urgency state based on time remaining.
 *
 * - 'locked'  — deadline has passed (totalMs === 0)
 * - 'warning' — within 24 hours of deadline
 * - 'normal'  — more than 24 hours remaining
 */
export function getUrgency(countdown: DeadlineCountdown): DeadlineUrgency {
  if (countdown.totalMs === 0) return 'locked';
  if (countdown.totalMs <= TWENTY_FOUR_HOURS_MS) return 'warning';
  return 'normal';
}

// --- Timezone Conversion ---

/**
 * Convert a UTC ISO 8601 deadline string to a local time string
 * in the given IANA timezone (e.g. 'Europe/London', 'America/New_York').
 *
 * Returns an ISO 8601-style string in the target timezone.
 */
export function convertToLocalTime(
  deadlineUtc: string,
  timezone: string,
): string {
  const date = new Date(deadlineUtc);
  // Use Intl.DateTimeFormat to produce a locale-independent representation
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

// --- Full Deadline State ---

/**
 * Build the complete deadline state for the current gameweek.
 *
 * Finds the current or next gameweek deadline from the gameweek list,
 * computes countdown, urgency, and local time.
 *
 * If the current gameweek deadline has passed (locked), it looks for
 * the next upcoming deadline.
 */
export function getDeadlineState(
  gameweeks: Gameweek[],
  now: Date,
  timezone: string,
): DeadlineState | null {
  if (gameweeks.length === 0) return null;

  // Find the current gameweek first
  const current = gameweeks.find((gw) => gw.isCurrent);
  const next = gameweeks.find((gw) => gw.isNext);

  // Determine which deadline to show
  let targetGw: Gameweek | undefined;

  if (current) {
    const currentDeadline = new Date(current.deadlineTime);
    if (currentDeadline.getTime() > now.getTime()) {
      // Current GW deadline hasn't passed yet
      targetGw = current;
    } else {
      // Current GW is locked, show next
      targetGw = next;
    }
  } else {
    // No current GW, try next
    targetGw = next;
  }

  // Fallback: find the first unfinished gameweek with a future deadline
  if (!targetGw) {
    targetGw = gameweeks
      .filter((gw) => !gw.finished)
      .sort((a, b) => a.id - b.id)
      .find((gw) => new Date(gw.deadlineTime).getTime() > now.getTime());
  }

  if (!targetGw) return null;

  const deadline = new Date(targetGw.deadlineTime);
  const countdown = calculateCountdown(now, deadline);
  const urgency = getUrgency(countdown);

  return {
    countdown,
    urgency,
    deadlineUtc: targetGw.deadlineTime,
    deadlineLocal: convertToLocalTime(targetGw.deadlineTime, timezone),
    gameweek: targetGw.id,
    isLocked: urgency === 'locked',
  };
}
