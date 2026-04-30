// schedule/add-schedule.js
// ─── CardioAI — Add / Schedule Appointment ────────────────────────────────────
// Note: API config loaded via <script src="../config/api-global.js"> in HTML
// This file expects window.apiUrl() to be available from that script





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

// ─── Dropdown data ────────────────────────────────────────────────────────────
const APPOINTMENT_TYPES = ["New Patient", "Follow-up", "Consultation", "Emergency", "Check-up"];
const APPOINTMENT_TIMES = [
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM",
];
const DURATION_OPTIONS = ["15 minutes", "30 minutes", "45 minutes", "60 minutes", "90 minutes", "120 minutes"];

// Converts "08:30 AM" → "08:30"
function parseTime(display) {
  if (!display || display === "Select Time") return null;
  const [time, meridiem] = display.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Dropdown builder ─────────────────────────────────────────────────────────
function buildDropdown(fieldEl, spanEl, options, onSelect) {
  if (!fieldEl || !spanEl) return;
  fieldEl.style.position = "relative";
  fieldEl.style.cursor = "pointer";

  // Remove old dropdown if any
  fieldEl.querySelector(".ca-dropdown")?.remove();

  const menu = document.createElement("div");
  menu.className = "ca-dropdown";
  menu.style.cssText = `
    position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;
    border:2px solid #e5e7eb;border-radius:10px;max-height:200px;overflow-y:auto;
    z-index:1000;box-shadow:0 10px 30px rgba(0,0,0,.15);display:none;direction:ltr;
  `;

  options.forEach((opt) => {
    const item = document.createElement("div");
    item.textContent = opt;
    item.style.cssText = "padding:11px 16px;cursor:pointer;font-size:14px;border-bottom:1px solid #f3f4f6;";
    item.addEventListener("mouseenter", () => (item.style.background = "#eff6ff"));
    item.addEventListener("mouseleave", () => (item.style.background = ""));
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      spanEl.textContent = opt;
      onSelect?.(opt);
      menu.style.display = "none";
    });
    menu.appendChild(item);
  });

  fieldEl.appendChild(menu);
  fieldEl.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".ca-dropdown").forEach((m) => {
      if (m !== menu) m.style.display = "none";
    });
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".ca-dropdown").forEach((m) => (m.style.display = "none"));
});

// ─── Auth Guard ───────────────────────────────────────────────────────────────
function checkAuth() {
  const role = sessionStorage.getItem("user_role");
  if (!role || role.toLowerCase() !== "doctor") {
    console.error("Auth Guard blocked access. User role is:", role);
    window.location.href = "../../auth/login.html";
    return false;
  }
  return true;
}

// ─── Patient autocomplete ─────────────────────────────────────────────────────
let patientList = [];
let selectedPatient = null;
// const apiUrl  = "http://localhost:5000"; // Removed duplicate

async function loadPatients() {
  try {
    const res = await fetch(window.apiUrl("/api/patients"));
    if (!res.ok) return;
    const result = await res.json();
    patientList = result.patients ?? result.data ?? [];
  } catch (err) {
    console.error("loadPatients:", err);
  }
}

