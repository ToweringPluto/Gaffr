import * as Notifications from 'expo-notifications';
import { scheduleDeadlineReminder, cancelDeadlineReminder } from '../notifications/deadlineNotifier';

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-10T10:00:00Z').getTime());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduleDeadlineReminder', () => {
  it('schedules a notification 1 hour before deadline', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockSchedule.mockResolvedValue('id');
    mockCancel.mockResolvedValue(undefined);

    // Deadline is 3 hours from now — trigger should be 2 hours from now
    const deadline = '2025-01-10T13:00:00Z';
    await scheduleDeadlineReminder(deadline);

    expect(mockSchedule).toHaveBeenCalledWith({
      identifier: 'gaffr-deadline-reminder',
      content: {
        title: 'GAFFR DEADLINE',
        body: 'GAMEWEEK DEADLINE IN 1 HOUR -- MAKE YOUR TRANSFERS',
      },
      trigger: {
        type: 'timeInterval',
        seconds: 7200, // 2 hours in seconds
        repeats: false,
      },
    });
  });

  it('does not schedule when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });

    await scheduleDeadlineReminder('2025-01-10T13:00:00Z');

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not schedule when deadline is less than 1 hour away', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });

    // Deadline is 30 minutes from now
    const deadline = '2025-01-10T10:30:00Z';
    await scheduleDeadlineReminder(deadline);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not schedule when deadline has already passed', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });

    const deadline = '2025-01-10T09:00:00Z';
    await scheduleDeadlineReminder(deadline);

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('cancels existing notification before scheduling a new one', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockSchedule.mockResolvedValue('id');
    mockCancel.mockResolvedValue(undefined);

    await scheduleDeadlineReminder('2025-01-10T13:00:00Z');

    expect(mockCancel).toHaveBeenCalledWith('gaffr-deadline-reminder');
    // Cancel is called before schedule — verify ordering via call order
    const cancelOrder = mockCancel.mock.invocationCallOrder[0];
    const scheduleOrder = mockSchedule.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(scheduleOrder);
  });

  it('does not throw when scheduling fails', async () => {
    mockRequestPermissions.mockRejectedValue(new Error('fail'));

    await expect(scheduleDeadlineReminder('2025-01-10T13:00:00Z')).resolves.toBeUndefined();
  });
});

describe('cancelDeadlineReminder', () => {
  it('cancels the scheduled notification', async () => {
    mockCancel.mockResolvedValue(undefined);

    await cancelDeadlineReminder();

    expect(mockCancel).toHaveBeenCalledWith('gaffr-deadline-reminder');
  });

  it('does not throw when cancel fails', async () => {
    mockCancel.mockRejectedValue(new Error('not found'));

    await expect(cancelDeadlineReminder()).resolves.toBeUndefined();
  });
});
