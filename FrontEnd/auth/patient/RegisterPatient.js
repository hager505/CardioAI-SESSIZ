document.addEventListener("DOMContentLoaded", function () {

  // ─── Elements ───────────────────────────────────────────
  const checkbox        = document.getElementById("checkbox");
  const privacyLink     = document.getElementById("privacyLink");
  const completeBtn     = document.getElementById("completeBtn");
  const loginBtn        = document.getElementById("loginBtn");
  const passwordInput   = document.getElementById("password");
  const confirmPassword = document.getElementById("confirmPassword");

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

  // ─── Checkbox ────────────────────────────────────────────
  function toggleCheckbox(e) {
    e?.stopPropagation();
    isChecked = !isChecked;

    checkbox.style.backgroundColor = isChecked ? "#779f00" : "";
    checkbox.style.borderColor     = isChecked ? "#779f00" : "#dee1e6";
    checkbox.innerHTML = isChecked
      ? `<svg width="12" height="12" viewBox="0 0 12 12">
           <polyline points="1.5,6 4.5,9.5 10.5,2.5"
             fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
         </svg>`
      : "";

    checkFormCompletion();
  }

  checkbox?.addEventListener("click", toggleCheckbox);

  privacyLink?.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleCheckbox(e);
  });

  // ─── Validation ──────────────────────────────────────────
  function isEmailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function checkFormCompletion() {
    const allFilled   = Object.values(fields).every((el) => el?.value.trim() !== "");
    const emailOk     = isEmailValid(fields.email?.value || "");
    const passMatch   = passwordInput?.value === confirmPassword?.value && !!passwordInput?.value;
    const valid       = allFilled && emailOk && passMatch && isChecked;

    if (completeBtn) {
      completeBtn.style.opacity = valid ? "1" : "0.5";
      completeBtn.style.cursor  = valid ? "pointer" : "not-allowed";
    }

    return valid;
  }

  // Focus / blur effects
  Object.values(fields).forEach((el) => {
    if (!el) return;
    el.addEventListener("input",  checkFormCompletion);
    el.addEventListener("change", checkFormCompletion);
    el.addEventListener("focus", () => {
      if (el.parentElement?.classList.contains("sign-up__textfield"))
        el.parentElement.style.borderColor = "#779f00";
    });
    el.addEventListener("blur", () => {
      if (el.parentElement?.classList.contains("sign-up__textfield"))
        el.parentElement.style.borderColor = "#dee1e6";
    });
  });

  // Password match indicator
  function validatePasswords() {
    if (!passwordInput.value && !confirmPassword.value) return;
    const match = passwordInput.value === confirmPassword.value;
    const color = match ? "#779f00" : "red";
    passwordInput.parentElement.style.borderColor  = color;
    confirmPassword.parentElement.style.borderColor = color;
    checkFormCompletion();
  }

  passwordInput?.addEventListener("input",  validatePasswords);
  confirmPassword?.addEventListener("input", validatePasswords);

  // ─── Submit ──────────────────────────────────────────────
  completeBtn?.addEventListener("click", async function () {
    if (!checkFormCompletion()) {
      alert("Please fill all required fields correctly.");
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

    completeBtn.style.opacity  = "0.7";
    completeBtn.style.cursor   = "not-allowed";

    try {
      const res  = await fetch("http://localhost:5000/api/patients/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        alert("❌ " + data.message);
        completeBtn.style.opacity = "1";
        completeBtn.style.cursor  = "pointer";
        return;
      }

      sessionStorage.setItem("patient_id", data.patient_id);
      window.location.href = "../patient/complete.html";

    } catch {
      alert("Connection error. Is the server running on port 5000?");
      completeBtn.style.opacity = "1";
      completeBtn.style.cursor  = "pointer";
    }
  });

  // ─── Login redirect ──────────────────────────────────────
  loginBtn?.addEventListener("click", () => {
    window.location.href = "../login/login.html";
  });

  // ─── Init ────────────────────────────────────────────────
  checkFormCompletion();
});