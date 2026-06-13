// doctor/schedule/schedule.js
const API = "http://localhost:5000/api";
let allAppointments = [];

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

  if (typeof AuthManager !== "undefined") {
    AuthManager.initDoctorAvatar(document.getElementById("doctorAvatar"), userId, user.full_name);
  }

  document.getElementById("currentDateDisplay").textContent =
    new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  await fetchAppointments(userId);
});

async function fetchAppointments(userId) {
  try {
    const res = await fetch(`${API}/appointments?doctor_id=${userId}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    allAppointments = data.appointments ?? [];
    updateStats();
    renderWeeklyTable();
  } catch (e) {
    console.error("fetchAppointments error:", e);
  }
}

function updateStats() {
  const today = new Date().toISOString().split("T")[0];
  const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  let todayCount = 0, upcomingCount = 0, completedCount = 0;

  allAppointments.forEach(a => {
    const d = (a.appointment_date || "").split("T")[0];
    if (d === today) todayCount++;
    if (d >= today && d <= weekFromNow && a.status !== "completed" && a.status !== "cancelled") upcomingCount++;
    if (a.status === "completed") completedCount++;
  });

  const statValues = document.querySelectorAll(".stat-card .stat-value");
  if (statValues[0]) statValues[0].textContent = todayCount;
  if (statValues[1]) statValues[1].textContent = upcomingCount;
  if (statValues[2]) statValues[2].textContent = completedCount;
  if (statValues[3]) statValues[3].textContent = Math.max(0, 20 - todayCount);
}

function renderWeeklyTable() {
  const tbody = document.querySelector(".schedule-table tbody");
  if (!tbody) return;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);

  // Update weekday headers
  const headers = document.querySelectorAll(".schedule-table thead th");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i - 1);
    if (headers[i]) headers[i].textContent = `${dayNames[d.getDay()]} ${d.getDate()}`;
  }

  // Build appointment lookup: dayIndex -> array of appointments
  const weekAppts = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekAppts[i] = allAppointments.filter(a => {
      const ad = (a.appointment_date || "").split("T")[0];
      return ad === d.toISOString().split("T")[0];
    });
  }

  // Time slots: 08:00 to 17:00
  const slots = [];
  for (let h = 8; h <= 17; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  const totalSlots = 20;

  let completedInWeek = 0;
  let scheduledInWeek = 0;

  let html = "";
  slots.forEach((time, idx) => {
    const hour = parseInt(time.split(":")[0]);

    html += `<tr>`;
    html += `<td class="time-cell">${time}</td>`;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayAppts = weekAppts[dayIdx].filter(a => {
        const ah = parseInt((a.appointment_time || "00:00").split(":")[0]);
        return ah === hour;
      });

      if (dayAppts.length > 0) {
        const appt = dayAppts[0];
        const isUrgent = (appt.appointment_type || "").toLowerCase() === "emergency";
        const isCompleted = appt.status === "completed";
        let cls = "appointment-block";
        if (isUrgent) cls += " appointment-block--urgent";
        if (isCompleted) cls += " appointment-block--completed";

        if (isCompleted) completedInWeek++;
        else scheduledInWeek++;

        html += `<td>
          <div class="${cls}" title="${escHtml(appt.notes || "")}">
            <span class="app-time">${formatTime(appt.appointment_time)} - ${formatTime(addHours(appt.appointment_time, appt.duration))}</span>
            <span class="app-name">${escHtml(appt.patient_name || "Unknown")}</span>
          </div>
        </td>`;
      } else {
        html += `<td></td>`;
      }
    }

    html += `</tr>`;
  });

  tbody.innerHTML = html;

  // Update available slots stat
  const availableSlots = totalSlots - scheduledInWeek - completedInWeek;
  const statValues = document.querySelectorAll(".stat-card .stat-value");
  if (statValues[3]) statValues[3].textContent = Math.max(0, availableSlots);
}

function formatTime(t) {
  if (!t) return "—";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const h = parseInt(parts[0]);
  const m = parts[1].substring(0, 2);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function addHours(time, duration) {
  if (!time) return "00:00";
  const parts = time.split(":");
  let h = parseInt(parts[0]);
  let m = parseInt(parts[1] || "0");
  const dur = duration ? parseInt(duration) : 30;
  m += dur;
  h += Math.floor(m / 60);
  m = m % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function escHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}
