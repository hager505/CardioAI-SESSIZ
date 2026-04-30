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
  document.getElementById("cardio-toast")?.remove();
  const colors = { success: "#779f00", error: "#de3b40", info: "#003785" };
  const t = document.createElement("div");
  t.id = "cardio-toast";
  t.style.cssText = `
    position:fixed;top:20px;right:24px;z-index:9999;
    background:${colors[type] ?? colors.info};color:#fff;
    padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;
    box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .4s;max-width:320px;`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 400); }, 3500);
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
const AVATAR_COLORS = ["003785", "779f00", "de3b40", "f59e0b", "1c8a8e"];
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
  const m = { "Check-up": "new", "Follow-up": "new", Consultation: "consult", Emergency: "high" };
  return m[type] ?? "new";
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────
// async function apiFetch(endpoint) {
//   try {
//     const res = await fetch(`${API}${endpoint}`);
//     if (!res.ok) {
//       console.warn(`[CardioAI] API ${endpoint} → HTTP ${res.status}`);
//       return null;
//     }
//     return await res.json();
//   } catch (e) {
//     console.error(`[CardioAI] apiFetch ${endpoint}`, e);
//     return null;
//   }
// }
async function apiFetch(endpoint) {
  try {
    const res = await fetch(`${API}${endpoint}`);

    if (!res.ok) {
      console.error(`API ERROR: ${endpoint}`, res.status);
      return { error: true };   // 👈 مهم
    }

    return await res.json();
  } catch (e) {
    console.error("Fetch failed:", endpoint, e);
    return { error: true };     // 👈 مهم
  }
}
// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {

  // ── 1. Session guard ───────────────────────────────────────────────────────
  const raw = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (!raw || role !== "doctor" || !userId) {
    window.location.href = "../../auth/login.html";
    return;
  }

  let user;
  try { user = JSON.parse(raw); }
  catch { window.location.href = "../../auth/login.html"; return; }

  // Debug: log what we got so you can verify the session is correct
  console.log("[CardioAI] Logged in as:", user.full_name, "| id:", userId, "| role:", role);

  // ── 2. Avatar pill ────────────────────────────────────────────────────────
  const avatarEl = document.getElementById("doctorAvatar");
  if (avatarEl) {
    const savedPhoto = localStorage.getItem(`avatar_${userId}`);
    const url = user.avatar_url || savedPhoto || avatarUrl(user.full_name, userId);

    // Apply as background-image (the element is a div, not an img)
    avatarEl.style.backgroundImage = `url('${url}')`;
    avatarEl.style.backgroundSize = "cover";
    avatarEl.style.backgroundPosition = "center";
    avatarEl.textContent = "";    // clear the "DR" placeholder
  }

  // ── 3. Greeting and name pill ─────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // user.full_name comes from the DB e.g. "Dr. Ahmed Samir"
  setText("headerGreeting", `${greeting}, ${user.full_name ?? "Doctor"}`);
  setText("doctorNamePill", user.full_name ?? "Doctor");

  // ── 4. Specialty (already in login response via LEFT JOIN doctor_details) ──
  // user.specialty is set by the loginDoctor JOIN — no extra call needed
  setText("doctorSpecialty", user.specialty ?? "Cardiologist");

  // Optionally refresh from /api/doctors/:id if you want the latest value
  const doctorData = await apiFetch(`/doctors/${userId}`);
  if (doctorData?.specialty) {
    setText("doctorSpecialty", doctorData.specialty);
  }

  // ── 5. Appointments ───────────────────────────────────────────────────────
  // GET /api/doctors/:id/appointments
  // appointment_date is now "YYYY-MM-DD" string from DATE_FORMAT in the fixed controller
  const apptData = await apiFetch(`/doctors/${userId}/appointments`);
  const allAppts = apptData?.appointments ?? [];

  console.log("[CardioAI] appointments loaded:", allAppts.length);

  const todayStr = new Date().toISOString().split("T")[0];   // "2025-03-23"
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
        const photo = localStorage.getItem(`avatar_${a.patient_id}`)
          ?? avatarUrl(a.patient_name, a.patient_id);
        return `
            <div class="list-item" style="cursor:pointer;"
              onclick="window.location.href='../patient-search/patient-search/patient-search.html'">
              <img src="${photo}"
                style="width:44px;height:44px;border-radius:50%;object-fit:cover;
                       margin-right:14px;flex-shrink:0;"
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
      : `<div style="text-align:center;padding:30px;color:#9ca3af;">
           <i class="fas fa-calendar-check"
              style="font-size:32px;display:block;margin-bottom:10px;"></i>
           No appointments today
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
        const photo = localStorage.getItem(`avatar_${a.patient_id}`)
          ?? avatarUrl(a.patient_name, a.patient_id);
        return `
            <div class="list-item" style="border-left:3px solid #779f00;">
              <img src="${photo}"
                style="width:40px;height:40px;border-radius:50%;object-fit:cover;
                       margin-right:12px;flex-shrink:0;"
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
      : `<p style="color:#9ca3af;padding:16px;text-align:center;">No upcoming appointments</p>`
  );

  // ── 9. Recent Completed ───────────────────────────────────────────────────
  const recent = allAppts.filter(a => a.status === "completed").slice(0, 3);
  setHTML("recentPatientsList",
    recent.length
      ? recent.map(a => `
          <div class="list-item request-item"
            style="border-left:4px solid #1c8a8e;cursor:pointer;"
            onclick="window.location.href='../patient-search/patient-search/patient-search.html'">
            <div class="item-info">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div class="item-name">${a.patient_name ?? "Patient"}</div>
                <span class="badge consult">${a.appointment_type ?? "Visit"}</span>
              </div>
              <div class="item-desc">${a.reason_for_visit ?? "—"}</div>
              <div class="item-time">
                <i class="fas fa-calendar"></i> ${formatDate(a.appointment_date)}
              </div>
            </div>
          </div>`).join("")
      : `<p style="color:#9ca3af;padding:16px;text-align:center;">No recent patients</p>`
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
  window.confirmLogout = function () {
    if (confirm("Are you sure you want to log out?")) {
      sessionStorage.clear();
      localStorage.removeItem("isLoggedIn");
      window.location.href = "../../auth/login.html";
    }
  };
});


// console.log("role :", sessionStorage.getItem("user_role"));
// console.log("id :", sessionStorage.getItem("user_id"));
// console.log("name :", JSON.parse(sessionStorage.getItem("user_data"))?.full_name);
// console.log("spec :", JSON.parse(sessionStorage.getItem("user_data"))?.specialty);