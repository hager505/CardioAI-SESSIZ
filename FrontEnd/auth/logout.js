document.addEventListener("DOMContentLoaded", function () {

  // ─── Elements ────────────────────────────────────────────
  const logoutBtn  = document.getElementById("logoutBtn");
  const cancelBtn  = document.getElementById("cancelBtn");

  // ─── Clear all session data ──────────────────────────────
  function clearSession() {
    // localStorage
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("loginTime");
    localStorage.removeItem("rememberLogin");
    localStorage.removeItem("savedEmail");
    localStorage.removeItem("savedPassword");
    // sessionStorage
    sessionStorage.clear();
  }

  // ─── Success message ─────────────────────────────────────
  function showSuccessMessage() {
    const card = document.querySelector(".logout-card");
    if (!card) return;

    const msg = document.createElement("div");
    msg.style.cssText = `
      margin-top:16px; padding:12px 16px;
      background:#f0f7e6; border:1px solid #779f00;
      border-radius:8px; color:#4a6300;
      display:flex; align-items:center; gap:10px; font-size:14px;
    `;
    msg.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>Logged out successfully. Redirecting...</span>
    `;
    card.appendChild(msg);
  }

  // ─── Handle logout ───────────────────────────────────────
  function handleLogout() {
    if (!logoutBtn) return;

    logoutBtn.disabled      = true;
    logoutBtn.style.opacity = "0.7";
    if (cancelBtn) cancelBtn.disabled = true;

    setTimeout(() => {
      clearSession();
      showSuccessMessage();
      setTimeout(() => {
        window.location.href = "/startpage/home.html";
      }, 1500);
    }, 800);
  }

  // ─── Handle cancel ───────────────────────────────────────
  function handleCancel() {
    if (confirm("Cancel logout and go back?")) {
      window.history.back();
    }
  }

  // ─── Event listeners ─────────────────────────────────────
  logoutBtn?.addEventListener("click", handleLogout);
  cancelBtn?.addEventListener("click", handleCancel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")  handleCancel();
    if (e.key === "Enter" && !e.target.matches("input, textarea, button"))
      handleLogout();
  });

  // ─── Navbar scroll shadow ────────────────────────────────
  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;
    navbar.style.boxShadow = window.scrollY > 10
      ? "0 4px 12px rgba(18,15,40,.15)"
      : "0 2px 8px rgba(18,15,40,.08)";
  });
});