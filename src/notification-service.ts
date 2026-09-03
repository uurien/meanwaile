import { ExecutionTrackerResult } from './execution-tracker';
import { buildNotificationCopy, NotifiableTransition } from './notification-copy';
import { AppSettings } from './settings-store';

export interface NativeNotificationOptions {
  title: string;
  body: string;
  silent: boolean;
}

export interface NativeNotification {
  on(eventName: 'click', handler: () => void): void;
  show(): void;
}

export interface NotificationPlatform {
  isSupported(): boolean;
  create(options: NativeNotificationOptions): NativeNotification;
}

export interface NotificationServiceOptions {
  platform: NotificationPlatform;
  isPopoverVisible(): boolean;
  openAgents(executionId: string): void;
}

function isNotifiableTransition(
  transition: ExecutionTrackerResult['transition'],
): transition is NotifiableTransition {
  return transition === 'needs_user' || transition === 'finished';
}

export class NotificationService {
  constructor(private readonly options: NotificationServiceOptions) {}

  handle(result: ExecutionTrackerResult, settings: AppSettings): boolean {
    if (!settings.notificationsEnabled) return false;
    if (!result.isSignificant || !result.execution) return false;
    if (!isNotifiableTransition(result.transition)) return false;
    if (result.transition === 'needs_user' && !settings.notifyNeedsUser) return false;
    if (result.transition === 'finished' && !settings.notifyFinished) return false;
    if (this.options.isPopoverVisible()) return false;
    if (!this.options.platform.isSupported()) return false;

    const copy = buildNotificationCopy(
      result.transition,
      result.execution,
      result.snapshot.counts,
    );
    const notification = this.options.platform.create({
      ...copy,
      silent: settings.notificationSound === 'none',
    });
    const executionId = result.execution.id;
    notification.on('click', () => this.options.openAgents(executionId));
    notification.show();
    return true;
  }
}
