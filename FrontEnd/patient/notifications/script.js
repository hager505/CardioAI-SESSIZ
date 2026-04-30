// ─── Auth Guard ───────────────────────────────────────────────────────────────
const userData = JSON.parse(sessionStorage.getItem('user_data') || 'null');
const userRole = sessionStorage.getItem('user_role');
const userId   = sessionStorage.getItem('user_id');

if (!userData || userRole !== 'patient' || !userId) {
  window.location.href = '../../auth/login.html';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const API = 'http://localhost:5000/api';

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast-runtime');
  if (existing) existing.remove();

  const icons  = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };

  const toast = document.createElement('div');
  toast.className = 'toast-runtime';
  toast.innerHTML = `<i class="fas fa-${icons[type] || icons.info}"></i><span>${message}</span>`;

  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: colors[type] || colors.info,
    color: '#fff', padding: '14px 22px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', gap: '10px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: '9999',
    fontSize: '14px', fontFamily: 'Poppins, sans-serif',
    opacity: '0', transition: 'opacity 0.3s ease', maxWidth: '380px'
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function renderAvatar() {
  // Notification page uses .header-right with icons — inject avatar there
  const container = document.querySelector('.header-right');
  if (!container) return;

  const saved    = localStorage.getItem(`avatar_${userId}`);
  const name     = userData?.full_name || '';
  const parts    = name.trim().split(' ');
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();

  const avatarEl = document.createElement('div');
  Object.assign(avatarEl.style, {
    width: '36px', height: '36px', borderRadius: '50%',
    background: '#003785', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '600', fontSize: '14px', cursor: 'pointer',
    marginLeft: '8px', flexShrink: '0'
  });

  if (saved) {
    avatarEl.innerHTML = `<img src="${saved}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" alt="avatar">`;
  } else {
    avatarEl.textContent = initials;
  }

  container.appendChild(avatarEl);
}

// ─── Notification type config ─────────────────────────────────────────────────
const TYPE_CONFIG = {
  critical: { icon: 'exclamation-triangle', label: 'Critical',     cssClass: 'alert-critical', filterKey: 'critical' },
  warning:  { icon: 'brain',               label: 'Preventive',   cssClass: 'alert-warning',  filterKey: 'warning'  },
  info:     { icon: 'calendar-check',      label: 'Follow-up',    cssClass: 'alert-info',     filterKey: 'info'     },
  success:  { icon: 'pills',               label: 'Daily Care',   cssClass: 'alert-success',  filterKey: 'success'  },
  system:   { icon: 'cog',                 label: 'System',       cssClass: 'alert-info',     filterKey: 'system'   },
};

// ─── State ─────────────────────────────────────────────────────────────────────
let allNotifications = [];   // from API
let activeFilter     = 'all';
let currentDetailId  = null;

// ─── Fetch notifications ───────────────────────────────────────────────────────
async function loadNotifications() {
  try {
    const res  = await fetch(`${API}/patients/${userId}/notifications`);
    const json = await res.json();
    allNotifications = json.data || [];
  } catch {
    // Offline: use sessionStorage cache
    const cached = sessionStorage.getItem('notifications_cache');
    allNotifications = cached ? JSON.parse(cached) : [];
    if (allNotifications.length) showToast('Showing cached notifications — offline', 'info');
  }

  sessionStorage.setItem('notifications_cache', JSON.stringify(allNotifications));
  renderNotifications();
  updateBadge();
}

