// Doctor Registration Script "doctor/script.js"
document.addEventListener("DOMContentLoaded", function () {

  // ─── App State ─────────────────────────────────────────
  const state = {
    currentStep: 1,
    totalSteps: 3,
    data: {
      full_name: "", email: "", address: "", password: "",
      confirm_password: "", phone: "", age: "", gender: "", role: "",
      medical_id: "", hospital_affiliation: "",
      has_private_clinic: false, years_experience: "",
      patients_per_week: "", university: "", medical_degree: "",
      has_masters_phd: false,
      acknowledged_terms: false,
    },
    files: {
      medical_license: null,
      medical_documents: [],
    },
  };

  // ─── Elements ──────────────────────────────────────────
  const progressFill = document.getElementById("progressFill");
  const steps        = document.querySelectorAll(".step");
  const stepContents = document.querySelectorAll(".step-content");
  const header       = document.getElementById("header");

  // ─── Header scroll shadow ────────────────────────────────
  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 10);
  });

  // ─── Progress ──────────────────────────────────────────
  function updateProgress() {
    const pct = ((state.currentStep - 1) / (state.totalSteps - 1)) * 100;
    progressFill.style.width = `${pct}%`;

    steps.forEach((s, i) => {
      const n = i + 1;
      s.classList.remove("active", "completed");
      const num = s.querySelector(".step-number");
      if (n === state.currentStep) { s.classList.add("active"); num.textContent = n; }
      else if (n < state.currentStep) { s.classList.add("completed"); num.textContent = "✓"; }
      else { num.textContent = n; }
    });
  }

  function showStep(n) {
    stepContents.forEach(c => c.classList.remove("active"));
    document.getElementById(`step${n}`)?.classList.add("active");
    if (n === 3) populateReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ─── Navigation ────────────────────────────────────────
  window.goToStep = function (n) {
    if (n > state.currentStep && !validateStep(state.currentStep)) return;
    collectStepData(state.currentStep);
    state.currentStep = n;
    showStep(n);
    updateProgress();
  };

  // ─── Collect step data ─────────────────────────────────
  function collectStepData(step) {
    if (step === 1) {
      state.data.full_name        = val("fullName");
      state.data.email            = val("email");
      state.data.address          = val("address");
      state.data.password         = val("password");
      state.data.confirm_password = val("confirmPassword");
      state.data.phone            = val("phoneNumber");
      state.data.age              = val("age");
      state.data.gender           = val("gender");
      state.data.role             = val("role");
    }
    if (step === 2) {
      state.data.medical_id           = val("medicalId");
      state.data.hospital_affiliation = val("hospitalAffiliation");
      state.data.has_private_clinic   = document.getElementById("hasPrivateClinic")?.checked || false;
      state.data.years_experience     = val("yearsExperience");
      state.data.patients_per_week    = val("patientsPerWeek");
      state.data.university           = val("university");
      state.data.medical_degree       = val("medicalDegree");
      const phd = document.querySelector('input[name="hasMastersPhD"]:checked');
      state.data.has_masters_phd = phd?.value === "yes";
    }
  }

  function val(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  // ─── Validation ────────────────────────────────────────
  function validateStep(step) {
    clearErrors();
    let valid = true;

    if (step === 1) {
      if (!val("fullName"))      { showErr("fullNameError", "Full name is required"); valid = false; }
      if (!isEmail(val("email"))){ showErr("emailError", "Valid email is required");  valid = false; }
      if (!val("address"))       { showErr("addressError", "Address is required");      valid = false; }
      if (val("password").length < 8) { showErr("passwordError","Min 8 characters");     valid = false; }
      if (val("password") !== val("confirmPassword"))
        { showErr("confirmPasswordError", "Passwords don't match");                      valid = false; }
      if (!val("phoneNumber"))   { showErr("phoneNumberError", "Phone is required");     valid = false; }
      if (!val("age") || +val("age") < 18 || +val("age") > 100)
        { showErr("ageError", "Age must be 18-100");                                    valid = false; }
      if (!val("gender"))        { showErr("genderError", "Gender is required");         valid = false; }
      if (!val("role"))          { showErr("roleError", "Role is required");            valid = false; }
    }

    if (step === 2) {
      if (!val("medicalId"))          { showErr("medicalIdError", "Medical ID is required");            valid = false; }
      if (!val("hospitalAffiliation")){ showErr("hospitalAffiliationError", "Hospital affiliation required"); valid = false; }
      if (!val("yearsExperience"))    { showErr("yearsExperienceError", "Years of experience required"); valid = false; }
      if (!val("patientsPerWeek"))    { showErr("patientsPerWeekError", "Patients/week required");      valid = false; }
      if (!val("university"))         { showErr("universityError", "University is required");           valid = false; }
      if (!val("medicalDegree"))      { showErr("medicalDegreeError", "Medical degree is required");    valid = false; }
      if (!state.files.medical_license) {
        showErr("licenseError", "Medical license is required");                                      valid = false;
      }
    }

    return valid;
  }

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function showErr(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add("show"); }
    // Also mark the input
    const inputEl = el?.closest(".form-group")?.querySelector("input, select");
    if (inputEl) inputEl.classList.add("has-error");
  }

  function clearErrors() {
    document.querySelectorAll(".error-message").forEach(el => {
      el.textContent = "";
      el.classList.remove("show");
    });
    document.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
  }

  // ─── File Upload ───────────────────────────────────────
  function initFileUpload() {
    const licenseInput = document.getElementById("medicalLicense");
    const licenseList  = document.getElementById("licenseFileList");

    licenseInput?.addEventListener("change", () => {
      const file = licenseInput.files[0];
      if (!file) return;
      if (!isValidFile(file)) return;
      state.files.medical_license = file;
      renderFileList([file], licenseList, "license");
      document.getElementById("licenseError")?.classList.remove("show");
    });

    licenseInput?.addEventListener("click", (e) => e.stopPropagation());
    initDropZone("licenseDropZone", licenseInput);

    const docsInput = document.getElementById("medicalDocuments");
    const docsList  = document.getElementById("medicalDocsList");

    docsInput?.addEventListener("change", () => {
      const newFiles = Array.from(docsInput.files).filter(isValidFile);
      state.files.medical_documents.push(...newFiles);
      renderFileList(state.files.medical_documents, docsList, "document");
    });

    docsInput?.addEventListener("click", (e) => e.stopPropagation());
    initDropZone("medicalDocsDropZone", docsInput);
  }

  function initDropZone(zoneId, input) {
    const zone = document.getElementById(zoneId);
    if (!zone || !input) return;

    zone.addEventListener("click", () => input.click());
    zone.addEventListener("dragover",  (e) => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", ()  => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event("change"));
    });
  }

  function isValidFile(file) {
    const allowed = ["application/pdf","image/jpeg","image/jpg","image/png",
                     "application/msword",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      showToast(`Invalid file type: ${file.name}`, "error");
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(`File too large (max 5MB): ${file.name}`, "error");
      return false;
    }
    return true;
  }

  function renderFileList(files, container, type) {
    if (!container) return;
    container.innerHTML = files.map((f, i) => `
      <div class="file-item" data-index="${i}">
        <div class="file-icon">
          <i class="fas ${f.type.includes("pdf") ? "fa-file-pdf" : f.type.includes("image") ? "fa-file-image" : "fa-file-word"}"></i>
        </div>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-size">${(f.size / 1024).toFixed(1)} KB</div>
        </div>
        <button class="remove-file" data-type="${type}" data-index="${i}" title="Remove file">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join("");

    container.querySelectorAll(".remove-file").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = +btn.dataset.index;
        if (btn.dataset.type === "license") {
          state.files.medical_license = null;
          container.innerHTML = "";
        } else {
          state.files.medical_documents.splice(i, 1);
          renderFileList(state.files.medical_documents, container, "document");
        }
      });
    });
  }

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

  // ─── Review (Step 3) ───────────────────────────────────
  function populateReview() {
    collectStepData(2);

    const basicReview  = document.getElementById("basicInfoReview");
    const doctorReview = document.getElementById("doctorDetailsReview");
    const docsReview   = document.getElementById("documentsReview");

    if (basicReview) {
      basicReview.innerHTML = reviewGrid([
        ["Full Name",    state.data.full_name],
        ["Email",        state.data.email],
        ["Address",      state.data.address],
        ["Phone",        state.data.phone],
        ["Age",          state.data.age],
        ["Gender",       state.data.gender],
        ["Role",         state.data.role],
      ]);
    }

    if (doctorReview) {
      doctorReview.innerHTML = reviewGrid([
        ["Medical ID",         state.data.medical_id],
        ["Hospital",           state.data.hospital_affiliation],
        ["Private Clinic",     state.data.has_private_clinic ? "Yes" : "No"],
        ["Years Experience",   state.data.years_experience],
        ["Patients/Week",      state.data.patients_per_week],
        ["University",         state.data.university],
        ["Medical Degree",     state.data.medical_degree],
        ["Master's / PhD",     state.data.has_masters_phd ? "Yes" : "No"],
      ]);
    }

    if (docsReview) {
      const allFiles = [];
      if (state.files.medical_license) allFiles.push({ name: state.files.medical_license.name, type: "License" });
      state.files.medical_documents.forEach(f => allFiles.push({ name: f.name, type: "Document" }));
      docsReview.innerHTML = allFiles.length
        ? allFiles.map(f => `<div class="document-item"><span class="badge">${f.type}</span> ${f.name}</div>`).join("")
        : `<p style="color:var(--text-muted);font-size:14px;"><i class="fas fa-info-circle" style="margin-right:6px;"></i>No documents uploaded</p>`;
    }
  }

  function reviewGrid(rows) {
    return rows.map(([label, value]) => `
      <div class="review-item">
        <div class="review-label">${label}</div>
        <div class="review-value ${!value ? "empty" : ""}">${value || "Not provided"}</div>
      </div>
    `).join("");
  }

  // ─── Custom Selects ─────────────────────────────────────
  function initCustomSelects() {
    document.querySelectorAll(".custom-select").forEach(container => {
      const trigger     = container.querySelector(".select-trigger");
      const options     = container.querySelector(".select-options");
      const hiddenInput = container.querySelector("input[type='hidden']");
      const display     = container.querySelector(".selected-value");

      trigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".custom-select.open").forEach(s => {
          if (s !== container) s.classList.remove("open");
        });
        container.classList.toggle("open");
      });

      options?.querySelectorAll(".option").forEach(opt => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          hiddenInput.value = opt.dataset.value;
          display.innerHTML = opt.innerHTML;
          display.classList.remove("placeholder");
          options.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
          opt.classList.add("selected");
          container.classList.remove("open");
          clearErrors();
        });
      });

      document.addEventListener("click", () => container.classList.remove("open"));
    });
  }

  // ─── Password visibility toggle ────────────────────────
  function initPasswordToggles() {
    document.querySelectorAll(".toggle-password").forEach(btn => {
      // Make sure the eye icon is rendered with the correct initial state (password hidden => fa-eye)
      if (!btn.querySelector("i")) {
        const i = document.createElement("i");
        i.className = "fas fa-eye";
        btn.appendChild(i);
      } else {
        const i = btn.querySelector("i");
        i.classList.remove("fa-eye-slash");
        i.classList.add("fa-eye");
      }

      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        const icon  = btn.querySelector("i");
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
        const isHidden = input.type === "password";
        icon.classList.toggle("fa-eye",       isHidden);
        icon.classList.toggle("fa-eye-slash",  !isHidden);
      });
    });
  }

  // ─── Submit (Step 3) ───────────────────────────────────
  window.submitForm = async function () {
    const termsCheckbox = document.getElementById("termsAgreement");
    if (!termsCheckbox?.checked) {
      showErr("termsError", "You must acknowledge the terms before submitting");
      return;
    }

    state.data.acknowledged_terms = true;
    collectStepData(2);

    const formData = new FormData();
    Object.entries(state.data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    if (state.files.medical_license) {
      formData.append("medical_license", state.files.medical_license);
    }
    state.files.medical_documents.forEach(f => {
      formData.append("medical_documents", f);
    });

    const submitBtn = document.querySelector(".btn--success[onclick='submitForm()']");
    const original  = submitBtn?.innerHTML;
    if (submitBtn) {
      submitBtn.innerHTML  = '<span class="spinner"></span> Submitting...';
      submitBtn.disabled   = true;
    }

    try {
      const res  = await fetch("http://localhost:5000/api/doctors/register", {
        method: "POST",
        body:   formData,
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "Submission failed", "error");
        if (submitBtn) {
          submitBtn.innerHTML = original;
          submitBtn.disabled  = false;
        }
        return;
      }

      document.getElementById("successModal")?.classList.add("show");
      sessionStorage.setItem("doctor_id", data.doctor_id);
      sessionStorage.setItem("doctor_serial", data.serial);

    } catch {
      showToast("Connection error. Is the server running on port 5000?", "error");
      if (submitBtn) {
        submitBtn.innerHTML = original;
        submitBtn.disabled  = false;
      }
    }
  };

  // ─── Modal ─────────────────────────────────────────────
  window.closeSuccessModal = function () {
    document.getElementById("successModal")?.classList.remove("show");
  };

  window.redirectToDashboard = function () {
    window.location.href = "../../doctor/dashboard/dashboard.html";
  };

  // ─── Init ──────────────────────────────────────────────
  initCustomSelects();
  initPasswordToggles();
  initFileUpload();
  updateProgress();
  showStep(1);
});
