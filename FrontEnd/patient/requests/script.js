// patient/requests/script.js — CardioAI
// Patient-side request page. Lets the patient send a request to a doctor
// they've had an appointment with (medication refill, lab review, or any
// custom ask) and shows the history of their past requests.

const API = 'http://localhost:5000/api';

// ─── Auth ──────────────────────────────────────────────────────────────────
const userData = JSON.parse(sessionStorage.getItem('user_data') || 'null');
const userRole = sessionStorage.getItem('user_role');
const userId   = sessionStorage.getItem('user_id');

if (!userData || userRole !== 'patient' || !userId) {
  window.location.href = '../../auth/login.html';
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer') || (() => {
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `
    <i class="fas ${icons[type] || icons.info} toast-icon"></i>
    <span class="toast-content">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(100%)';
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins} min ago`;
  if (hrs  < 24) return `${hrs} hr ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
function detectType(message) {
  const m = (message ?? '').toLowerCase();
  if (m.startsWith('refill:') || m.includes('refill')) return 'refill';
  if (m.startsWith('lab review:') || m.includes('lab')) return 'lab';
  return 'custom';
}
function stripPrefix(message) {
  if (!message) return '';
  // Strip "Refill: <name>" / "Lab review:" prefixes for display.
  return message.replace(/^(refill|lab review)\s*:\s*/i, '');
}
function titleForRequest(req) {
  if (req.title) return req.title;
  const msg = req.message ?? '';
  const t = detectType(msg);
  if (t === 'refill') {
    const m = stripPrefix(msg);
    return `Refill: ${m}`;
  }
  if (t === 'lab') return 'Lab Review Request';
  return msg.slice(0, 80) + (msg.length > 80 ? '…' : '');
}

let currentType = 'refill';
let allRequests = [];
let allMedications = [];
let allDoctors = [];

// ─── DOM refs ──────────────────────────────────────────────────────────────
const form              = document.getElementById('newRequestForm');
const typeToggle        = document.getElementById('requestTypeToggle');
const refillGroup       = document.getElementById('refillMedicationGroup');
const refillSelect      = document.getElementById('refillMedication');
const messageGroup      = document.getElementById('messageGroup');
const messageInput      = document.getElementById('requestMessage');
const doctorSelect      = document.getElementById('requestDoctor');
const prioritySelect    = document.getElementById('requestPriority');
const submitBtn         = document.getElementById('submitRequestBtn');
const resetBtn          = document.getElementById('resetRequestBtn');
const pastList          = document.getElementById('pastRequestsList');
const statusFilter      = document.getElementById('requestStatusFilter');
const requestsCount     = document.getElementById('requestsCount');

// ─── Load: medications + appointments → derived doctors ────────────────────
async function loadMedications() {
  try {
    const res  = await fetch(`${API}/patients/${userId}/medications`);
    const json = await res.json();
    allMedications = (json.data || json.medications || []).filter(m => (m.status ?? 'active') === 'active');
  } catch {
    allMedications = [];
  }
  renderMedicationOptions();
}

function renderMedicationOptions() {
  if (!allMedications.length) {
    refillSelect.innerHTML = `<option value="">No active medications — add one first</option>`;
    refillSelect.disabled = true;
    return;
  }
  refillSelect.disabled = false;
  refillSelect.innerHTML = `<option value="">Choose a medication…</option>` +
    allMedications.map(m =>
      `<option value="${escHtml(m.medication_name)}">${escHtml(m.medication_name)} — ${escHtml(m.dosage ?? '')}</option>`
    ).join('');
}

async function loadDoctorsFromAppointments() {
  // The patient can only send requests to doctors they've had appointments
  // with. We pull the patient's appointments and de-duplicate by doctor_id.
  try {
    const res  = await fetch(`${API}/patients/${userId}/appointments`);
    const json = await res.json();
    const appts = json.appointments || json.data || [];
    const map = new Map();
    appts.forEach(a => {
      if (a.doctor_id && !map.has(a.doctor_id)) {
        map.set(a.doctor_id, { id: a.doctor_id, name: a.doctor_name || `Doctor #${a.doctor_id}` });
      }
    });
    allDoctors = Array.from(map.values());

    if (!allDoctors.length) {
      doctorSelect.innerHTML = `<option value="">No doctors yet — book an appointment first</option>`;
      doctorSelect.disabled = true;
      return;
    }
    doctorSelect.disabled = false;
    doctorSelect.innerHTML = `<option value="">Choose a doctor…</option>` +
      allDoctors.map(d => `<option value="${d.id}">Dr. ${escHtml(d.name)}</option>`).join('');
  } catch {
    doctorSelect.innerHTML = `<option value="">Could not load doctors</option>`;
  }
}

