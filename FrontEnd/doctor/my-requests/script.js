// doctor/my-requests/script.js — CardioAI
// No type="module". No imports. Plain script tag.

const API = "http://localhost:5000/api";

// ─── Toast ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function timeAgo(ts) {
  if (!ts) return "Unknown time";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function avatarUrl(name, bg = "003785") {
  const parts = (name ?? "X").trim().split(/\s+/);
  const f = encodeURIComponent((parts[0]?.[0] ?? "X").toUpperCase());
  const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "X").toUpperCase());
  return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

async function apiFetch(endpoint, opts) {
  try {
    const res = await fetch(`${API}${endpoint}`, opts);
    if (!res.ok) { console.error(`[Requests] ${endpoint} → HTTP ${res.status}`); return null; }
    return await res.json();
  } catch (e) { console.error(`[Requests] fetch error ${endpoint}`, e); return null; }
}

// ─── State ────────────────────────────────────────────────────────────────────
let allRequests = [];
let currentFilter = "all";
let currentModalId = null;

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
  console.log("[Requests] logged in as:", user.full_name, "id:", userId);

  // ── Doctor pill ───────────────────────────────────────────────────────────
  const nameEl = document.getElementById("doctorNamePill");
  if (nameEl) nameEl.textContent = user.full_name ?? "Doctor";

  const specEl = document.getElementById("doctorSpecialty");
  if (specEl) specEl.textContent = user.specialty ?? "—";

  if (typeof AuthManager !== "undefined") {
    AuthManager.initDoctorAvatar(document.getElementById("doctorAvatar"), userId, user.full_name);
  }

  // ── Load requests ─────────────────────────────────────────────────────────
  await loadRequests();

  // ── Tab buttons ───────────────────────────────────────────────────────────
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterRequests(btn.dataset.filter ?? "all");
    });
  });

  // ── Modal buttons ─────────────────────────────────────────────────────────
  document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
  document.getElementById("cancelModalBtn")?.addEventListener("click", closeModal);
  document.getElementById("approveBtn")?.addEventListener("click", () => handleAction("approve"));
  document.getElementById("rejectBtn")?.addEventListener("click", () => handleAction("reject"));

  document.getElementById("refillModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("refillModal")) closeModal();
  });

});

// ─── User Menu ────────────────────────────────────────────────────────────────
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
window.toggleUserMenu = toggleUserMenu;
window.confirmLogout = confirmLogout;

