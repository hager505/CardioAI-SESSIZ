// patient/notifications/script.js
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
  toast.innerHTML = `<i class="fas fa-${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;

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

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Type inference ──────────────────────────────────────────────────────────
// The DB notifications table doesn't have a type column, so we infer one
// from the title and message. Order matters: more specific matches first.
function inferType(n) {
  const t = `${n.title || ''} ${n.message || ''}`.toLowerCase();

  // Critical — anything that explicitly sounds like an emergency
  if (/urgent|critical|emergency|immediate|seeks? care|afib|atrial fibrillation|heart attack|stroke/.test(t)) {
    return 'critical';
  }

  // AI / predictive insights
  if (/ai |recommend|insight|trend|risk|preventive|predict/.test(t)) {
    return 'warning';
  }

  // Appointments + reminders
  if (/appointment|schedule|booking|follow-up|follow up|consultation|reminder/.test(t)) {
    return 'info';
  }

  // Medications
  if (/medication|medicine|refill|dosage|prescription|pill/.test(t)) {
    return 'success';
  }

  // Vitals, records, system
  if (/vital|record|upload|document|profile|password|system|device/.test(t)) {
    return 'system';
  }

  return 'info';
}

const TYPE_CONFIG = {
  critical: { icon: 'exclamation-triangle', label: 'Health Alert',   cssClass: 'alert-critical' },
  warning:  { icon: 'brain',                label: 'AI Insight',     cssClass: 'alert-warning'  },
  info:     { icon: 'calendar-check',       label: 'Reminder',       cssClass: 'alert-info'     },
  success:  { icon: 'pills',                label: 'Medication',     cssClass: 'alert-success'  },
  system:   { icon: 'cog',                  label: 'System',         cssClass: 'alert-system'   },
};

// ─── State ────────────────────────────────────────────────────────────────────
let allNotifications = [];
let activeFilter     = 'all';
let currentDetailId  = null;

// ─── Fetch notifications ──────────────────────────────────────────────────────
async function loadNotifications() {
  try {
    const res  = await fetch(`${API}/patients/${userId}/notifications`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    allNotifications = json.data || json.notifications || [];
  } catch {
    const cached = sessionStorage.getItem('notifications_cache');
    allNotifications = cached ? JSON.parse(cached) : [];
    if (allNotifications.length) showToast('Showing cached notifications — offline', 'info');
  }

  // Seed a few welcome notifications for brand-new accounts so the
  // notification center isn't empty on first visit.
  if (allNotifications.length === 0 && !localStorage.getItem(`notif_seeded_${userId}`)) {
    await seedDemoNotifications();
    try {
      const res = await fetch(`${API}/patients/${userId}/notifications`);
      if (res.ok) {
        const json = await res.json();
        allNotifications = json.data || [];
      }
    } catch { /* ignore */ }
    localStorage.setItem(`notif_seeded_${userId}`, '1');
  }

  sessionStorage.setItem('notifications_cache', JSON.stringify(allNotifications));
  renderNotifications();
  updateBadge();
}

async function seedDemoNotifications() {
  const seeds = [
    { title: 'Welcome to CardioAI', message: 'Your personal heart-health assistant is ready. Book your first appointment to get started.' },
    { title: 'AI Health Recommendation', message: 'Based on your profile, we recommend recording your vitals at least once a week to track trends.' },
    { title: 'Appointment Reminder', message: 'You have no upcoming appointments. Tap "New Appointment" on the Appointments page to schedule one.' },
  ];
  for (const s of seeds) {
    try {
      await fetch(`${API}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: parseInt(userId, 10), title: s.title, message: s.message }),
      });
    } catch { /* ignore */ }
  }
}

