document.addEventListener("DOMContentLoaded", async function () {

  // ─── Auth Guard ───────────────────────────────────────────
  const userData = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (!userData || role !== "patient") {
    // window.location.href = "../../login.html";
    window.location.href = "../../auth/login.html";
    return;
  }

  const user = JSON.parse(userData);
  const API = "http://localhost:5000/api";

  // ─── Helpers ──────────────────────────────────────────────
  async function get(endpoint) {
    try {
      const res = await fetch(`${API}${endpoint}`);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
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

  function showToast(message, type = "info") {
    const colors = { success: "#10b981", error: "#ef4444", info: "#003785" };
    const toast = document.createElement("div");
    toast.style.cssText = `
      position:fixed; top:80px; right:20px;
      background:${colors[type] || colors.info}; color:white;
      padding:12px 20px; border-radius:8px; font-size:14px;
      z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.2);
      animation: slideInToast .3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── 1. Welcome + Avatar ──────────────────────────────────
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
    if (!name) return 'P';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function setAvatarInitials(name) {
    const initials = getInitials(name);
    ['profileAvatar', 'largeAvatarContainer'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const oldImg = el.querySelector('img');
      const oldSpan = el.querySelector('.avatar-initials');

      // Specifically target our avatar icons
      const avatarIcon = el.querySelector('.default-avatar, .default-avatar-large');
      if (avatarIcon) avatarIcon.remove();
      if (oldSpan) oldSpan.remove();
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
    ['profileAvatar', 'largeAvatarContainer'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      const oldSpan = el.querySelector('.avatar-initials');
      if (oldSpan) oldSpan.remove();

      const avatarIcon = el.querySelector('.default-avatar, .default-avatar-large');
      if (avatarIcon) avatarIcon.style.display = 'none';

      let img = el.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = 'Profile';
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;cursor:pointer;';
        el.appendChild(img);
      }
      img.src = src;
      img.style.display = 'block';
    });
  }

  const age = calculateAge(user.date_of_birth);
  setText("patientName", `Hello, ${user.full_name}!`);
  setText("patientAge", age !== "—" ? `${age} years old` : "—");
  setText("patientSerial", user.serial || "");

  // Load Avatar
  const savedAvatar = localStorage.getItem(`avatar_${userId}`);
  if (savedAvatar) {
    setAvatarImage(savedAvatar);
  } else if (user.avatar_url) {
    setAvatarImage(user.avatar_url);
  } else {
    setAvatarInitials(user.full_name);
  }

  // Avatar upload
  const avatarUpload = document.getElementById("avatarUpload");
  const smallAvatar = document.getElementById("profileAvatar");
  const bigAvatar = document.getElementById("largeAvatarContainer");

  [smallAvatar, bigAvatar].forEach(el => {
    el?.addEventListener("click", () => avatarUpload?.click());
  });

  avatarUpload?.addEventListener("change", function (e) {
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

  // ─── 2. Vital Signs ───────────────────────────────────────
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

  // ─── 3. Upcoming Appointments ─────────────────────────────
  const apptData = await get(`/patients/${userId}/appointments`);
  const appts = apptData?.appointments || [];
  const upcoming = appts.filter(a => a.status === "scheduled")
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    .slice(0, 3);

  setText("upcomingCount", upcoming.length);

  setHTML("upcomingAppointments", upcoming.length
    ? upcoming.map(a => `
        <div class="appt-item" style="
          display:flex; align-items:center; gap:14px; padding:14px 16px;
          border:1px solid #e5e7eb; border-radius:10px; margin-bottom:10px;
          background:#fff; cursor:pointer;" 
          onclick="window.location.href='/patient/appointments/appiontment.html'">
          <div style="
            width:44px; height:44px; background:#003785; border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            color:white; font-size:18px; flex-shrink:0;">
            <i class="fas fa-calendar-check"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600; color:#1f2937; font-size:14px;">
              ${a.doctor_name || "Doctor"}
            </div>
            <div style="font-size:12px; color:#6b7280; margin-top:2px;">
              ${a.specialty || a.appointment_type}
            </div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">
              <i class="fas fa-clock" style="margin-right:4px;"></i>
              ${formatDate(a.appointment_date)} at ${a.appointment_time?.slice(0, 5) || "—"}
            </div>
          </div>
          <span style="
            background:#779f00; color:white; padding:4px 10px;
            border-radius:6px; font-size:11px; font-weight:500;">
            ${a.appointment_type}
          </span>
        </div>`).join("")
    : `<p style="color:#9ca3af; text-align:center; padding:20px;">
         <i class="fas fa-calendar" style="font-size:24px; display:block; margin-bottom:8px;"></i>
         No upcoming appointments
       </p>`
  );

  // ─── 4. Active Medications ────────────────────────────────
  const medData = await get(`/patients/${userId}/medications`);
  const meds = medData?.medications || [];
  const active = meds.filter(m => m.status === "active").slice(0, 4);

  setText("medsCount", active.length);

  setHTML("activeMedications", active.length
    ? active.map(m => `
        <div style="
          display:flex; align-items:center; gap:14px; padding:12px 16px;
          border:1px solid #e5e7eb; border-radius:10px; margin-bottom:10px; background:#fff;">
          <div style="
            width:40px; height:40px; background:#f0f7e6; border-radius:10px;
            display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="fas fa-pills" style="color:#779f00; font-size:16px;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600; color:#1f2937; font-size:14px;">
              ${m.medication_name}
            </div>
            <div style="font-size:12px; color:#6b7280;">${m.dosage}</div>
          </div>
          <div style="font-size:11px; color:#9ca3af; text-align:right;">
            <i class="fas fa-redo" style="margin-right:3px;"></i>
            ${m.refill_due ? formatDate(m.refill_due) : "No refill"}
          </div>
        </div>`).join("")
    : `<p style="color:#9ca3af; text-align:center; padding:20px;">
         <i class="fas fa-pills" style="font-size:24px; display:block; margin-bottom:8px;"></i>
         No active medications
       </p>`
  );

  // ─── 5. Recent Medical Records ────────────────────────────
  const recData = await get(`/patients/${userId}/records`);
  const records = recData?.records?.slice(0, 3) || [];

  setHTML("recentRecords", records.length
    ? records.map(r => `
        <div style="
          display:flex; align-items:center; gap:14px; padding:12px 16px;
          border:1px solid #e5e7eb; border-radius:10px; margin-bottom:10px;
          background:#fff; cursor:pointer;"
          onclick="window.location.href='/patient/Medical Records/medicalrecords1.html'">
          <div style="
            width:40px; height:40px; background:#eff6ff; border-radius:10px;
            display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="fas ${getRecordIcon(r.record_type)}" style="color:#003785; font-size:16px;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600; color:#1f2937; font-size:14px;">${r.title || "—"}</div>
            <div style="font-size:12px; color:#6b7280;">${r.doctor_name || "—"}</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${formatDate(r.record_date)}</div>
          </div>
          <span style="
            background:#e8f0f8; color:#003785; padding:3px 8px;
            border-radius:6px; font-size:11px; text-transform:capitalize;">
            ${r.record_type}
          </span>
        </div>`).join("")
    : `<p style="color:#9ca3af; text-align:center; padding:20px;">
         <i class="fas fa-file-medical" style="font-size:24px; display:block; margin-bottom:8px;"></i>
         No medical records found
       </p>`
  );

  function getRecordIcon(type) {
    return { lab: "fa-flask", radiology: "fa-x-ray", prescription: "fa-prescription-bottle", surgery: "fa-syringe" }[type] || "fa-file-medical";
  }

  // ─── 6. Notifications Badge ───────────────────────────────
  const notifBtn = document.getElementById("quickNotifications");
  const pending = appts.filter(a => {
    const d = new Date(a.appointment_date);
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3 && a.status === "scheduled";
  }).length;

  if (notifBtn) {
    notifBtn.querySelector("span").textContent =
      pending > 0 ? `${pending} Upcoming Appointment${pending > 1 ? "s" : ""}` : "No new notifications";
  }

  // ─── 7. Buttons & Navigation ──────────────────────────────
  document.getElementById("notificationsBtn")
    ?.addEventListener("click", () => window.location.href = "../notifications/notification.html");

  document.getElementById("settingsBtn")
    ?.addEventListener("click", () => window.location.href = "../profile/profile.html");

  document.getElementById("quickNotifications")
    ?.addEventListener("click", () => window.location.href = "/patient/notifications/notification.html");

  document.getElementById("chatBotBtn")
    ?.addEventListener("click", () => window.location.href = '../../chatbot/mainpage.html');

  // ─── 8. Logout ────────────────────────────────────────────
  document.getElementById("footerLogoutBtn")
    ?.addEventListener("click", () => {
      if (confirm("Are you sure you want to log out?")) {
        sessionStorage.clear();
        localStorage.removeItem("isLoggedIn");
        window.location.href = "../../auth/login.html";
      }
    });

  // ─── 9. Search ────────────────────────────────────────────
  document.querySelector(".search-input")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        window.location.href = `/patient/search.html?q=${encodeURIComponent(e.target.value.trim())}`;
      }
    });

  // ─── Helpers ──────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });
  }

  // ─── Toast animation CSS ──────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInToast {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }`;
  document.head.appendChild(style);

  // ─── Welcome toast ────────────────────────────────────────
  setTimeout(() => showToast(`Welcome back, ${user.full_name?.split(" ")[0]}!`, "info"), 800);
});