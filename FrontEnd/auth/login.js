// Login Script "login.js"
document.addEventListener("DOMContentLoaded", function () {

  // ─── Elements ────────────────────────────────────────────
  const loginForm    = document.getElementById("loginForm");
  const loginBtn     = document.getElementById("loginBtn");
  const forgotLink   = document.getElementById("forgotPasswordLink");
  const rememberChk  = document.getElementById("rememberMe");
  const emailInput   = document.getElementById("emailOrPhone");
  const passwordInput= document.getElementById("password");
  const togglePass   = document.getElementById("togglePassword");

  // ─── Password toggle ─────────────────────────────────────
  togglePass?.addEventListener("click", () => {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    const icon = togglePass.querySelector("i");
    const isHidden = passwordInput.type === "password";
    icon.classList.toggle("fa-eye", isHidden);
    icon.classList.toggle("fa-eye-slash", !isHidden);
  });

  // ─── Remember Me restore ─────────────────────────────────
  if (rememberChk && localStorage.getItem("rememberLogin") === "true") {
    rememberChk.checked = true;
    emailInput.value    = localStorage.getItem("savedEmail") || "";
    passwordInput.value = localStorage.getItem("savedPassword") || "";
  }

  rememberChk?.addEventListener("change", () => {
    if (!rememberChk.checked) {
      localStorage.removeItem("savedEmail");
      localStorage.removeItem("savedPassword");
      localStorage.removeItem("rememberLogin");
    }
  });

  // ─── Toast helper ────────────────────────────────────────
  function showToast(message, type = "error") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    const icon = type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle";
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("toast-out");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ─── Loading state ───────────────────────────────────────
  function setLoading(on) {
    if (!loginBtn) return;
    loginBtn.disabled = on;
    if (on) {
      loginBtn.innerHTML = '<span class="spinner"></span> Logging in...';
    } else {
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
    }
  }

  // ─── Core login ───────────────────────────────────────────
  async function handleLogin() {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      showToast("Please fill in all fields.", "error");
      emailInput?.classList.toggle("has-error", !email);
      passwordInput?.classList.toggle("has-error", !password);
      return;
    }

    setLoading(true);

    try {
      let result = await tryLogin("patient", email, password);

      if (!result || result.status === 401) {
        const docResult = await tryLogin("doctor", email, password);
        if (docResult) result = docResult;
      }

      if (!result || result.status === 401) {
        showToast("Invalid email or password.", "error");
        passwordInput?.classList.add("has-error");
        setLoading(false);
        return;
      }

      if (result.status !== 200) {
        showToast(result.data?.message || "Login failed.", "error");
        setLoading(false);
        return;
      }

      // Remember Me
      if (rememberChk?.checked) {
        localStorage.setItem("rememberLogin", "true");
        localStorage.setItem("savedEmail", email);
        localStorage.setItem("savedPassword", password);
      }

      // Store session via AuthManager
      const { role, data } = result;
      sessionStorage.setItem("user_role", role);
      sessionStorage.setItem("user_id", String(data.id));
      sessionStorage.setItem("user_name", data.full_name);
      sessionStorage.setItem("user_data", JSON.stringify(data));
      if (typeof AuthManager !== 'undefined') {
        AuthManager.setAuthData({
          userType: role,
          name: data.full_name,
          // userId is required for cross-tab auth: when the user opens a
          // dashboard link in a new tab, the new tab has empty
          // sessionStorage but we still want it to know who the user is.
          userId: data.id,
          token: data.token || null,
          // The login response carries avatar_url (resolved by the
          // patient/doctor controller). Forward it so the landing-page
          // navbar (and any other page that reads AuthManager.getUserData)
          // shows the user's photo on the very first render, even if no
          // dashboard has been visited yet in this session.
          avatar: data.avatar_url || null,
          // Full login-response blob. AuthManager mirrors it to
          // localStorage.userData so that bootstrapSessionFromLocal() in
          // any new tab can rebuild sessionStorage.user_data. This is
          // what stops the dashboard <-> login.html infinite redirect
          // loop when a logged-in user opens a dashboard link in a new
          // tab (the per-tab sessionStorage is empty there).
          data: data,
        });
      } else {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("loginTime", new Date().toISOString());
      }

      showToast("Login successful! Redirecting...", "success");

      setTimeout(() => {
        if (role === "doctor") {
          window.location.href = "../doctor/dashboard/dashboard.html";
        } else {
          window.location.href = "../patient/dashboard/dashboard.html";
        }
      }, 800);

    } catch (err) {
      console.error("Login Error:", err);
      showToast("Connection error. Is the server running on port 5000?", "error");
      setLoading(false);
    }
  }

  // ─── Try login for a specific role ───────────────────────
  async function tryLogin(role, email, password) {
    const url = role === "patient"
      ? "http://localhost:5000/api/patients/login"
      : "http://localhost:5000/api/doctors/login";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    return { role, data, status: res.status };
  }

  // ─── Event Listeners ─────────────────────────────────────
  loginForm?.addEventListener("submit", (e) => { e.preventDefault(); handleLogin(); });
  loginBtn?.addEventListener("click", handleLogin);

  passwordInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  forgotLink?.addEventListener("click", (e) => {
    e.preventDefault();
    const mail = emailInput?.value.trim();
    if (mail) {
      showToast(`Password reset link will be sent to: ${mail}`, "info");
    } else {
      showToast("Please enter your email first.", "info");
      emailInput?.focus();
    }
  });

});