// ─── Render cards ─────────────────────────────────────────────────────────────
function renderNotifications() {
  const grid = document.getElementById('notificationsGrid');
  if (!grid) return;

  const readIds = JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]');

  const visible = allNotifications
    .map(n => ({ n, type: inferType(n) }))
    .filter(({ type }) => activeFilter === 'all' || type === activeFilter);

  if (!visible.length) {
    grid.innerHTML = `
      <div class="notifications-empty">
        <i class="fas fa-bell-slash"></i>
        <h3>No notifications in this category</h3>
        <p>New updates will appear here when your care team sends them, or when you take actions like booking an appointment.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';

  visible.forEach(({ n, type }) => {
    const cfg      = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const isRead   = readIds.includes(n.id) || !!n.is_read;
    const timeStr  = relativeTime(n.created_at);

    const card = document.createElement('div');
    card.className   = `notification-card ${cfg.cssClass}${isRead ? ' read' : ''}`;
    card.dataset.id   = n.id;
    card.dataset.type = type;

    card.innerHTML = `
      <div class="notification-icon"><i class="fas fa-${cfg.icon}"></i></div>
      <div class="notification-content">
        <div class="notification-header">
          <h3 class="notification-title">${escapeHtml(n.title || 'Notification')}</h3>
          <span class="notification-tag ${type}">${cfg.label}</span>
        </div>
        <p class="notification-desc">${escapeHtml(n.message || '')}</p>
        <div class="notification-footer">
          <span class="notification-time"><i class="far fa-clock"></i> ${timeStr}</span>
          <div class="notification-actions">
            <button class="notification-action-btn view-detail-btn" data-id="${n.id}">
              <i class="fas fa-eye"></i> Details
            </button>
            ${!isRead ? `<button class="notification-action-btn mark-read-btn" data-id="${n.id}">
                          <i class="fas fa-check"></i> Mark Read
                        </button>` : ''}
          </div>
        </div>
      </div>`;

    card.querySelector('.view-detail-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      openDetailModal(n, type);
    });
    card.querySelector('.mark-read-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      markAsRead(n.id);
    });
    card.addEventListener('click', () => openDetailModal(n, type));

    grid.appendChild(card);
  });
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
function openDetailModal(n, type) {
  currentDetailId = n.id;
  const modal = document.getElementById('notificationDetailModal');
  if (!modal) return;

  document.getElementById('detailTitle').textContent   = n.title   || 'Notification';
  document.getElementById('detailMessage').textContent = n.message || '';

  const instructionsEl = document.getElementById('detailInstructions');
  if (instructionsEl) {
    instructionsEl.innerHTML = buildNextStepsHTML(type);
  }

  // Tweak the "Take Action" button label based on inferred type
  const takeActionBtn = document.getElementById('detailTakeActionBtn');
  const actionLabel = {
    critical: 'Acknowledge & Notify Care Team',
    info:     'Open Appointments',
    success:  'Open Medications',
    warning:  'View AI Analysis',
    system:   'View Details',
  }[type] || 'Take Action';
  if (takeActionBtn) takeActionBtn.innerHTML = `<i class="fas fa-play-circle mr-sm"></i> ${actionLabel}`;

  // Persist the "currently shown notification" so the buttons can act
  modal.dataset.currentId    = n.id;
  modal.dataset.currentType  = type;

  modal.classList.add('active');
}

function buildNextStepsHTML(type) {
  const steps = {
    critical: [
      'Stay calm and follow your care plan',
      'If symptoms worsen, contact your doctor or emergency services',
      'Your care team has been notified automatically',
    ],
    warning: [
      'Review the AI insight carefully',
      'Note any new symptoms to share with your doctor',
      'Schedule a follow-up if recommended',
    ],
    info: [
      'Confirm the date and time',
      'Prepare any questions for your doctor',
      'Add the appointment to your calendar',
    ],
    success: [
      'Take the medication exactly as prescribed',
      'Set up a daily reminder if needed',
      'Refill before you run out',
    ],
    system: [
      'Review the change in your profile / records',
      'Contact support if something looks wrong',
    ],
  }[type] || [
    'Follow up with your care team if needed',
    'Monitor your symptoms',
    'Contact support if you have questions',
  ];

  return `
    <div class="instructions">
      <h4>Recommended next steps</h4>
      <ul>${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
    </div>`;
}

function handleNotificationAction() {
  const modal = document.getElementById('notificationDetailModal');
  const type  = modal?.dataset.currentType || 'info';
  const id    = modal?.dataset.currentId;

  switch (type) {
    case 'critical':
      showToast('Your care team has been notified.', 'warning');
      break;
    case 'info':
      window.location.href = '../appointments/appointment.html';
      return;
    case 'success':
      window.location.href = '../medications/medications.html';
      return;
    case 'warning':
      window.location.href = '../profile/profile.html';
      return;
    case 'system':
    default:
      showToast('Action noted.', 'success');
  }

  if (id) markAsRead(id);
  modal?.classList.remove('active');
}

// ─── Mark as read ─────────────────────────────────────────────────────────────
async function markAsRead(notifId) {
  const readIds = JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]');
  if (!readIds.includes(notifId)) {
    readIds.push(notifId);
    localStorage.setItem(`read_notifs_${userId}`, JSON.stringify(readIds));
  }

  // Also flip the DB record
  try {
    await fetch(`${API}/notifications/${notifId}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: parseInt(userId, 10) }),
    });
  } catch { /* local state already updated */ }

  renderNotifications();
  updateBadge();
  // Let other tabs / shared listeners know the unread count changed.
  window.dispatchEvent(new CustomEvent('notifications:updated'));
}

async function markAllRead() {
  const ids = allNotifications.map(n => n.id);
  const readIds = [...new Set([
    ...JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]'),
    ...ids,
  ])];
  localStorage.setItem(`read_notifs_${userId}`, JSON.stringify(readIds));

  try {
    await fetch(`${API}/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: parseInt(userId, 10) }),
    });
  } catch { /* silent */ }

  renderNotifications();
  updateBadge();
  window.dispatchEvent(new CustomEvent('notifications:updated'));
  showToast('All notifications marked as read.', 'success');
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function updateBadge() {
  const readIds = JSON.parse(localStorage.getItem(`read_notifs_${userId}`) || '[]');
  const unread  = allNotifications.filter(n => !readIds.includes(n.id) && !n.is_read).length;
  const badge   = document.getElementById('notifBadge');
  if (!badge) return;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter || 'all';
      renderNotifications();
    });
  });
}

function initDetailModal() {
  const modal = document.getElementById('notificationDetailModal');
  if (!modal) return;

  document.getElementById('closeDetailBtn')?.addEventListener('click', () => modal.classList.remove('active'));
  document.getElementById('detailMarkReadBtn')?.addEventListener('click', () => {
    const id = modal.dataset.currentId;
    if (id) markAsRead(id);
    modal.classList.remove('active');
  });
  document.getElementById('detailTakeActionBtn')?.addEventListener('click', handleNotificationAction);
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
}

function initMarkAllBtn() {
  document.getElementById('markAllReadBtn')?.addEventListener('click', markAllRead);
}

function initLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', e => {
    e.preventDefault();
    if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
      AuthManager.handleLogout();
    } else {
      sessionStorage.clear();
      localStorage.removeItem('isLoggedIn');
      window.location.href = '../../auth/login.html';
    }
  });
}

function initHeaderShortcuts() {
  document.getElementById('notificationsBtn')?.addEventListener('click', e => {
    e.preventDefault();
    // We're already on the notifications page — just refresh
    loadNotifications();
  });
}

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

document.addEventListener('DOMContentLoaded', () => {
  initFilterTabs();
  initDetailModal();
  initMarkAllBtn();
  initLogout();
  initHeaderShortcuts();
  loadNotifications();
});
