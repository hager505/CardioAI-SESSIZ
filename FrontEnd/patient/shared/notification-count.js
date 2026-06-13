// patient/shared/notification-count.js
// Shared header/sidebar notification badge — included on every patient page.
// Fetches /api/patients/:id/notifications, subtracts locally-tracked read
// IDs, and renders an unread count next to the bell + sidebar link.
// Exposes window.NotificationCount.refresh() so page scripts can force a
// re-fetch after they create a new notification.

(function () {
  const API = 'http://localhost:5000/api';

  // Auth guard: bail out quietly if there's no logged-in patient.
  const userId = sessionStorage.getItem('user_id');
  const role   = sessionStorage.getItem('user_role');
  if (!userId || role !== 'patient') return;

  const READ_KEY = `read_notifs_${userId}`;

  // ── Helpers ────────────────────────────────────────────────────────────
  const getReadIds = () => {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); }
    catch { return []; }
  };

  const getNotifications = () => {
    try { return JSON.parse(sessionStorage.getItem('notifications_cache') || '[]'); }
    catch { return []; }
  };

  // ── DOM injection ──────────────────────────────────────────────────────
  // If the page already declared <span id="notifBadge"> we use it; otherwise
  // we inject one into the bell button. We always inject a sidebar badge
  // if the sidebar Notifications link exists, so the count shows up there
  // even on pages that don't put a badge in the header.
  const ensureHeaderBadge = () => {
    const bell = document.getElementById('notificationsBtn');
    if (!bell) return null;
    bell.style.position = bell.style.position || 'relative';
    let badge = document.getElementById('notifBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'notifBadge';
      badge.className = 'notification-badge';
      badge.style.display = 'none';
      bell.appendChild(badge);
    }
    return badge;
  };

  const ensureSidebarBadge = () => {
    // Match the sidebar Notifications link whether it's a relative href
    // (notifications/notification.html on the notifications page itself) or
    // a path-from-sibling href (../notifications/notification.html on the
    // other pages).
    const link = document.querySelector(
      'a.dashboard-sidebar__item[href$="notification.html"]'
    );
    if (!link) return null;
    link.style.position = link.style.position || 'relative';
    let badge = document.getElementById('sidebarNotifBadge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'sidebarNotifBadge';
      badge.className = 'sidebar-notif-badge';
      badge.style.display = 'none';
      link.appendChild(badge);
    }
    return badge;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  function render(notifications) {
    const readIds = getReadIds();
    const unread  = notifications.filter(n => !readIds.includes(n.id) && !n.is_read).length;

    const header  = ensureHeaderBadge();
    if (header) {
      if (unread > 0) {
        header.textContent = unread > 9 ? '9+' : String(unread);
        header.style.display = '';
      } else {
        header.style.display = 'none';
      }
    }

    const sidebar = ensureSidebarBadge();
    if (sidebar) {
      if (unread > 0) {
        sidebar.textContent = unread > 9 ? '9+' : String(unread);
        sidebar.style.display = '';
      } else {
        sidebar.style.display = 'none';
      }
    }

    // Dashboard welcome card button — replace its text with the unread
    // count so the entry point on the home page stays in sync too.
    const quick = document.getElementById('quickNotifications');
    if (quick) {
      const labelSpan = quick.querySelector('span');
      if (labelSpan) {
        if (unread > 0) {
          labelSpan.textContent = `${unread} New Notification${unread > 1 ? 's' : ''}`;
        } else {
          labelSpan.textContent = 'No new notifications';
        }
      }
    }

    // Title bar count (browser tab) — small touch but useful.
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = unread > 0 ? `(${unread > 9 ? '9+' : unread}) ${base}` : base;
  }

  // ── Fetch ──────────────────────────────────────────────────────────────
  async function fetchNotifications() {
    try {
      const res  = await fetch(`${API}/patients/${userId}/notifications`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = json.data || json.notifications || [];
      sessionStorage.setItem('notifications_cache', JSON.stringify(list));
      render(list);
      return list;
    } catch (err) {
      // Offline / server down — fall back to the cached list.
      const cached = getNotifications();
      render(cached);
      return cached;
    }
  }

  // ── Bell click ─────────────────────────────────────────────────────────
  // We only attach a navigation handler on non-notification pages; the
  // notifications page's own script handles the click to re-load data.
  function wireBellClick() {
    const bell = document.getElementById('notificationsBtn');
    if (!bell) return;
    if (window.location.pathname.replace(/\\/g, '/').includes('/notifications/')) return;
    bell.addEventListener('click', e => {
      e.preventDefault();
      window.location.href = '../notifications/notification.html';
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────
  const NotificationCount = {
    /** Force a re-fetch from the server. Safe to call any time. */
    refresh: fetchNotifications,
    /**
     * After creating a notification (e.g. after a successful POST to
     * /api/notifications), call this to update the badge immediately
     * without waiting for the next poll.
     */
    notifyCreated: () => {
      // Fire a custom event so any other listeners can react, then refresh.
      window.dispatchEvent(new CustomEvent('notification:created'));
      fetchNotifications();
    },
  };
  window.NotificationCount = NotificationCount;

  // ── Init ───────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    wireBellClick();
    fetchNotifications();
    // Re-fetch periodically so badge stays fresh even if no event fires.
    setInterval(fetchNotifications, 30000);
  });

  // Also re-render whenever the page itself signals a new notification.
  window.addEventListener('notification:created', () => fetchNotifications());

  // When the user marks a notification as read in another tab, the
  // localStorage change won't reach us here, but the notifications page
  // dispatches a 'notifications:updated' event we can listen to.
  window.addEventListener('notifications:updated', () => fetchNotifications());
})();
