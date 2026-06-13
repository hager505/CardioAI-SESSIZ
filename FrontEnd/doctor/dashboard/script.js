// doctor/dashboard/script.js
// ─── CardioAI — Doctor Dashboard ─────────────────────────────────────────────
//
// sessionStorage contract (set by your login page after POST /api/doctors/login):
//   user_role  = "doctor"
//   user_id    = String(data.id)          e.g. "1"
//   user_data  = JSON.stringify(data)     full login response object
//
// If any of these three are missing the page redirects to login.

const API = "http://localhost:5000/api";

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer") || createToastContainer();
  const colors = { success: "#10b981", error: "#ef4444", info: "#1a56db", warning: "#f59e0b" };
  const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", info: "fa-info-circle", warning: "fa-exclamation-triangle" };
  
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `
    <i class="fas ${icons[type] || icons.info} toast-icon"></i>
    <span class="toast-content">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(t);
  
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(100%)";
    setTimeout(() => t.remove(), 400);
  }, 3500);
}

function createToastContainer() {
  const c = document.createElement("div");
  c.id = "toastContainer";
  c.className = "toast-container";
  document.body.appendChild(c);
  return c;
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function setText(id, val, fallback = "—") {
  const el = document.getElementById(id);
  if (el) el.textContent = (val !== null && val !== undefined) ? val : fallback;
}
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ui-avatars.com — works for any language / name
const AVATAR_COLORS = ["1a56db", "10b981", "ef4444", "f59e0b", "1c8a8e"];
function getAvatarColor(id) {
  const i = parseInt(id) || 0;
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

function avatarUrl(name, id = 0) {
  const bg = getAvatarColor(id);
  const parts = (name ?? "Unknown Patient").trim().split(/\s+/);
  const f = encodeURIComponent((parts[0]?.[0] ?? "U").toUpperCase());
  const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "P").toUpperCase());
  return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

function formatTime(t) {
  if (!t) return "—";
  const [h, m] = String(t).split(":");
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return t;
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDate(d) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed)) return d;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function badgeClass(type) {
  const m = { "Check-up": "badge-new", "Follow-up": "badge-new", Consultation: "badge-consult", Emergency: "badge-high" };
  return m[type] ?? "badge-new";
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API}${endpoint}`);
    if (!res.ok) {
      console.error(`API ERROR: ${endpoint}`, res.status);
      return { error: true };
    }
    return await res.json();
  } catch (e) {
    console.error("Fetch failed:", endpoint, e);
    return { error: true };
  }
}

// ─── User Menu Toggle ────────────────────────────────────────────────────────
function toggleUserMenu() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

