import { describe, expect, it, vi } from 'vitest';
import { ExecutionTracker, ExecutionTrackerResult } from '../src/execution-tracker';
import {
  NativeNotification,
  NativeNotificationOptions,
  NotificationPlatform,
  NotificationService,
} from '../src/notification-service';
import { AppSettings, DEFAULT_SETTINGS } from '../src/settings-store';
import { AgentEvent } from '../src/adapters/types';

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    notificationsEnabled: true,
    ...overrides,
  };
}

function event(type: AgentEvent['type'], timestamp = 100): AgentEvent {
  return {
    type,
    adapterId: 'claude-code',
    sessionId: 'one',
    agentName: 'Claude',
    projectName: 'website',
    timestamp,
  };
}

function result(type: AgentEvent['type']): ExecutionTrackerResult {
  const tracker = new ExecutionTracker({ now: () => 100 });
  return tracker.handle(event(type));
}

function setup(overrides: {
  supported?: boolean;
  visible?: boolean;
} = {}) {
  let clickHandler: (() => void) | undefined;
  const nativeNotification: NativeNotification = {
    on: vi.fn((eventName, handler) => {
      if (eventName === 'click') clickHandler = handler;
    }),
    show: vi.fn(),
  };
  const platform: NotificationPlatform = {
    isSupported: vi.fn(() => overrides.supported ?? true),
    create: vi.fn((_options: NativeNotificationOptions) => nativeNotification),
  };
  const openAgents = vi.fn();
  const service = new NotificationService({
    platform,
    isPopoverVisible: () => overrides.visible ?? false,
    openAgents,
  });
  return { service, platform, nativeNotification, openAgents, click: () => clickHandler?.() };
}

describe('NotificationService', () => {
  it('does nothing when notifications are disabled', () => {
    const { service, platform } = setup();

    expect(service.handle(result('needs_user'), settings({ notificationsEnabled: false }))).toBe(false);
    expect(platform.create).not.toHaveBeenCalled();
  });

  it.each([
    ['needs_user', { notifyNeedsUser: false }],
    ['task_finished', { notifyFinished: false }],
  ] as const)('respects the event preference for %s', (type, preference) => {
    const { service, platform } = setup();

    expect(service.handle(result(type), settings(preference))).toBe(false);
    expect(platform.create).not.toHaveBeenCalled();
  });

  it.each(['prompt_submitted', 'work_resumed'] as const)('does not notify for %s', (type) => {
    const { service, platform } = setup();

    expect(service.handle(result(type), settings())).toBe(false);
    expect(platform.create).not.toHaveBeenCalled();
  });

  it('does not notify for a duplicate tracker event', () => {
    const tracker = new ExecutionTracker({ now: () => 200 });
    tracker.handle(event('needs_user', 100));
    const duplicate = tracker.handle(event('needs_user', 200));
    const { service, platform } = setup();

    expect(service.handle(duplicate, settings())).toBe(false);
    expect(platform.create).not.toHaveBeenCalled();
  });

  it('suppresses the system notification while the popover is visible', () => {
    const { service, platform } = setup({ visible: true });

    expect(service.handle(result('needs_user'), settings())).toBe(false);
    expect(platform.create).not.toHaveBeenCalled();
  });

  it('does not notify when the operating system reports no support', () => {
    const { service, platform } = setup({ supported: false });

    expect(service.handle(result('task_finished'), settings())).toBe(false);
    expect(platform.create).not.toHaveBeenCalled();
  });

  it('creates and shows a silent attention notification by default', () => {
    const { service, platform, nativeNotification } = setup();

    expect(service.handle(result('needs_user'), settings())).toBe(true);
    expect(platform.create).toHaveBeenCalledWith({
      title: 'Claude · website needs your attention',
      body: 'Waiting for confirmation or a response.',
      silent: true,
    });
    expect(nativeNotification.show).toHaveBeenCalledOnce();
  });

  it('allows the system sound when configured', () => {
    const { service, platform } = setup();

    service.handle(result('task_finished'), settings({ notificationSound: 'system' }));

    expect(platform.create).toHaveBeenCalledWith(expect.objectContaining({ silent: false }));
  });

  it('opens Agents and identifies the execution when the notification is clicked', () => {
    const { service, openAgents, click } = setup();
    const trackerResult = result('task_finished');

    service.handle(trackerResult, settings());
    click();

    expect(openAgents).toHaveBeenCalledWith(trackerResult.execution?.id);
  });
});
