import * as Notifications from 'expo-notifications';

const DEADLINE_NOTIFICATION_ID = 'gaffr-deadline-reminder';

/**
 * Cancel any previously scheduled deadline reminder notification.
 */
export async function cancelDeadlineReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DEADLINE_NOTIFICATION_ID);
  } catch {
    // Notification may not exist — safe to ignore
  }
}

/**
 * Schedule a local push notification for 1 hour before the gameweek deadline.
 *
 * - Requests notification permissions; if denied, silently returns (app continues normally).
 * - Cancels any existing deadline notification before scheduling a new one.
 * - Only schedules if the trigger time (deadline minus 1 hour) is in the future.
 *
 * @param deadlineTime ISO 8601 UTC deadline string from the FPL API
 */
export async function scheduleDeadlineReminder(deadlineTime: string): Promise<void> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      // Permission denied — app functions normally without notifications
      return;
    }

    const deadlineMs = new Date(deadlineTime).getTime();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const triggerMs = deadlineMs - ONE_HOUR_MS;
    const now = Date.now();

    if (triggerMs <= now) {
      // Too late to schedule — deadline is less than 1 hour away (or passed)
      return;
    }

    // Cancel any previously scheduled deadline notification
    await cancelDeadlineReminder();

    const triggerSeconds = Math.floor((triggerMs - now) / 1000);

    await Notifications.scheduleNotificationAsync({
      identifier: DEADLINE_NOTIFICATION_ID,
      content: {
        title: 'GAFFR DEADLINE',
        body: 'GAMEWEEK DEADLINE IN 1 HOUR -- MAKE YOUR TRANSFERS',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
        repeats: false,
      },
    });
  } catch {
    // Notification scheduling failed — app continues normally
  }
}
