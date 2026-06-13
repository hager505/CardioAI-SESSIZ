// patient/dashboard/script.js
// CardioAI Patient Dashboard - Unified Design System

document.addEventListener("DOMContentLoaded", async function () {

  // ══════════════════════════════════════════════════════════════════════
  // AUTH GUARD
  // ══════════════════════════════════════════════════════════════════════
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

  const userData = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (!userData || role !== "patient") {
    // Fallback: user is logged in (localStorage) but the full blob
    // didn't make it into sessionStorage (e.g. an old session that
    // predates the localStorage.userData mirror, or sessionStorage was
    // cleared by the user). Re-fetch from the API and reload so the
    // guard passes on the second pass — instead of redirecting to
    // login.html, which would bounce right back here (infinite loop).
    if (typeof AuthManager !== "undefined" && AuthManager.isLoggedIn && AuthManager.isLoggedIn()) {
      const lsRole = localStorage.getItem("userType");
      const lsId   = localStorage.getItem("userId");
      if (lsRole === "patient" && lsId) {
        try {
          const res = await fetch(`http://localhost:5000/api/patients/${lsId}`);
          if (res.ok) {
            const data = await res.json();
            sessionStorage.setItem("user_role", "patient");
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

  const user = JSON.parse(userData);
  const API = "http://localhost:5000/api";

  // ══════════════════════════════════════════════════════════════════════
  // TOAST NOTIFICATION SYSTEM
  // ══════════════════════════════════════════════════════════════════════
  const toastContainer = document.getElementById("toastContainer");

  function showToast(message, type = "info") {
    if (!toastContainer) return;

    const icons = {
      success: "fa-check-circle",
      error: "fa-times-circle",
      info: "fa-info-circle",
      warning: "fa-exclamation-triangle"
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type} animate-slide-in-right`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast-icon"></i>
      <span class="toast-content">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    `;

    toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ══════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════
  async function get(endpoint) {
    try {
      const res = await fetch(`${API}${endpoint}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function setText(id, val, fallback = "—") {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? fallback;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function setWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(0)}%`;
  }

  function calculateAge(dob) {
    if (!dob) return "—";
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  function getInitials(name) {
    if (!name) return "P";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. WELCOME + AVATAR
  // ══════════════════════════════════════════════════════════════════════
  const age = calculateAge(user.date_of_birth);
  setText("patientName", `Hello, ${user.full_name}!`);
  setText("patientAge", age !== "—" ? `${age} years old` : "—");
  setText("patientSerial", user.serial || "");

  // Update header greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  setText("headerGreeting", `${greeting}, ${user.full_name?.split(" ")[0] || "Patient"}`);

  // Set avatar initials
  const initials = getInitials(user.full_name);
  const avatarInitials = document.getElementById("avatarInitials");
  const largeAvatarInitials = document.getElementById("largeAvatarInitials");
  if (avatarInitials) avatarInitials.textContent = initials;
  if (largeAvatarInitials) largeAvatarInitials.textContent = initials;

  const resolveAvatarUrl = (url) => (typeof AuthManager !== 'undefined' ? AuthManager.resolveUrl(url) : null);

  // Load saved avatar
  // Try sessionStorage avatar_url first (DB-backed), then localStorage cache
  let avatarToShow = null;
  try {
    const raw = sessionStorage.getItem('user_data');
    if (raw) {
      const ud = JSON.parse(raw);
      avatarToShow = resolveAvatarUrl(ud.avatar_url || null);
    }
  } catch (_) { /* ignore */ }
  if (!avatarToShow) {
    avatarToShow = resolveAvatarUrl(localStorage.getItem(`avatar_patient_${userId}`));
  }
  if (!avatarToShow && user.avatar_url) {
    avatarToShow = resolveAvatarUrl(user.avatar_url);
  }
  if (avatarToShow) {
    localStorage.setItem(`avatar_patient_${userId}`, avatarToShow);
    setAvatarImage(avatarToShow);
  }

  function setAvatarImage(src) {
    const profileAvatar = document.getElementById("profileAvatar");
    const largeAvatarContainer = document.getElementById("largeAvatarContainer");

    [profileAvatar, largeAvatarContainer].forEach(el => {
      if (!el) return;
      const oldSpan = el.querySelector(".avatar-initials");
      if (oldSpan) oldSpan.remove();

      let img = el.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "Profile";
        img.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;";
        el.appendChild(img);
      }
      img.src = src;
      img.style.display = "block";
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. VITAL SIGNS
  // ══════════════════════════════════════════════════════════════════════
  const vitals = await get(`/patients/${userId}/vitals`);

  if (vitals) {
    const [sys, dia] = (vitals.blood_pressure || "0/0").split("/").map(Number);

    // Blood Pressure
    setText("bpValue", vitals.blood_pressure || "—");
    setText("bpStatus", getBPStatus(sys, dia));
    setWidth("bpProgress", (sys / 180) * 100);

    // Heart Rate
    setText("hrValue", vitals.heart_rate ? `${vitals.heart_rate}` : "—");
    setText("hrStatus", getHRStatus(vitals.heart_rate));
    setWidth("hrProgress", (vitals.heart_rate / 120) * 100);

    // SpO2
    setText("spo2Value", vitals.spo2 ? `${vitals.spo2}` : "—");
    setText("spo2Status", getSPO2Status(vitals.spo2));
    setWidth("spo2Progress", vitals.spo2 || 0);

    // Body Temperature
    setText("tempValue", vitals.body_temperature ? `${vitals.body_temperature}` : "—");
    setText("tempStatus", getTempStatus(vitals.body_temperature));
    setWidth("tempProgress", ((vitals.body_temperature - 35) / 5) * 100);

  } else {
    ["bpValue", "hrValue", "spo2Value", "tempValue"].forEach(id => setText(id, "—"));
    ["bpStatus", "hrStatus", "spo2Status", "tempStatus"].forEach(id => setText(id, "Not measured yet"));
  }

  function getBPStatus(s, d) {
    if (!s) return "—";
    if (s < 120 && d < 80) return "Normal";
    if (s < 130) return "Elevated";
    if (s < 140) return "High Stage 1";
    return "High Stage 2";
  }

  function getHRStatus(hr) {
    if (!hr) return "—";
    if (hr < 60) return "Low (Bradycardia)";
    if (hr <= 100) return "Normal";
    return "High (Tachycardia)";
  }

  function getSPO2Status(v) {
    if (!v) return "—";
    if (v >= 95) return "Optimal range";
    if (v >= 90) return "Acceptable";
    return "Low — seek care";
  }

  function getTempStatus(t) {
    if (!t) return "—";
    if (t < 36.1) return "Low";
    if (t <= 37.2) return "Normal";
    if (t <= 38.0) return "Slightly elevated";
    return "Fever";
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. UPCOMING APPOINTMENTS
  // ══════════════════════════════════════════════════════════════════════
  const apptData = await get(`/patients/${userId}/appointments`);
  const appts = apptData?.appointments || [];
  const upcoming = appts
    .filter(a => a.status === "scheduled")
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    .slice(0, 3);

  setText("upcomingCount", upcoming.length);

  setHTML("upcomingAppointments", upcoming.length
    ? upcoming.map(a => `
        <div class="item-card" onclick="window.location.href='../appointments/appointment.html'">
          <div class="item-icon primary">
            <i class="fas fa-calendar-check"></i>
          </div>
          <div class="item-content">
            <div class="item-title">${a.doctor_name || "Doctor"}</div>
            <div class="item-subtitle">${a.specialty || a.appointment_type}</div>
            <div class="item-subtitle">
              <i class="fas fa-clock mr-xs"></i>
              ${formatDate(a.appointment_date)} at ${a.appointment_time?.slice(0, 5) || "—"}
            </div>
          </div>
          <span class="item-badge badge badge-primary">${a.appointment_type}</span>
        </div>`).join("")
    : `<p class="text-muted text-center p-xl">
         <i class="fas fa-calendar d-block mb-sm" style="font-size:24px;"></i>
         No upcoming appointments
       </p>`
  );

  // ══════════════════════════════════════════════════════════════════════
  // 4. ACTIVE MEDICATIONS
  // ══════════════════════════════════════════════════════════════════════
  const medData = await get(`/patients/${userId}/medications`);
  const meds = medData?.medications || [];
  const active = meds.filter(m => m.status === "active").slice(0, 4);

  setText("medsCount", active.length);

  setHTML("activeMedications", active.length
    ? active.map(m => `
        <div class="item-card">
          <div class="item-icon secondary">
            <i class="fas fa-pills"></i>
          </div>
          <div class="item-content">
            <div class="item-title">${m.medication_name}</div>
            <div class="item-subtitle">${m.dosage}</div>
          </div>
          <div class="text-xs text-muted text-right">
            <i class="fas fa-redo mr-xs"></i>
            ${m.refill_due ? formatDate(m.refill_due) : "No refill"}
          </div>
        </div>`).join("")
    : `<p class="text-muted text-center p-xl">
         <i class="fas fa-pills d-block mb-sm" style="font-size:24px;"></i>
         No active medications
       </p>`
  );

  // ══════════════════════════════════════════════════════════════════════
  // 5. RECENT MEDICAL RECORDS
  // ══════════════════════════════════════════════════════════════════════
  const recData = await get(`/patients/${userId}/records`);
  const records = recData?.records?.slice(0, 3) || [];

  setHTML("recentRecords", records.length
    ? records.map(r => `
        <div class="item-card" onclick="window.location.href='../MedicalRecords/medicalrecords1.html'">
          <div class="item-icon primary">
            <i class="fas ${getRecordIcon(r.record_type)}"></i>
          </div>
          <div class="item-content">
            <div class="item-title">${r.title || "—"}</div>
            <div class="item-subtitle">${r.doctor_name || "—"}</div>
            <div class="item-subtitle">${formatDate(r.record_date)}</div>
          </div>
          <span class="item-badge badge badge-primary text-capitalize">${r.record_type}</span>
        </div>`).join("")
    : `<p class="text-muted text-center p-xl">
         <i class="fas fa-file-medical d-block mb-sm" style="font-size:24px;"></i>
         No medical records found
       </p>`
  );

  function getRecordIcon(type) {
    return {
      lab: "fa-flask",
      radiology: "fa-x-ray",
      prescription: "fa-prescription-bottle",
      surgery: "fa-syringe"
    }[type] || "fa-file-medical";
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. QUICK NOTIFICATIONS BUTTON
  // ══════════════════════════════════════════════════════════════════════
  // The shared notification-count.js already populates the
  // #quickNotifications label (and the bell badge) from the real
  // /api/patients/:id/notifications endpoint. We used to override that
  // here with an appointments-based "upcoming" count, which caused a
  // race: sometimes this code won and showed "No new notifications"
  // even when the bell badge showed unread items. The shared script
  // is the single source of truth now, so we just leave the button's
  // text alone and let the shared notifier drive it.
  window.NotificationCount?.refresh();

  // ══════════════════════════════════════════════════════════════════════
  // 7. NAVIGATION & BUTTONS
  // ══════════════════════════════════════════════════════════════════════
  document.getElementById("notificationsBtn")
    ?.addEventListener("click", () => window.location.href = "../notifications/notification.html");

  document.getElementById("quickNotifications")
    ?.addEventListener("click", () => window.location.href = "../notifications/notification.html");

  // Header search
  document.getElementById("mainSearch")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        window.location.href = `../MedicalRecords/medicalrecords1.html?q=${encodeURIComponent(e.target.value.trim())}`;
      }
    });

  // ══════════════════════════════════════════════════════════════════════
  // 8. WELCOME TOAST — only on first arrival in this session.
  // sessionStorage is cleared on logout (AuthManager.clearAuthData calls
  // sessionStorage.clear()), so the next login resets the flag and the
  // toast shows again. Navigating away from the dashboard and coming
  // back in the same tab keeps sessionStorage intact, so the toast
  // stays suppressed on subsequent visits.
  // ══════════════════════════════════════════════════════════════════════
  if (!sessionStorage.getItem("patientDashboard.welcomeShown")) {
    sessionStorage.setItem("patientDashboard.welcomeShown", "1");
    setTimeout(() => {
      showToast(`Welcome back, ${user.full_name?.split(" ")[0]}!`, "info");
    }, 800);
  }
});
