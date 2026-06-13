// my-requests/script.js
// ─── CardioAI — Patient Requests ─────────────────────────────────────────────

const API = "http://localhost:5000/api";

// ─── Toast ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = s;
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
async function apiFetch(endpoint, opts) {
  try {
    const res = await fetch(`${API}${endpoint}`, opts);
    if (!res.ok) {
      console.error(`apiFetch ${endpoint} HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`apiFetch ${endpoint}`, err);
    return null;
  }
}

function avatarUrl(name, bg = "003785") {
  const parts = (name ?? "X").trim().split(/\s+/);
  const f = encodeURIComponent((parts[0]?.[0] ?? "X").toUpperCase());
  const l = encodeURIComponent((parts[1]?.[0] ?? parts[0]?.[1] ?? "X").toUpperCase());
  return `https://ui-avatars.com/api/?name=${f}+${l}&background=${bg}&color=fff&size=128&bold=true`;
}

// ─── State ────────────────────────────────────────────────────────────────────
let allRequests = [];
let currentFilter = "all";
let currentModalId = null;

// ─── Auth Guard ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const raw = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (!raw || role !== "doctor") {
    window.location.href = "../../auth/login.html";
    return;
  }

  const user = JSON.parse(raw);

  const namePill = document.getElementById("doctorNamePill");
  if (namePill) namePill.textContent = user.full_name || "Doctor";

  const avatarPill = document.getElementById("doctorAvatarPill");
  if (avatarPill) {
    const photo = localStorage.getItem(`avatar_doctor_${user.id}`) ?? avatarUrl(user.full_name);
    avatarPill.src = photo;
  }

  await loadRequests();

  // ── Tab buttons ───────────────────────────────────────────────────────────
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.textContent.trim().toLowerCase();
      if (f === "all requests") filterRequests("all");
      else if (f === "urgent") filterRequests("urgent");
      else if (f === "lab results") filterRequests("lab");
      else if (f === "prescriptions") filterRequests("refill");
    });
  });

  // ── Stat cards ────────────────────────────────────────────────────────────
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("click", () => {
      const label = card.querySelector(".stat-label")?.textContent?.toLowerCase() ?? "";
      if (label.includes("pending")) filterRequests("pending");
      else if (label.includes("urgent")) filterRequests("urgent");
      else if (label.includes("review")) filterRequests("approved");
      else if (label.includes("completed")) filterRequests("resolved");
    });
  });

  // ── Modal close ───────────────────────────────────────────────────────────
  const modal = document.getElementById("refillModal");
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) closeRefillModal(); });
  }
  document.querySelector(".close-modal")?.addEventListener("click", closeRefillModal);

  // ── Modal action buttons ──────────────────────────────────────────────────
  document.querySelector(".btn-approve")?.addEventListener("click", () => handleAction("approve"));
  document.querySelector(".btn-reject")?.addEventListener("click", () => handleAction("reject"));
  document.querySelector(".btn-cancel")?.addEventListener("click", closeRefillModal);

  // ── Logout ────────────────────────────────────────────────────────────────
  document.querySelector("footer button")?.addEventListener("click", () => {
    if (typeof AuthManager !== 'undefined' && AuthManager.handleLogout) {
      AuthManager.handleLogout();
    } else {
      sessionStorage.clear();
      window.location.href = "../../auth/login.html";
    }
  });
});

// ─── Load Requests ────────────────────────────────────────────────────────────
async function loadRequests(statusFilter) {
  const endpoint = statusFilter && statusFilter !== "all"
    ? `/doctor/requests?status=${statusFilter}`
    : "/doctor/requests";

  const result = await apiFetch(endpoint);
  if (!result) {
    showToast("Failed to load requests", "error");
    return;
  }
  allRequests = result.data ?? result.requests ?? [];
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

  list.innerHTML = requests.map(createRequestCard).join("");

  list.querySelectorAll(".btn-review").forEach((btn) => {
    btn.addEventListener("click", () => openRefillModal(parseInt(btn.dataset.requestId)));
  });
}