// Close user menu when clicking outside
document.addEventListener("click", (e) => {
  const menu = document.getElementById("userMenu");
  const dropdown = document.getElementById("userDropdown");
  if (menu && dropdown && !menu.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────
function confirmLogout() {
  if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
    AuthManager.handleLogout();
  } else {
    sessionStorage.clear();
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userType");
    localStorage.removeItem("userName");
    localStorage.removeItem("token");
    window.location.href = "../../index.html";
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  
  // ── 1. Session guard ───────────────────────────────────────────────────────
  // The per-tab sessionStorage is empty in any new tab (e.g. when this
  // URL is opened from the landing-page navbar dropdown or pasted into
  // the address bar), even though localStorage is shared across tabs
  // and knows the user is logged in. Bootstrap sessionStorage from
  // localStorage FIRST so the sessionStorage-only check below passes.
  // Without this, the guard redirects to login.html, which calls
  // AuthManager.redirectIfAuthenticated() and bounces right back here
  // — an infinite redirect loop. See auth-manager.js bootstrapSessionFromLocal.
  if (typeof AuthManager !== "undefined" && AuthManager.bootstrapSessionFromLocal) {
    AuthManager.bootstrapSessionFromLocal();
  }

  // Cross-tab logout check. sessionStorage is per-tab and persists
  // across refreshes, but the user may have logged out from ANOTHER
  // tab — in which case localStorage.isLoggedIn is now "false" /
  // removed, but THIS tab's sessionStorage still holds the old
  // user_data. Without this check, refreshing the dashboard tab
  // after a logout in another tab would still render the dashboard
  // (the sessionStorage-only check below would pass against stale
  // data). localStorage is the source of truth for "is this user
  // logged in" — trust it, not the per-tab sessionStorage cache.
  if (typeof AuthManager !== "undefined" && AuthManager.isLoggedIn && !AuthManager.isLoggedIn()) {
    try { sessionStorage.clear(); } catch (_) {}
    window.location.href = "../../auth/login.html";
    return;
  }

  // Auto-redirect this tab if the user logs out from another tab
  // WHILE the dashboard is open (no manual refresh needed). The
  // storage event fires in other tabs when localStorage changes.
  if (typeof AuthManager !== "undefined" && AuthManager.installCrossTabLogoutGuard) {
    AuthManager.installCrossTabLogoutGuard();
  }

  const raw = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (!raw || role !== "doctor" || !userId) {
    // Fallback: user is logged in (localStorage) but the full blob
    // didn't make it into sessionStorage (e.g. an old session that
    // predates the localStorage.userData mirror, or sessionStorage was
    // cleared by the user). Re-fetch from the API and reload so the
    // guard passes on the second pass — instead of redirecting to
    // login.html, which would bounce right back here (infinite loop).
    if (typeof AuthManager !== "undefined" && AuthManager.isLoggedIn && AuthManager.isLoggedIn()) {
      const lsRole  = localStorage.getItem("userType");
      const lsId    = localStorage.getItem("userId");
      if (lsRole === "doctor" && lsId) {
        try {
          const res = await fetch(`${API}/doctors/${lsId}`);
          if (res.ok) {
            const data = await res.json();
            sessionStorage.setItem("user_role", "doctor");
            sessionStorage.setItem("user_id", String(data.id));
            sessionStorage.setItem("user_name", data.full_name || "");
            sessionStorage.setItem("user_data", JSON.stringify(data));
            window.location.reload();
            return;
          }
        } catch (_) { /* fall through to redirect */ }
      }
    }
    window.location.href = "../../auth/login.html";
    return;
  }

  let user;
  try { user = JSON.parse(raw); }
  catch { window.location.href = "../../auth/login.html"; return; }

  console.log("[CardioAI] Logged in as:", user.full_name, "| id:", userId, "| role:", role);

  // ── 2. Avatar pill ────────────────────────────────────────────────────────
  if (typeof AuthManager !== "undefined") {
    AuthManager.initDoctorAvatar(document.getElementById("doctorAvatar"), userId, user.full_name);
  }

  // ── 3. Greeting and name pill ─────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  setText("headerGreeting", `${greeting}, ${user.full_name ?? "Doctor"}`);
  setText("doctorNamePill", user.full_name ?? "Doctor");

  // ── 4. Specialty ──────────────────────────────────────────────────────────
  setText("doctorSpecialty", user.specialty ?? "Cardiologist");

  const doctorData = await apiFetch(`/doctors/${userId}`);
  if (doctorData?.specialty) {
    setText("doctorSpecialty", doctorData.specialty);
  }

  // ── 5. Appointments ───────────────────────────────────────────────────────
  const apptData = await apiFetch(`/doctors/${userId}/appointments`);
  const allAppts = apptData?.appointments ?? [];

  console.log("[CardioAI] appointments loaded:", allAppts.length);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAppts = allAppts.filter(a => a.appointment_date === todayStr);
  const completed = todayAppts.filter(a => a.status === "completed").length;
  const remaining = todayAppts.filter(a => a.status === "scheduled").length;
  const scheduledAll = allAppts.filter(a => a.status === "scheduled");

  // ── 6. Stats cards ────────────────────────────────────────────────────────
  setText("statTodayCount", todayAppts.length);
  setText("statCompletedSub", `${completed} completed · ${remaining} remaining`);
  setText("statScheduledCount", scheduledAll.length);
  setText("headerSubtitle",
    remaining > 0
      ? `You have ${remaining} appointment${remaining !== 1 ? "s" : ""} remaining today`
      : "No remaining appointments today"
  );

  const effPct = todayAppts.length > 0
    ? Math.round((completed / todayAppts.length) * 100)
    : 0;
  setText("statEfficiency", `${effPct}%`);
  const effBar = document.getElementById("efficiencyBar");
  if (effBar) effBar.style.width = `${effPct}%`;

  // Total patients
  const patientsData = await apiFetch("/patients");
  setText("statTotalPatients",
    patientsData?.count ?? patientsData?.patients?.length ?? "—"
  );

  // ── 7. Today's Schedule ───────────────────────────────────────────────────
  setHTML("todaySchedule",
    todayAppts.length
      ? todayAppts.slice(0, 5).map(a => {
        const photo = localStorage.getItem(`avatar_patient_${a.patient_id}`)
          ?? avatarUrl(a.patient_name, a.patient_id);
        return `
            <div class="list-item" style="cursor:pointer;"
              onclick="window.location.href='../patient-search/patient-search/patient-search.html'">
              <img src="${photo}"
                onerror="this.src='${avatarUrl(a.patient_name, a.patient_id)}'">
              <div class="item-info">
                <div class="item-name">${a.patient_name ?? "Patient"}</div>
                <div class="item-desc">${a.reason_for_visit ?? a.appointment_type ?? "—"}</div>
                <div class="item-time">
                  <i class="fas fa-clock"></i> ${formatTime(a.appointment_time)}
                  ${a.patient_age ? `· ${a.patient_age} yrs` : ""}
                </div>
              </div>
              <span class="badge ${badgeClass(a.appointment_type)}">
                ${a.appointment_type ?? "Visit"}
              </span>
            </div>`;
      }).join("")
      : `<div class="empty-state">
            <i class="fas fa-calendar-check"></i>
            <p>No appointments today</p>
          </div>`
  );

  // ── 8. Upcoming Appointments ──────────────────────────────────────────────
  const upcoming = scheduledAll
    .filter(a => a.appointment_date > todayStr)
    .sort((a, b) => {
      const d = a.appointment_date.localeCompare(b.appointment_date);
      return d !== 0 ? d : a.appointment_time.localeCompare(b.appointment_time);
    })
    .slice(0, 4);

  setHTML("upcomingList",
    upcoming.length
      ? upcoming.map(a => {
        const photo = localStorage.getItem(`avatar_patient_${a.patient_id}`)
          ?? avatarUrl(a.patient_name, a.patient_id);
        return `
            <div class="list-item" style="border-left:3px solid var(--secondary);">
              <img src="${photo}"
                onerror="this.src='${avatarUrl(a.patient_name, a.patient_id)}'">
              <div class="item-info">
                <div class="item-name">${a.patient_name ?? "Patient"}</div>
                <div class="item-desc">${a.appointment_type ?? "—"}</div>
                <div class="item-time">
                  <i class="fas fa-calendar"></i>
                  ${formatDate(a.appointment_date)}
                  at ${formatTime(a.appointment_time)}
                </div>
              </div>
            </div>`;
      }).join("")
      : `<div class="empty-state"><i class="fas fa-calendar"></i><p>No upcoming appointments</p></div>`
  );

  // ── 9. Recent Completed ───────────────────────────────────────────────────
  const recent = allAppts.filter(a => a.status === "completed").slice(0, 3);
  setHTML("recentPatientsList",
    recent.length
      ? recent.map(a => `
          <div class="list-item"
            style="border-left:4px solid #1c8a8e;cursor:pointer;"
            onclick="window.location.href='../patient-search/patient-search/patient-search.html'">
            <div class="item-info">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div class="item-name">${a.patient_name ?? "Patient"}</div>
                <span class="badge badge-consult">${a.appointment_type ?? "Visit"}</span>
              </div>
              <div class="item-desc">${a.reason_for_visit ?? "—"}</div>
              <div class="item-time">
                <i class="fas fa-calendar"></i> ${formatDate(a.appointment_date)}
              </div>
            </div>
          </div>`).join("")
      : `<div class="empty-state"><i class="fas fa-user-check"></i><p>No recent patients</p></div>`
  );

  // ── 10. Search ────────────────────────────────────────────────────────────
  document.getElementById("mainSearch")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".list-item").forEach(item => {
      const name = (item.querySelector(".item-name")?.textContent ?? "").toLowerCase();
      item.style.display = name.includes(q) ? "flex" : "none";
    });
  });

  // ── 11. Logout ────────────────────────────────────────────────────────────
  window.confirmLogout = confirmLogout;
});