// ─── Request type toggle ───────────────────────────────────────────────────
function setType(type) {
  currentType = type;
  typeToggle.querySelectorAll('.request-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  // Show the right input
  if (type === 'refill') {
    refillGroup.style.display = '';
    messageGroup.style.display = 'none';
    messageInput.value = '';
  } else {
    refillGroup.style.display = 'none';
    refillSelect.value = '';
    messageGroup.style.display = '';
    if (type === 'lab') {
      messageInput.placeholder = 'e.g., Please review my latest cholesterol panel';
    } else {
      messageInput.placeholder = 'Describe what you need help with…';
    }
  }
}

typeToggle.addEventListener('click', e => {
  const btn = e.target.closest('.request-type-btn');
  if (btn) setType(btn.dataset.type);
});

// ─── Submit ────────────────────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  await submitRequest();
});

async function submitRequest() {
  const doctorId = doctorSelect.value;
  const priority = prioritySelect.value;

  if (!doctorId) {
    showToast('Please choose a doctor to send this request to.', 'error');
    doctorSelect.focus();
    return;
  }

  let message = '';
  let title   = '';

  if (currentType === 'refill') {
    const med = refillSelect.value;
    if (!med) {
      showToast('Please choose a medication to refill.', 'error');
      refillSelect.focus();
      return;
    }
    message = `Refill: ${med} — please approve a refill prescription.`;
    title   = `Refill: ${med}`;
  } else {
    message = messageInput.value.trim();
    if (!message) {
      showToast('Please describe your request.', 'error');
      messageInput.focus();
      return;
    }
    if (currentType === 'lab') {
      title = `Lab review: ${message.slice(0, 60)}`;
    } else {
      title = message.slice(0, 80);
    }
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-sm"></i> Sending…';

  try {
    const res  = await fetch(`${API}/doctor/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id:  parseInt(userId, 10),
        doctor_id:   parseInt(doctorId, 10),
        patientName: userData?.full_name ?? null,
        title,
        message,
        priority,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to send request');

    // Also push a patient-facing notification so it shows up in the
    // notifications page (consistent with the medication refill flow).
    try {
      await fetch(`${API}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: parseInt(userId, 10),
          title: 'Request Sent',
          message: `Your request "${title}" was sent to your doctor.`,
        }),
      });
    } catch (_) { /* non-blocking */ }

    showToast('Request sent to your doctor ✓', 'success');
    window.NotificationCount?.refresh();
    resetForm();
    await loadRequests();
  } catch (err) {
    showToast(err.message || 'Failed to send request.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-sm"></i> Send Request';
  }
}

function resetForm() {
  form.reset();
  setType('refill');
  // Restore the default priority option
  prioritySelect.value = 'Medium';
}

// ─── Past requests ─────────────────────────────────────────────────────────
async function loadRequests() {
  pastList.innerHTML = `
    <div class="patient-requests-empty">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading your requests…</p>
    </div>`;

  try {
    const res  = await fetch(`${API}/doctor/requests?patient_id=${userId}`, { cache: 'no-store' });
    const json = await res.json();
    allRequests = json.data || json.requests || [];
  } catch {
    allRequests = [];
  }
  renderRequests();
}

function renderRequests() {
  const filter = statusFilter.value;
  const list = filter === 'all'
    ? allRequests
    : allRequests.filter(r => (r.status ?? 'pending').toLowerCase() === filter);

  requestsCount.textContent = allRequests.length;

  if (!list.length) {
    pastList.innerHTML = `
      <div class="patient-requests-empty">
        <i class="fas fa-paper-plane"></i>
        <p>${allRequests.length ? 'No requests match this filter.' : "You haven't sent any requests yet."}</p>
      </div>`;
    return;
  }

  pastList.innerHTML = list.map(r => {
    const status = (r.status ?? 'pending').toLowerCase();
    const priority = (r.priority ?? 'Medium').toLowerCase();
    const isUrgent = priority === 'high';
    const t = detectType(r.message ?? r.title);
    const icon = t === 'refill' ? 'fa-pills' : t === 'lab' ? 'fa-flask' : 'fa-comment-dots';
    return `
      <div class="patient-request-card${isUrgent ? ' urgent' : ''}">
        <div class="pr-icon"><i class="fas ${icon}"></i></div>
        <div class="pr-body">
          <div class="pr-top">
            <h4 class="pr-title">${escHtml(titleForRequest(r))}</h4>
            <span class="badge ${priority}">${escHtml(r.priority ?? 'Medium')} Priority</span>
          </div>
          <p class="pr-message">${escHtml(stripPrefix(r.message ?? ''))}</p>
          <div class="pr-meta">
            <span><i class="fas fa-clock"></i> ${formatDateTime(r.created_at)}</span>
            <span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            ${r.notes ? `<span><i class="fas fa-comment"></i> Doctor replied</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

statusFilter.addEventListener('change', renderRequests);
resetBtn.addEventListener('click', resetForm);

// ─── Logout (matches the other patient pages) ─────────────────────────────
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

// ─── Boot ──────────────────────────────────────────────────────────────────
setType('refill');
loadMedications();
loadDoctorsFromAppointments();
loadRequests();