// ─── Render cards ─────────────────────────────────────────────────────────────
function renderNotifications() {
  const grid = document.querySelector('.notifications-grid');
  if (!grid) return;

  const readIds = JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]');

  const visible = allNotifications.filter(n => {
    if (activeFilter === 'all') return true;
    return (n.notification_type || 'info') === activeFilter;
  });

  if (!visible.length) {
    grid.innerHTML = `
      <div style="text-align:center;padding:48px;color:#6b7280;grid-column:1/-1;">
        <i class="fas fa-bell-slash" style="font-size:48px;margin-bottom:16px;display:block;opacity:.4;"></i>
        <p>No notifications in this category</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';

  visible.forEach(n => {
    const type     = n.notification_type || 'info';
    const cfg      = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const isRead   = readIds.includes(n.id) || n.is_read;
    const timeStr  = relativeTime(n.created_at);

    const card = document.createElement('div');
    card.className   = `notification-card ${cfg.cssClass}${isRead ? ' read-notification' : ''}`;
    card.dataset.type = cfg.filterKey;
    card.dataset.id   = n.id;

    card.innerHTML = `
      <div class="notification-icon">
        <i class="fas fa-${cfg.icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-header">
          <h3 class="notification-title">${escapeHtml(n.title || 'Notification')}</h3>
          <span class="notification-tag ${cfg.filterKey}">${cfg.label}</span>
        </div>
        <p class="notification-desc">${escapeHtml(n.message || '')}</p>
        <div class="notification-footer">
          <span class="notification-time">${timeStr}</span>
          <div class="notification-actions">
            <button class="notification-action-btn primary view-detail-btn" data-id="${n.id}">
              View Details
            </button>
            ${!isRead ? `<button class="notification-action-btn mark-read-btn" data-id="${n.id}">Mark Read</button>` : ''}
          </div>
        </div>
      </div>`;

    // View detail
    card.querySelector('.view-detail-btn').addEventListener('click', e => {
      e.stopPropagation();
      openDetailModal(n);
    });

    // Mark read
    card.querySelector('.mark-read-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      markAsRead(n.id);
    });

    // Card click also opens detail
    card.addEventListener('click', () => openDetailModal(n));

    grid.appendChild(card);
  });
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function openDetailModal(n) {
  currentDetailId = n.id;
  const modal = document.getElementById('notificationDetailModal');
  if (!modal) return;

  document.getElementById('detailTitle').textContent   = n.title   || 'Notification';
  document.getElementById('detailMessage').textContent = n.message || '';

  const instructionsEl = document.getElementById('detailInstructions');
  // Show action_data JSON if present, otherwise show a generic follow-up note
  if (n.action_data) {
    try {
      const data = typeof n.action_data === 'string' ? JSON.parse(n.action_data) : n.action_data;
      instructionsEl.innerHTML = buildInstructionsHTML(data);
    } catch {
      instructionsEl.innerHTML = '';
    }
  } else {
    instructionsEl.innerHTML = `
      <div class="instructions" style="margin-top:16px;">
        <h4 style="margin-bottom:8px;color:#374151;">Next Steps</h4>
        <ul style="padding-left:20px;color:#6b7280;line-height:1.8;">
          <li>Follow up with your care team if needed</li>
          <li>Monitor your symptoms</li>
          <li>Contact support if you have questions</li>
        </ul>
      </div>`;
  }

  modal.classList.add('active');

  // Wire modal action buttons
  document.querySelector('.detail-action-btn.secondary').onclick = () => {
    markAsRead(currentDetailId);
    modal.classList.remove('active');
  };
  document.querySelector('.detail-action-btn.primary').onclick = () => {
    handleNotificationAction(n);
    modal.classList.remove('active');
  };
}

function buildInstructionsHTML(data) {
  if (!data.steps?.length) return '';
  const items = data.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('');
  return `
    <div class="instructions" style="margin-top:16px;">
      <h4 style="margin-bottom:8px;color:#374151;">${escapeHtml(data.heading || 'Recommended Actions')}</h4>
      <ul style="padding-left:20px;color:#6b7280;line-height:1.8;">${items}</ul>
    </div>`;
}

function handleNotificationAction(n) {
  const type = n.notification_type || 'info';
  switch (type) {
    case 'critical':
      showToast('Your care team has been notified. Stay calm.', 'warning');
      break;
    case 'info':
      // Navigate to appointments
      window.location.href = '../appointments/appiontment.html';
      break;
    case 'success':
      markMedicationTaken(n);
      break;
    default:
      showToast('Action noted. Your care team has been informed.', 'success');
  }
}

// ─── Mark as Read ──────────────────────────────────────────────────────────────
async function markAsRead(notifId) {
  // Optimistic local update
  const readIds = JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]');
  if (!readIds.includes(notifId)) {
    readIds.push(notifId);
    localStorage.setItem(`read_notifs_${userId}`, JSON.stringify(readIds));
  }

  // Sync with server
  try {
    await fetch(`${API}/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: parseInt(userId) })
    });
  } catch {
    // Silent fail — local state is already updated
  }

  renderNotifications();
  updateBadge();
  showToast('Notification marked as read.', 'success');
}

