document.addEventListener("DOMContentLoaded", function () {

  // ─── Elements ────────────────────────────────────────────
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const forgotPassLink = document.getElementById("forgotPasswordLink");
  const rememberChk = document.getElementById("rememberMe");
  const emailInput = document.getElementById("emailOrPhone");
  const passwordInput = document.getElementById("password");

  // ─── Remember Me restore ─────────────────────────────────
  if (rememberChk && localStorage.getItem("rememberLogin") === "true") {
    rememberChk.checked = true;
    emailInput.value = localStorage.getItem("savedEmail") || "";
    passwordInput.value = localStorage.getItem("savedPassword") || "";
  }

  rememberChk?.addEventListener("change", () => {
    if (!rememberChk.checked) {
      localStorage.removeItem("savedEmail");
      localStorage.removeItem("savedPassword");
      localStorage.removeItem("rememberLogin");
    }
  });

  // ─── Core login ───────────────────────────────────────────
  async function handleLogin() {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();

    if (!email || !password) {
      showError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      // Try patient login first
      let result = await tryLogin("patient", email, password);

      // If patient not found (401), try doctor login
      if (!result || (result.status === 401)) {
        const docResult = await tryLogin("doctor", email, password);
        // If doctor was found or had a specific error (like 403 pending), use that
        if (docResult) result = docResult;
      }

      if (!result || result.status === 401) {
        showError("Invalid email or password.");
        return;
      }

      if (result.status !== 200) {
        showError(result.data?.message || "Login failed.");
        return;
      }

      // ─── Remember Me save ───────────────────────────────
      if (rememberChk?.checked) {
        localStorage.setItem("rememberLogin", "true");
        localStorage.setItem("savedEmail", email);
        localStorage.setItem("savedPassword", password);
      }

      // ─── Store session ──────────────────────────────────
      const { role, data } = result;
      sessionStorage.setItem("user_role", role);
      sessionStorage.setItem("user_id", String(data.id));
      sessionStorage.setItem("user_name", data.full_name);
      sessionStorage.setItem("user_data", JSON.stringify(data));
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("loginTime", new Date().toISOString());

      // ─── Redirect ────────────────────────────────────────
      if (role === "doctor") {
        window.location.href = "../doctor/dashboard/dashboard.html";
      } else {
        window.location.href = "../patient/dashboard/dashboard.html";
      }

    } catch (err) {
      console.error("Login Error:", err);
      showError("Connection error. Is the server running on port 5000?");
    } finally {
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

  // ─── UI Helpers ───────────────────────────────────────────
  function setLoading(on) {
    if (!loginBtn) return;
    loginBtn.disabled = on;
    loginBtn.style.opacity = on ? "0.7" : "1";
    loginBtn.textContent = on ? "Logging in..." : "Log In";
  }

  function showError(msg) {
    let el = document.getElementById("loginError");
    if (!el) {
      el = document.createElement("p");
      el.id = "loginError";
      el.style.cssText = "color:red; font-size:13px; margin-top:8px; text-align:center;";
      loginBtn.insertAdjacentElement("afterend", el);
    }
    el.textContent = msg;
  }

  // ─── Event Listeners ─────────────────────────────────────
  loginForm?.addEventListener("submit", (e) => { e.preventDefault(); handleLogin(); });
  loginBtn?.addEventListener("click", handleLogin);

  passwordInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  forgotPassLink?.addEventListener("click", (e) => {
    e.preventDefault();
    const mail = emailInput?.value.trim();
    alert(mail ? `Reset link will be sent to: ${mail}` : "Please enter your email first.");
  });

  // ─── Already logged in ────────────────────────────────────
  const role1 = sessionStorage.getItem("user_role");
  const userId = sessionStorage.getItem("user_id");

  if (role1 && userId) {
    if (role1 === "doctor") {
      window.location.href = "../doctor/dashboard/dashboard.html";
    } else {
      window.location.href = "../patient/dashboard/dashboard.html";
    }
  }
});