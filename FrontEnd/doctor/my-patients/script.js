// my-patients/script.js — CardioAI
// No type="module". Plain script tag.

const API = "http://localhost:5000/api";

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  document.getElementById("cardio-toast")?.remove();
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return "??";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? p[0]?.[1] ?? "")).toUpperCase();
}
function calcAge(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function escHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function avatarUrl(name, bg = "003785") {
  const parts = (name ?? "X").trim().split(/\s+/);
  const f = encodeURIComponent((parts[0]?.[0] ?? "X").toUpperCase());
  const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "X").toUpperCase());
  return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

// ─── API fetch ────────────────────────────────────────────────────────────────
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) {
      console.warn(`[MyPatients] ${endpoint} → HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[MyPatients] fetch error:`, endpoint, e);
    return null;
  }
}

// ─── State ────────────────────────────────────────────────────────────────────
let allPatients = [];
let allAppointments = [];

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {

  // ── Auth guard ────────────────────────────────────────────────────────────
  const raw = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (!raw || role !== "doctor" || !userId) {
    window.location.href = "../../auth/login.html";
    return;
  }

  const user = JSON.parse(raw);
  console.log("[MyPatients] doctor:", user.full_name, "id:", userId);

  // ── Doctor pill ───────────────────────────────────────────────────────────
  const namePill = document.getElementById("doctorNamePill");
  if (namePill) namePill.textContent = user.full_name ?? "Doctor";

  const avatarPill = document.getElementById("doctorAvatarPill");
  if (avatarPill) {
    const saved = localStorage.getItem(`avatar_${userId}`);
    avatarPill.src = user.avatar_url || saved || avatarUrl(user.full_name);
    avatarPill.onerror = () => { avatarPill.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"; };
  }

  // ── Step 1: get this doctor's appointments ────────────────────────────────
  const apptData = await apiFetch(`/doctors/${userId}/appointments`);
  allAppointments = apptData?.appointments ?? [];
  console.log("[MyPatients] appointments:", allAppointments.length);

  if (!allAppointments.length) {
    document.getElementById("patientsGrid").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:#9ca3af;">
        <i class="fas fa-calendar-times" style="font-size:40px;display:block;margin-bottom:12px;"></i>
        No appointments found for this doctor
      </div>`;
    updateStats([]);
    setApptStat(0);
    return;
  }

  // ── Step 2: deduplicate patient IDs ──────────────────────────────────────
  const seen = new Set();
  const patientIds = [];
  for (const a of allAppointments) {
    if (a.patient_id && !seen.has(a.patient_id)) {
      seen.add(a.patient_id);
      patientIds.push(a.patient_id);
    }
  }
  console.log("[MyPatients] unique patients:", patientIds.length);

  // ── Step 3: fetch each patient's full data ────────────────────────────────
  // getPatient returns the patient object DIRECTLY (no wrapper key)
  // e.g. { id, full_name, email, ... }  ← NOT { patient: {...} }
  const patientMap = {};
  const chunks = [];
  for (let i = 0; i < patientIds.length; i += 8) chunks.push(patientIds.slice(i, i + 8));

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (pid) => {
      const data = await apiFetch(`/patients/${pid}`);
      if (!data) return;

      // Handle both response shapes safely:
      //   shape A (current): { id, full_name, blood_type, ... }  ← direct object
      //   shape B (if wrapped): { patient: { id, full_name, ... } }
      patientMap[pid] = data.patient ?? data;
    }));
  }

  // ── Step 4: merge into display objects ───────────────────────────────────
  allPatients = patientIds.map((pid) => {
    const p = patientMap[pid] ?? {};

    const patAppts = allAppointments
      .filter(a => a.patient_id === pid)
      .sort((a, b) => (b.appointment_date ?? "").localeCompare(a.appointment_date ?? ""));
    const latest = patAppts[0] ?? {};

    // Age: calculate from DOB if available, else fall back to appointment field
    const age = calcAge(p.date_of_birth) ?? latest.patient_age ?? p.age ?? null;

    return {
      id: pid,
      name: p.full_name ?? latest.patient_name ?? "Unknown",
      dob: p.date_of_birth ?? null,
      age,
      gender: p.gender ?? latest.patient_gender ?? "—",
      phone: p.phone ?? latest.patient_phone ?? "—",
      email: p.email ?? latest.patient_email ?? "—",
      blood_type: p.blood_type ?? latest.blood_type ?? "—",
      condition: p.condition_text ?? latest.condition_text ?? "—",
      status: deriveStatus(patAppts),
      lastVisit: formatDate(latest.appointment_date),
      appointmentType: latest.appointment_type ?? "—",
      totalAppts: patAppts.length,
    };
  });

  renderPatients(allPatients);
  updateStats(allPatients);
  setApptStat(allAppointments.filter(a => a.appointment_date === new Date().toISOString().split("T")[0]).length);
  initSearch();
});

// ─── Derive status ────────────────────────────────────────────────────────────
function deriveStatus(appts) {
  if (!appts.length) return "Inactive";
  const cond = (appts[0].condition_text ?? "").toLowerCase();
  if (cond.includes("critical") || cond.includes("emergency")) return "Critical";
  const daysSince = (Date.now() - new Date(appts[0].appointment_date)) / 86400000;
  return daysSince <= 90 ? "Active" : "Inactive";
}

// ─── Render cards ─────────────────────────────────────────────────────────────
function renderPatients(patients) {
  const grid = document.getElementById("patientsGrid");
  if (!grid) return;

  if (!patients.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:#9ca3af;">
      <i class="fas fa-user-slash" style="font-size:40px;display:block;margin-bottom:12px;"></i>
      No patients found
    </div>`;
    return;
  }

  grid.innerHTML = patients.map(createCard).join("");

  grid.querySelectorAll(".patient-card").forEach(card => {
    const pid = card.dataset.patientId;
    card.addEventListener("click", e => {
      if (!e.target.closest(".btn-card")) openModal(pid);
    });
    card.querySelector(".btn-view")?.addEventListener("click", e => {
      e.stopPropagation(); openModal(pid);
    });
    card.querySelector(".btn-records")?.addEventListener("click", e => {
      e.stopPropagation();
      sessionStorage.setItem("view_patient_id", pid);
      window.location.href = "../patient-search/view-patient-hisoty/index.html";
    });
  });
}

function createCard(p) {
  const sc = p.status === "Critical" ? "critical" : p.status === "Active" ? "active" : "inactive";
  const bdr = p.status === "Critical" ? 'style="border-top:4px solid var(--danger-red);"' : "";
  const saved = localStorage.getItem(`avatar_${p.id}`);
  const avatarHtml = saved
    ? `<img src="${saved}" class="patient-avatar">`
    : `<div class="patient-avatar" style="display:flex;align-items:center;justify-content:center;
        background:#003785;color:#fff;font-weight:700;font-size:20px;">${initials(p.name)}</div>`;

  return `
    <div class="patient-card" data-patient-id="${p.id}" ${bdr} style="cursor:pointer;">
      <div class="card-header">
        ${avatarHtml}
        <div class="patient-main-info">
          <h3>${escHtml(p.name)}</h3>
          <span class="status-badge ${sc}">${escHtml(p.status)}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="info-row">
          <i class="fas fa-heartbeat" style="color:#003785;width:16px;"></i>
          Age ${p.age ?? "—"} · ${escHtml(p.gender)}
        </div>
        <div class="info-row">
          <i class="fas fa-tint" style="color:#de3b40;width:16px;"></i>
          Blood type: ${escHtml(p.blood_type)}
        </div>
        <div class="info-row">
          <i class="fas fa-calendar" style="color:#1c8a8e;width:16px;"></i>
          Last visit: ${p.lastVisit}
        </div>
        <div class="medical-tag ${p.status === "Critical" ? "critical" : ""}">
          ${escHtml(p.condition !== "—" ? p.condition : p.appointmentType)}
        </div>
      </div>
      <div class="card-footer">
        <button class="btn-card btn-view">View Chart</button>
        <button class="btn-card btn-records">Open Records</button>
      </div>
    </div>`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats(patients) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("statTotalPatients", patients.length);
  set("statActivePatients", patients.filter(p => p.status === "Active").length);
  set("statCriticalCases", patients.filter(p => p.status === "Critical").length);
}
function setApptStat(count) {
  const el = document.getElementById("statAppointments");
  if (el) el.textContent = count;
}

// ─── Search ───────────────────────────────────────────────────────────────────
function initSearch() {
  let input = document.querySelector(".header-actions input[type='text']");
  if (!input) {
    input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search by name or ID...";
    input.style.cssText = "padding:9px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;min-width:200px;";
    const ha = document.querySelector(".header-actions");
    if (ha) ha.insertBefore(input, ha.firstChild);
  }
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const filtered = q
      ? allPatients.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q))
      : allPatients;
    renderPatients(filtered);
    updateStats(filtered);
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
async function openModal(patientId) {
  const p = allPatients.find(x => String(x.id) === String(patientId));
  if (!p) return;

  // Fetch vitals and medications in parallel
  const [vitalsData, medsData] = await Promise.all([
    apiFetch(`/patients/${patientId}/vitals`),
    apiFetch(`/patients/${patientId}/medications`),
  ]);

  // getPatientVitals returns a single object (latest only), NOT an array
  // getPatientMedications returns { count, medications: [...] }
  const latest = vitalsData ?? {};
  const meds = medsData?.medications ?? [];

  closeModal();
  const overlay = document.createElement("div");
  overlay.id = "patientModal";
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.45);
    display:flex;align-items:center;justify-content:center;z-index:9999;`;

  overlay.innerHTML = `
    <div style="background:#fff;padding:28px;border-radius:14px;max-width:520px;width:92%;
      max-height:85vh;overflow-y:auto;position:relative;">
      <button onclick="closeModal()" style="position:absolute;top:14px;right:14px;
        background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280;line-height:1;">✕</button>

      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        <div style="width:56px;height:56px;background:#003785;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:700;font-size:18px;flex-shrink:0;">
          ${initials(p.name)}
        </div>
        <div>
          <h2 style="font-size:18px;color:#1f2937;margin-bottom:4px;">${escHtml(p.name)}</h2>
          <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;
            background:${p.status === "Critical" ? "#fee2e2" : p.status === "Active" ? "#dcfce7" : "#f3f4f6"};
            color:${p.status === "Critical" ? "#991b1b" : p.status === "Active" ? "#166534" : "#374151"};">
            ${escHtml(p.status)}
          </span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
        ${infoBox("Age", p.age ?? "—")}
        ${infoBox("Gender", p.gender)}
        ${infoBox("Blood Type", p.blood_type)}
        ${infoBox("Phone", p.phone)}
        ${infoBox("Last Visit", p.lastVisit)}
        ${infoBox("Condition", p.condition !== "—" ? p.condition : "—")}
      </div>

      <h4 style="font-size:14px;color:#003785;margin-bottom:10px;font-weight:600;">Latest Vitals</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px;">
        ${vitalBox("HR", latest.heart_rate ? latest.heart_rate + " bpm" : "—")}
        ${vitalBox("BP", latest.blood_pressure ?? "—")}
        ${vitalBox("SpO₂", latest.spo2 ? latest.spo2 + "%" : "—")}
        ${vitalBox("Temp", latest.body_temperature ? latest.body_temperature + "°C" : "—")}
      </div>

      <h4 style="font-size:14px;color:#003785;margin-bottom:10px;font-weight:600;">Medications</h4>
      <div style="font-size:13px;color:#374151;margin-bottom:20px;">
        ${meds.length
      ? meds.map(m => `
              <div style="padding:8px 0;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;">
                <span><strong>${escHtml(m.medication_name)}</strong> <span style="color:#6b7280;">${escHtml(m.dosage ?? "")}</span></span>
                <span style="font-size:11px;padding:2px 8px;border-radius:10px;
                  background:${m.status === "active" ? "#dcfce7" : "#f3f4f6"};
                  color:${m.status === "active" ? "#166534" : "#6b7280"};">
                  ${escHtml(m.status ?? "")}
                </span>
              </div>`).join("")
      : '<p style="color:#9ca3af;">No medications on record</p>'}
      </div>

      <div style="display:flex;gap:10px;">
        <button onclick="sessionStorage.setItem('view_patient_id','${patientId}');window.location.href='../patient-search/view-patient-hisoty/index.html';"
          style="flex:1;padding:10px;background:#003785;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:500;">
          Open Records
        </button>
        <button onclick="closeModal()"
          style="flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;cursor:pointer;font-weight:500;">
          Close
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", escHandler);
}

function infoBox(label, value) {
  return `<div style="background:#f9fafb;padding:10px;border-radius:8px;">
    <div style="font-size:11px;color:#6b7280;margin-bottom:3px;">${label}</div>
    <div style="font-size:14px;font-weight:600;color:#1f2937;">${escHtml(String(value ?? "—"))}</div>
  </div>`;
}
function vitalBox(label, value) {
  return `<div style="background:#eff6ff;padding:10px;border-radius:8px;text-align:center;">
    <div style="font-size:11px;color:#6b7280;">${label}</div>
    <div style="font-size:15px;font-weight:700;color:#003785;">${value}</div>
  </div>`;
}

function escHandler(e) { if (e.key === "Escape") closeModal(); }
window.closeModal = function () {
  document.getElementById("patientModal")?.remove();
  document.removeEventListener("keydown", escHandler);
};