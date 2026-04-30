document.addEventListener('DOMContentLoaded', function () {

  // ─── Auth Guard ───────────────────────────────────────────
  const userData = sessionStorage.getItem('user_data');
  const role     = sessionStorage.getItem('user_role');
  const userId   = sessionStorage.getItem('user_id');

  if (!userData || role !== 'patient') {
    window.location.href = '../../auth/login.html';
    return;
  }

  const API = 'http://localhost:5000/api';

  // ─── State ────────────────────────────────────────────────
  let allRecords     = [];   // raw from API
  let currentRecords = [];   // after filter
  let selectedRecord = null;
  let selectedFile   = null;
  let currentCategory = 'lab-tests';

  // ─── DOM ──────────────────────────────────────────────────
  const reportsList    = document.getElementById('reportsList');
  const uploadBtn      = document.getElementById('uploadReportBtn');
  const uploadModal    = document.getElementById('uploadModal');
  const closeModalBtn  = document.getElementById('closeModalBtn');
  const cancelUploadBtn= document.getElementById('cancelUploadBtn');
  const uploadForm     = document.getElementById('uploadForm');
  const tabs           = document.querySelectorAll('.tab');
  const searchInput    = document.getElementById('searchInput');
  const typeFilter     = document.getElementById('typeFilter');
  const previewTitle   = document.getElementById('previewTitle');
  const previewType    = document.getElementById('previewType');
  const previewDate    = document.getElementById('previewDate');
  const previewDoctor  = document.getElementById('previewDoctor');
  const previewDescription = document.getElementById('previewDescription');
  const previewImage   = document.getElementById('previewImage');
  const downloadBtn    = document.getElementById('downloadBtn');
  const fileUploadArea = document.getElementById('fileUploadArea');
  const fileUpload     = document.getElementById('fileUpload');
  const browseBtn      = document.getElementById('browseBtn');
  const filePreview    = document.getElementById('filePreview');

  // ─── Toast ────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const colors = { success: '#10b981', error: '#ef4444', info: '#003785' };
    const existing = document.querySelectorAll('.mr-toast');
    existing.forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'mr-toast';
    toast.style.cssText = `
      position:fixed; top:80px; right:20px;
      background:${colors[type] || colors.info}; color:#fff;
      padding:12px 20px; border-radius:8px; font-size:14px;
      z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.25);
      transition: opacity .3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ─── Helpers ──────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '—';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Map DB record_type → UI category tab
  function dbTypeToCategory(record_type) {
    const map = {
      lab:          'lab-tests',
      radiology:    'radiology',
      prescription: 'prescriptions',
      surgery:      'surgeries',
    };
    return map[record_type] || 'lab-tests';
  }

  // Map UI upload type → DB record_type
  function uploadTypeToDb(type) {
    const map = {
      'lab-test':   'lab',
      'radiology':  'radiology',
      'prescription':'prescription',
      'surgery':    'surgery',
      'other':      'lab',
    };
    return map[type] || 'lab';
  }

  function getReportIcon(record_type) {
    const icons = {
      lab:          'fas fa-vial',
      radiology:    'fas fa-x-ray',
      prescription: 'fas fa-prescription-bottle-alt',
      surgery:      'fas fa-syringe',
    };
    return icons[record_type] || 'fas fa-file-medical';
  }

  function getReportTypeName(record_type) {
    const names = {
      lab:          'Lab Test',
      radiology:    'Radiology/Imaging',
      prescription: 'Prescription',
      surgery:      'Surgery Report',
    };
    return names[record_type] || record_type;
  }

  // ─── Load Records from API ────────────────────────────────
  async function loadRecords() {
    reportsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading records...</p>
      </div>`;

    try {
      const res = await fetch(`${API}/patients/${userId}/records`);
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      allRecords = data.records || [];
      applyFilters();

      // Select first record by default
      if (currentRecords.length > 0) selectRecord(currentRecords[0]);
    } catch (err) {
      console.error('loadRecords error:', err);
      reportsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Could not load records</h3>
          <p>${err.message}</p>
        </div>`;
    }
  }

  // ─── Render Records List ──────────────────────────────────
  function renderRecords() {
    reportsList.innerHTML = '';

    if (currentRecords.length === 0) {
      reportsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-medical"></i>
          <h3>No records found</h3>
          <p>Upload your first medical report</p>
        </div>`;
      return;
    }

    currentRecords.forEach(record => {
      const el = document.createElement('div');
      el.className = `report-item ${selectedRecord?.id === record.id ? 'selected' : ''}`;
      el.dataset.id = record.id;

      el.innerHTML = `
        <div class="report-icon">
          <i class="${getReportIcon(record.record_type)}"></i>
        </div>
        <div class="report-content">
          <div class="report-title">${record.title || '—'}</div>
          <div class="report-meta">${formatDate(record.record_date)} • ${record.doctor_name || '—'}</div>
        </div>
        <div class="report-actions">
          <button class="action-btn download-action" title="Download">
            <i class="fas fa-download"></i>
          </button>
          <button class="action-btn delete-action" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;

      el.addEventListener('click', e => {
        if (!e.target.closest('.action-btn')) selectRecord(record);
      });

      el.querySelector('.download-action').addEventListener('click', e => {
        e.stopPropagation();
        downloadRecord(record);
      });

      el.querySelector('.delete-action').addEventListener('click', e => {
        e.stopPropagation();
        deleteRecord(record.id);
      });

      reportsList.appendChild(el);
    });
  }

  // ─── Select Record → Preview ──────────────────────────────
  function selectRecord(record) {
    selectedRecord = record;

    document.querySelectorAll('.report-item').forEach(el => el.classList.remove('selected'));
    const el = document.querySelector(`.report-item[data-id="${record.id}"]`);
    if (el) el.classList.add('selected');

    previewTitle.textContent       = record.title       || '—';
    previewType.textContent        = getReportTypeName(record.record_type);
    previewDate.textContent        = formatDate(record.record_date);
    previewDoctor.textContent      = record.doctor_name || '—';
    previewDescription.textContent = record.description || '—';

    if (record.report_file) {
      const ext = record.report_file.split('.').pop().toLowerCase();
      const isPdf = ext === 'pdf';
      previewImage.innerHTML = `
        <div class="file-preview-content">
          <i class="fas fa-file-${isPdf ? 'pdf' : 'image'} fa-3x"></i>
          <h4>${record.report_file.split('/').pop()}</h4>
        </div>`;
    } else {
      previewImage.innerHTML = `
        <div class="no-preview">
          <i class="fas fa-file-medical"></i>
          <p>No file attached</p>
        </div>`;
    }

    downloadBtn.disabled = !record.report_file;
    downloadBtn.onclick  = () => downloadRecord(record);
  }

  function resetPreview() {
    selectedRecord = null;
    previewTitle.textContent  = 'No document selected';
    previewType.textContent   = '-';
    previewDate.textContent   = '-';
    previewDoctor.textContent = '-';
    previewDescription.textContent = '-';
    previewImage.innerHTML = `
      <div class="no-preview">
        <i class="fas fa-file-medical"></i>
        <p>Select a document to preview</p>
      </div>`;
    downloadBtn.disabled = true;
  }

  // ─── Download ─────────────────────────────────────────────
  function downloadRecord(record) {
    if (!record.report_file) { showToast('No file attached to this record', 'error'); return; }
    const url = `http://localhost:5000/${record.report_file}`;
    const a   = document.createElement('a');
    a.href     = url;
    a.download = record.report_file.split('/').pop();
    a.target   = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading: ${a.download}`, 'success');
  }

  // ─── Delete ───────────────────────────────────────────────
  async function deleteRecord(recordId) {
    if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/records/${recordId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      allRecords = allRecords.filter(r => r.id !== recordId);
      if (selectedRecord?.id === recordId) resetPreview();
      applyFilters();
      showToast('Record deleted successfully', 'success');
    } catch (err) {
      showToast('Failed to delete record: ' + err.message, 'error');
    }
  }

  // ─── Upload ───────────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) { showToast('Please select a file to upload', 'error'); return; }

    const formData = new FormData();
    formData.append('patient_id',   userId);
    formData.append('title',        document.getElementById('reportTitle').value.trim());
    formData.append('record_type',  uploadTypeToDb(document.getElementById('reportType').value));
    formData.append('record_date',  document.getElementById('reportDate').value);
    formData.append('doctor_name',  document.getElementById('reportDoctor').value.trim());
    formData.append('description',  document.getElementById('reportDescription').value.trim());
    formData.append('report_file',  selectedFile);

    try {
      const res = await fetch(`${API}/records`, {
        method: 'POST',
        body:   formData,   // no Content-Type header — browser sets multipart boundary
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      const data = await res.json();

      // Prepend new record to list
      allRecords.unshift(data.record || data);
      applyFilters();
      if (allRecords.length > 0) selectRecord(allRecords[0]);

      closeModal();
      showToast('Report uploaded successfully!', 'success');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  }

  // ─── Filters ──────────────────────────────────────────────
  function applyFilters() {
    const search = searchInput.value.toLowerCase();
    const type   = typeFilter.value;

    // Map UI tab category → DB record_type(s)
    const categoryMap = {
      'lab-tests':     ['lab'],
      'radiology':     ['radiology'],
      'prescriptions': ['prescription'],
      'surgeries':     ['surgery'],
    };
    const allowedTypes = categoryMap[currentCategory] || [];

    currentRecords = allRecords.filter(r => {
      if (allowedTypes.length && !allowedTypes.includes(r.record_type)) return false;

      // Type dropdown filter (maps UI option → db value)
      const typeMap = {
        'lab-test':    'lab',
        'xray':        'radiology',
        'mri':         'radiology',
        'prescription':'prescription',
        'surgery':     'surgery',
      };
      if (type !== 'all' && r.record_type !== typeMap[type]) return false;

      if (search) {
        const fields = [r.title, r.doctor_name, r.description, r.record_date].map(f => (f || '').toLowerCase());
        if (!fields.some(f => f.includes(search))) return false;
      }

      return true;
    });

    renderRecords();
  }

  // ─── File Upload UI ───────────────────────────────────────
  function showFilePreview(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const icon = ext === 'pdf' ? 'pdf' : ['jpg','jpeg','png','gif'].includes(ext) ? 'image' : 'alt';
    filePreview.innerHTML = `
      <div class="file-info">
        <i class="fas fa-file-${icon}"></i>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="remove-file" type="button"><i class="fas fa-times"></i></button>
      </div>`;
    filePreview.classList.add('active');
    filePreview.querySelector('.remove-file').addEventListener('click', () => {
      selectedFile = null;
      filePreview.classList.remove('active');
      filePreview.innerHTML = '';
      fileUpload.value = '';
    });
  }

  function closeModal() {
    uploadModal.classList.remove('active');
    uploadForm.reset();
    selectedFile = null;
    filePreview.classList.remove('active');
    filePreview.innerHTML = '';
    fileUpload.value = '';
  }

  // ─── Event Listeners ──────────────────────────────────────
  function setupEventListeners() {
    // Tabs
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentCategory = tab.dataset.category;
        applyFilters();
      });
    });

    // Search & filter
    searchInput.addEventListener('input', applyFilters);
    typeFilter.addEventListener('change', applyFilters);

    // Upload modal open/close
    uploadBtn.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('reportDate').value = today;
      document.getElementById('reportDate').max   = today;
      uploadModal.classList.add('active');
    });
    closeModalBtn.addEventListener('click', closeModal);
    cancelUploadBtn.addEventListener('click', closeModal);
    uploadModal.addEventListener('click', e => { if (e.target === uploadModal) closeModal(); });

    // File pick
    fileUploadArea.addEventListener('click', () => fileUpload.click());
    browseBtn.addEventListener('click', e => { e.stopPropagation(); fileUpload.click(); });
    fileUpload.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) { selectedFile = file; showFilePreview(file); }
    });

    // Drag & drop
    ['dragenter','dragover','dragleave','drop'].forEach(ev =>
      fileUploadArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); })
    );
    ['dragenter','dragover'].forEach(ev =>
      fileUploadArea.addEventListener(ev, () => {
        fileUploadArea.style.borderColor = 'var(--primary-blue)';
        fileUploadArea.style.background  = 'rgba(0,59,133,0.05)';
      })
    );
    ['dragleave','drop'].forEach(ev =>
      fileUploadArea.addEventListener(ev, () => {
        fileUploadArea.style.borderColor = '';
        fileUploadArea.style.background  = '';
      })
    );
    fileUploadArea.addEventListener('drop', e => {
      const file = e.dataTransfer.files[0];
      if (file) { selectedFile = file; showFilePreview(file); }
    });

    // Form submit
    uploadForm.addEventListener('submit', handleUpload);

    // Navigation
  document.getElementById("notificationsBtn")
    ?.addEventListener("click", () => window.location.href = "../notifications/notification.html");

  document.getElementById("settingsBtn")
    ?.addEventListener("click", () => window.location.href = "../profile/profile.html");
    
    document.getElementById('logoutBtn')?.addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        sessionStorage.clear();
        window.location.href = '../../auth/login.html';
      }
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // ─── Init ──────────────────────────────────────────────────
  setupEventListeners();
  loadRecords();

});