function createRequestCard(req) {
  const priority = (req.priority ?? "Medium").toLowerCase();
  const status = (req.status ?? "pending").toLowerCase();
  const isUrgent = priority === "high" || status === "urgent";
  const category = isUrgent ? "urgent" : (req.message ?? "").toLowerCase().includes("refill") ? "refill" : "lab";
  const priorityBadge = priority === "high" ? "high" : priority === "medium" ? "medium" : "pending";

  return `
    <div class="request-card${isUrgent ? " urgent" : ""}" data-category="${category}" data-status="${status}">
      <div class="req-info">
        <img src="${category === "refill" ? "Prescription Refill Request.png" : "Lab Results Review.png"}"
          class="req-icon" style="width:48px;height:48px;"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/2965/2965301.png'">
        <div class="req-details">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <h3>${escHtml(req.patientName ?? req.patient_name ?? "Unknown")}
              <span style="font-size:12px;font-weight:400;color:#666;">·
                ${category === "refill" ? "Prescription Refill" : "Lab Results Review"}
              </span>
            </h3>
            <span class="badge ${priorityBadge}">${escHtml(req.priority ?? "Medium")} Priority</span>
          </div>
          <p>${escHtml(req.message ?? "No message")}</p>
          <div class="req-meta">
            <span><i class="fas fa-clock"></i> ${timeAgo(req.created_at ?? req.createdAt)}</span>
            <span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        </div>
      </div>
      <button class="btn-review" data-request-id="${req.id}">Review</button>
    </div>`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats(requests) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("statPending", requests.filter((r) => (r.status ?? "").toLowerCase() === "pending").length);
  set("statUrgent", requests.filter((r) => (r.priority ?? "").toLowerCase() === "high").length);
  set("statReview", requests.filter((r) => (r.status ?? "").toLowerCase() === "approved").length);
  set("statCompleted", requests.filter((r) => ["resolved", "completed"].includes((r.status ?? "").toLowerCase())).length);
}

// ─── Filter ───────────────────────────────────────────────────────────────────
window.filterRequests = function (filter) {
  currentFilter = filter;
  if (filter === "all" || filter === "pending" || filter === "approved" || filter === "resolved") {
    loadRequests(filter !== "all" ? filter : null);
  } else if (filter === "urgent") {
    renderRequests(allRequests.filter((r) => (r.priority ?? "").toLowerCase() === "high"));
  } else {
    // category filter (lab, refill) — client-side only
    renderRequests(
      allRequests.filter((r) => {
        const category = (r.message ?? "").toLowerCase().includes("refill") ? "refill" : "lab";
        return category === filter;
      })
    );
  }
};

// ─── Modal ────────────────────────────────────────────────────────────────────
function openRefillModal(reqId) {
  currentModalId = reqId;
  const req = allRequests.find((r) => r.id === reqId);
  if (!req) return;

  const modal = document.getElementById("refillModal");
  if (!modal) return;

  // Populate modal with real data
  const infoDiv = modal.querySelector(".modal-body div[style*='bg-light'], .modal-body div[style*='background:var']");
  if (infoDiv) {
    infoDiv.innerHTML = `Request from <strong>${escHtml(req.patientName ?? req.patient_name)}</strong> · ${timeAgo(req.created_at ?? req.createdAt)}`;
  }

  const detailsP = modal.querySelector("p[style*='background:#f9f9f9']");
  if (detailsP) detailsP.textContent = req.message ?? "";

  const priorityBadges = modal.querySelectorAll(".badge");
  priorityBadges.forEach((b) => {
    if (b.textContent.includes("Priority") || ["high", "medium", "pending"].some(c => b.classList.contains(c))) {
      b.className = `badge ${(req.priority ?? "Medium").toLowerCase()}`;
      b.textContent = req.priority ?? "Medium";
    }
  });

  const notesField = document.getElementById("modalNotes");
  if (notesField) notesField.value = "";

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

window.closeRefillModal = function () {
  const modal = document.getElementById("refillModal");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
  currentModalId = null;
};

async function handleAction(action) {
  if (!currentModalId) return;
  const notes = document.getElementById("modalNotes")?.value ?? "";

  if (action === "reject" && !confirm("Are you sure you want to reject this request?")) return;

  const status = action === "approve" ? "approved" : "rejected";
  const result = await apiFetch(`/doctor/requests/${currentModalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });

  if (!result) {
    showToast(`Failed to ${action} request`, "error");
    return;
  }

  showToast(
    action === "approve" ? "Request approved ✓" : "Request rejected",
    action === "approve" ? "success" : "error"
  );
  closeRefillModal();
  await loadRequests(currentFilter !== "all" ? currentFilter : null);
}