// ── AI Prediction Result Renderer ──────────────────────────────────────────
function renderAIResult(data) {
  const resultEl = document.getElementById("aiPredictionResult");
  if (!resultEl) return;

  if (data.error) {
    resultEl.innerHTML = `<span style="color:var(--danger)">❌ ${data.error}</span>`;
    showToast("Prediction failed", "error");
    return;
  }

  const riskColor = data.risk_color || (data.risk_level === "none" ? "#10b981" : "#ef4444");
  const modelLabel = data.model_used === "vitals" ? "🫀 Vitals Analysis" : "📊 ECG Analysis";
  const conf = data.confidence_pct ?? (data.confidence * 100).toFixed(1);

  resultEl.innerHTML = `
    <div style="background:white;border-radius:var(--radius-md);border-left:5px solid ${riskColor};
                padding:var(--spacing-md);margin-top:var(--spacing-sm);box-shadow:var(--shadow-md);">
      <div style="display:flex;align-items:center;gap:var(--spacing-sm);margin-bottom:var(--spacing-sm);">
        <div style="width:40px;height:40px;background:${riskColor};border-radius:50%;
                    display:flex;align-items:center;justify-content:center;color:white;
                    font-size:18px;flex-shrink:0;">
          <i class="fas fa-heartbeat"></i>
        </div>
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--text-primary);">${modelLabel}</div>
          <div style="font-size:12px;color:${riskColor};font-weight:600;">
            ${data.label || "—"} · ${conf}%
          </div>
        </div>
      </div>
      <div style="background:${riskColor}15;border-radius:var(--radius-sm);padding:var(--spacing-sm);margin-bottom:var(--spacing-sm);">
        <div style="font-size:14px;font-weight:600;color:${riskColor};margin-bottom:4px;">
          ${data.message_en || "Analysis complete"}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);direction:rtl;text-align:right;">
          ${data.message_ar || ""}
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">
        <i class="fas fa-stethoscope"></i>
        <span>${data.recommendation_en || ""}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);direction:rtl;text-align:right;margin-top:4px;">
        📝 ${data.recommendation_ar || ""}
      </div>
    </div>
  `;

  const toastType = data.risk_level === "none" || data.risk_level === "low" ? "success" : "error";
  showToast(`${modelLabel}: ${data.label}`, toastType);
}

