// doctor/patient-search/view-patient-history/navigation.js
// ─── CardioAI — Patient Records Navigation ────────────────────────────────────

(function () {
  "use strict";

  const API = "http://localhost:5000/api";

  // ─── Toast ───────────────────────────────────────────────────────────────
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer") || (() => {
      const c = document.createElement("div");
      c.id = "toastContainer";
      c.className = "toast-container";
      document.body.appendChild(c);
      return c;
    })();
    const colors = { success: "#779f00", error: "#de3b40", info: "#003785" };
    const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", info: "fa-info-circle" };
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast-icon"></i>
      <span class="toast-content">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    container.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateX(100%)";
      setTimeout(() => t.remove(), 400);
    }, 3500);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return "";
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }
  function calcAge(dob) {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  }
  function formatDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  function formatDateTime(d) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }
  async function apiFetch(endpoint) {
    try {
      const res = await fetch(`${API}${endpoint}`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  // ─── Section map ─────────────────────────────────────────────────────────
  const sections = {
    overview:            { id: "overview-section" },
    "visit-history":     { id: "visit-history-section" },
    "medical-reports":   { id: "medical-reports-section" },
    medications:         { id: "medications-section" },
    requests:            { id: "requests-section" },
    "clinical-notes":    { id: "clinical-notes-section" },
  };

  // ─── Navigation ──────────────────────────────────────────────────────────
  function switchSection(name) {
    if (!sections[name]) return;
    document.querySelectorAll(".section-content").forEach((s) => s.classList.remove("active"));
    document.querySelectorAll(".patient-tab").forEach((b) => b.classList.remove("active"));
    const sec = document.getElementById(sections[name].id);
    if (sec) sec.classList.add("active");
    const btn = document.querySelector(`.patient-tab[data-section="${name}"]`);
    if (btn) btn.classList.add("active");
  }

  function initNavigation() {
    document.querySelectorAll(".patient-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = btn.getAttribute("data-section");
        if (sec) switchSection(sec);
      });
    });
    switchSection("overview");
  }

  // ─── Clinical Notes toggle / load / save / delete ────────────────────────
  // Persists per-patient notes to the DB (clinical_notes table) via
  // /api/clinical-notes. The overview list is rebuilt on every save/delete.
  function initClinicalNotes() {
    const overview = document.getElementById("clinical-notes-overview");
    const form     = document.getElementById("clinical-notes-form");
    const textarea = document.getElementById("clinicalNotesTextarea");

    document.querySelector(".btn-add-notes")?.addEventListener("click", () => {
      if (textarea) textarea.value = "";
      overview?.classList.add("clinical-notes-hidden");
      form?.classList.remove("clinical-notes-hidden");
      textarea?.focus();
    });
    document.querySelector(".btn-cancel-notes")?.addEventListener("click", () => {
      form?.classList.add("clinical-notes-hidden");
      overview?.classList.remove("clinical-notes-hidden");
    });
    document.querySelector(".btn-save-notes")?.addEventListener("click", async () => {
      const note = (textarea?.value ?? "").trim();
      if (!note) { showToast("Please enter a note before saving.", "error"); return; }
      await saveClinicalNote(note);
    });
    overview?.classList.remove("clinical-notes-hidden");
    form?.classList.add("clinical-notes-hidden");
  }

  async function loadClinicalNotes() {
    const patientId = sessionStorage.getItem("view_patient_id");
    if (!patientId) return;
    try {
      const res = await apiFetch(`/clinical-notes?patient_id=${patientId}`);
      const list = res?.data ?? [];
      renderClinicalNotesList(list);
    } catch (err) {
      console.error("loadClinicalNotes error", err);
    }
  }

  function renderClinicalNotesList(notes) {
    const list = document.getElementById("clinicalNotesList");
    const empty = document.getElementById("clinicalNotesEmpty");
    if (!list) return;
    if (!notes.length) {
      list.innerHTML = "";
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    list.innerHTML = notes.map(n => `
      <div class="clinical-note-row" data-id="${n.id}">
        <div class="clinical-note-row__head">
          <div>
            <span class="clinical-note-row__author">${escHtml(n.doctor_name ?? "Doctor")}</span>
            <span class="clinical-note-row__date">${formatDateTime(n.created_at)}</span>
          </div>
          <button class="clinical-note-row__delete" data-id="${n.id}" title="Delete note">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="clinical-note-row__body">${escHtml(n.note)}</div>
      </div>
    `).join("");
    list.querySelectorAll(".clinical-note-row__delete").forEach(btn => {
      btn.addEventListener("click", () => deleteClinicalNote(parseInt(btn.dataset.id, 10)));
    });
  }

  async function saveClinicalNote(note) {
    const patientId = sessionStorage.getItem("view_patient_id");
    if (!patientId) return;
    const doctorId = sessionStorage.getItem("user_id");
    try {
      const res = await fetch(`${API}/clinical-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: parseInt(patientId, 10), doctor_id: parseInt(doctorId, 10), note }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Save failed");
      }
      showToast("Note saved", "success");
      document.getElementById("clinical-notes-form")?.classList.add("clinical-notes-hidden");
      document.getElementById("clinical-notes-overview")?.classList.remove("clinical-notes-hidden");
      const ta = document.getElementById("clinicalNotesTextarea");
      if (ta) ta.value = "";
      await loadClinicalNotes();
    } catch (err) {
      showToast(err.message || "Failed to save note", "error");
    }
  }

  async function deleteClinicalNote(id) {
    if (!confirm("Delete this clinical note? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API}/clinical-notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Delete failed");
      }
      showToast("Note deleted", "success");
      await loadClinicalNotes();
    } catch (err) {
      showToast(err.message || "Failed to delete note", "error");
    }
  }

  // ─── Auth guard ───────────────────────────────────────────────────────────
  function checkAuth() {
    const raw = sessionStorage.getItem("user_data");
    const role = sessionStorage.getItem("user_role");
    if (!raw || role !== "doctor") {
      window.location.href = "../../../auth/login.html";
      return false;
    }
    return true;
  }

  // ─── User Menu ──────────────────────────────────────────────────────────
  function toggleUserMenu() {
    const dropdown = document.getElementById("userDropdown");
    if (dropdown) dropdown.classList.toggle("show");
  }

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("userMenu");
    const dropdown = document.getElementById("userDropdown");
    if (menu && dropdown && !menu.contains(e.target)) {
      dropdown.classList.remove("show");
    }
  });

  function confirmLogout() {
    if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
      AuthManager.handleLogout();
    } else {
      sessionStorage.clear();
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("userType");
      localStorage.removeItem("userName");
      localStorage.removeItem("token");
      window.location.href = "../../../index.html";
    }
  }

  // ─── Load Patient Data ────────────────────────────────────────────────────
  async function loadPatientData() {
    const patientId = sessionStorage.getItem("view_patient_id");
    if (!patientId) {
      showToast("No patient selected", "error");
      return;
    }

    const [patientRaw, vitalsRaw, appointmentsRaw, medsRaw, recordsRaw, requestsRaw] = await Promise.all([
      apiFetch(`/patients/${patientId}`),
      apiFetch(`/patients/${patientId}/vitals`),
      apiFetch(`/patients/${patientId}/appointments`),
      apiFetch(`/patients/${patientId}/medications`),
      apiFetch(`/patients/${patientId}/records`),
      apiFetch(`/doctor/requests?patient_id=${patientId}`),
    ]);

    const p = patientRaw?.patient ?? patientRaw ?? {};
    // Check if vitals is an object or an array. In my-patients script.js, apiFetch('/patients/:id/vitals') returns a direct object (e.g., {heart_rate: 72, ...}) or an array/vitals object.
    // Let's handle both. If vitalsRaw has a .vitals or .data property, use it. Otherwise, if it has a heart_rate or blood_pressure property directly, wrap it or use it as latestVital.
    let latestVital = {};
    if (vitalsRaw) {
      if (vitalsRaw.heart_rate !== undefined || vitalsRaw.blood_pressure !== undefined) {
        latestVital = vitalsRaw;
      } else {
        const vitalsList = vitalsRaw.vitals ?? vitalsRaw.data ?? [];
        if (Array.isArray(vitalsList)) {
          latestVital = vitalsList[vitalsList.length - 1] ?? {};
        } else if (vitalsList && typeof vitalsList === 'object') {
          latestVital = vitalsList;
        }
      }
    }
    const appointments = appointmentsRaw?.appointments ?? appointmentsRaw?.data ?? [];
    const meds = medsRaw?.medications ?? medsRaw?.data ?? [];
    const records = recordsRaw?.records ?? recordsRaw?.data ?? [];
    const requests = requestsRaw?.data ?? requestsRaw?.requests ?? [];

    const age = calcAge(p.date_of_birth) ?? "—";
    const initials = p.full_name
      ? p.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
      : "—";

    // ── Populate Patient Header ───────────────────────────────────────────
    const avatarContainer = document.getElementById("patientAvatarInitials");
    if (avatarContainer) {
      const avatarUrl = p.avatar_url || (p.files || []).find(f => f.file_type === 'avatar')?.file_path;
      if (avatarUrl) {
        const absUrl = avatarUrl.startsWith('http') ? avatarUrl : 'http://localhost:5000' + (avatarUrl.startsWith('/') ? '' : '/') + avatarUrl;
        avatarContainer.textContent = '';
        avatarContainer.style.backgroundImage = `url(${absUrl})`;
        avatarContainer.style.backgroundSize = 'cover';
        avatarContainer.style.backgroundPosition = 'center';
      } else {
        avatarContainer.textContent = initials;
      }
    }
    setText("patientName", p.full_name ?? "—");
    setText("patientInfo", `Age ${age} · ${p.gender ?? "—"} · ${p.blood_type ?? "—"}`);
    setText("patientEmail", p.email ?? "—");
    setText("patientPhone", p.phone ?? "—");
    setText("patientLocation", p.address ?? "—");
    setText("patientConditionTag", p.condition_text ?? "Active");

    // ── Overview: Medical Info ────────────────────────────────────────────
    setText("primaryCondition", p.condition_text);
    setText("allergies", p.allergies);
    setText("emergencyContact", p.emergency_contact);

    const medStr = meds
      .filter((m) => (m.status ?? "active").toLowerCase() === "active")
      .map((m) => `${m.medication_name} ${m.dosage ?? ""}`.trim())
      .join(", ");
    setText("currentMeds", medStr || "None");

    // ── Latest Vitals ─────────────────────────────────────────────────────
    setText("bpValue", latestVital.blood_pressure ?? "—");
    setText("hrValue", latestVital.heart_rate ? `${latestVital.heart_rate}` : "—");
    setText("tempValue", latestVital.body_temperature ? `${latestVital.body_temperature}` : "—");
    setText("spo2Value", latestVital.spo2 ? `${latestVital.spo2}` : "—");
    if (latestVital.recorded_at) {
      setText("lastVisitDate", `From last visit on ${formatDate(latestVital.recorded_at)}`);
    }

    // Set progress bars
    setProgress("bpProgress", latestVital.blood_pressure ? 70 : 0);
    setProgress("hrProgress", latestVital.heart_rate ? 65 : 0);
    setProgress("tempProgress", latestVital.body_temperature ? 50 : 0);
    setProgress("spo2Progress", latestVital.spo2 ? 60 : 0);

    // ── Visit History ─────────────────────────────────────────────────────
    renderVisitHistory(appointments);

    // ── Medical Reports (all uploaded records, not just lab/radiology) ──
    renderMedicalReports(records);

    // ── Medications ───────────────────────────────────────────────────────
    renderMedications(meds);

    // ── Patient Requests (strict filter to the inspected patient) ────────
    // The server already filters with `?patient_id=...`; the row-level
    // check below is a belt-and-suspenders guard against ever showing a
    // test row with `patient_id = null` / "Unknown" when viewing a real
    // patient.
    renderRequests(requests, patientId);

    // ── Clinical Notes ───────────────────────────────────────────────────
    await loadClinicalNotes();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = escHtml(value);
  }

  function setProgress(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  // ─── Visit History Render ─────────────────────────────────────────────────
  function renderVisitHistory(appointments) {
    const container = document.getElementById("visitHistoryContainer");
    if (!container) return;

    if (!appointments.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-calendar-check"></i>
        <p>No visit history available</p>
      </div>`;
      return;
    }

    container.innerHTML = appointments.slice(0, 5).map((a) => `
      <div class="visit-card">
        <div class="visit-card__header">
          <span class="visit-card__type">${escHtml(a.appointment_type ?? "Visit")}</span>
          <span class="visit-card__date">
            <i class="fas fa-calendar"></i> ${formatDate(a.appointment_date)}
          </span>
        </div>
        <span class="badge badge-primary visit-card__condition">
          ${escHtml(a.condition_text ?? a.status ?? "—")}
        </span>
        <div class="visit-card__notes">${escHtml(a.notes ?? a.reason_for_visit ?? "—")}</div>
        <div class="visit-card__vitals">
          ${a.heart_rate ? `<span><i class="fas fa-heart"></i> HR: ${a.heart_rate}</span>` : ""}
          ${a.blood_pressure ? `<span><i class="fas fa-tachometer-alt"></i> BP: ${a.blood_pressure}</span>` : ""}
          ${a.body_temperature ? `<span><i class="fas fa-temperature-high"></i> Temp: ${a.body_temperature}°F</span>` : ""}
        </div>
      </div>
    `).join("");
  }

  // ─── Medical Reports Render ───────────────────────────────────────────────
  // Shows every record the patient uploaded (lab, radiology, prescription,
  // surgery, etc.) so the doctor sees the full picture, not just labs.
  function renderMedicalReports(records) {
    const container = document.getElementById("medicalReportsContainer");
    if (!container) return;

    if (!records.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-file-medical"></i>
        <p>No medical reports available</p>
      </div>`;
      return;
    }

    const typeIcons = {
      lab: "fa-flask",
      radiology: "fa-x-ray",
      prescription: "fa-prescription-bottle",
      surgery: "fa-syringe",
    };

    container.innerHTML = records.map((r) => {
      const icon = typeIcons[r.record_type] || "fa-file-medical";
      // The backend stores report_file as "uploads/records/<filename>" and
      // the static mount in app.js is `/uploads`, so the absolute URL is
      // http://localhost:5000/<report_file>. Building `${API}/uploads/...`
      // would double the prefix and 404 ("/api/uploads/uploads/records/...").
      const fileUrl = r.report_file ? `http://localhost:5000/${r.report_file}` : "";
      return `
      <div class="lab-card">
        <div class="lab-card__header">
          <span class="lab-card__name"><i class="fas ${icon} mr-sm"></i>${escHtml(r.title ?? r.record_type ?? "Report")}</span>
          <span class="lab-card__date">
            <i class="fas fa-calendar"></i> ${formatDate(r.record_date)}
          </span>
        </div>
        <span class="badge badge-secondary text-capitalize">${escHtml(r.record_type ?? "Report")}</span>
        ${r.description ? `<div class="lab-card__description">${escHtml(r.description)}</div>` : ""}
        ${fileUrl ? `
          <div class="lab-card__actions">
            <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
              <i class="fas fa-download"></i> Download
            </a>
          </div>` : ""}
      </div>`;
    }).join("");
  }

  // ─── Medications Render ───────────────────────────────────────────────────
  function renderMedications(meds) {
    const container = document.getElementById("medicationsContainer");
    if (!container) return;

    if (!meds.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-pills"></i>
        <p>No medications on record</p>
      </div>`;
      return;
    }

    container.innerHTML = meds.map((m) => {
      const isActive = (m.status ?? "active").toLowerCase() === "active";
      return `
      <div class="med-card">
        <div class="med-card__header">
          <span class="med-card__name">${escHtml(m.medication_name)}</span>
          <span class="badge ${isActive ? "badge-success" : "badge-secondary"}">
            ${isActive ? "Active" : "Past"}
          </span>
        </div>
        <div class="med-card__dosage">
          ${escHtml(m.dosage ?? "")} ${m.frequency ? `· ${m.frequency}` : ""}
        </div>
        ${m.refill_due ? `
          <div class="med-card__refill">
            <i class="fas fa-sync"></i> Refill due: ${formatDate(m.refill_due)}
          </div>` : ""}
      </div>`;
    }).join("");
  }

  // ─── Patient Requests Render ──────────────────────────────────────────────
  // Reads /api/doctor/requests?patient_id=... so the doctor can see every
  // request (refills, lab reviews, custom asks) the patient has sent.
  // `currentPatientId` is the patient we're inspecting. We filter again on
  // the client so a row that somehow has the wrong `patient_id` (e.g. an
  // older "Unknown" test row) can never bleed into this view.
  function renderRequests(requests, currentPatientId) {
    const container = document.getElementById("requestsContainer");
    if (!container) return;

    const inspectedId = parseInt(currentPatientId, 10);
    const visible = (requests || []).filter(r => {
      if (!r) return false;
      const pid = r.patient_id != null ? parseInt(r.patient_id, 10) : NaN;
      // Keep the row only if the request was actually bound to the
      // patient we're inspecting. Anything without a matching numeric
      // patient_id (legacy test data, "Unknown" rows) is dropped here.
      return Number.isFinite(pid) && pid === inspectedId;
    });

    if (!visible.length) {
      container.innerHTML = `<div class="empty-state">
        <i class="fas fa-file-medical"></i>
        <p>No requests from this patient</p>
      </div>`;
      return;
    }

    const priorityCls = (p) => (p ?? "").toLowerCase() === "high" ? "high"
                          : (p ?? "").toLowerCase() === "low"  ? "low" : "medium";
    const statusCls   = (s) => (s ?? "pending").toLowerCase();

    container.innerHTML = visible.map((r) => {
      const status = statusCls(r.status);
      const priority = priorityCls(r.priority);
      const isUrgent = priority === "high";
      return `
      <div class="request-card${isUrgent ? " urgent" : ""}">
        <div class="req-info">
          <i class="fas fa-file-medical req-card-icon"></i>
          <div class="req-details">
            <div class="req-card-top">
              <h3>${escHtml(r.title || "Request")}</h3>
              <span class="badge ${priority}">${escHtml(r.priority ?? "Medium")} Priority</span>
            </div>
            <p>${escHtml(r.message ?? "—")}</p>
            <div class="req-meta">
              <span><i class="fas fa-clock"></i> ${formatDateTime(r.created_at)}</span>
              <span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </div>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    if (!checkAuth()) return;

    // Set doctor name in header user menu
    try {
      const userData = JSON.parse(sessionStorage.getItem("user_data") || "{}");
      const nameEl = document.getElementById("doctorNamePill");
      const specEl = document.getElementById("doctorSpecialty");
      if (nameEl) nameEl.textContent = userData.full_name ?? "Doctor";
      if (specEl) specEl.textContent = userData.specialty ?? "—";

      if (typeof AuthManager !== "undefined") {
        AuthManager.initDoctorAvatar(document.getElementById("doctorAvatar"), sessionStorage.getItem("user_id"), userData.full_name);
      }
    } catch {}

    initNavigation();
    initClinicalNotes();
    loadPatientData();

    // Expose for inline onclick
    window.toggleUserMenu = toggleUserMenu;
    window.confirmLogout = confirmLogout;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
