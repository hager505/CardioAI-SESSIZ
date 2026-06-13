// doctor/profile/script.js
const API = "http://localhost:5000/api";
const BASE = "http://localhost:5000";
let doctorData = null;

document.addEventListener("DOMContentLoaded", async () => {
  const raw = sessionStorage.getItem("user_data");
  const userId = sessionStorage.getItem("user_id");
  const role = sessionStorage.getItem("user_role");

  if (!raw || role !== "doctor" || !userId) {
    window.location.href = "../../auth/login.html";
    return;
  }

  const user = JSON.parse(raw);
  const namePill = document.getElementById("doctorNamePill");
  if (namePill) namePill.textContent = user.full_name ?? "Doctor";

  const avatarEl = document.getElementById("doctorAvatar");
  if (avatarEl && typeof AuthManager !== "undefined") {
    AuthManager.initDoctorAvatar(avatarEl, userId, user.full_name);
  }

  await loadProfile(userId);
});

async function loadProfile(userId) {
  try {
    const res = await fetch(`${API}/doctors/${userId}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    doctorData = await res.json();
  } catch (e) {
    console.error("loadProfile error:", e);
    showToast("Failed to load profile", "error");
    return;
  }

  document.getElementById("inputFullName").value = doctorData.full_name ?? "";
  document.getElementById("inputEmail").value = doctorData.email ?? "";
  document.getElementById("inputPhone").value = doctorData.phone ?? "";
  document.getElementById("inputAddress").value = doctorData.address ?? "";

  document.getElementById("inputSpecialty").value = doctorData.specialty ?? "—";
  document.getElementById("inputHospital").value = doctorData.hospital_affiliation ?? "—";
  document.getElementById("inputExperience").value = doctorData.years_experience ?? "—";
  document.getElementById("inputMedicalId").value = doctorData.medical_id ?? "—";
  document.getElementById("inputUniversity").value = doctorData.university ?? "—";
  document.getElementById("inputDegree").value = doctorData.medical_degree ?? "—";

  // Avatar from files
  if (doctorData.files) {
    const avatarFile = doctorData.files.find(f => f.file_type === "avatar");
    if (avatarFile) {
      let avatarUrl = avatarFile.file_path;
      if (avatarUrl && !avatarUrl.startsWith("http") && !avatarUrl.startsWith("data:")) {
        avatarUrl = BASE + (avatarUrl.startsWith("/") ? "" : "/") + avatarUrl;
      }
      const pa = document.getElementById("profileAvatar");
      pa.style.backgroundImage = `url(${avatarUrl})`;
      pa.style.backgroundSize = "cover";
      pa.style.backgroundPosition = "center";
      pa.textContent = "";
      localStorage.setItem(`avatar_doctor_${userId}`, avatarUrl);
    }
  }
}

async function saveProfile() {
  const userId = sessionStorage.getItem("user_id");
  if (!userId) return;

  const payload = {
    full_name: document.getElementById("inputFullName").value.trim(),
    email: document.getElementById("inputEmail").value.trim(),
    phone: document.getElementById("inputPhone").value.trim(),
    address: document.getElementById("inputAddress").value.trim(),
  };

  if (!payload.full_name || !payload.email) {
    showToast("Full name and email are required", "error");
    return;
  }

  const btn = document.getElementById("saveProfileBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    const res = await fetch(`${API}/doctors/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "HTTP " + res.status);
    }

    // ── Update sessionStorage so the dashboards read the new values ──
    const raw = sessionStorage.getItem("user_data");
    let updatedName = payload.full_name;
    if (raw) {
      const user = JSON.parse(raw);
      user.full_name = payload.full_name;
      user.email = payload.email;
      if (payload.phone)   user.phone   = payload.phone;
      if (payload.address) user.address = payload.address;
      sessionStorage.setItem("user_data", JSON.stringify(user));
      updatedName = user.full_name;
    }

    // ── Update every visible name spot on the current page ──
    const setName = (id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = updatedName;
    };
    setName("doctorNamePill");
    setName("footerDoctorName");
    // Generic fallback for any other .user-name / .sidebar-footer-name
    document.querySelectorAll(".user-name, .sidebar-footer-name").forEach(el => {
      // Don't clobber elements that hold a different name (e.g. patient
      // names in lists); only update ones that currently show the OLD name.
      // Heuristic: they live inside the header / sidebar.
      const inHeaderOrSidebar =
        el.closest(".dashboard-sidebar") ||
        el.closest(".dashboard-header") ||
        el.closest(".user-menu") ||
        el.closest("#doctorNamePill") ||
        el.closest("#footerDoctorName");
      if (inHeaderOrSidebar) el.textContent = updatedName;
    });

    // Update the header email pill too, if present
    const emailPill = document.getElementById("doctorSpecialty") || document.querySelector("#userDropdown .user-email");
    if (emailPill && payload.email) emailPill.textContent = payload.email;

    // Re-render the avatar (initials) on the current page if no photo
    const avatarEl = document.getElementById("doctorAvatar");
    const footerAvatarEl = document.getElementById("footerAvatar");
    const savedAvatar = localStorage.getItem(`avatar_doctor_${userId}`);
    if (!savedAvatar) {
      const initials = (updatedName || "D").trim().split(/\s+/).map(p => p[0] || "").join("").toUpperCase().slice(0, 2) || "DR";
      if (avatarEl && avatarEl.tagName === "DIV") {
        // Only update if it currently shows text (not a background image)
        if (!avatarEl.style.backgroundImage) avatarEl.textContent = initials;
      }
      if (footerAvatarEl && !footerAvatarEl.style.backgroundImage) {
        footerAvatarEl.textContent = initials;
      }
    }
    if (typeof AuthManager !== "undefined") {
      AuthManager.refreshAllAvatars();
    }

    // ── Persist to localStorage + fire userUpdated event so the landing
    //    page navbar and any other page that reads AuthManager picks up
    //    the new name without a refresh. ──
    if (typeof AuthManager !== "undefined") {
      AuthManager.syncUser({ name: updatedName, email: payload.email });
    } else {
      try { localStorage.setItem("userName", updatedName); } catch (_) {}
      try { localStorage.setItem("userEmail", payload.email); } catch (_) {}
    }

    showToast("Profile updated successfully", "success");
  } catch (e) {
    console.error("saveProfile error:", e);
    showToast(e.message || "Failed to save profile", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
  }
}

