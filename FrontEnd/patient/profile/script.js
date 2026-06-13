// patient/profile/script.js
document.addEventListener('DOMContentLoaded', function () {

  // ─── Auth Guard ───────────────────────────────────────────
  const userData = sessionStorage.getItem('user_data');
  const role     = sessionStorage.getItem('user_role');
  const userId   = sessionStorage.getItem('user_id');

  if (!userData || role !== 'patient') {
    window.location.href = '../../auth/login.html';
    return;
  }

  const user = JSON.parse(userData);
  const API  = 'http://localhost:5000/api';

  // ─── Helpers ──────────────────────────────────────────────
  function calculateAge(dob) {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function formatDateForInput(isoDate) {
    if (!isoDate) return '';
    return new Date(isoDate).toISOString().split('T')[0];
  }

  function getInitials(name) {
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function showToast(message, type = 'success') {
    const colors = { success: '#10b981', error: '#ef4444', info: '#003785' };
    const existing = document.querySelectorAll('.profile-toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'profile-toast';
    toast.style.cssText = `
      position:fixed; top:80px; right:20px;
      background:${colors[type] || colors.info}; color:white;
      padding:12px 20px; border-radius:8px; font-size:14px;
      z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.25);
      transition: opacity .3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ─── Avatar Initials Helper ────────────────────────────────
  function setAvatarInitials(name) {
    const initials = getInitials(name);
    ['profileAvatar', 'userAvatarLarge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      // Remove any existing img or initials span
      const oldImg = el.querySelector('img');
      const oldSpan = el.querySelector('.avatar-initials');
      if (oldSpan) oldSpan.remove();

      // Hide the image tag and show initials
      if (oldImg) oldImg.style.display = 'none';

      const span = document.createElement('span');
      span.className = 'avatar-initials';
      span.style.cssText = `
        display:flex; align-items:center; justify-content:center;
        width:100%; height:100%;
        font-weight:600; color:#fff;
        background: linear-gradient(135deg, #003785, #2d68af);
        border-radius:50%; user-select:none;
        position:absolute; top:0; left:0;
      `;
      span.textContent = initials;
      el.style.position = 'relative';
      el.appendChild(span);
    });
  }

  function setAvatarImage(src) {
    ['profileAvatar', 'userAvatarLarge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      // Remove initials span
      const oldSpan = el.querySelector('.avatar-initials');
      if (oldSpan) oldSpan.remove();
      // Show & update image
      let img = el.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = 'Profile';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        el.appendChild(img);
      }
      img.src = src;
      img.style.display = 'block';
    });
  }

  // ─── Populate Form ─────────────────────────────────────────
  function populateForm(u) {
    // Header name
    const nameEl = document.getElementById('userFullName');
    if (nameEl) nameEl.textContent = u.full_name || '—';

    const resolveAvatarUrl = (url) => (typeof AuthManager !== 'undefined' ? AuthManager.resolveUrl(url) : null);

    // Try sessionStorage avatar_url first (DB-backed), then localStorage cache
    const role = 'patient';
    const cacheKey = `avatar_${role}_${userId}`;
    let avatarUrl = null;
    try {
      const raw = sessionStorage.getItem('user_data');
      if (raw) {
        const ud = JSON.parse(raw);
        avatarUrl = resolveAvatarUrl(ud.avatar_url || null);
      }
    } catch (_) { /* ignore */ }
    if (!avatarUrl) {
      avatarUrl = resolveAvatarUrl(localStorage.getItem(cacheKey));
    }
    if (!avatarUrl && u.files) {
      const avatarFile = u.files.find(f => f.file_type === 'avatar');
      if (avatarFile && avatarFile.file_path) {
        avatarUrl = resolveAvatarUrl(avatarFile.file_path);
      }
    }
    if (avatarUrl) {
      localStorage.setItem(cacheKey, avatarUrl);
      setAvatarImage(avatarUrl);
    } else {
      setAvatarInitials(u.full_name);
    }

    // Form fields
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    set('fullName',    u.full_name);
    set('dateOfBirth', formatDateForInput(u.date_of_birth));
    set('nationalId',  u.national_id);
    set('gender',      u.gender);
    set('phoneNumber', u.phone);
    set('bloodType',   u.blood_type);
    set('email',       u.email);
    set('address',     u.address || '');
  }

  // ─── Populate Medical Info ─────────────────────────────────
  function populateMedical(u) {
    // Chronic diseases from condition_text
    const chronicContainer = document.getElementById('chronicDiseasesContainer');
    if (chronicContainer && u.condition_text) {
      // Clear existing tags
      chronicContainer.querySelectorAll('.tag').forEach(t => t.remove());
      u.condition_text.split(',').map(s => s.trim()).filter(Boolean).forEach(disease => {
        addTagToContainer(chronicContainer, disease);
      });
    }

    // Allergies from patient_info.allergies (if available)
    if (u.allergies) {
      const allergiesContainer = document.getElementById('allergiesContainer');
      if (allergiesContainer) {
        allergiesContainer.querySelectorAll('.tag').forEach(t => t.remove());
        u.allergies.split(',').map(s => s.trim()).filter(Boolean).forEach(allergy => {
          addTagToContainer(allergiesContainer, allergy);
        });
      }
    }

    // Surgeries
    if (u.previous_surgeries) {
      const surgeriesContainer = document.getElementById('surgeriesContainer');
      if (surgeriesContainer) {
        surgeriesContainer.querySelectorAll('.list-item').forEach(i => i.remove());
        u.previous_surgeries.split(',').map(s => s.trim()).filter(Boolean).forEach(surgery => {
          addListItemToContainer(surgeriesContainer, surgery);
        });
      }
    }
  }

  // ─── Load Patient Data ─────────────────────────────────────
  async function loadPatientData() {
    try {
      const res = await fetch(`${API}/patients/${userId}`);
      if (res.ok) {
        const data = await res.json();
        // Merge API response with sessionStorage (API is source of truth)
        const merged = { ...user, ...data };
        populateForm(merged);
        populateMedical(merged);
        // Update sessionStorage with fresh data
        sessionStorage.setItem('user_data', JSON.stringify(merged));
      } else {
        // Fallback to sessionStorage
        populateForm(user);
        populateMedical(user);
      }
    } catch {
      // Offline fallback
      populateForm(user);
      populateMedical(user);
    }
  }

  // ─── Save Profile to Backend ───────────────────────────────
  async function saveProfileToBackend() {
    const body = {
      full_name:     document.getElementById('fullName')?.value.trim(),
      date_of_birth: document.getElementById('dateOfBirth')?.value,
      national_id:   document.getElementById('nationalId')?.value.trim(),
      gender:        document.getElementById('gender')?.value,
      phone:         document.getElementById('phoneNumber')?.value.trim(),
      email:         document.getElementById('email')?.value.trim(),
      address:       document.getElementById('address')?.value.trim(),
    };

    const infoBody = {
      blood_type:    document.getElementById('bloodType')?.value,
      condition_text: Array.from(document.querySelectorAll('#chronicDiseasesContainer .tag span'))
                        .map(s => s.textContent).join(', '),
      allergies:     Array.from(document.querySelectorAll('#allergiesContainer .tag span'))
                        .map(s => s.textContent).join(', '),
      previous_surgeries: Array.from(document.querySelectorAll('#surgeriesContainer .list-item span'))
                        .map(s => s.textContent).join(', '),
    };

    // Update patients table
    const r1 = await fetch(`${API}/patients/${userId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    // Update patient_info table
    const r2 = await fetch(`${API}/patients/${userId}/info`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(infoBody),
    });

    if (!r1.ok) {
        const err = await r1.json().catch(() => ({ message: 'Failed to update profile' }));
        throw new Error(err.message);
    }
    if (!r2.ok) {
        const err = await r2.json().catch(() => ({ message: 'Failed to update medical info' }));
        throw new Error(err.message);
    }

    // Update sessionStorage
    const updated = { ...user, ...body, ...infoBody };
    sessionStorage.setItem('user_data', JSON.stringify(updated));

    // Update name display
    const displayName = body.full_name || user.full_name;
    const nameEl = document.getElementById('userFullName');
    if (nameEl) nameEl.textContent = displayName;

    // Update sidebar footer name
    const footerNameEl = document.getElementById('footerPatientName');
    if (footerNameEl) footerNameEl.textContent = displayName;

    // Update sidebar footer avatar initials (the bottom-left user card)
    const footerAvatarEl = document.getElementById('footerAvatar');
    if (footerAvatarEl && !footerAvatarEl.style.backgroundImage) {
      footerAvatarEl.textContent = getInitials(displayName);
    }

    // Update dropdown user name
    const dropdownNameEl = document.getElementById('dropdownUserName');
    if (dropdownNameEl) dropdownNameEl.textContent = displayName;

    // Update dropdown email
    const dropdownEmailEl = document.getElementById('dropdownUserEmail');
    if (dropdownEmailEl && body.email) dropdownEmailEl.textContent = body.email;

    // Update header dropdown user name (the one in the top-right user menu)
    const headerDropdownName = document.getElementById('headerDropdownName') || document.querySelector('#userMenu .user-name');
    if (headerDropdownName) headerDropdownName.textContent = displayName;

    // Update header greeting (e.g. "Good morning, John") on the current page
    document.querySelectorAll('.dashboard-header__greeting h1').forEach(h1 => {
      if (h1.dataset.dynamicName === 'true' || h1.id) {
        h1.textContent = h1.textContent.replace(/,\s*[^,]*$/, `, ${displayName}`);
      }
    });

    // Update avatar initials in the header / dropdown if no photo is set
    const savedAvatar = localStorage.getItem(`avatar_patient_${userId}`);
    if (!savedAvatar) {
      setAvatarInitials(displayName);
      // Also update the header avatar if it currently shows initials
      const headerAvatarInitials = document.getElementById('avatarInitials');
      if (headerAvatarInitials) headerAvatarInitials.textContent = getInitials(displayName);
    }

    // Persist the new name/email to localStorage (so the landing page navbar
    // picks it up on the next render) and dispatch the userUpdated event so
    // the dashboards refresh their sidebar / dropdowns without a reload.
    if (typeof AuthManager !== 'undefined') {
      AuthManager.refreshAllAvatars();
      AuthManager.syncUser({
        name:  displayName,
        email: body.email || (user && user.email) || null,
      });
    } else {
      try { localStorage.setItem('userName', displayName); } catch (_) {}
      if (body.email) { try { localStorage.setItem('userEmail', body.email); } catch (_) {} }
    }
  }

  // ─── Change Password ───────────────────────────────────────
  async function changePassword(currentPw, newPw) {
    const res = await fetch(`${API}/patients/${userId}/password`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Password change failed');
    }
  }

  // ─── Vitals → Notifications ─────────────────────────────────
  // After saving new vitals, push:
  //   • Always: a "Vitals Updated" info notification
  //   • Optionally: an AI Recommendation if any value looks abnormal
  async function notifyVitalsSaved(v) {
    try {
      // 1) Confirmation notification (always)
      await fetch(`${API}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: parseInt(userId, 10),
          title: 'Vitals Updated',
          message: `Your latest vitals have been recorded${v.heart_rate ? ` (HR ${v.heart_rate} bpm` : ''}${v.blood_pressure ? `, BP ${v.blood_pressure} mmHg` : ''}${v.heart_rate || v.blood_pressure ? ')' : '.'}`,
        }),
      });

      // 2) Try the AI predictor for a richer recommendation
      const sys = v.blood_pressure ? parseInt(v.blood_pressure.split('/')[0], 10) : null;
      const dia = v.blood_pressure ? parseInt(v.blood_pressure.split('/')[1], 10) : null;
      let recommendation = null;
      try {
        const aiRes = await fetch(`${API}/predict/vitals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heart_rate:             v.heart_rate         || 0,
            blood_pressure_systolic:  sys                 || 0,
            blood_pressure_diastolic: dia                 || 0,
            temperature:            v.body_temperature   || 0,
            respiratory_rate:       v.respiratory_rate   || 0,
            oxygen_saturation:      v.spo2               || 0,
            bmi:                    v.bmi                || 0,
          }),
        });
        if (aiRes.ok) {
          const ai = await aiRes.json();
          const rec = ai.recommendation_en || ai.message_en;
          if (rec) recommendation = { text: rec, risk: ai.risk_level || 'unknown', color: ai.risk_color || '#6b7280' };
        }
      } catch { /* fall back to threshold check */ }

      // 3) Threshold-based fallback if no AI recommendation
      if (!recommendation) {
        const abnormal = [];
        if (v.heart_rate && (v.heart_rate < 50 || v.heart_rate > 120)) abnormal.push(`Heart rate ${v.heart_rate} bpm is outside the safe range`);
        if (sys && (sys < 90  || sys > 160)) abnormal.push(`Systolic BP ${sys} mmHg is outside the safe range`);
        if (dia && (dia < 60  || dia > 100)) abnormal.push(`Diastolic BP ${dia} mmHg is outside the safe range`);
        if (v.spo2 && v.spo2 < 92)  abnormal.push(`SpO₂ ${v.spo2}% is below the recommended threshold`);
        if (v.body_temperature && (v.body_temperature < 35.5 || v.body_temperature > 38.0))
          abnormal.push(`Body temperature ${v.body_temperature}°C is outside the normal range`);
        if (abnormal.length) {
          recommendation = {
            text: `We noticed: ${abnormal.join('; ')}. Please consider contacting your doctor.`,
            risk: 'elevated',
            color: '#ef4444',
          };
        }
      }

      if (recommendation) {
        const isCritical = /critical|high|emergency|severe/i.test(recommendation.risk);
        await fetch(`${API}/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: parseInt(userId, 10),
            title: isCritical ? 'Urgent Health Alert' : 'AI Health Recommendation',
            message: recommendation.text,
          }),
        });
      }

      // Refresh the header / sidebar notification badge immediately so
      // the count updates without waiting for the 30s poll.
      window.NotificationCount?.refresh();
    } catch (err) {
      console.error('notifyVitalsSaved error:', err);
    }
  }

  // ─── Tag / List Helpers ────────────────────────────────────
  function addTagToContainer(container, text) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `<span>${text}</span><button type="button" class="remove-tag">&times;</button>`;
    tag.querySelector('.remove-tag').addEventListener('click', () => {
      tag.remove();
      showToast('Item removed', 'success');
    });
    const addBtn = container.querySelector('.add-tag-btn, .add-item-btn');
    addBtn ? container.insertBefore(tag, addBtn) : container.appendChild(tag);
  }

  function addListItemToContainer(container, text) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<i class="fas fa-circle"></i><span>${text}</span><button type="button" class="remove-item">&times;</button>`;
    item.querySelector('.remove-item').addEventListener('click', () => {
      item.remove();
      showToast('Item removed', 'success');
    });
    const addBtn = container.querySelector('.add-tag-btn, .add-item-btn');
    addBtn ? container.insertBefore(item, addBtn) : container.appendChild(item);
  }

  // ─── Avatar Upload ─────────────────────────────────────────
  function setupAvatarUpload() {
    const avatarUpload = document.getElementById('avatarUpload');
    if (!avatarUpload) return;

    ['changePhotoBtn', 'avatarUploadBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => avatarUpload.click());
    });

    avatarUpload.addEventListener('change', async function (e) {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.match('image.*')) { showToast('Please select an image file', 'error'); return; }
      if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'error'); return; }

      const formData = new FormData();
      formData.append('avatar', file);

      try {
        const res = await fetch(`http://localhost:5000/api/patients/${userId}/avatar`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        let url = data.file_path || data.url;
        if (url && !url.startsWith('http') && !url.startsWith('data:')) {
          url = 'http://localhost:5000' + (url.startsWith('/') ? '' : '/') + url;
        }
        // Sync sessionStorage so all pages see the new avatar immediately
        try {
            const raw = sessionStorage.getItem('user_data');
            if (raw) {
                const u = JSON.parse(raw);
                u.avatar_url = url;
                sessionStorage.setItem('user_data', JSON.stringify(u));
            }
        } catch (_) { /* ignore */ }
        // Keep the landing-page navbar (which reads AuthManager.getUserData
        // → localStorage.userAvatar) in sync. Without this, the navbar
        // would keep showing the previous photo until the next login.
        try { localStorage.setItem('userAvatar', url); } catch (_) { /* ignore */ }
        if (typeof AuthManager !== 'undefined') {
          AuthManager.syncUser({ avatar: url });
        }
        setAvatarImage(url);
        showToast('Profile photo updated!', 'success');
      } catch (err) {
        console.error('avatar upload error:', err);
        showToast('Failed to upload avatar', 'error');
      }
    });
  }

  // ─── Remove Avatar ─────────────────────────────────────────
  function setupRemoveAvatar() {
    const removeBtn = document.getElementById('removePatientAvatarBtn');
    if (!removeBtn) return;
    removeBtn.addEventListener('click', async () => {
      if (!userId) return;
      try {
        const res = await fetch(`http://localhost:5000/api/patients/${userId}/avatar`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Remove failed');
        try {
          const raw = sessionStorage.getItem('user_data');
          if (raw) {
            const u = JSON.parse(raw);
            u.avatar_url = null;
            sessionStorage.setItem('user_data', JSON.stringify(u));
          }
        } catch (_) { /* ignore */ }
        localStorage.removeItem(`avatar_patient_${userId}`);
        try { localStorage.removeItem('userAvatar'); } catch (_) { /* ignore */ }
        if (typeof AuthManager !== 'undefined') {
          AuthManager.syncUser({ avatar: null });
        }
        setAvatarInitials(user?.full_name || 'Patient');
        if (typeof AuthManager !== 'undefined') AuthManager.refreshAllAvatars();
        showToast('Photo removed', 'success');
      } catch (err) {
        console.error('remove avatar error:', err);
        showToast('Failed to remove photo', 'error');
      }
    });
  }

  // ─── 2FA Toggle ───────────────────────────────────────────
  function setup2FA() {
    const toggle = document.getElementById('twoFactorToggle');
    const status = document.getElementById('twoFactorStatus');
    if (!toggle || !status) return;

    toggle.addEventListener('change', function () {
      status.textContent = this.checked ? 'ON' : 'OFF';
      status.style.color = this.checked ? '#10b981' : '#ef4444';
      showToast(`Two-factor authentication ${this.checked ? 'enabled' : 'disabled'}`, 'success');
    });
  }

  // ─── Modal for Adding Medical Items ───────────────────────
  const medicalDropdownData = {
    allergies: ["Penicillin","Dust Mites","Pollen","Peanuts","Shellfish","Latex","Animal Dander","Mold","Eggs","Milk","Soy","Wheat","Tree Nuts","Fish"],
    chronicDiseases: ["Hypertension","Type 1 Diabetes","Type 2 Diabetes","Asthma","Arthritis","Heart Disease","Chronic Kidney Disease","COPD","Epilepsy","Multiple Sclerosis","Cancer","HIV/AIDS","Alzheimer's","Parkinson's","Osteoporosis","Coronary Artery Disease"],
    commonSurgeries: ["Appendectomy","Cataract Surgery","Gallbladder Removal","Hernia Repair","Hip Replacement","Knee Replacement","Heart Bypass","Cesarean Section","Tonsillectomy"],
  };

  let currentModalInput = null;
  let currentModalCustomInput = null;

  function openAddModal(category, type) {
    const modal = document.getElementById('addItemModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalInputContainer = document.getElementById('modalInputContainer');
    const modalAdditionalFieldContainer = document.getElementById('modalAdditionalFieldContainer');
    const modalAdditionalInfo = document.getElementById('modalAdditionalInfo');
    const modalItemCategory = document.getElementById('modalItemCategory');

    const titles = { chronicDiseases: 'Add Chronic Disease', allergies: 'Add Allergy', surgeries: 'Add Surgery' };
    modalTitle.textContent = titles[category] || 'Add New Item';
    modalItemCategory.value = category;
    modalInputContainer.innerHTML = '';
    modalAdditionalInfo.value = '';
    modalAdditionalFieldContainer.style.display = 'none';
    currentModalInput = null;
    currentModalCustomInput = null;

    if (category === 'allergies' || category === 'chronicDiseases') {
      const select = document.createElement('select');
      select.id = 'modalSelect';
      select.className = 'modal-select';
      select.required = true;
      select.innerHTML = `<option value="" disabled selected>Select from list...</option>`;
      medicalDropdownData[category].forEach(opt => {
        select.innerHTML += `<option value="${opt}">${opt}</option>`;
      });
      select.innerHTML += `<option value="custom">Other (enter custom)...</option>`;
      select.addEventListener('change', function () {
        modalInputContainer.querySelector('.modal-custom-input')?.remove();
        currentModalCustomInput = null;
        if (this.value === 'custom') {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'modal-custom-input';
          inp.placeholder = 'Enter custom value...';
          inp.required = true;
          modalInputContainer.appendChild(inp);
          currentModalCustomInput = inp;
          setTimeout(() => inp.focus(), 50);
        }
      });
      modalInputContainer.appendChild(select);
      currentModalInput = select;
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'modalTextInput';
      input.className = 'modal-input';
      input.placeholder = 'e.g., Appendectomy';
      input.required = true;
      const datalist = document.createElement('datalist');
      datalist.id = `${category}-suggestions`;
      const items = medicalDropdownData.commonSurgeries || [];
      items.forEach(i => { const o = document.createElement('option'); o.value = i; datalist.appendChild(o); });
      input.setAttribute('list', `${category}-suggestions`);
      modalInputContainer.appendChild(input);
      modalInputContainer.appendChild(datalist);
      currentModalInput = input;
      modalAdditionalFieldContainer.style.display = 'block';
      modalAdditionalInfo.placeholder = 'e.g., Year (2023)';
    }

    modal.classList.add('active');
    setTimeout(() => currentModalInput?.focus(), 100);
  }

  function closeAddModal() {
    const modal = document.getElementById('addItemModal');
    const addItemForm = document.getElementById('addItemForm');
    modal.classList.remove('active');
    addItemForm.reset();
    document.getElementById('modalInputContainer').innerHTML = '';
    document.getElementById('modalAdditionalFieldContainer').style.display = 'none';
    currentModalInput = null;
    currentModalCustomInput = null;
  }

  function handleAddItem(e) {
    e.preventDefault();
    const category = document.getElementById('modalItemCategory').value;
    const info = document.getElementById('modalAdditionalInfo').value.trim();
    let name = '';

    if (category === 'allergies' || category === 'chronicDiseases') {
      const select = document.getElementById('modalSelect');
      name = select?.value === 'custom' ? currentModalCustomInput?.value.trim() : select?.value;
    } else {
      name = document.getElementById('modalTextInput')?.value.trim();
    }

    if (!name) { showToast('Please enter a valid name', 'error'); return; }

    const containerId = category + 'Container';
    const container = document.getElementById(containerId);
    const displayText = info ? `${name} (${info})` : name;

    if (category === 'chronicDiseases' || category === 'allergies') {
      const existing = Array.from(container.querySelectorAll('.tag span')).map(s => s.textContent);
      if (existing.includes(name)) { showToast('This item already exists', 'error'); return; }
      addTagToContainer(container, displayText);
    } else {
      addListItemToContainer(container, displayText);
    }

    showToast('Item added successfully', 'success');
    closeAddModal();
  }

  // ─── Event Listeners ───────────────────────────────────────
  function setupEventListeners() {
    // Profile form save
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        try {
          await saveProfileToBackend();
          showToast('Profile updated successfully!', 'success');
        } catch (err) {
          showToast('Failed to save profile: ' + err.message, 'error');
        }
      });
    }

    // Cancel
    const cancelBtn = document.getElementById('cancelChangesBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        if (confirm('Discard all changes?')) {
          populateForm(JSON.parse(sessionStorage.getItem('user_data') || '{}'));
          showToast('Changes discarded', 'info');
        }
      });
    }

    // Add medical item buttons (event delegation)
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.add-tag-btn, .add-item-btn');
      if (btn) {
        openAddModal(btn.getAttribute('data-category'), btn.getAttribute('data-type'));
      }
      if (e.target.classList.contains('remove-tag')) {
        e.target.closest('.tag')?.remove();
      }
      if (e.target.classList.contains('remove-item')) {
        e.target.closest('.list-item')?.remove();
      }
    });

    // Add item modal form
    const addItemForm = document.getElementById('addItemForm');
    if (addItemForm) addItemForm.addEventListener('submit', handleAddItem);

    // Modal close buttons
    document.getElementById('closeModalBtn')?.addEventListener('click', closeAddModal);
    document.getElementById('cancelAddBtn')?.addEventListener('click', closeAddModal);
    document.getElementById('addItemModal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('addItemModal')) closeAddModal();
    });

    // Password modal
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const passwordModal = document.getElementById('passwordModal');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => passwordModal?.classList.add('active'));
    document.getElementById('closePasswordBtn')?.addEventListener('click', () => { passwordModal?.classList.remove('active'); document.getElementById('passwordForm')?.reset(); });
    document.getElementById('cancelPasswordBtn')?.addEventListener('click', () => { passwordModal?.classList.remove('active'); document.getElementById('passwordForm')?.reset(); });
    passwordModal?.addEventListener('click', e => { if (e.target === passwordModal) { passwordModal.classList.remove('active'); document.getElementById('passwordForm')?.reset(); } });

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const currentPw  = document.getElementById('currentPassword').value;
        const newPw      = document.getElementById('newPassword').value;
        const confirmPw  = document.getElementById('confirmPassword').value;

        if (!currentPw || !newPw || !confirmPw) { showToast('Please fill all fields', 'error'); return; }
        if (newPw !== confirmPw) { showToast('New passwords do not match', 'error'); return; }
        if (newPw.length < 6)    { showToast('Password must be at least 6 characters', 'error'); return; }

        try {
          await changePassword(currentPw, newPw);
          passwordModal.classList.remove('active');
          passwordForm.reset();
          showToast('Password updated successfully!', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Navigation buttons
    document.getElementById('notificationsBtn')?.addEventListener('click', () => window.location.href = '../notifications/notification.html');
    document.getElementById('viewMedicalHistoryBtn')?.addEventListener('click', () => window.location.href = '../MedicalRecords/medicalrecords1.html');
    document.getElementById('manageMedicationsBtn')?.addEventListener('click', () => window.location.href = '../medications/medications.html');

    document.getElementById('logoutBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
        AuthManager.handleLogout();
      } else {
        sessionStorage.clear();
        window.location.href = '../../auth/login.html';
      }
    });

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAddModal();
        document.getElementById('passwordModal')?.classList.remove('active');
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        document.getElementById('profileForm')?.requestSubmit();
      }
    });

    // ─── Vitals Form ──────────────────────────────────────────
    const vitalsForm = document.getElementById('vitalsForm');
    if (vitalsForm) {
      vitalsForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const hr = document.getElementById('vitalHR').value;
        const sys = document.getElementById('vitalBPSys').value;
        const dia = document.getElementById('vitalBPDia').value;
        const spo2 = document.getElementById('vitalSpO2').value;
        const temp = document.getElementById('vitalTemp').value;
        const rr = document.getElementById('vitalRR').value;
        const bmi = document.getElementById('vitalBMI').value;
        if (!hr && !sys && !dia && !spo2 && !temp && !rr && !bmi) {
          showToast('Please enter at least one vital sign', 'error');
          return;
        }
        const btn = document.getElementById('saveVitalsBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-sm"></i>Saving...';
        try {
          const res = await fetch(`http://localhost:5000/api/patients/${userId}/vitals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              heart_rate: hr || null,
              blood_pressure_sys: sys || null,
              blood_pressure_dia: dia || null,
              spo2: spo2 || null,
              body_temperature: temp || null,
              respiratory_rate: rr || null,
              bmi: bmi || null,
            }),
          });
          if (!res.ok) throw new Error('Failed to save vitals');
          const statusEl = document.getElementById('vitalsStatus');
          if (statusEl) statusEl.innerHTML = `<span style="color:var(--secondary);">Vitals saved — ${new Date().toLocaleString()}</span>`;
          showToast('Vital signs saved successfully!', 'success');

          // Fire a vitals + (optional) AI recommendation notification
          await notifyVitalsSaved({
            heart_rate: parseFloat(hr) || null,
            blood_pressure: (sys && dia) ? `${sys}/${dia}` : null,
            body_temperature: parseFloat(temp) || null,
            spo2: parseFloat(spo2) || null,
            respiratory_rate: parseFloat(rr) || null,
            bmi: parseFloat(bmi) || null,
          });
        } catch (err) {
          showToast('Failed to save vitals: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-save mr-sm"></i>Save Vitals';
        }
      });
    }

    const loadLatestBtn = document.getElementById('loadLatestVitalsBtn');
    if (loadLatestBtn) {
      loadLatestBtn.addEventListener('click', async function () {
        try {
          const res = await fetch(`http://localhost:5000/api/patients/${userId}/vitals`);
          if (!res.ok) throw new Error('Failed to load');
          const data = await res.json();
          if (data.heart_rate) document.getElementById('vitalHR').value = data.heart_rate;
          if (data.blood_pressure) {
            const parts = data.blood_pressure.split('/');
            if (parts[0]) document.getElementById('vitalBPSys').value = parts[0];
            if (parts[1]) document.getElementById('vitalBPDia').value = parts[1];
          }
          if (data.spo2) document.getElementById('vitalSpO2').value = data.spo2;
          if (data.body_temperature) document.getElementById('vitalTemp').value = data.body_temperature;
          if (data.respiratory_rate) document.getElementById('vitalRR').value = data.respiratory_rate;
          if (data.bmi) document.getElementById('vitalBMI').value = data.bmi;
          const statusEl = document.getElementById('vitalsStatus');
          if (statusEl) statusEl.innerHTML = `<span style="color:var(--text-muted);">Loaded from ${data.recorded_at ? new Date(data.recorded_at).toLocaleString() : 'latest record'}</span>`;
          showToast('Latest vitals loaded', 'info');
        } catch (err) {
          showToast('No vitals found yet', 'info');
        }
      });
    }
  }

  // ─── Init ──────────────────────────────────────────────────
  setupAvatarUpload();
  setupRemoveAvatar();
  setup2FA();
  setupEventListeners();
  loadPatientData(); // Load fresh data from API, fallback to sessionStorage

  // ─── AI Analysis Upload ────────────────────────────────────
  const aiFileUpload = document.getElementById("aiFileUpload");
  const aiAnalysisResult = document.getElementById("aiAnalysisResult");
  const uploadDataBtn = document.getElementById("uploadDataBtn");

  if (aiFileUpload) {
      aiFileUpload.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          if (uploadDataBtn) uploadDataBtn.disabled = true;
          if (aiAnalysisResult) aiAnalysisResult.innerHTML = `
            <div style="text-align:center;padding:20px;">
              <i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary-blue);"></i>
              <div style="margin-top:10px;color:var(--primary-blue);font-weight:600;">
                Analyzing ${file.name}...
              </div>
            </div>`;

          try {
              const formData = new FormData();
              formData.append("file", file);

              const res = await fetch("http://localhost:5000/api/predict/upload", {
                  method: "POST",
                  body: formData
              });

              if (!res.ok) throw new Error("Upload failed");
              const data = await res.json();

              if (data.error) {
                  aiAnalysisResult.innerHTML = `<span style='color: red;'>❌ ${data.error}</span>`;
              } else {
                  const riskColor = data.risk_color || "#6b7280";
                  const modelIcon = data.model_used === "vitals" ? "🫀" : "📊";
                  const modelName = data.model_used === "vitals" ? "Vitals Model" : "ECG Model";
                  const conf = data.confidence_pct ?? (data.confidence * 100).toFixed(1);

                  aiAnalysisResult.innerHTML = `
                    <div style="background:white;border-radius:12px;border-left:5px solid ${riskColor};
                                padding:18px;box-shadow:0 2px 10px rgba(0,0,0,.08);">
                      <!-- Header -->
                      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                        <div style="width:44px;height:44px;background:${riskColor};border-radius:50%;
                                    display:flex;align-items:center;justify-content:center;
                                    color:white;font-size:20px;flex-shrink:0;">
                          <i class="fas fa-heartbeat"></i>
                        </div>
                        <div>
                          <div style="font-weight:700;font-size:16px;">
                            ${modelIcon} ${modelName} — AI Analysis Complete
                          </div>
                          <div style="font-size:13px;color:${riskColor};font-weight:600;">
                            ${data.label || "—"} · Confidence: ${conf}%
                          </div>
                        </div>
                      </div>

                      <!-- Risk Bar -->
                      <div style="background:#f3f4f6;border-radius:8px;height:10px;margin-bottom:14px;overflow:hidden;">
                        <div style="height:100%;width:${conf}%;background:${riskColor};
                                    border-radius:8px;transition:width 1s ease;"></div>
                      </div>

                      <!-- Messages -->
                      <div style="background:${riskColor}12;border-radius:8px;padding:14px;margin-bottom:12px;">
                        <div style="font-size:15px;font-weight:600;color:${riskColor};margin-bottom:6px;">
                          ${data.message_en || "Analysis complete"}
                        </div>
                        <div style="font-size:14px;color:#374151;direction:rtl;text-align:right;">
                          ${data.message_ar || ""}
                        </div>
                      </div>

                      <!-- Recommendations -->
                      <div style="display:flex;flex-direction:column;gap:6px;">
                        <div style="font-size:13px;color:#6b7280;display:flex;align-items:center;gap:8px;">
                          <i class="fas fa-stethoscope" style="color:${riskColor};"></i>
                          <span>${data.recommendation_en || ""}</span>
                        </div>
                        <div style="font-size:13px;color:#6b7280;direction:rtl;text-align:right;">
                          📝 ${data.recommendation_ar || ""}
                        </div>
                      </div>
                    </div>
                  `;

                  showToast('AI Analysis complete!', data.risk_level === 'none' || data.risk_level === 'low' ? 'success' : 'error');
              }
          } catch (err) {
              console.error(err);
              aiAnalysisResult.innerHTML = "<span style='color: red;'>❌ Failed to connect to AI server.</span>";
              showToast('AI Analysis failed', 'error');
          } finally {
              if (uploadDataBtn) uploadDataBtn.disabled = false;
              aiFileUpload.value = ''; // reset
          }
      });
  }

});