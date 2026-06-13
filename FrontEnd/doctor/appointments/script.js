// doctor/appointments/script.js
const API = "http://localhost:5000/api";
let allAppointments = [];
let patients = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = new Date().toISOString().split("T")[0];
let doctorId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const raw = sessionStorage.getItem("user_data");
  doctorId = sessionStorage.getItem("user_id");
  const role = sessionStorage.getItem("user_role");

  if (!raw || role !== "doctor" || !doctorId) {
    window.location.href = "../../auth/login.html";
    return;
  }

  const user = JSON.parse(raw);
  const namePill = document.getElementById("doctorNamePill");
  if (namePill) namePill.textContent = user.full_name ?? "Doctor";

  const avatarEl = document.getElementById("doctorAvatar");
  if (avatarEl && typeof AuthManager !== "undefined") {
    AuthManager.initDoctorAvatar(avatarEl, doctorId, user.full_name);
  }

  document.getElementById("selectedDateLabel").textContent =
    new Date(selectedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  document.getElementById("fabAddAppt").addEventListener("click", openCreateModal);
  if (window.location.hash === "#new-appointment") openCreateModal();
  document.getElementById("createApptForm").addEventListener("submit", createAppointment);

  document.getElementById("listSearch").addEventListener("input", renderListView);
  document.getElementById("listStatusFilter").addEventListener("change", renderListView);
  document.getElementById("listDateFilter").addEventListener("change", renderListView);

  await Promise.all([fetchAppointments(), fetchPatients()]);
  renderCalendar();
  renderSelectedDateAppts();
});

async function fetchAppointments() {
  try {
    const res = await fetch(`${API}/appointments?doctor_id=${doctorId}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    allAppointments = data.appointments ?? [];
    updateStats();
    renderListView();
  } catch (e) {
    console.error("fetchAppointments error:", e);
  }
}

async function fetchPatients() {
  try {
    const res = await fetch(`${API}/patients`);
    if (!res.ok) return;
    const data = await res.json();
    patients = data.patients ?? data ?? [];
    populatePatientSelect();
  } catch (e) {
    console.error("fetchPatients error:", e);
  }
}

function populatePatientSelect() {
  const sel = document.getElementById("modalPatientId");
  sel.innerHTML = '<option value="">Select a patient...</option>';
  patients.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.full_name} (${p.id})`;
    sel.appendChild(opt);
  });
}

function updateStats() {
  const today = new Date().toISOString().split("T")[0];
  let todayCount = 0, upcoming = 0, completed = 0, cancelled = 0;
  allAppointments.forEach(a => {
    const d = (a.appointment_date || "").split("T")[0];
    if (d === today) todayCount++;
    if (a.status === "completed") completed++;
    else if (a.status === "cancelled") cancelled++;
    else if (d >= today) upcoming++;
  });
  document.getElementById("statToday").textContent = todayCount;
  document.getElementById("statUpcoming").textContent = upcoming;
  document.getElementById("statCompleted").textContent = completed;
  document.getElementById("statCancelled").textContent = cancelled;
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".appt-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.appt-tab[data-tab="${tab}"]`).classList.add("active");
  document.getElementById("calendarView").classList.toggle("active", tab === "calendar");
  document.getElementById("listView").classList.toggle("active", tab === "list");
  const split = document.querySelector(".appointments-split");
  if (split) split.style.display = tab === "list" ? "none" : "";
}

// ─── Calendar ──────────────────────────────────────────────────────────────────
function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  title.textContent = `${months[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date().toISOString().split("T")[0];
  const apptDates = new Set();
  allAppointments.forEach(a => {
    const d = (a.appointment_date || "").split("T")[0];
    if (d) apptDates.add(d);
  });

  let html = `<div class="calendar-weekday">Sun</div><div class="calendar-weekday">Mon</div>
    <div class="calendar-weekday">Tue</div><div class="calendar-weekday">Wed</div>
    <div class="calendar-weekday">Thu</div><div class="calendar-weekday">Fri</div>
    <div class="calendar-weekday">Sat</div>`;

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    html += `<div class="calendar-day other-month" data-date="${currentYear}-${String(currentMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}">${day}</div>`;
  }

  // Current month days
  const mStr = String(currentMonth + 1).padStart(2, "0");
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, "0");
    const dateStr = `${currentYear}-${mStr}-${dStr}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const hasAppt = apptDates.has(dateStr);
    let cls = "calendar-day";
    if (isToday) cls += " today";
    if (isSelected) cls += " selected";
    html += `<div class="${cls}" data-date="${dateStr}">
      ${d}${hasAppt ? '<div class="appt-dot"></div>' : ""}</div>`;
  }

  // Next month days
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  const nM = currentMonth + 1 > 11 ? 0 : currentMonth + 1;
  const nY = currentMonth + 1 > 11 ? currentYear + 1 : currentYear;
  for (let d = 1; d <= remaining; d++) {
    const dStr = String(d).padStart(2, "0");
    const mStr2 = String(nM + 1).padStart(2, "0");
    html += `<div class="calendar-day other-month" data-date="${nY}-${mStr2}-${dStr}">${d}</div>`;
  }

  grid.innerHTML = html;
  grid.querySelectorAll(".calendar-day").forEach(el => {
    el.addEventListener("click", () => {
      selectedDate = el.dataset.date;
      document.getElementById("selectedDateLabel").textContent =
        new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      renderCalendar();
      renderSelectedDateAppts();
    });
  });
}

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}
function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

