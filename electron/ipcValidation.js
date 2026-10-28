const MAX_TEXT = 500;

// Shape check for the show-notification IPC payload (kept Electron-free for testing).
export function sanitizeNotificationPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const { title, body, route } = payload;
  if (typeof title !== 'string' || typeof body !== 'string') return null;
  if (!title || title.length > MAX_TEXT || body.length > MAX_TEXT) return null;
  // Routes are in-app paths only ("/orders/1"), never URLs or protocol-relative.
  if (
    route !== undefined &&
    (typeof route !== 'string' || !/^\/(?!\/)[\w\-./?=&%#]*$/.test(route))
  ) {
    return null;
  }
  return { title, body, route };
}
