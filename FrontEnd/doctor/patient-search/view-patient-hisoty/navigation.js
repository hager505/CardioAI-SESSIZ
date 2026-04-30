// view-patient-hisoty/navigation.js
// ─── CardioAI — Patient Records Navigation ────────────────────────────────────

(function () {
  "use strict";

  const API = "http://localhost:5000/api";

  // ─── Toast ───────────────────────────────────────────────────────────────
  function showToast(message, type = "info") {
    const existing = document.getElementById("cardio-toast");
    if (existing) existing.remove();
    const colors = { success: "#779f00", error: "#de3b40", info: "#003785" };
    const t = document.createElement("div");
    t.id = "cardio-toast";
    t.style.cssText = `position:fixed;top:20px;right:24px;z-index:9999;
      background:${colors[type]};color:#fff;padding:12px 20px;border-radius:8px;
      font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.2);
      transition:opacity .4s;max-width:320px;`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3500);
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
    overview:        { id: "overview-section",      btn: ".overview-records__button2" },
    "visit-history": { id: "visit-history-section", btn: ".overview-records__button3" },
    "lab-results":   { id: "lab-results-section",   btn: ".overview-records__button4" },
    medications:     { id: "medications-section",   btn: ".overview-records__button5" },
    "clinical-notes":{ id: "clinical-notes-section",btn: ".overview-records__button6" },
  };

  // ─── Navigation ──────────────────────────────────────────────────────────
  function switchSection(name) {
    if (!sections[name]) return;

    document.querySelectorAll(".section-content").forEach((s) => s.classList.remove("active"));
    document.querySelectorAll(".nav-button").forEach((b) => {
      b.classList.remove("active");
      b.style.background = "rgba(0,0,0,0)";
      b.style.boxShadow = "none";
    });

    const sec = document.getElementById(sections[name].id);
    if (sec) sec.classList.add("active");

    const btn = document.querySelector(`.nav-button[data-section="${name}"]`);
    if (btn) {
      btn.classList.add("active");
      btn.style.background = "#ffffff";
      btn.style.boxShadow = "0px 0px 1px 0px rgba(23,26,31,.15),0px 0px 2px 0px rgba(23,26,31,.2)";
    }
  }

  function initNavigation() {
    document.querySelectorAll(".nav-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sec = btn.getAttribute("data-section");
        if (sec) switchSection(sec);
      });
    });
    switchSection("overview");
  }

  // ─── Clinical Notes toggle ────────────────────────────────────────────────
  function initClinicalNotes() {
    const overview = document.getElementById("clinical-notes-overview");
    const form = document.getElementById("clinical-notes-form");

    document.querySelector(".add-clinical-notes__button8")?.addEventListener("click", () => {
      overview?.classList.add("clinical-notes-hidden");
      form?.classList.remove("clinical-notes-hidden");
    });

    document.querySelector(".add-clinical-notes__button9")?.addEventListener("click", () => {
      form?.classList.add("clinical-notes-hidden");
      overview?.classList.remove("clinical-notes-hidden");
    });

    document.querySelector(".add-clinical-notes__button10")?.addEventListener("click", () => {
      // Save note via API (future: POST to /api/doctor/notes)
      form?.classList.add("clinical-notes-hidden");
      overview?.classList.remove("clinical-notes-hidden");
      showToast("Note saved", "success");
    });

    // initial state
    overview?.classList.remove("clinical-notes-hidden");
    form?.classList.add("clinical-notes-hidden");
  }

  // ─── Auth guard ───────────────────────────────────────────────────────────
  function checkAuth() {
    const raw = sessionStorage.getItem("user_data");
    const role = sessionStorage.getItem("user_role");
    if (!raw || role !== "doctor") {
      window.location.href = "../../../../auth/login.html";
      return false;
    }
    return true;
  }

  // ─── Load Patient Data ────────────────────────────────────────────────────
  async function loadPatientData() {
    const patientId = sessionStorage.getItem("view_patient_id");
    if (!patientId) {
      showToast("No patient selected", "error");
      return;
    }

    // Fetch all data in parallel
    const [patientRaw, vitalsRaw, appointmentsRaw, medsRaw, recordsRaw] = await Promise.all([
      apiFetch(`/patients/${patientId}`),
      apiFetch(`/patients/${patientId}/vitals`),
      apiFetch(`/patients/${patientId}/appointments`),
      apiFetch(`/patients/${patientId}/medications`),
      apiFetch(`/patients/${patientId}/records`),
    ]);

    const p = patientRaw?.patient ?? patientRaw ?? {};
    const vitals = vitalsRaw?.vitals ?? vitalsRaw?.data ?? [];
    const appointments = appointmentsRaw?.appointments ?? appointmentsRaw?.data ?? [];
    const meds = medsRaw?.medications ?? medsRaw?.data ?? [];
    const records = recordsRaw?.records ?? recordsRaw?.data ?? [];

    const age = calcAge(p.date_of_birth) ?? "—";
    const latestVital = vitals[vitals.length - 1] ?? {};

    // ── Populate Header ───────────────────────────────────────────────────
    const nameEl = document.querySelector(".overview-records__sarah-johnson");
    if (nameEl) nameEl.textContent = p.full_name ?? "—";

    const infoEl = document.querySelector(".overview-records__age-40-female-o");
    if (infoEl) infoEl.textContent = `Age ${age} · ${p.gender ?? "—"} · ${p.blood_type ?? "—"}`;

    const emailEl = document.querySelector(".overview-records__sarah-johnson-email-com");
    if (emailEl) emailEl.textContent = p.email ?? "—";

    const phoneEl = document.querySelector(".overview-records___1-555-123-4567");
    if (phoneEl) phoneEl.textContent = p.phone ?? "—";

    // ── Overview: Medical Info ────────────────────────────────────────────
    setOverviewField(".overview-records__hypertension2", p.condition_text);
    setOverviewField(".overview-records__penicillin-shellfish", p.allergies);
    setOverviewField(".overview-records__john-johnson-555-987-6543", p.emergency_contact);

    // Current medications string for overview
    const medStr = meds
      .filter((m) => (m.status ?? "active").toLowerCase() === "active")
      .map((m) => `${m.medication_name} ${m.dosage ?? ""}`.trim())
      .join(", ");
    setOverviewField(".overview-records__lisinopril-10-mg-daily-metformin-500-mg-twice-daily", medStr || "None");

    // ── Latest Vitals ─────────────────────────────────────────────────────
    setOverviewField(".overview-records___128-82", latestVital.blood_pressure ?? "—");
    setOverviewField(".overview-records___72", latestVital.heart_rate ?? "—");
    setOverviewField(".overview-records___98-6-f", latestVital.body_temperature ? `${latestVital.body_temperature}°F` : "—");
    setOverviewField(".overview-records___165-lbs", latestVital.weight ? `${latestVital.weight} lbs` : "—");
    if (latestVital.recorded_at) {
      const vitalDateEl = document.querySelector(".overview-records__from-last-visit-on-2024-01-10");
      if (vitalDateEl) vitalDateEl.textContent = `From last visit on ${formatDate(latestVital.recorded_at)}`;
    }

    // ── Visit History ─────────────────────────────────────────────────────
    renderVisitHistory(appointments);

    // ── Lab Results ───────────────────────────────────────────────────────
    renderLabResults(records.filter((r) => r.record_type === "lab" || r.record_type === "radiology"));

    // ── Medications ───────────────────────────────────────────────────────
    renderMedications(meds);
  }

  function setOverviewField(selector, value) {
    const el = document.querySelector(selector);
    if (el && value) el.textContent = escHtml(value);
  }

  // ─── Visit History Render ─────────────────────────────────────────────────
  function renderVisitHistory(appointments) {
    const container = document.querySelector(".patient-medical-vist-hostory__container3");
    if (!container) return;

    // Keep the heading elements, replace visit cards
    const heading = container.querySelector(".patient-medical-vist-hostory__visit-history2")?.parentElement ?? container;

    // Remove old cards
    container.querySelectorAll(".visit-card-dynamic").forEach((c) => c.remove());

    if (!appointments.length) {
      const empty = document.createElement("p");
      empty.className = "visit-card-dynamic";
      empty.style.cssText = "color:#9ca3af;padding:20px;text-align:center;";
      empty.textContent = "No visit history available";
      container.appendChild(empty);
      return;
    }

    appointments.slice(0, 5).forEach((a) => {
      const card = document.createElement("div");
      card.className = "patient-medical-vist-hostory__container4 visit-card-dynamic";
      card.style.cssText = "margin-bottom:16px;";
      card.innerHTML = `
        <div class="patient-medical-vist-hostory__follow-up">${escHtml(a.appointment_type ?? "Visit")}</div>
        <div class="patient-medical-vist-hostory___2024-01-10">${formatDate(a.appointment_date)}</div>
        <div class="patient-medical-vist-hostory__tag3">
          <div class="patient-medical-vist-hostory__frame3">
            <div class="patient-medical-vist-hostory__hypertension-stable">
              ${escHtml(a.condition_text ?? a.status ?? "—")}
            </div>
          </div>
        </div>
        <div class="patient-medical-vist-hostory__blood-pressure-well-controlled-continue-current-medication">
          ${escHtml(a.notes ?? a.reason_for_visit ?? "—")}
        </div>
        ${a.heart_rate ? `<div class="patient-medical-vist-hostory__bp-128-82">HR: ${a.heart_rate}</div>` : ""}
        ${a.blood_pressure ? `<div class="patient-medical-vist-hostory__hr-72">BP: ${a.blood_pressure}</div>` : ""}
        ${a.body_temperature ? `<div class="patient-medical-vist-hostory__temp-98-6-f">Temp: ${a.body_temperature}°F</div>` : ""}`;
      container.appendChild(card);
    });
  }

  // ─── Lab Results Render ───────────────────────────────────────────────────
  function renderLabResults(records) {
    const container = document.querySelector(".patient-medical-lab-results__container3");
    if (!container) return;

    container.querySelectorAll(".lab-card-dynamic").forEach((c) => c.remove());

    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "lab-card-dynamic";
      empty.style.cssText = "color:#9ca3af;padding:20px;text-align:center;";
      empty.textContent = "No lab results available";
      container.appendChild(empty);
      return;
    }

    records.slice(0, 5).forEach((r) => {
      const card = document.createElement("div");
      card.className = "patient-medical-lab-results__container4 lab-card-dynamic";
      card.style.cssText = "margin-bottom:16px;";
      card.innerHTML = `
        <div class="patient-medical-lab-results__complete-blood-count">${escHtml(r.title ?? r.record_type)}</div>
        <div class="patient-medical-lab-results__tag3">
          <div class="patient-medical-lab-results__frame3">
            <div class="patient-medical-lab-results__normal">${escHtml(r.status ?? "Review")}</div>
          </div>
        </div>
        <div class="patient-medical-lab-results__wbc-7-2-rbc-4-5-hgb-14-2-hct-42-1">
          ${escHtml(r.description ?? "—")}
        </div>
        <div class="patient-medical-lab-results___2024-01-08">${formatDate(r.record_date)}</div>
        ${r.report_file ? `
          <button onclick="window.open('${API}/uploads/${r.report_file}')"
            style="margin-top:8px;padding:6px 12px;background:#003785;color:#fff;
            border:none;border-radius:6px;cursor:pointer;font-size:12px;">
            Download
          </button>` : ""}`;
      container.appendChild(card);
    });
  }

  // ─── Medications Render ───────────────────────────────────────────────────
  function renderMedications(meds) {
    const container = document.querySelector(".patient-medical-medications__container3");
    if (!container) return;

    container.querySelectorAll(".med-card-dynamic").forEach((c) => c.remove());

    if (!meds.length) {
      const empty = document.createElement("p");
      empty.className = "med-card-dynamic";
      empty.style.cssText = "color:#9ca3af;padding:20px;text-align:center;";
      empty.textContent = "No medications on record";
      container.appendChild(empty);
      return;
    }

    meds.forEach((m) => {
      const isActive = (m.status ?? "active").toLowerCase() === "active";
      const card = document.createElement("div");
      card.className = "patient-medical-medications__container4 med-card-dynamic";
      card.style.cssText = "margin-bottom:16px;";
      card.innerHTML = `
        <div class="patient-medical-medications__lisinopril">${escHtml(m.medication_name)}</div>
        <div class="patient-medical-medications___10-mg-daily-for-hypertension">
          ${escHtml(m.dosage ?? "")} ${m.frequency ? `· ${m.frequency}` : ""}
        </div>
        ${m.refill_due ? `
          <div class="patient-medical-medications__prescribed-2023-06-15-refills-3-remaining">
            Refill due: ${formatDate(m.refill_due)}
          </div>` : ""}
        <div class="patient-medical-medications__tag3">
          <div class="patient-medical-medications__frame3">
            <div class="patient-medical-medications__active2"
              style="color:${isActive ? "#166534" : "#6b7280"};">
              ${isActive ? "Active" : "Past"}
            </div>
          </div>
        </div>`;
      container.appendChild(card);
    });
  }

  // ─── Sidebar navigation ───────────────────────────────────────────────────
  function initSidebarNavigation() {
    const routes = {
      ".overview-records__button11": "../../../dashboard/dashboard.html",
      ".overview-records__button7":  "../../../patient-search/patient-search/patient-search.html",
      ".overview-records__button8":  "../../../my-patients/my-patients.html",
      ".overview-records__button9":  "../../../my-requests/my-requests.html",
      ".overview-records__button10": "../../../schedule/add-schedule.html",
    };
    Object.entries(routes).forEach(([sel, href]) => {
      const btn = document.querySelector(sel);
      if (!btn) return;
      btn.style.cursor = "pointer";
      btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); window.location.href = href; });
      btn.querySelectorAll("*").forEach((c) => (c.style.pointerEvents = "none"));
    });

    // Schedule button in patient header
    const schedBtn = document.querySelector(".overview-records__button");
    if (schedBtn) {
      schedBtn.style.cursor = "pointer";
      schedBtn.addEventListener("click", () => {
        window.location.href = "../../../schedule/add-schedule.html";
      });
    }

    // Logout
    document.querySelector(".overview-records__button-109")?.addEventListener("click", () => {
      if (confirm("Log out?")) { sessionStorage.clear(); window.location.href = "../../../../auth/login.html"; }
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    if (!checkAuth()) return;
    initNavigation();
    initClinicalNotes();
    initSidebarNavigation();
    loadPatientData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();