// ── Run ECG Prediction ───────────────────────────────────────────────────────
window.runAIPrediction = async function () {
  const btn = document.getElementById("runPredictionBtn");
  if (btn) btn.disabled = true;
  document.getElementById("aiPredictionResult").innerHTML =
    `<div class="empty-state">
       <i class="fas fa-spinner fa-spin"></i>
       <p>Running AI analysis...</p>
     </div>`;

  try {
    const res = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error("API responded with an error");
    renderAIResult(await res.json());
  } catch (err) {
    console.error(err);
    renderAIResult({ error: "Failed to connect to the AI server: " + err.message });
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── Upload CSV for AI Prediction ──────────────────────────────────────────
window.uploadCSVForPrediction = async function () {
  const input = document.getElementById("dashboardCSVUpload");
  if (!input) return;
  input.click();
};

// Listen for CSV file selection
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("dashboardCSVUpload")) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.id = "dashboardCSVUpload";
    inp.accept = ".csv";
    inp.style.display = "none";
    document.body.appendChild(inp);
  }

  document.getElementById("dashboardCSVUpload")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const resultEl = document.getElementById("aiPredictionResult");
    if (resultEl) resultEl.innerHTML =
      `<div class="empty-state">
         <i class="fas fa-spinner fa-spin"></i>
         <p>Analyzing ${file.name}...</p>
       </div>`;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/predict/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      renderAIResult(await res.json());
    } catch (err) {
      console.error(err);
      renderAIResult({ error: "Failed to analyze file: " + err.message });
    }

    e.target.value = "";
  });
});
