// Patient Registration Script "patient/RegisterPatient.js"
document.addEventListener("DOMContentLoaded", function () {

  // ─── Elements ───────────────────────────────────────────
  const checkbox     = document.getElementById("checkbox");
  const termsInput   = document.getElementById("termsCheckbox");
  const privacyLink  = document.getElementById("privacyLink");
  const completeBtn  = document.getElementById("completeBtn");
  const loginBtn     = document.getElementById("loginBtn");
  const passwordInput    = document.getElementById("password");
  const confirmPassword  = document.getElementById("confirmPassword");
  const header       = document.getElementById("header");

  const fields = {
    fullName:        document.getElementById("fullName"),
    nationalId:      document.getElementById("nationalId"),
    dateOfBirth:     document.getElementById("dateOfBirth"),
    gender:          document.getElementById("gender"),
    phoneNumber:     document.getElementById("phoneNumber"),
    email:           document.getElementById("email"),
    password:        passwordInput,
    confirmPassword: confirmPassword,
  };

  let isChecked = false;

  // ─── Header scroll shadow ────────────────────────────────
  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 10);
  });

  // ─── Password toggles ────────────────────────────────────
  function bindPasswordToggle(btn, input) {
    btn?.addEventListener("click", function () {
      input.type = input.type === "password" ? "text" : "password";
      const icon = btn.querySelector("i");
      const isHidden = input.type === "password";
      icon.classList.toggle("fa-eye", isHidden);
      icon.classList.toggle("fa-eye-slash", !isHidden);
    });
  }
  bindPasswordToggle(document.getElementById("togglePassword1"), passwordInput);
  bindPasswordToggle(document.getElementById("togglePassword2"), confirmPassword);

  // ─── Checkbox ────────────────────────────────────────────
  function applyCheckboxState() {
    checkbox.style.backgroundColor = isChecked ? "var(--primary)" : "";
    checkbox.style.borderColor     = isChecked ? "var(--primary)" : "";
  }

  function toggleCheckbox() {
    isChecked = !isChecked;
    if (termsInput) termsInput.checked = isChecked;
    applyCheckboxState();
    checkFormCompletion();
  }

  // Handle clicking anywhere on the custom checkbox or its label/text
  const privacyLabel = document.getElementById("privacyLabel");
  if (privacyLabel) {
    privacyLabel.addEventListener("click", function (e) {
      // If clicking the link, don't toggle (let link do its own thing)
      if (e.target === privacyLink || e.target.closest("#privacyLink")) return;
      // Prevent the default label click (which would toggle the input and fire change twice)
      e.preventDefault();
      toggleCheckbox();
    });
  } else {
    checkbox?.addEventListener("click", function (e) {
      e.preventDefault();
      toggleCheckbox();
    });
  }

  // Sync termsInput changes to visual state if termsInput is checked/unchecked directly
  termsInput?.addEventListener("change", function () {
    isChecked = termsInput.checked;
    applyCheckboxState();
    checkFormCompletion();
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
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ─── Validation ──────────────────────────────────────────
  function isEmailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function checkFormCompletion() {
    const allFilled = Object.values(fields).every((el) => el?.value.trim() !== "");
    const emailOk   = isEmailValid(fields.email?.value || "");
    const passMatch = passwordInput?.value === confirmPassword?.value && !!passwordInput?.value;
    const valid     = allFilled && emailOk && passMatch && isChecked;

    if (completeBtn) {
      completeBtn.disabled = !valid;
      completeBtn.style.opacity = valid ? "1" : "0.5";
      completeBtn.style.cursor = valid ? "pointer" : "not-allowed";
    }

    return valid;
  }

  // ─── Input focus / blur effects ──────────────────────────
  Object.values(fields).forEach((el) => {
    if (!el) return;
    el.addEventListener("input", checkFormCompletion);
    el.addEventListener("change", checkFormCompletion);
    el.addEventListener("focus", () => {
      el.closest(".input-wrapper")?.classList.add("focused");
    });
    el.addEventListener("blur", () => {
      el.closest(".input-wrapper")?.classList.remove("focused");
    });
  });

  // ─── Password match indicator ────────────────────────────
  function validatePasswords() {
    if (!passwordInput.value && !confirmPassword.value) return;
    const match = passwordInput.value === confirmPassword.value;
    passwordInput.classList.toggle("has-success", match && !!passwordInput.value);
    passwordInput.classList.toggle("has-error", !match && !!confirmPassword.value);
    confirmPassword.classList.toggle("has-success", match && !!confirmPassword.value);
    confirmPassword.classList.toggle("has-error", !match && !!confirmPassword.value);
    checkFormCompletion();
  }

  passwordInput?.addEventListener("input", validatePasswords);
  confirmPassword?.addEventListener("input", validatePasswords);

  // ─── Submit ──────────────────────────────────────────────
  completeBtn?.addEventListener("click", async function () {
    if (!checkFormCompletion()) {
      showToast("Please fill all required fields correctly.", "error");
      return;
    }

    const body = {
      full_name:        fields.fullName.value.trim(),
      national_id:      fields.nationalId.value.trim(),
      date_of_birth:    fields.dateOfBirth.value,
      gender:           fields.gender.value,
      phone:            fields.phoneNumber.value.trim(),
      email:            fields.email.value.trim(),
      password:         passwordInput.value,
      confirm_password: confirmPassword.value,
      agreed_terms:     true,
    };

    completeBtn.disabled = true;
    completeBtn.innerHTML = '<span class="spinner"></span> Creating account...';

    try {
      const res  = await fetch("http://localhost:5000/api/patients/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Registration failed", "error");
        completeBtn.disabled = false;
        completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete My Account';
        return;
      }

      sessionStorage.setItem("patient_id", data.patient_id);
      showToast("Account created! Redirecting...", "success");

      setTimeout(() => {
        window.location.href = "./complete.html";
      }, 800);

    } catch {
      showToast("Connection error. Is the server running on port 5000?", "error");
      completeBtn.disabled = false;
      completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete My Account';
    }
  });

  // ─── Login redirect ──────────────────────────────────────
  loginBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "../login.html";
  });

  // ─── Init ────────────────────────────────────────────────
  checkFormCompletion();
});