async function changePassword() {
  const userId = sessionStorage.getItem("user_id");
  const current = document.getElementById("inputCurrentPwd").value;
  const newPwd = document.getElementById("inputNewPwd").value;
  const confirm = document.getElementById("inputConfirmPwd").value;

  if (!current || !newPwd || !confirm) {
    showToast("Fill in all password fields", "error");
    return;
  }
  if (newPwd !== confirm) {
    showToast("New passwords do not match", "error");
    return;
  }
  if (newPwd.length < 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  const btn = document.getElementById("changePwdBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

  try {
    const res = await fetch(`${API}/doctors/${userId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: newPwd }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "HTTP " + res.status);
    }
    showToast("Password updated successfully", "success");
    document.getElementById("inputCurrentPwd").value = "";
    document.getElementById("inputNewPwd").value = "";
    document.getElementById("inputConfirmPwd").value = "";
  } catch (e) {
    console.error("changePassword error:", e);
    showToast(e.message || "Failed to update password", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-key"></i> Update Password';
  }
}

// Avatar upload
document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("avatarUploadBtn");
  const input = document.getElementById("avatarInput");
  if (uploadBtn && input) {
    uploadBtn.addEventListener("click", () => input.click());
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const userId = sessionStorage.getItem("user_id");
      if (!userId) return;

      const formData = new FormData();
      formData.append("avatar", file);

      try {
        const res = await fetch(`${API}/doctors/${userId}/avatar`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        let avatarUrl = data.file_path || data.url;
        if (avatarUrl && !avatarUrl.startsWith("http") && !avatarUrl.startsWith("data:")) {
          avatarUrl = BASE + (avatarUrl.startsWith("/") ? "" : "/") + avatarUrl;
        }
        const pa = document.getElementById("profileAvatar");
        pa.style.backgroundImage = `url(${avatarUrl})`;
        pa.style.backgroundSize = "cover";
        pa.style.backgroundPosition = "center";
        pa.textContent = "";
        // Sync sessionStorage so all pages see the new avatar immediately
        try {
            const raw = sessionStorage.getItem('user_data');
            if (raw) {
                const u = JSON.parse(raw);
                u.avatar_url = avatarUrl;
                sessionStorage.setItem('user_data', JSON.stringify(u));
            }
        } catch (_) { /* ignore */ }
        // Keep the landing-page navbar (which reads AuthManager.getUserData
        // → localStorage.userAvatar) in sync. Without this, the navbar
        // would keep showing the previous photo until the next login.
        try { localStorage.setItem('userAvatar', avatarUrl); } catch (_) { /* ignore */ }
        if (typeof AuthManager !== 'undefined') {
          AuthManager.syncUser({ avatar: avatarUrl });
        }
        showToast("Avatar updated", "success");
      } catch (err) {
        console.error("avatar upload error:", err);
        showToast("Failed to upload avatar", "error");
      }
    });
  }

  // Remove avatar
  const removeBtn = document.getElementById("removeAvatarBtn");
  if (removeBtn) {
    removeBtn.addEventListener("click", async () => {
      const userId = sessionStorage.getItem("user_id");
      if (!userId) return;
      try {
        const res = await fetch(`${API}/doctors/${userId}/avatar`, { method: "DELETE" });
        if (!res.ok) throw new Error("Remove failed");
        // Clear avatar from sessionStorage
        try {
          const raw = sessionStorage.getItem("user_data");
          if (raw) {
            const u = JSON.parse(raw);
            u.avatar_url = null;
            sessionStorage.setItem("user_data", JSON.stringify(u));
          }
        } catch (_) { /* ignore */ }
        // Clear localStorage cache
        const role = sessionStorage.getItem("user_role") || "doctor";
        localStorage.removeItem(`avatar_${role}_${userId}`);
        // Keep the landing-page navbar in sync (it reads userAvatar)
        try { localStorage.removeItem('userAvatar'); } catch (_) { /* ignore */ }
        if (typeof AuthManager !== 'undefined') {
          AuthManager.syncUser({ avatar: null });
        }
        // Reset to initials
        const pa = document.getElementById("profileAvatar");
        const raw = sessionStorage.getItem("user_data");
        let name = "Doctor";
        if (raw) { try { name = JSON.parse(raw).full_name || name; } catch (_) {} }
        const parts = name.trim().split(/\s+/);
        const first = parts[0]?.[0] || 'D';
        const second = parts[1]?.[0] || parts[0]?.[1] || name[1] || 'R';
        const initials = (first + second).toUpperCase();
        pa.textContent = initials;
        pa.style.backgroundImage = "";
        if (typeof AuthManager !== 'undefined') AuthManager.refreshAllAvatars();
        showToast("Photo removed", "success");
      } catch (err) {
        console.error("remove avatar error:", err);
        showToast("Failed to remove photo", "error");
      }
    });
  }
});

function resetForm() {
  if (!doctorData) return;
  document.getElementById("inputFullName").value = doctorData.full_name ?? "";
  document.getElementById("inputEmail").value = doctorData.email ?? "";
  document.getElementById("inputPhone").value = doctorData.phone ?? "";
  document.getElementById("inputAddress").value = doctorData.address ?? "";
}

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
