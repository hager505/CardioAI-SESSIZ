// patient/medications/script.js
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

  const saved = localStorage.getItem(`avatar_patient_${userId}`);
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
      allMedications = json.data || json.medications || [];
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

  // Effective status combines the DB enum (active/past) with the
  // refill_due date so the UI can show a "Refill Due" tab even though
  // the DB doesn't have a refill-due status value.
  function effectiveStatus(m) {
    if (!m) return 'active';
    if (m.status === 'past') return 'past';
    if (m.refill_due) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(m.refill_due);
      due.setHours(0, 0, 0, 0);
      if (due <= today) return 'refill-due';
    }
    return m.status || 'active';
  }

  function isRefillRequested(m) {
    // Persisted on the client only; survives reloads via localStorage
    return localStorage.getItem(`refill_req_${m.id}`) === '1';
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
      const eff = effectiveStatus(m);
      const matchStatus = statusF === 'all' || eff === statusF;
      const matchSearch = !search || [m.medication_name, m.dosage, m.prescribed_by]
        .some(f => f && f.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });

    switch (section) {
      case 'active':
        renderCards(list.filter(m => effectiveStatus(m) === 'active'), activeMedicationsGrid);
        break;
      case 'past':
        renderTable(list.filter(m => effectiveStatus(m) === 'past'), pastMedicationsBody);
        break;
      case 'refill-due':
        renderCards(list.filter(m => effectiveStatus(m) === 'refill-due'), refillDueGrid);
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
    card.className   = `medication-card med-status-${effectiveStatus(m).replace('-', '')}`;
    card.dataset.id  = m.id;

    const status      = effectiveStatus(m);
    const statusLabel = statusDisplayName(status);
    const imgSrc      = localStorage.getItem(`med_img_${m.id}`) || '';
    const refillRequested = isRefillRequested(m);

    let refillTag = '';
    if (m.refill_due) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(m.refill_due);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due - today) / 86400000);
      let tone = 'ok';
      let label = `Refill in ${diffDays}d`;
      if (diffDays < 0)      { tone = 'overdue'; label = `Refill overdue (${Math.abs(diffDays)}d)`; }
      else if (diffDays === 0) { tone = 'due';     label = 'Refill due today'; }
      else if (diffDays <= 7) { tone = 'soon';    label = `Refill in ${diffDays}d`; }
      refillTag = `<span class="refill-pill refill-${tone}">${label}</span>`;
    }

    card.innerHTML = `
      <div class="medication-header">
        <div class="medication-header-main">
          <div class="medication-icon"><i class="fas fa-pills"></i></div>
          <div>
            <h3 class="medication-name">${escapeHtml(m.medication_name)}</h3>
            <div class="medication-sub">
              <span class="status-badge ${status}"><span>${statusLabel}</span></span>
              ${refillTag}
              ${refillRequested ? '<span class="refill-pill refill-pending"><i class="fas fa-paper-plane"></i> Refill requested</span>' : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="medication-info">
        ${m.dosage       ? `<div class="info-item"><i class="fas fa-capsules"></i><span>${escapeHtml(m.dosage)}</span></div>` : ''}
        ${m.frequency    ? `<div class="info-item"><i class="fas fa-clock"></i><span>${escapeHtml(m.frequency)}</span></div>` : ''}
        ${m.time_of_day  ? `<div class="info-item"><i class="fas fa-sun"></i><span>${escapeHtml(m.time_of_day)}</span></div>` : ''}
        ${m.start_date   ? `<div class="info-item"><i class="fas fa-calendar-plus"></i><span>Started ${formatDate(m.start_date)}</span></div>` : ''}
        ${m.prescribed_by? `<div class="info-item"><i class="fas fa-user-md"></i><span>${escapeHtml(m.prescribed_by)}</span></div>` : ''}
        ${m.instructions ? `<div class="info-item info-instructions"><i class="fas fa-info-circle"></i><span>${escapeHtml(m.instructions)}</span></div>` : ''}
      </div>
      <div class="medication-image">
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${escapeHtml(m.medication_name)}">`
          : `<div class="default-image"><i class="fas fa-pills"></i></div>`}
      </div>
      <div class="medication-actions">
        <button class="action-btn view"   data-action="view"   data-id="${m.id}"><i class="fas fa-eye"></i> View</button>
        <button class="action-btn edit"   data-action="edit"   data-id="${m.id}"><i class="fas fa-edit"></i> Edit</button>
        ${status === 'active' ? `<button class="action-btn set-reminder" data-action="reminder" data-id="${m.id}"><i class="fas fa-bell"></i> Reminder</button>` : ''}
        ${!imgSrc ? `<button class="action-btn upload" data-action="upload" data-id="${m.id}"><i class="fas fa-upload"></i> Add Image</button>` : ''}
        <button class="action-btn delete" data-action="delete" data-id="${m.id}"><i class="fas fa-trash"></i> Delete</button>
      </div>`;

    card.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleAction(btn.dataset.action, m);
      });
    });

    return card;
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
      const s = effectiveStatus(m);
      statusBadge.className = `status-badge ${s}`;
      statusBadge.innerHTML = `<span>${statusDisplayName(s)}</span>`;
    }

    const imgSrc = localStorage.getItem(`med_img_${m.id}`) || '';
    const imgEl  = document.getElementById('detailsImage');
    const iconEl = document.getElementById('detailsImagePlaceholder');
    if (imgEl) {
      if (imgSrc) {
        // Image is uploaded: drop the pill placeholder, show the image.
        if (iconEl) iconEl.style.display = 'none';
        // Replace only any previous <img>, keep the (now hidden) icon
        // node around so the next medication without an image still has
        // something to fall back to without re-creating DOM.
        let existing = imgEl.querySelector('img.medication-image-large__img');
        if (!existing) {
          existing = document.createElement('img');
          existing.className = 'medication-image-large__img';
          existing.alt = m.medication_name;
          imgEl.appendChild(existing);
        }
        existing.src = imgSrc;
      } else {
        // No image: hide any previously injected <img> and show the
        // static pill icon (`.medication-icon`) that lives in the HTML.
        const existing = imgEl.querySelector('img.medication-image-large__img');
        if (existing) existing.remove();
        if (iconEl) iconEl.style.display = '';
      }
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
    // Form only supports the two valid DB enum values; if the record was
    // previously "refill-due" the user can reset it to active.
    document.getElementById('status').value            = m.status === 'past' ? 'past' : 'active';
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

    // The DB only accepts 'active' or 'past' for status; the form may still
    // have an old 'refill-due' value cached — coerce to the closest valid one.
    let formStatus = document.getElementById('status').value;
    if (formStatus !== 'active' && formStatus !== 'past') formStatus = 'active';

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
      status:          formStatus,
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
        if (selectedImageBase64 && (json.data?.id || json.id)) {
          localStorage.setItem(`med_img_${json.data?.id || json.id}`, selectedImageBase64);
        }

        // Auto-create a notification record so the patient sees a
        // "Medication added" entry in their notification center.
        try {
          await fetch(`${API}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patient_id: parseInt(userId, 10),
              title: 'New Medication Added',
              message: `${payload.medication_name} (${payload.dosage || ''}) has been added to your medication list.`,
            }),
          });
          window.NotificationCount?.refresh();
        } catch (_) { /* non-blocking */ }
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
    if (!confirm(`Request a refill for ${m.medication_name}? Your care team will be notified.`)) return;
    try {
      // Persist on the client so the card can show a "Refill requested" badge
      localStorage.setItem(`refill_req_${m.id}`, '1');

      // Push a notification record so it shows up in the notifications page
      // and the doctor side can pick it up.
      try {
        await fetch(`${API}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: parseInt(userId, 10),
            title: 'Medication Refill Requested',
            message: `${userData?.full_name || 'Patient'} has requested a refill for ${m.medication_name} (${m.dosage || ''}).`,
          }),
        });
        window.NotificationCount?.refresh();
      } catch (_) { /* non-blocking — the client-side flag is the source of truth for the patient UI */ }

      showToast('Refill request sent to your care team.', 'success');
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
    activeCountEl.textContent  = allMedications.filter(m => effectiveStatus(m) === 'active').length;
    pastCountEl.textContent    = allMedications.filter(m => effectiveStatus(m) === 'past').length;
    refillCountEl.textContent  = allMedications.filter(m => effectiveStatus(m) === 'refill-due').length;
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
      if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
        AuthManager.handleLogout();
      } else {
        sessionStorage.clear();
        localStorage.removeItem('isLoggedIn');
        window.location.href = '../../auth/login.html';
      }
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

  document.getElementById("notificationsBtn")
    ?.addEventListener("click", () => window.location.href = "../notifications/notification.html");

  document.getElementById("settingsBtn")
    ?.addEventListener("click", () => window.location.href = "../profile/profile.html");
});
