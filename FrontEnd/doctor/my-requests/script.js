// my-requests/script.js — CardioAI
// No type="module". No imports. Plain script tag.

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

  const avatarEl = document.getElementById("doctorAvatar");
  if (avatarEl) {
    const saved = localStorage.getItem(`avatar_${userId}`);
    const url = user.avatar_url || saved || avatarUrl(user.full_name);
    avatarEl.style.backgroundImage = `url('${url}')`;
    avatarEl.style.backgroundSize = "cover";
    avatarEl.style.backgroundPosition = "center";
    avatarEl.textContent = "";
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
}

function createCard(req) {
  const priority = (req.priority ?? "Medium").toLowerCase();
  const status = (req.status ?? "pending").toLowerCase();
  const isUrgent = priority === "high";
  const name = req.patient_name ?? req.patientName ?? "Unknown";
  const msg = req.message ?? "No message";
  const category = msg.toLowerCase().includes("refill") ? "refill" : "lab";
  const priorityCls = priority === "high" ? "high" : priority === "medium" ? "medium" : "low";

  return `
    <div class="request-card${isUrgent ? " urgent" : ""}" data-category="${category}" data-status="${status}">
      <div class="req-info">
        <img src="${category === "refill" ? "Prescription Refill Request.png" : "Lab Results Review.png"}"
          class="req-icon"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/2965/2965301.png'">
        <div class="req-details">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <h3>${escHtml(name)}
              <span style="font-size:12px;font-weight:400;color:#666;">
                · ${category === "refill" ? "Prescription Refill" : "Lab Results"}
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
      <button class="btn-review" data-id="${req.id}">Review</button>
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
    // category filter: lab / refill
    renderRequests(allRequests.filter(r => {
      const cat = (r.message ?? "").toLowerCase().includes("refill") ? "refill" : "lab";
      return cat === filter;
    }));
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