// ─── Selected Date Appointments ────────────────────────────────────────────────
function renderSelectedDateAppts() {
  const container = document.getElementById("selectedDateAppts");
  const dayAppts = allAppointments.filter(a => {
    const d = (a.appointment_date || "").split("T")[0];
    return d === selectedDate;
  }).sort((a, b) => (a.appointment_time || "").localeCompare(b.appointment_time || ""));

  if (!dayAppts.length) {
    container.innerHTML = `<div class="empty-state">
      <i class="fas fa-calendar-check"></i><p>No appointments on this date</p></div>`;
    return;
  }

  container.innerHTML = dayAppts.map(a => `
    <div class="appt-item">
      <div class="appt-item-time">${formatTime(a.appointment_time)}</div>
      <div class="appt-item-info">
        <div class="appt-item-name">${escHtml(a.patient_name || "Unknown")}</div>
        <div class="appt-item-detail">${escHtml(a.appointment_type)} ${a.duration ? "· " + a.duration : ""}</div>
      </div>
      <span class="appt-item-status ${a.status || "scheduled"}">${a.status || "scheduled"}</span>
      <div class="appt-item-actions">
        <button class="btn-icon" onclick="updateApptStatus(${a.id},'completed')" title="Mark completed">
          <i class="fas fa-check" style="color:var(--success);"></i>
        </button>
        <button class="btn-icon" onclick="updateApptStatus(${a.id},'cancelled')" title="Cancel">
          <i class="fas fa-times" style="color:var(--danger);"></i>
        </button>
      </div>
    </div>`).join("");
}

// ─── List View ─────────────────────────────────────────────────────────────────
function renderListView() {
  const container = document.getElementById("apptListBody");
  const query = document.getElementById("listSearch").value.toLowerCase().trim();
  const statusFilter = document.getElementById("listStatusFilter").value;
  const dateFilter = document.getElementById("listDateFilter").value;

  let filtered = allAppointments;
  if (query) filtered = filtered.filter(a => (a.patient_name || "").toLowerCase().includes(query));
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);
  if (dateFilter) filtered = filtered.filter(a => (a.appointment_date || "").split("T")[0] === dateFilter);

  filtered.sort((a, b) => ((b.appointment_date || "") + " " + (b.appointment_time || "")).localeCompare((a.appointment_date || "") + " " + (a.appointment_time || "")));

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>No appointments found</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="appt-item">
      <div class="appt-item-time">${formatDate(a.appointment_date)}<br><small>${formatTime(a.appointment_time)}</small></div>
      <div class="appt-item-info">
        <div class="appt-item-name">${escHtml(a.patient_name || "Unknown")}</div>
        <div class="appt-item-detail">${escHtml(a.appointment_type)} ${a.duration ? "· " + a.duration : ""} ${a.notes ? "· " + escHtml(a.notes) : ""}</div>
      </div>
      <span class="appt-item-status ${a.status || "scheduled"}">${a.status || "scheduled"}</span>
      <div class="appt-item-actions">
        <button class="btn-icon" onclick="updateApptStatus(${a.id},'completed')" title="Mark completed">
          <i class="fas fa-check" style="color:var(--success);"></i>
        </button>
        <button class="btn-icon" onclick="updateApptStatus(${a.id},'cancelled')" title="Cancel">
          <i class="fas fa-times" style="color:var(--danger);"></i>
        </button>
      </div>
    </div>`).join("");
}

// ─── Create Modal ──────────────────────────────────────────────────────────────
function openCreateModal() {
  document.getElementById("createModal").style.display = "flex";
  document.getElementById("modalDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("modalTime").value = new Date().toTimeString().slice(0, 5);
}

function closeCreateModal() {
  document.getElementById("createModal").style.display = "none";
}

async function createAppointment(e) {
  e.preventDefault();
  const btn = document.getElementById("modalSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

  const payload = {
    doctor_id: parseInt(doctorId),
    patient_id: document.getElementById("modalPatientId").value || null,
    patient_name: document.getElementById("modalPatientName").value.trim() || null,
    appointment_date: document.getElementById("modalDate").value,
    appointment_time: document.getElementById("modalTime").value,
    appointment_type: document.getElementById("modalType").value,
    duration: document.getElementById("modalDuration").value,
    notes: document.getElementById("modalNotes").value.trim() || null,
  };

  if (!payload.appointment_date || !payload.appointment_time || !payload.appointment_type) {
    showToast("Date, time, and type are required", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-calendar-plus"></i> Create Appointment';
    return;
  }

  try {
    const res = await fetch(`${API}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "HTTP " + res.status);
    }
    showToast("Appointment created!", "success");
    closeCreateModal();
    document.getElementById("createApptForm").reset();
    await fetchAppointments();
    renderCalendar();
    renderSelectedDateAppts();
  } catch (e) {
    console.error("createAppointment error:", e);
    showToast(e.message || "Failed to create appointment", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-calendar-plus"></i> Create Appointment';
  }
}

// ─── Status Update ─────────────────────────────────────────────────────────────
async function updateApptStatus(apptId, newStatus) {
  try {
    const res = await fetch(`${API}/appointments/${apptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    showToast(`Appointment ${newStatus}`, "success");
    await fetchAppointments();
    renderCalendar();
    renderSelectedDateAppts();
  } catch (e) {
    console.error("updateApptStatus error:", e);
    showToast("Failed to update", "error");
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(t) {
  if (!t) return "—";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const h = parseInt(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d + (d.includes("T") ? "" : "T12:00:00"));
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function escHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
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
