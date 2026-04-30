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
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();

  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
  const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerHTML = `<i class="fas fa-${icons[type] || icons.info}"></i><span>${message}</span>`;

  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: colors[type] || colors.info,
    color: '#fff', padding: '12px 20px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', gap: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: '9999',
    fontSize: '14px', fontFamily: 'Poppins, sans-serif',
    opacity: '0', transition: 'opacity 0.3s ease'
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
  const container = document.querySelector('.profile-avatar-container');
  if (!container) return;

  const saved = localStorage.getItem(`avatar_${userId}`);
  if (saved) {
    container.innerHTML = `<img src="${saved}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" alt="avatar">`;
    return;
  }

  const parts    = (userData.full_name || '').trim().split(' ');
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();

  container.innerHTML = `
    <div style="width:40px;height:40px;border-radius:50%;background:#003785;
    color:#fff;display:flex;align-items:center;justify-content:center;
    font-weight:600;font-size:15px;cursor:pointer;">${initials}</div>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAvatar();

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const addNewMedicationBtn   = document.getElementById('addNewMedicationBtn');
  const tabs                  = document.querySelectorAll('.tab');
  const searchMedications     = document.getElementById('searchMedications');
  const filterStatus          = document.getElementById('filterStatus');

  const medicationModal       = document.getElementById('medicationModal');
  const modalTitle            = document.getElementById('modalTitle');
  const medicationForm        = document.getElementById('medicationForm');
  const closeModalBtn         = document.getElementById('closeModalBtn');
  const cancelBtn             = document.getElementById('cancelBtn');
  const medicationIdInput     = document.getElementById('medicationId');

  const detailsModal          = document.getElementById('detailsModal');
  const closeDetailsBtn       = document.getElementById('closeDetailsBtn');

  const reminderModal         = document.getElementById('reminderModal');
  const reminderForm          = document.getElementById('reminderForm');
  const closeReminderBtn      = document.getElementById('closeReminderBtn');
  const cancelReminderBtn     = document.getElementById('cancelReminderBtn');
  const reminderMedicationId  = document.getElementById('reminderMedicationId');

  const imageUploadArea       = document.getElementById('imageUploadArea');
  const medicationImageInput  = document.getElementById('medicationImage');
  const imagePreview          = document.getElementById('imagePreview');

  const activeCountEl   = document.getElementById('activeCount');
  const pastCountEl     = document.getElementById('pastCount');
  const refillCountEl   = document.getElementById('refillCount');
  const allCountEl      = document.getElementById('allCount');

  const activeMedicationsGrid  = document.getElementById('activeMedicationsGrid');
  const pastMedicationsBody    = document.getElementById('pastMedicationsBody');
  const refillDueGrid          = document.getElementById('refillDueGrid');
  const allMedicationsGrid     = document.getElementById('allMedicationsGrid');

  // ── State ───────────────────────────────────────────────────────────────────
  let allMedications      = [];   // raw from API
  let selectedMedication  = null;
  let selectedImageBase64 = null;
  let activeTab           = 'active';

  // ─── Load Medications from API ─────────────────────────────────────────────
  async function loadMedications() {
    try {
      const res  = await fetch(`${API}/patients/${userId}/medications`);
      const json = await res.json();
      allMedications = json.data || [];
    } catch {
      // Offline: try sessionStorage cache
      const cached = sessionStorage.getItem('medications_cache');
      allMedications = cached ? JSON.parse(cached) : [];
      if (allMedications.length) showToast('Showing cached data — offline mode', 'info');
    }
    // Cache for offline
    sessionStorage.setItem('medications_cache', JSON.stringify(allMedications));
    renderAllSections();
    updateCounts();
  }

  // ─── Render All Sections ───────────────────────────────────────────────────
  function renderAllSections() {
    renderSection('active');
    renderSection('past');
    renderSection('refill-due');
    renderSection('all');
  }

  function renderSection(section) {
    const search = (searchMedications?.value || '').toLowerCase();
    const statusF = filterStatus?.value || 'all';

    let list = allMedications.filter(m => {
      const matchStatus = statusF === 'all' || normalizeStatus(m.status) === statusF;
      const matchSearch = !search || [m.medication_name, m.dosage, m.prescribed_by]
        .some(f => f && f.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });

    switch (section) {
      case 'active':
        renderCards(list.filter(m => normalizeStatus(m.status) === 'active'), activeMedicationsGrid);
        break;
      case 'past':
        renderTable(list.filter(m => normalizeStatus(m.status) === 'past'), pastMedicationsBody);
        break;
      case 'refill-due':
        renderCards(list.filter(m => normalizeStatus(m.status) === 'refill-due'), refillDueGrid);
        break;
      case 'all':
        renderCards(list, allMedicationsGrid);
        break;
    }
  }

  // ─── Cards ─────────────────────────────────────────────────────────────────
  function renderCards(list, container) {
    container.innerHTML = '';
    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-pills"></i>
          <h4>No medications found</h4>
          <p>Click "Add New Medication" to get started</p>
        </div>`;
      return;
    }
    list.forEach(m => container.appendChild(buildCard(m)));
  }

  function buildCard(m) {
    const card = document.createElement('div');
    card.className   = 'medication-card';
    card.dataset.id  = m.id;

    const status      = normalizeStatus(m.status);
    const statusLabel = statusDisplayName(status);
    const imgSrc      = localStorage.getItem(`med_img_${m.id}`) || '';

    card.innerHTML = `
      <div class="medication-header">
        <h3 class="medication-name">${m.medication_name}</h3>
        <div class="status-badge ${status}"><span>${statusLabel}</span></div>
      </div>
      <div class="medication-info">
        <div class="info-item"><i class="fas fa-capsules"></i><span>Dosage: ${m.dosage || '—'}</span></div>
        <div class="info-item"><i class="fas fa-clock"></i><span>${m.frequency || '—'}</span></div>
        ${m.start_date ? `<div class="info-item"><i class="fas fa-calendar-alt"></i><span>Start: ${formatDate(m.start_date)}</span></div>` : ''}
        ${m.refill_due ? `<div class="info-item"><i class="fas fa-sync-alt"></i><span>Refill due: ${formatDate(m.refill_due)}</span></div>` : ''}
        ${m.prescribed_by ? `<div class="info-item"><i class="fas fa-user-md"></i><span>${m.prescribed_by}</span></div>` : ''}
      </div>
      <div class="medication-image">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${m.medication_name}">`
          : `<div class="default-image"><i class="fas fa-pills"></i><p>No image uploaded</p></div>`}
      </div>
      <div class="medication-actions">
        <button class="action-btn view"   data-action="view"   data-id="${m.id}"><i class="fas fa-eye"></i> View</button>
        <button class="action-btn edit"   data-action="edit"   data-id="${m.id}"><i class="fas fa-edit"></i> Edit</button>
        <button class="action-btn delete" data-action="delete" data-id="${m.id}"><i class="fas fa-trash"></i> Delete</button>
        ${status === 'active' ? `<button class="action-btn set-reminder" data-action="reminder" data-id="${m.id}"><i class="fas fa-bell"></i> Reminder</button>` : ''}
        ${!imgSrc ? `<button class="action-btn upload" data-action="upload" data-id="${m.id}"><i class="fas fa-upload"></i> Upload Image</button>` : ''}
      </div>`;

    card.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleAction(btn.dataset.action, m);
      });
    });

    return card;
  }

  // ─── Table (Past) ──────────────────────────────────────────────────────────
  function renderTable(list, tbody) {
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-table"><i class="fas fa-pills"></i><p>No past medications found</p></td></tr>`;
      return;
    }
    list.forEach(m => {
      const tr = document.createElement('tr');
      tr.dataset.id = m.id;
      tr.innerHTML = `
        <td>${m.medication_name}</td>
        <td>${m.dosage || '—'}</td>
        <td>${m.start_date ? formatDate(m.start_date) : '—'}</td>
        <td>${m.prescribed_by || 'N/A'}</td>
        <td><div class="status-badge past"><span>Past</span></div></td>
        <td>
          <div class="table-actions">
            <button class="table-btn view"   title="View"><i class="fas fa-eye"></i></button>
            <button class="table-btn edit"   title="Edit"><i class="fas fa-edit"></i></button>
            <button class="table-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </td>`;
      tr.querySelector('.table-btn.view').addEventListener('click',   () => handleAction('view',   m));
      tr.querySelector('.table-btn.edit').addEventListener('click',   () => handleAction('edit',   m));
      tr.querySelector('.table-btn.delete').addEventListener('click', () => handleAction('delete', m));
      tbody.appendChild(tr);
    });
  }

  // ─── Action Handler ────────────────────────────────────────────────────────
  function handleAction(action, m) {
    switch (action) {
      case 'view':     openDetailsModal(m); break;
      case 'edit':     openEditModal(m);    break;
      case 'delete':   deleteMedication(m); break;
      case 'reminder': openReminderModal(m); break;
      case 'upload':   openEditModal(m, true); break;
    }
  }

  // ─── View Details Modal ────────────────────────────────────────────────────
  function openDetailsModal(m) {
    selectedMedication = m;
    document.getElementById('detailsTitle').textContent    = m.medication_name;
    document.getElementById('detailsName').textContent     = m.medication_name;

    // Safe-set optional detail fields (may not exist in all HTML versions)
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    safeSet('detailsDosage',      m.dosage);
    safeSet('detailsFrequency',   m.frequency);
    safeSet('detailsStartDate',   m.start_date ? formatDate(m.start_date) : null);
    safeSet('detailsEndDate',     m.end_date   ? formatDate(m.end_date)   : null);
    safeSet('detailsDoctor',      m.prescribed_by);
    safeSet('detailsInstructions', m.instructions || 'No instructions provided');

    const statusBadge = document.getElementById('detailsStatus');
    if (statusBadge) {
      const s = normalizeStatus(m.status);
      statusBadge.className = `status-badge ${s}`;
      statusBadge.innerHTML = `<span>${statusDisplayName(s)}</span>`;
    }

    const imgSrc = localStorage.getItem(`med_img_${m.id}`) || '';
    const imgEl  = document.getElementById('detailsImage');
    if (imgEl) {
      imgEl.innerHTML = imgSrc
        ? `<img src="${imgSrc}" alt="${m.medication_name}">`
        : `<div class="default-image"><i class="fas fa-pills"></i><p>No image</p></div>`;
    }

    document.getElementById('setReminderBtn').onclick  = () => openReminderModal(m);
    document.getElementById('requestRefillBtn').onclick = () => requestRefill(m);

    detailsModal.classList.add('active');
  }

  // ─── Add / Edit Modal ──────────────────────────────────────────────────────
  function openAddModal() {
    selectedMedication  = null;
    selectedImageBase64 = null;
    modalTitle.textContent = 'Add New Medication';
    medicationForm.reset();
    medicationIdInput.value = '';
    imagePreview.innerHTML  = '';
    imagePreview.classList.remove('active');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    medicationModal.classList.add('active');
  }

  function openEditModal(m, focusImage = false) {
    selectedMedication  = m;
    selectedImageBase64 = null;
    modalTitle.textContent = 'Edit Medication';

    document.getElementById('medicationName').value    = m.medication_name || '';
    document.getElementById('dosage').value            = m.dosage          || '';
    document.getElementById('frequency').value         = m.frequency       || '';
    document.getElementById('timeOfDay').value         = m.time_of_day     || '';
    document.getElementById('startDate').value         = m.start_date      ? m.start_date.split('T')[0] : '';
    document.getElementById('endDate').value           = m.end_date        ? m.end_date.split('T')[0]   : '';
    document.getElementById('instructions').value      = m.instructions    || '';
    document.getElementById('prescribingDoctor').value = m.prescribed_by   || '';
    document.getElementById('status').value            = normalizeStatus(m.status);
    medicationIdInput.value = m.id;

    const imgSrc = localStorage.getItem(`med_img_${m.id}`) || '';
    if (imgSrc) {
      imagePreview.innerHTML = `<img src="${imgSrc}" alt="${m.medication_name}">`;
      imagePreview.classList.add('active');
    } else {
      imagePreview.innerHTML = '';
      imagePreview.classList.remove('active');
    }

    medicationModal.classList.add('active');
    if (focusImage) setTimeout(() => imageUploadArea.scrollIntoView({ behavior: 'smooth' }), 300);
  }

  // ─── Save (Create / Update) ────────────────────────────────────────────────
  medicationForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id        = medicationIdInput.value;
    const isEditing = !!id;

    const payload = {
      patient_id:     parseInt(userId),
      medication_name: document.getElementById('medicationName').value.trim(),
      dosage:          document.getElementById('dosage').value.trim(),
      frequency:       document.getElementById('frequency').value,
      time_of_day:     document.getElementById('timeOfDay').value || null,
      start_date:      document.getElementById('startDate').value || null,
      end_date:        document.getElementById('endDate').value   || null,
      instructions:    document.getElementById('instructions').value.trim() || null,
      prescribed_by:   document.getElementById('prescribingDoctor').value.trim() || null,
      status:          document.getElementById('status').value,
      refill_due:      document.getElementById('endDate').value   || null,
    };

    try {
      let res, json;
      if (isEditing) {
        res  = await fetch(`${API}/medications/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        json = await res.json();
        if (!res.ok) throw new Error(json.message);
        showToast('Medication updated successfully!', 'success');
      } else {
        res  = await fetch(`${API}/medications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        json = await res.json();
        if (!res.ok) throw new Error(json.message);
        showToast('Medication added successfully!', 'success');

        // Store image in localStorage keyed by new ID
        if (selectedImageBase64 && json.data?.id) {
          localStorage.setItem(`med_img_${json.data.id}`, selectedImageBase64);
        }
      }

      // Store image update for existing record
      if (isEditing && selectedImageBase64) {
        localStorage.setItem(`med_img_${id}`, selectedImageBase64);
      }

      closeMedicationModal();
      await loadMedications();
    } catch (err) {
      showToast(err.message || 'Failed to save medication.', 'error');
    }
  });

  // ─── Delete ────────────────────────────────────────────────────────────────
  async function deleteMedication(m) {
    if (!confirm(`Delete "${m.medication_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/medications/${m.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      localStorage.removeItem(`med_img_${m.id}`);
      showToast('Medication deleted.', 'success');
      await loadMedications();
    } catch {
      showToast('Failed to delete medication.', 'error');
    }
  }

  // ─── Refill Request ────────────────────────────────────────────────────────
  async function requestRefill(m) {
    if (!confirm(`Request refill for ${m.medication_name}?`)) return;
    try {
      const res = await fetch(`${API}/medications/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'refill-due' })
      });
      if (!res.ok) throw new Error();
      showToast('Refill request sent!', 'success');
      detailsModal.classList.remove('active');
      await loadMedications();
    } catch {
      showToast('Failed to send refill request.', 'error');
    }
  }

  // ─── Reminder ─────────────────────────────────────────────────────────────
  function openReminderModal(m) {
    selectedMedication        = m;
    reminderMedicationId.value = m.id;
    reminderModal.classList.add('active');
  }

  reminderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const time = document.getElementById('reminderTime').value;
    const days  = Array.from(document.querySelectorAll('.day-checkbox input:checked')).map(cb => cb.value);
    if (!time)        { showToast('Please select a reminder time.', 'error');    return; }
    if (!days.length) { showToast('Please select at least one day.', 'error');   return; }

    // Store reminder locally (no dedicated API endpoint yet)
    const reminders = JSON.parse(localStorage.getItem(`reminders_${userId}`) || '{}');
    reminders[reminderMedicationId.value] = {
      time, days,
      sound: document.getElementById('reminderSound').value,
      medicationName: selectedMedication?.medication_name
    };
    localStorage.setItem(`reminders_${userId}`, JSON.stringify(reminders));

    showToast('Reminder set successfully!', 'success');
    closeReminderModal();
  });

  // ─── Image Upload ──────────────────────────────────────────────────────────
  imageUploadArea.addEventListener('click', () => medicationImageInput.click());
  medicationImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.', 'error'); return; }

    const reader = new FileReader();
    reader.onload = ev => {
      selectedImageBase64 = ev.target.result;
      imagePreview.innerHTML = `<img src="${selectedImageBase64}" alt="preview">`;
      imagePreview.classList.add('active');
    };
    reader.readAsDataURL(file);
  });

  // ─── Tabs ──────────────────────────────────────────────────────────────────
  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      activeTab = this.dataset.tab;

      document.querySelectorAll('.medications-section').forEach(s => s.style.display = 'none');
      const sectionMap = {
        'active':     'activeMedications',
        'past':       'pastMedications',
        'refill-due': 'refillDue',
        'all':        'allMedications'
      };
      const el = document.getElementById(sectionMap[activeTab]);
      if (el) el.style.display = 'block';

      renderSection(activeTab);
    });
  });

  // ─── Search / Filter ───────────────────────────────────────────────────────
  searchMedications?.addEventListener('input',  () => renderSection(activeTab));
  filterStatus?.addEventListener('change',      () => renderSection(activeTab));

  // ─── Update Counts ─────────────────────────────────────────────────────────
  function updateCounts() {
    activeCountEl.textContent  = allMedications.filter(m => normalizeStatus(m.status) === 'active').length;
    pastCountEl.textContent    = allMedications.filter(m => normalizeStatus(m.status) === 'past').length;
    refillCountEl.textContent  = allMedications.filter(m => normalizeStatus(m.status) === 'refill-due').length;
    allCountEl.textContent     = allMedications.length;
  }

  // ─── Modal Controls ────────────────────────────────────────────────────────
  addNewMedicationBtn.addEventListener('click', openAddModal);

  closeModalBtn.addEventListener('click',  closeMedicationModal);
  cancelBtn.addEventListener('click',      closeMedicationModal);
  closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('active'));
  closeReminderBtn.addEventListener('click',  closeReminderModal);
  cancelReminderBtn.addEventListener('click', closeReminderModal);

  [medicationModal, detailsModal, reminderModal].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
  });

  function closeMedicationModal() {
    medicationModal.classList.remove('active');
    medicationForm.reset();
    selectedImageBase64 = null;
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('active');
  }

  function closeReminderModal() {
    reminderModal.classList.remove('active');
    reminderForm.reset();
  }

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', e => {
      e.preventDefault();
      sessionStorage.clear();
      window.location.href = '../../auth/login.html';
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function normalizeStatus(s) {
    if (!s) return 'active';
    const map = { active: 'active', past: 'past', 'refill-due': 'refill-due', refill_due: 'refill-due' };
    return map[s.toLowerCase().replace(' ', '-')] || s.toLowerCase();
  }

  function statusDisplayName(s) {
    return s === 'refill-due' ? 'Refill Due' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  loadMedications();
});

  document.getElementById("notificationsBtn")
    ?.addEventListener("click", () => window.location.href = "../notifications/notification.html");

  document.getElementById("settingsBtn")
    ?.addEventListener("click", () => window.location.href = "../profile/profile.html");
    