function initPatientAutocomplete() {
  const input = document.querySelector(".add-appointment__enter-patent-name");
  if (!input) return;

  const suggest = document.createElement("div");
  suggest.style.cssText = `position:absolute;top:100%;left:0;right:0;background:#fff;
    border:1px solid #e5e7eb;border-radius:8px;max-height:160px;overflow-y:auto;
    z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,.1);display:none;`;
  const wrapper = input.closest(".add-appointment__textfield");
  if (wrapper) {
    wrapper.style.position = "relative";
    wrapper.appendChild(suggest);
  }

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    suggest.innerHTML = "";
    selectedPatient = null;
    if (!q || !patientList.length) { suggest.style.display = "none"; return; }

    const matches = patientList.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(q)
    ).slice(0, 6);

    if (!matches.length) { suggest.style.display = "none"; return; }
    suggest.style.display = "block";
    matches.forEach((p) => {
      const item = document.createElement("div");
      item.textContent = p.full_name;
      item.style.cssText = "padding:10px 14px;cursor:pointer;font-size:14px;border-bottom:1px solid #f9fafb;";
      item.addEventListener("mouseenter", () => (item.style.background = "#eff6ff"));
      item.addEventListener("mouseleave", () => (item.style.background = ""));
      item.addEventListener("click", () => {
        input.value = p.full_name;
        selectedPatient = p;
        suggest.style.display = "none";
        // Auto-fill phone / email if those inputs exist
        const phoneInput = document.querySelector(".add-appointment__textbox-152 input");
        const emailInput = document.querySelector(".add-appointment__textbox-153 input");
        if (phoneInput && !phoneInput.value) phoneInput.value = p.phone ?? "";
        if (emailInput && !emailInput.value) emailInput.value = p.email ?? "";
      });
      suggest.appendChild(item);
    });
  });

  document.addEventListener("click", (e) => {
    if (!wrapper?.contains(e.target)) suggest.style.display = "none";
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateForm() {
  const patientName = document.querySelector(".add-appointment__enter-patent-name")?.value.trim() ?? "";
  const date = document.querySelector(".add-appointment___09-feb-2021")?.value ?? "";
  const timeDisplay = document.querySelector(".add-appointment__select-time")?.textContent ?? "";

  const errors = [];
  if (!patientName) errors.push("Patient Name is required");
  if (!date) errors.push("Appointment Date is required");
  if (!timeDisplay || timeDisplay === "Select Time") errors.push("Please select an Appointment Time");
  return errors;
}

// ─── Save Appointment ─────────────────────────────────────────────────────────
async function saveAppointment() {
  const errors = validateForm();
  if (errors.length) {
    showToast(errors[0], "error");
    return;
  }

  const userId = sessionStorage.getItem("user_id");
  const patientName = document.querySelector(".add-appointment__enter-patent-name")?.value.trim() ?? "";
  const phone = document.querySelector(".add-appointment__textbox-152 input")?.value.trim() ?? "";
  const email = document.querySelector(".add-appointment__textbox-153 input")?.value.trim() ?? "";
  const typeDisplay = document.querySelector(".add-appointment__new-patient")?.textContent ?? "New Patient";
  const dateVal = document.querySelector(".add-appointment___09-feb-2021")?.value ?? "";
  const timeDisplay = document.querySelector(".add-appointment__select-time")?.textContent ?? "";
  const duration = document.querySelector(".add-appointment___30-minute")?.textContent ?? "30 minutes";
  const notes = document.querySelector(".add-appointment__enter-any-addation-notes")?.value.trim() ?? "";

  const time24 = parseTime(timeDisplay);

  const payload = {
    doctor_id: userId ? parseInt(userId) : null,
    patient_id: selectedPatient?.id ?? null,
    patient_name: patientName,
    phone: phone || null,
    email: email || null,
    appointment_type: typeDisplay,
    appointment_date: dateVal,
    appointment_time: time24,
    duration: duration,
    notes: notes,
    status: "scheduled",
  };

  try {
    const res = await fetch(window.apiUrl("/api/appointments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (res.ok) {
      showToast("Appointment scheduled successfully!", "success");
      setTimeout(() => window.location.href = "../dashboard/dashboard.html", 1500);
    } else {
      showToast(result.message ?? "Failed to schedule appointment", "error");
    }
  } catch (err) {
    console.error("saveAppointment:", err);
    showToast("Network error — please try again", "error");
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function onDOMReady() {
  if (!checkAuth()) return;

  // Set default date to today
  const dateInput = document.querySelector(".add-appointment___09-feb-2021");
  if (dateInput) dateInput.valueAsDate = new Date();

  // Build dropdowns
  buildDropdown(
    document.querySelector(".add-appointment__dropdown-button-3 .add-appointment__textfield"),
    document.querySelector(".add-appointment__new-patient"),
    APPOINTMENT_TYPES
  );
  buildDropdown(
    document.querySelector(".add-appointment__dropdown-button-32 .add-appointment__textfield"),
    document.querySelector(".add-appointment__select-time"),
    APPOINTMENT_TIMES
  );
  buildDropdown(
    document.querySelector(".add-appointment__dropdown-button-33 .add-appointment__textfield"),
    document.querySelector(".add-appointment___30-minute"),
    DURATION_OPTIONS
  );

  // Load patients and set up autocomplete
  await loadPatients();
  initPatientAutocomplete();

  // Buttons
  document.querySelector(".add-appointment__button")?.addEventListener("click", (e) => {
    e.preventDefault();
    saveAppointment();
  });

  document.querySelector(".add-appointment__button-197")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Cancel without saving?")) window.location.href = "../dashboard/dashboard.html";
  });

  document.querySelector(".add-appointment__c-remove-1")?.addEventListener("click", () => {
    if (confirm("Close without saving?")) window.location.href = "../dashboard/dashboard.html";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", onDOMReady);
} else {
  setTimeout(onDOMReady, 50);
}