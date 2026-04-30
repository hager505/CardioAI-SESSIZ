document.addEventListener("DOMContentLoaded", function () {

  // ─── Guard: patient_id لازم يكون موجود ──────────────────
  const patientId = sessionStorage.getItem("patient_id");
  if (!patientId) {
    alert("Session expired. Please register again.");
    window.location.href = "../register/register.html";
    return;
  }

  // ─── Elements ────────────────────────────────────────────
  const uploadBtn  = document.getElementById("uploadBtn");
  const fileNameEl = document.getElementById("fileName");
  const saveBtn    = document.getElementById("saveBtn");
  const cancelBtn  = document.getElementById("cancelBtn");
  const backArrow  = document.getElementById("backArrow");

  // ─── File upload ─────────────────────────────────────────
  const fileInput    = document.createElement("input");
  fileInput.type     = "file";
  fileInput.accept   = "image/*,.pdf";

  uploadBtn?.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    if (!fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert("⚠️ File size should be less than 5MB");
      fileInput.value = "";
      return;
    }
    fileNameEl.textContent = file.name;
    fileNameEl.style.color = "#171a1f";
  });

  // ─── Toast helper ────────────────────────────────────────
  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position:fixed; top:80px; right:20px;
      background:#779f00; color:white;
      padding:12px 20px; border-radius:6px;
      font-size:14px; z-index:9999;
      box-shadow:0 3px 10px rgba(0,0,0,.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── Textarea: Enter يضيف سطر جديد مش submit ────────────
  document.querySelectorAll(".complete-account-textarea").forEach((ta) => {
    ta.addEventListener("keypress", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        // نسمح بالـ Enter الطبيعي في الـ textarea
        // لو حابب تمنعه وتعمل tag system هنا المكان
      }
    });
  });

  // ─── Save / Complete ─────────────────────────────────────
  saveBtn?.addEventListener("click", async function () {
    const bloodType = document.getElementById("bloodType").value;
    if (!bloodType) {
      alert("Please select your blood type.");
      document.getElementById("bloodType").focus();
      return;
    }

    saveBtn.style.opacity = "0.7";
    saveBtn.style.cursor  = "not-allowed";

    const formData = new FormData();
    formData.append("patient_id",         patientId);
    formData.append("blood_type",         bloodType);
    formData.append("chronic_diseases",   document.getElementById("chronicDiseases").value.trim());
    formData.append("allergies",          document.getElementById("allergies").value.trim());
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
        alert("❌ " + data.message);
        saveBtn.style.opacity = "1";
        saveBtn.style.cursor  = "pointer";
        return;
      }

      sessionStorage.removeItem("patient_id");
      showToast("✅ Account completed successfully!");
      setTimeout(() => {
        window.location.href = "../login.html";
      }, 1500);

    } catch {
      alert("Connection error. Is the server running on port 5000?");
      saveBtn.style.opacity = "1";
      saveBtn.style.cursor  = "pointer";
    }
  });

  // ─── Cancel ──────────────────────────────────────────────
  cancelBtn?.addEventListener("click", () => {
    if (confirm("Are you sure? Your data will be lost.")) {
      sessionStorage.removeItem("patient_id");
      window.location.href = "../register/register.html";
    }
  });

  // ─── Back Arrow ──────────────────────────────────────────
  backArrow?.addEventListener("click", () => window.history.back());

  // ─── Keyboard shortcuts ──────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) saveBtn?.click();
    if (e.key === "Escape")             cancelBtn?.click();
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