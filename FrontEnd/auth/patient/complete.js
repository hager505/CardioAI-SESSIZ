// Patient Account Completion Script "patient/complete.js"
document.addEventListener("DOMContentLoaded", function () {

  // ─── Guard: patient_id must exist ───────────────────────
  const patientId = sessionStorage.getItem("patient_id");
  if (!patientId) {
    const container = document.getElementById("toastContainer");
    if (container) {
      container.innerHTML = `
        <div class="toast toast--error" style="animation:toastIn 0.4s ease;">
          <i class="fas fa-exclamation-circle"></i>
          <span>Session expired. Redirecting to registration...</span>
        </div>
      `;
    }
    setTimeout(() => {
      window.location.href = "./RegisterPatient.html";
    }, 2000);
    return;
  }

  // ─── Elements ────────────────────────────────────────────
  const uploadBtn   = document.getElementById("uploadBtn");
  const fileNameEl  = document.getElementById("fileName");
  const saveBtn     = document.getElementById("saveBtn");
  const cancelBtn   = document.getElementById("cancelBtn");
  const backArrow   = document.getElementById("backArrow");
  const header      = document.getElementById("header");

  // ─── Header scroll shadow ────────────────────────────────
  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 10);
  });

  // ─── File upload ─────────────────────────────────────────
  const fileInput  = document.createElement("input");
  fileInput.type   = "file";
  fileInput.accept = "image/*,.pdf";

  uploadBtn?.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    if (!fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size should be less than 5MB", "error");
      fileInput.value = "";
      return;
    }
    fileNameEl.value = file.name;
    fileNameEl.classList.add("has-success");
    showToast(`File "${file.name}" selected`, "success");
  });

  // ─── Toast helper ────────────────────────────────────────
  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle";
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ─── Save / Complete ─────────────────────────────────────
  saveBtn?.addEventListener("click", async function () {
    const bloodType = document.getElementById("bloodType").value;
    if (!bloodType) {
      showToast("Please select your blood type.", "error");
      document.getElementById("bloodType").focus();
      document.getElementById("bloodType").classList.add("has-error");
      return;
    }

    document.getElementById("bloodType").classList.remove("has-error");
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    const formData = new FormData();
    formData.append("patient_id", patientId);
    formData.append("blood_type", bloodType);
    formData.append("chronic_diseases", document.getElementById("chronicDiseases").value.trim());
    formData.append("allergies", document.getElementById("allergies").value.trim());
    formData.append("previous_surgeries", document.getElementById("previousSurgeries").value.trim());
    formData.append("additional_history", document.getElementById("additionalInfo").value.trim());

    if (fileInput.files[0]) {
      formData.append("prescription_file", fileInput.files[0]);
    }

    try {
      const res  = await fetch("http://localhost:5000/api/patients/register/info", {
        method: "POST",
        body:   formData,
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Failed to save", "error");
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Complete';
        return;
      }

      sessionStorage.removeItem("patient_id");
      showToast("Profile completed successfully!", "success");

      setTimeout(() => {
        window.location.href = "../login.html";
      }, 1500);

    } catch {
      showToast("Connection error. Is the server running on port 5000?", "error");
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Save &amp; Complete';
    }
  });

  // ─── Cancel ──────────────────────────────────────────────
  cancelBtn?.addEventListener("click", () => {
    if (confirm("Are you sure? Your data will be lost.")) {
      sessionStorage.removeItem("patient_id");
      window.location.href = "./RegisterPatient.html";
    }
  });

  // ─── Back Arrow ──────────────────────────────────────────
  backArrow?.addEventListener("click", () => window.history.back());

  // ─── Keyboard shortcuts ──────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) saveBtn?.click();
    if (e.key === "Escape") cancelBtn?.click();
  });

  // ─── Warn before leaving with unsaved data ───────────────
  window.addEventListener("beforeunload", (e) => {
    const hasData =
      document.getElementById("bloodType")?.value ||
      document.getElementById("chronicDiseases")?.value ||
      document.getElementById("allergies")?.value ||
      document.getElementById("previousSurgeries")?.value ||
      document.getElementById("additionalInfo")?.value;

    if (hasData) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
});
