// doctor/my-requests/refill.js
// ─── CardioAI — Prescription Refill Request ───────────────────────────────────

const API = "http://localhost:5000/api";

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

document.addEventListener("DOMContentLoaded", () => {
  // Auth guard
  const raw = sessionStorage.getItem("user_data");
  const role = sessionStorage.getItem("user_role");
  if (!raw || role !== "doctor") {
    window.location.href = "../../auth/login.html";
    return;
  }

  const closeIcon = document.querySelector(".refill-request__x");
  const cancelBtn = document.querySelector(".refill-request__button2");
  const submitBtn = document.getElementById("submitBtn");
  const patientNameInput = document.getElementById("patientName");
  const prioritySelect = document.getElementById("priority");
  const messageTextarea = document.getElementById("message");

  const goBack = () => window.location.href = "my-requests.html";

  closeIcon?.addEventListener("click", goBack);
  cancelBtn?.addEventListener("click", goBack);

  submitBtn?.addEventListener("click", async () => {
    const patientName = patientNameInput?.value.trim() ?? "";
    const priority = prioritySelect?.value ?? "Medium";
    const message = messageTextarea?.value.trim() ?? "";

    if (!patientName) { showToast("Patient name is required", "error"); return; }
    if (!message) { showToast("Message is required", "error"); return; }

    submitBtn.style.opacity = "0.6";
    submitBtn.style.pointerEvents = "none";

    try {
      const res = await fetch(`${API}/doctor/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, message, priority }),
      });
      const result = await res.json();

      if (res.ok) {
        showToast("Request submitted successfully ✓", "success");
        setTimeout(goBack, 1500);
      } else {
        showToast(result.message ?? "Failed to submit request", "error");
        submitBtn.style.opacity = "";
        submitBtn.style.pointerEvents = "";
      }
    } catch (err) {
      console.error("submit refill request:", err);
      showToast("Network error — please try again", "error");
      submitBtn.style.opacity = "";
      submitBtn.style.pointerEvents = "";
    }
  });
});