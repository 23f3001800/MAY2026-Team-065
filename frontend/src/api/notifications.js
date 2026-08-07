// Notification endpoints.
import { apiRequest } from './client';
import { fromApiNotification } from './mappers';

/**
 * The citizen's inbox. All filtering is server-side now.
 * @param {object} [opts]
 * @param {boolean} [opts.unreadOnly]
 * @param {string}  [opts.type]
 * @param {number}  [opts.skip]
 * @param {number}  [opts.limit] max 100
 */
export async function listMyNotifications(opts = {}) {
  const data = await apiRequest('/notifications/me', {
    params: {
      unreadOnly: opts.unreadOnly ? 'true' : undefined,
      type: opts.type,
      skip: opts.skip,
      limit: opts.limit,
    },
  });
  return (data || []).map(fromApiNotification);
}

// Cheap poll target for the sidebar badge — avoids pulling the whole list.
export async function getUnreadCount() {
  const data = await apiRequest('/notifications/me/unread-count');
  return data?.unread ?? 0;
}

export function markNotificationRead(notificationId, isRead = true) {
  return apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    body: { isRead },
  });
}

// Returns { message, updated } — `updated` is how many rows changed.
export async function markAllNotificationsRead() {
  const data = await apiRequest('/notifications/me/read-all', { method: 'POST' });
  return data?.updated ?? 0;
}

export function deleteNotification(notificationId) {
  return apiRequest(`/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
  });
}