// ─── Mark All Read ─────────────────────────────────────────────────────────────
async function markAllRead() {
  const ids = allNotifications.map(n => n.id);
  const readIds = [...new Set([
    ...JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]'),
    ...ids
  ])];
  localStorage.setItem(`read_notifs_${userId}`, JSON.stringify(readIds));

  try {
    await fetch(`${API}/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: parseInt(userId) })
    });
  } catch { /* silent */ }

  renderNotifications();
  updateBadge();
  showToast('All notifications marked as read.', 'success');
}

// ─── Mark Medication Taken ─────────────────────────────────────────────────────
async function markMedicationTaken(n) {
  if (!n.related_id) { showToast('Medication logged as taken.', 'success'); return; }
  try {
    await fetch(`${API}/medications/${n.related_id}/taken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: parseInt(userId), taken_at: new Date().toISOString() })
    });
    showToast('Medication marked as taken!', 'success');
    markAsRead(n.id);
  } catch {
    showToast('Could not log medication. Please try again.', 'error');
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function updateBadge() {
  const readIds = JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]');
  const unread  = allNotifications.filter(n => !readIds.includes(n.id) && !n.is_read).length;
  const badge   = document.querySelector('.notification-badge');
  if (!badge) return;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
function initFilterTabs() {
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      filterTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      activeFilter = this.dataset.filter || 'all';
      renderNotifications();
    });
  });
}

// ─── Mark All button ──────────────────────────────────────────────────────────
function initMarkAllBtn() {
  const btn = document.querySelector('.mark-all-btn');
  if (btn) btn.addEventListener('click', markAllRead);
}

// ─── Close detail modal ───────────────────────────────────────────────────────
function initDetailModal() {
  const modal = document.getElementById('notificationDetailModal');
  if (!modal) return;

  // Close button (in HTML it uses onclick="closeNotificationDetail()")
  window.closeNotificationDetail = () => modal.classList.remove('active');

  // Click outside
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
}

// ─── Search ───────────────────────────────────────────────────────────────────
function initSearch() {
  const searchInput = document.querySelector('.search-box input');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const term  = searchInput.value.toLowerCase();
    const cards = document.querySelectorAll('.notification-card');
    cards.forEach(card => {
      const title = card.querySelector('.notification-title')?.textContent.toLowerCase() || '';
      const desc  = card.querySelector('.notification-desc')?.textContent.toLowerCase() || '';
      card.style.display = (!term || title.includes(term) || desc.includes(term)) ? '' : 'none';
    });
  });
}

// ─── Mobile Sidebar ───────────────────────────────────────────────────────────
function initMobileSidebar() {
  const sidebar      = document.querySelector('.sidebar');
  const headerLeft   = document.querySelector('.header-left');
  if (!sidebar || !headerLeft) return;

  // Remove duplicate toggle inserted by old script if present
  headerLeft.querySelectorAll('.mobile-menu-toggle').forEach(el => el.remove());

  const toggle   = document.createElement('button');
  toggle.className = 'mobile-menu-toggle';
  toggle.innerHTML = '<i class="fas fa-bars"></i>';
  Object.assign(toggle.style, { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#374151' });
  headerLeft.insertBefore(toggle, headerLeft.firstChild);

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  Object.assign(overlay.style, {
    display: 'none', position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.4)', zIndex: '199'
  });
  document.body.appendChild(overlay);

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.style.display = 'none';
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('active');
      overlay.style.display = 'none';
    }
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function initLogout() {
  const logoutBtn = document.querySelector('.logout-btn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', e => {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = '../../auth/login.html';
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1)  return 'Just now';
  if (mins  < 60)  return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hours < 24)  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days  <  7)  return days === 1 ? 'Yesterday' : `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAvatar();
  initMobileSidebar();
  initFilterTabs();
  initMarkAllBtn();
  initDetailModal();
  initSearch();
  initLogout();
  loadNotifications();
});