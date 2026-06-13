// Logout Script "logout.js"
document.addEventListener("DOMContentLoaded", function () {

  // ─── Elements ────────────────────────────────────────────
  const logoutBtn  = document.getElementById("logoutBtn");
  const cancelBtn  = document.getElementById("cancelBtn");
  const header     = document.getElementById("header");
  const successContainer = document.getElementById("successContainer");

  // ─── Header scroll shadow ────────────────────────────────
  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 10);
  });

  // ─── Clear all session data ──────────────────────────────
  function clearSession() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("loginTime");
    localStorage.removeItem("rememberLogin");
    localStorage.removeItem("savedEmail");
    localStorage.removeItem("savedPassword");
    sessionStorage.clear();
  }

  // ─── Success message ─────────────────────────────────────
  function showSuccess() {
    if (!successContainer) return;
    successContainer.innerHTML = `
      <div class="logout-success-msg">
        <i class="fas fa-check-circle" style="font-size:18px;"></i>
        <span>Logged out successfully! Redirecting...</span>
      </div>
    `;
  }

  // ─── Loading state ───────────────────────────────────────
  function setLoading(on) {
    if (!logoutBtn) return;
    logoutBtn.disabled = on;
    if (on) {
      logoutBtn.innerHTML = '<span class="spinner"></span> Logging out...';
    } else {
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span class="btn-text">Log Out</span>';
    }
  }

  // ─── Handle logout ───────────────────────────────────────
  function handleLogout() {
    setLoading(true);
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.style.opacity = "0.5";
    }

    setTimeout(() => {
      clearSession();
      showSuccess();
      setTimeout(() => {
        window.location.href = "../index.html";
      }, 1500);
    }, 600);
  }

  // ─── Handle cancel ───────────────────────────────────────
  function handleCancel() {
    window.history.back();
  }

  // ─── Event listeners ─────────────────────────────────────
  logoutBtn?.addEventListener("click", handleLogout);
  cancelBtn?.addEventListener("click", handleCancel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter") handleLogout();
  });
});
