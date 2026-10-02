export type NotificationPreferences = { in_app_alerts: boolean; unread_badge: boolean };

export function notificationPreferences(user: { user_metadata?: Record<string, unknown> } | null | undefined): NotificationPreferences {
  const value = user?.user_metadata?.notification_preferences as Partial<NotificationPreferences> | undefined;
  return { in_app_alerts: value?.in_app_alerts !== false, unread_badge: value?.unread_badge !== false };
}
