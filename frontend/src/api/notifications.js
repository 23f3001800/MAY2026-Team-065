// Notification endpoints.
//
// The backend exposes the inbox only. There is no mark-as-read endpoint yet, so
// read state stays client-side and resets on reload -- see Notifications.jsx.
// TODO(raja-api): PATCH /notifications/{id} { isRead } to persist it.
import { apiRequest } from './client';
import { fromApiNotification } from './mappers';

// Citizen-only on the backend; other roles get a 403.
export async function listMyNotifications() {
  const data = await apiRequest('/notifications/me');
  return (data || []).map(fromApiNotification);
}
