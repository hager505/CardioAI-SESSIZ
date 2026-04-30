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
        font-size:1.4rem; font-weight:700; color:#fff;
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

    // Avatar: use saved photo or initials
    const savedAvatar = localStorage.getItem(`avatar_${userId}`);
    if (savedAvatar) {
      setAvatarImage(savedAvatar);
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

    // REPLACE with:
        const r1json = await r1.json();
        const r2json = await r2.json();
        if (!r1.ok) throw new Error(r1json.message || 'Failed to update profile');
        if (!r2.ok) throw new Error(r2json.message || 'Failed to update medical info');

    // Update sessionStorage
    const updated = { ...user, ...body, ...infoBody };
    sessionStorage.setItem('user_data', JSON.stringify(updated));

    // Update name display
    const nameEl = document.getElementById('userFullName');
    if (nameEl) nameEl.textContent = body.full_name || user.full_name;

    // Update avatar initials if no photo
    const savedAvatar = localStorage.getItem(`avatar_${userId}`);
    if (!savedAvatar) setAvatarInitials(body.full_name);
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

    ['changePhotoBtn', 'avatarUploadBtn', 'profileAvatar', 'userAvatarLarge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => avatarUpload.click());
    });

    avatarUpload.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.match('image.*')) { showToast('Please select an image file', 'error'); return; }
      if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'error'); return; }

      const reader = new FileReader();
      reader.onload = function (e) {
        const src = e.target.result;
        localStorage.setItem(`avatar_${userId}`, src);
        setAvatarImage(src);
        showToast('Profile photo updated!', 'success');
      };
      reader.readAsDataURL(file);
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
    commonMedications: ["Lisinopril 10mg","Metformin 500mg","Atorvastatin 20mg","Levothyroxine 50mcg","Metoprolol 25mg","Amlodipine 5mg","Omeprazole 20mg","Albuterol Inhaler","Warfarin 5mg"]
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

    const titles = { chronicDiseases: 'Add Chronic Disease', allergies: 'Add Allergy', surgeries: 'Add Surgery', medications: 'Add Medication' };
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
      input.placeholder = category === 'surgeries' ? 'e.g., Appendectomy' : 'e.g., Lisinopril 10mg';
      input.required = true;
      const datalist = document.createElement('datalist');
      datalist.id = `${category}-suggestions`;
      const items = medicalDropdownData[category === 'surgeries' ? 'commonSurgeries' : 'commonMedications'];
      items.forEach(i => { const o = document.createElement('option'); o.value = i; datalist.appendChild(o); });
      input.setAttribute('list', `${category}-suggestions`);
      modalInputContainer.appendChild(input);
      modalInputContainer.appendChild(datalist);
      currentModalInput = input;
      modalAdditionalFieldContainer.style.display = 'block';
      modalAdditionalInfo.placeholder = category === 'surgeries' ? 'e.g., Year (2023)' : 'e.g., Dosage (twice daily)';
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
    document.getElementById('settingsBtn')?.addEventListener('click', () => window.location.href = '../profile/profile.html');
    document.getElementById('viewMedicalHistoryBtn')?.addEventListener('click', () => window.location.href = '../MedicalRecords/medicalrecords1.html');
    document.getElementById('manageMedicationsBtn')?.addEventListener('click', () => window.location.href = '../medications/medications.html');

    document.getElementById('logoutBtn')?.addEventListener('click', function (e) {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
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
  }

  // ─── Init ──────────────────────────────────────────────────
  setupAvatarUpload();
  setup2FA();
  setupEventListeners();
  loadPatientData(); // Load fresh data from API, fallback to sessionStorage

});