// ─── Load from API ────────────────────────────────────────────────────────────
async function loadRequests(statusFilter) {
  const userId = sessionStorage.getItem("user_id");
  // Pass doctor_id so the backend only returns THIS doctor's requests
  const endpoint = statusFilter && statusFilter !== "all"
    ? `/doctor/requests?doctor_id=${userId}&status=${statusFilter}`
    : `/doctor/requests?doctor_id=${userId}`;

  const result = await apiFetch(endpoint);

  if (!result) {
    showToast("Failed to load requests", "error");
    document.getElementById("requestsList").innerHTML =
      `<p style="color:#9ca3af;text-align:center;padding:40px;">
         Could not load requests. Check the server is running.
       </p>`;
    return;
  }

  allRequests = result.data ?? result.requests ?? [];
  console.log("[Requests] loaded:", allRequests.length);
  renderRequests(allRequests);
  updateStats(allRequests);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderRequests(requests) {
  const list = document.getElementById("requestsList");
  if (!list) return;

  if (!requests.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px;color:#9ca3af;">
      <i class="fas fa-inbox" style="font-size:36px;display:block;margin-bottom:12px;"></i>
      No requests found
    </div>`;
    return;
  }

  list.innerHTML = requests.map(createCard).join("");

  list.querySelectorAll(".btn-review").forEach(btn => {
    btn.addEventListener("click", () => openModal(parseInt(btn.dataset.id)));
  });
  list.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => handleDelete(parseInt(btn.dataset.id)));
  });
}

// ─── Category detection ────────────────────────────────────────────────────────
// Patient-facing request flows (the /patient/requests page and the
// refill-from-medical-records flow) all stamp the message with a
// recognisable prefix; this function sniffs that prefix and falls back
// to keyword matching so legacy / external rows still categorise
// correctly. Returns one of:
//   "refill"  — prescription refill
//   "lab"     — lab results review
//   "custom"  — any other bespoke message
const REQUEST_ICON_MAP = {
  refill: { icon: "fas fa-pills",                  label: "Prescription Refill" },
  lab:    { icon: "fas fa-flask",                 label: "Lab Results Review" },
  custom: { icon: "fas fa-comment-medical",       label: "Custom Request"     },
};

function detectRequestCategory(req) {
  const msg = (req.message ?? "").toLowerCase();
  const title = (req.title ?? "").toLowerCase();
  const haystack = `${msg} ${title}`;
  if (haystack.startsWith("refill:") || /\brefill\b/.test(haystack)) return "refill";
  if (haystack.startsWith("lab review") || haystack.startsWith("lab:") || /\blab\s*review\b/.test(haystack)) return "lab";
  return "custom";
}

function createCard(req) {
  const priority = (req.priority ?? "Medium").toLowerCase();
  const status = (req.status ?? "pending").toLowerCase();
  const isUrgent = priority === "high";
  const name = req.patient_name ?? req.patientName ?? "Unknown";
  const msg = req.message ?? "No message";
  const category = detectRequestCategory(req);
  const iconMeta = REQUEST_ICON_MAP[category] ?? REQUEST_ICON_MAP.custom;
  const priorityCls = priority === "high" ? "high" : priority === "medium" ? "medium" : "low";

  // Coloured icon pill: each category gets a tinted background that
  // matches the request type, and the FontAwesome icon sits centered
  // inside. We use the existing token palette so the chip matches the
  // surrounding stat cards / badges / table rows.
  const iconBg = {
    refill: "background:rgba(135,175,18,0.12);color:#779f00;",  // green (secondary)
    lab:    "background:rgba(0,55,133,0.10);color:#003785;",  // blue   (primary)
    custom: "background:rgba(124,58,237,0.10);color:#7c3aed;",  // purple (custom)
  }[category];

  return `
    <div class="request-card${isUrgent ? " urgent" : ""}" data-category="${category}" data-status="${status}">
      <div class="req-info">
        <span class="req-icon-tile" style="${iconBg}" aria-hidden="true">
          <i class="${iconMeta.icon}"></i>
        </span>
        <div class="req-details">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <h3>${escHtml(name)}
              <span style="font-size:12px;font-weight:400;color:#666;">
                · ${escHtml(iconMeta.label)}
              </span>
            </h3>
            <span class="badge ${priorityCls}">${escHtml(req.priority ?? "Medium")} Priority</span>
          </div>
          <p>${escHtml(msg)}</p>
          <div class="req-meta">
            <span><i class="fas fa-clock"></i> ${timeAgo(req.created_at)}</span>
            <span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        </div>
      </div>
      <div class="req-actions">
        <button class="btn-review" data-id="${req.id}">Review</button>
        <button class="btn-delete" data-id="${req.id}" title="Delete request" aria-label="Delete request">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats(requests) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("statPending", requests.filter(r => (r.status ?? "").toLowerCase() === "pending").length);
  set("statUrgent", requests.filter(r => (r.priority ?? "").toLowerCase() === "high").length);
  set("statReview", requests.filter(r => (r.status ?? "").toLowerCase() === "approved").length);
  set("statCompleted", requests.filter(r => ["resolved", "completed"].includes((r.status ?? "").toLowerCase())).length);
}

// ─── Filter ───────────────────────────────────────────────────────────────────
function filterRequests(filter) {
  currentFilter = filter;

  if (filter === "all") {
    renderRequests(allRequests);
  } else if (filter === "urgent") {
    renderRequests(allRequests.filter(r => (r.priority ?? "").toLowerCase() === "high"));
  } else if (filter === "pending" || filter === "approved" || filter === "resolved") {
    renderRequests(allRequests.filter(r => (r.status ?? "").toLowerCase() === filter));
  } else {
    // category filter: lab / refill / custom — uses the same
    // detectRequestCategory helper that createCard() uses so a request
    // is filtered the same way it would be displayed.
    renderRequests(allRequests.filter(r => detectRequestCategory(r) === filter));
  }
}
window.filterRequests = filterRequests;

// ─── Modal open ───────────────────────────────────────────────────────────────
function openModal(reqId) {
  const req = allRequests.find(r => r.id === reqId);
  if (!req) return;
  currentModalId = reqId;

  const name = req.patient_name ?? req.patientName ?? "Unknown";

  // Populate fields using the clean IDs from the new HTML
  const infoEl = document.getElementById("modalRequestInfo");
  if (infoEl) infoEl.innerHTML =
    `Request from <strong>${escHtml(name)}</strong> · ${timeAgo(req.created_at)}`;

  const priorityEl = document.getElementById("modalPriorityBadge");
  if (priorityEl) {
    const p = (req.priority ?? "Medium").toLowerCase();
    priorityEl.className = `badge ${p}`;
    priorityEl.textContent = req.priority ?? "Medium";
  }

  const statusEl = document.getElementById("modalStatusBadge");
  if (statusEl) {
    const s = (req.status ?? "pending").toLowerCase();
    statusEl.className = `badge ${s}`;
    statusEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
  }

  const msgEl = document.getElementById("modalMessage");
  if (msgEl) msgEl.textContent = req.message ?? "—";

  const notesEl = document.getElementById("modalNotes");
  if (notesEl) notesEl.value = "";

  document.getElementById("refillModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

// ─── Modal close ─────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById("refillModal").classList.remove("active");
  document.body.style.overflow = "";
  currentModalId = null;
}
window.closeRefillModal = closeModal;

// ─── Approve / Reject ─────────────────────────────────────────────────────────
async function handleAction(action) {
  if (!currentModalId) return;

  if (action === "reject" && !confirm("Are you sure you want to reject this request?")) return;

  const status = action === "approve" ? "approved" : "rejected";
  const notes = document.getElementById("modalNotes")?.value ?? "";

  const result = await apiFetch(`/doctor/requests/${currentModalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });

  if (!result) {
    showToast(`Failed to ${action} request`, "error");
    return;
  }

  showToast(action === "approve" ? "Request approved ✓" : "Request rejected", action === "approve" ? "success" : "error");
  closeModal();
  await loadRequests(currentFilter !== "all" ? currentFilter : null);
}

// ─── Delete ────────────────────────────────────────────────────────────────
async function handleDelete(reqId) {
  const req = allRequests.find(r => r.id === reqId);
  const who = req?.patient_name ?? req?.patientName ?? "this request";
  if (!confirm(`Delete the request from ${who}? This cannot be undone.`)) return;

  const result = await apiFetch(`/doctor/requests/${reqId}`, { method: "DELETE" });
  if (!result) {
    showToast("Failed to delete request", "error");
    return;
  }
  showToast("Request deleted", "success");
  await loadRequests(currentFilter !== "all" ? currentFilter : null);
}

