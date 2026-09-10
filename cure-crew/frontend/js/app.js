// CareCrew frontend — splash sequence, auth, and the two post-login dashboards.
(function () {
  const SESSION_KEY = "carecrew-session"; // { token, user }

  let currentRole = "patient"; // role currently being logged into on the auth screen
  let authMode = "login"; // "login" | "register"

  const els = {
    splash: document.getElementById("splash"),
    splashLogo: document.getElementById("splash-logo"),
    app: document.getElementById("app"),
    headerLogo: document.getElementById("header-logo"),
    themeToggle: document.getElementById("theme-toggle"),
    headerLangSelect: document.getElementById("header-lang-select"),
    userChip: document.getElementById("user-chip"),
    userChipAvatar: document.getElementById("user-chip-avatar"),
    userChipName: document.getElementById("user-chip-name"),
    logoutBtn: document.getElementById("logout-btn"),

    headerLoginBtn: document.getElementById("header-login-btn"),
    headerGetStartedBtn: document.getElementById("header-get-started-btn"),

    mainContent: document.getElementById("main-content"),
    viewLanding: document.getElementById("view-landing"),
    viewAuth: document.getElementById("view-auth"),

    appShell: document.getElementById("app-shell"),
    hamburgerBtn: document.getElementById("hamburger-btn"),
    sidebar: document.getElementById("sidebar"),
    sidebarNav: document.getElementById("sidebar-nav"),
    sidebarProfile: document.getElementById("sidebar-profile"),
    sidebarProfileAvatar: document.getElementById("sidebar-profile-avatar"),
    sidebarProfileName: document.getElementById("sidebar-profile-name"),
    sidebarProfileRole: document.getElementById("sidebar-profile-role"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    aiBotFab: document.getElementById("ai-bot-fab"),

    viewDashboard: document.getElementById("view-dashboard"),
    viewDiagnosis: document.getElementById("view-diagnosis"),
    diagnosisBack: document.getElementById("diagnosis-back"),
    viewProfile: document.getElementById("view-profile"),
    viewChat: document.getElementById("view-chat"),
    viewAppointments: document.getElementById("view-appointments"),
    viewReports: document.getElementById("view-reports"),

    dashboardWelcome: document.getElementById("dashboard-welcome"),
    dashboardSubtitle: document.getElementById("dashboard-subtitle"),
    dashboardIdCard: document.getElementById("dashboard-id-card"),
    dashboardPatientHome: document.getElementById("dashboard-patient-home"),
    dashboardDoctorActions: document.getElementById("dashboard-doctor-actions"),
    profileIdCard: document.getElementById("profile-id-card"),

    nextAppointmentBody: document.getElementById("next-appointment-body"),
    lastCasesheetBody: document.getElementById("last-casesheet-body"),
    recentActivityList: document.getElementById("recent-activity-list"),
    reportStatusLink: document.getElementById("report-status-link"),

    startCaseBtn: document.getElementById("start-case-btn"),
    chatBack: document.getElementById("chat-back"),

    goAppointmentsBtn: document.getElementById("go-appointments-btn"),
    goReportsBtn: document.getElementById("go-reports-btn"),
    appointmentsBack: document.getElementById("appointments-back"),
    reportsBack: document.getElementById("reports-back"),
    appointmentForm: document.getElementById("appointment-form"),
    appointmentsError: document.getElementById("appointments-error"),
    apptDepartment: document.getElementById("appt-department"),
    apptDate: document.getElementById("appt-date"),
    apptNote: document.getElementById("appt-note"),
    apptUrgent: document.getElementById("appt-urgent"),
    apptSubmit: document.getElementById("appt-submit"),
    appointmentsList: document.getElementById("appointments-list"),

    reportsListWrap: document.getElementById("reports-list-wrap"),
    reportsError: document.getElementById("reports-error"),
    reportsList: document.getElementById("reports-list"),
    reportDetail: document.getElementById("report-detail"),
    reportDetailBack: document.getElementById("report-detail-back"),
    reportDetailBody: document.getElementById("report-detail-body"),
    reportSummaryPatientBtn: document.getElementById("report-summary-patient"),
    reportSummaryDoctorBtn: document.getElementById("report-summary-doctor"),
    reportSummaryBody: document.getElementById("report-summary-body"),

    viewDoctorAppointments: document.getElementById("view-doctor-appointments"),
    goDoctorAppointmentsBtn: document.getElementById("go-doctor-appointments-btn"),
    doctorAppointmentsBack: document.getElementById("doctor-appointments-back"),
    doctorAppointmentsError: document.getElementById("doctor-appointments-error"),
    doctorAppointmentsList: document.getElementById("doctor-appointments-list"),

    authBackHome: document.getElementById("auth-back-home"),
    authLangSelect: document.getElementById("auth-lang-select"),
    authThemeToggle: document.getElementById("auth-theme-toggle"),
    rolePatientBtn: document.getElementById("role-toggle-patient"),
    roleDoctorBtn: document.getElementById("role-toggle-doctor"),
    authHeading: document.getElementById("auth-heading"),
    authSubheading: document.getElementById("auth-subheading"),
    authForm: document.getElementById("auth-form"),
    authSubmit: document.getElementById("auth-submit"),
    authToggleMode: document.getElementById("auth-toggle-mode"),
    authToggleText: document.getElementById("auth-toggle-text"),
    formError: document.getElementById("form-error"),
    formSuccess: document.getElementById("form-success"),

    fieldName: document.getElementById("field-name"),
    fieldIdentifier: document.getElementById("field-identifier"),
    fieldIdentifierLabel: document.getElementById("field-identifier-label"),
    fieldEmail: document.getElementById("field-email"),
    fieldPassword: document.getElementById("field-password"),
    fieldConfirmPassword: document.getElementById("field-confirm-password"),
    fieldPhone: document.getElementById("field-phone"),
    fieldDepartment: document.getElementById("field-department"),
    fieldSpecialty: document.getElementById("field-specialty"),
    authConsentWrap: document.getElementById("auth-consent-wrap"),
    fieldConsent: document.getElementById("field-consent"),
    errConsent: document.getElementById("err-consent"),
    linkTermsConditions: document.getElementById("link-terms-conditions"),
    pdfViewerModal: document.getElementById("pdf-viewer-modal"),
    btnClosePdfModal: document.getElementById("btn-close-pdf-modal"),
    btnClosePdfModalFooter: document.getElementById("btn-close-pdf-modal-footer"),

    headerSosBtn: document.getElementById("btn-header-sos"),
    avatarFileInput: document.getElementById("avatar-file-input"),
    sosConfirmModal: document.getElementById("sos-confirm-modal"),
    btnCloseSosModal: document.getElementById("btn-close-sos-modal"),
    btnCancelSos: document.getElementById("btn-cancel-sos"),
    btnConfirmSos: document.getElementById("btn-confirm-sos"),
    sosSuccessModal: document.getElementById("sos-success-modal"),
    btnCloseSosSuccess: document.getElementById("btn-close-sos-success"),
    btnDoneSosSuccess: document.getElementById("btn-done-sos-success"),
    sosAppointmentSummary: document.getElementById("sos-appointment-summary"),
    doctorSosAlertBanner: document.getElementById("doctor-sos-alert-banner"),
    doctorSosAlertMsg: document.getElementById("doctor-sos-alert-msg"),
    btnViewSosAppointments: document.getElementById("btn-view-sos-appointments"),
    viewMyDoctors: document.getElementById("view-my-doctors"),
    myDoctorsBack: document.getElementById("my-doctors-back"),
    myDoctorsError: document.getElementById("my-doctors-error"),
    myDoctorsList: document.getElementById("my-doctors-list"),
  };

  // ---------- Sidebar / shell config ----------
  const SIDEBAR_ICONS = {
    dashboard: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    "symptom-check": '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><rect x="5" y="6" width="14" height="15" rx="2"/><path d="M9 13l2 2 4-4"/>',
    reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
    appointments: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    doctor: '<path d="M12 2a4 4 0 0 1 4 4v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z"/><path d="M12 12v6m-3-3h6"/>',
    profile: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    diagnosis: '<path d="M11 2v6a2 2 0 0 0 2 2h6"/><path d="M20 12v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9l5 5"/><path d="M9.5 14.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0"/>',
  };

  // label is a fallback string; data-i18n key (set below) keeps it in sync
  // with the language selector without re-rendering the sidebar.
  const SIDEBAR_ITEMS_BY_ROLE = {
    patient: [
      { key: "dashboard", label: "Home", icon: "dashboard", i18n: "nav_home" },
      { key: "chat", label: "Symptom Check & Book Appointment", icon: "symptom-check", i18n: "nav_symptom_check" },
      { key: "reports", label: "Case Sheet", icon: "reports", i18n: "nav_case_sheet" },
      { key: "my_doctors", label: "My Doctor", icon: "doctor", i18n: "nav_my_doctor" },
      {
        key: "diagnosis", label: "Diagnosis", icon: "diagnosis", i18n: "nav_diagnosis", group: true,
        children: [
          { key: "diagnosis:previous", label: "Previous Diagnosis", i18n: "nav_previous_diagnosis" },
          { key: "diagnosis:current", label: "Current Diagnosis", i18n: "nav_current_diagnosis" },
          { key: "diagnosis:dietary", label: "Dietary", i18n: "nav_dietary" },
        ],
      },
      { key: "profile", label: "Profile", icon: "profile", i18n: "nav_profile" },
    ],
    // Doctor's "Appointments" is a separate, read-only, department-wide view
    // (view-doctor-appointments) — NOT the patient's self-booking form.
    // Doctor sidebar/dashboard is intentionally untouched by the patient redesign.
    doctor: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "doctor_appointments", label: "Appointments", icon: "appointments" },
      { key: "profile", label: "Profile", icon: "profile" },
    ],
  };

  const SHELL_VIEWS = {
    dashboard: els.viewDashboard,
    diagnosis: els.viewDiagnosis,
    profile: els.viewProfile,
    chat: els.viewChat,
    appointments: els.viewAppointments,
    reports: els.viewReports,
    doctor_appointments: els.viewDoctorAppointments,
    my_doctors: els.viewMyDoctors,
  };

  // ---------- View switching ----------
  // Two independent switchers: auth views (role-select/login, pre-login) and
  // shell views (dashboard/profile/chat/appointments/reports, post-login).
  // enterAuthMode()/enterShellMode() toggle which top-level region is visible.
  function enterAuthMode() {
    els.appShell.classList.add("hidden");
    els.mainContent.classList.remove("hidden");
    els.hamburgerBtn.classList.add("hidden");
  }

  function enterShellMode() {
    els.mainContent.classList.add("hidden");
    els.appShell.classList.remove("hidden");
    els.hamburgerBtn.classList.remove("hidden");
  }

  function showAuthView(view) {
    els.viewLanding.classList.add("hidden");
    els.viewAuth.classList.add("hidden");
    view.classList.remove("hidden");
  }

  // Sticky header shows "Login"/"Get Started" only on the pre-login landing page.
  function setHeaderLandingNav(visible) {
    els.headerLoginBtn.classList.toggle("hidden", !visible);
    els.headerGetStartedBtn.classList.toggle("hidden", !visible);
  }

  function closeSidebarDrawer() {
    els.sidebar.classList.remove("open");
    els.sidebarBackdrop.classList.add("hidden");
  }

  function openSidebarDrawer() {
    els.sidebar.classList.add("open");
    els.sidebarBackdrop.classList.remove("hidden");
  }

  function setActiveSidebarItem(key) {
    document.querySelectorAll(".sidebar-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === key);
    });
  }

  // 150-300ms fade/slide on every shell-view switch (see .view-transition-in
  // in css/dashboard.css). `activeKey` lets a sub-page (e.g. a Diagnosis tab)
  // highlight a different sidebar item than the shell-view key itself.
  function showShellView(key, activeKey) {
    Object.values(SHELL_VIEWS).forEach((v) => v.classList.add("hidden"));
    const target = SHELL_VIEWS[key] || SHELL_VIEWS.dashboard;
    target.classList.remove("hidden");
    target.classList.remove("view-transition-in");
    void target.offsetWidth; // restart the CSS animation on repeat navigations
    target.classList.add("view-transition-in");
    setActiveSidebarItem(activeKey || key);
    closeSidebarDrawer();
  }

  function openDiagnosis(tab) {
    showShellView("diagnosis", `diagnosis:${tab}`);
    const groupToggle = els.sidebarNav.querySelector('[data-key="diagnosis"]');
    const groupWrap = groupToggle && groupToggle.closest(".sidebar-group");
    if (groupWrap) groupWrap.classList.add("open");
    window.CareCrewDashboard.showDiagnosisTab(tab);
  }

  function renderSidebar(role) {
    const items = SIDEBAR_ITEMS_BY_ROLE[role] || SIDEBAR_ITEMS_BY_ROLE.patient;
    els.sidebarNav.innerHTML = "";
    items.forEach((item) => {
      if (item.group) {
        const wrap = document.createElement("div");
        wrap.className = "sidebar-group";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "sidebar-item sidebar-group-toggle";
        toggleBtn.dataset.key = item.key;
        toggleBtn.innerHTML =
          `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SIDEBAR_ICONS[item.icon]}</svg>` +
          `<span data-i18n="${item.i18n}">${item.label}</span>` +
          `<svg class="sidebar-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
        toggleBtn.addEventListener("click", () => wrap.classList.toggle("open"));

        const subnav = document.createElement("div");
        subnav.className = "sidebar-subnav";
        const subnavInner = document.createElement("div");
        subnavInner.className = "sidebar-subnav-inner";
        item.children.forEach((child) => {
          const childBtn = document.createElement("button");
          childBtn.type = "button";
          childBtn.className = "sidebar-item sidebar-subitem";
          childBtn.dataset.key = child.key;
          childBtn.setAttribute("data-i18n", child.i18n);
          childBtn.textContent = child.label;
          childBtn.addEventListener("click", () => openDiagnosis(child.key.split(":")[1]));
          subnavInner.appendChild(childBtn);
        });
        subnav.appendChild(subnavInner);

        wrap.appendChild(toggleBtn);
        wrap.appendChild(subnav);
        els.sidebarNav.appendChild(wrap);
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sidebar-item";
      btn.dataset.key = item.key;
      const labelHtml = item.i18n ? `<span data-i18n="${item.i18n}">${item.label}</span>` : `<span>${item.label}</span>`;
      btn.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SIDEBAR_ICONS[item.icon]}</svg>${labelHtml}`;
      btn.addEventListener("click", () => {
        if (item.key === "chat") {
          showShellView("chat");
          window.CareCrewChat.resumeOrStart();
        } else if (item.key === "appointments") {
          openAppointments();
        } else if (item.key === "reports") {
          openReports();
        } else if (item.key === "doctor_appointments") {
          openDoctorAppointments();
        } else if (item.key === "my_doctors") {
          openMyDoctors();
        } else if (item.key === "dashboard") {
          goToDashboardHome();
        } else {
          showShellView(item.key);
        }
      });
      els.sidebarNav.appendChild(btn);
    });
    if (window.CareCrewI18n) window.CareCrewI18n.applyToDOM();
  }

  function greeting() {
    const hour = new Date().getHours();
    const key = hour < 12 ? "greeting_morning" : hour < 17 ? "greeting_afternoon" : "greeting_evening";
    return window.CareCrewI18n ? window.CareCrewI18n.t(key) : "Hello";
  }

  function renderSidebarProfile(user) {
    els.sidebarProfile.classList.remove("hidden");
    setAvatar(els.sidebarProfileAvatar, user);
    els.sidebarProfileName.textContent = user.name;
    els.sidebarProfileRole.textContent = user.role === "doctor" ? "Doctor" : "Patient";
    els.sidebarProfileRole.setAttribute("data-i18n", user.role === "doctor" ? "role_doctor" : "role_patient");
    if (window.CareCrewI18n) window.CareCrewI18n.applyToDOM();
  }

  function showLanding() {
    enterAuthMode();
    showAuthView(els.viewLanding);
    els.userChip.classList.add("hidden");
    if (els.headerSosBtn) els.headerSosBtn.classList.add("hidden");
    els.mainContent.classList.add("main-content--landing");
    setHeaderLandingNav(true);
  }

  // Replaces the old two-step "pick a role card, then see the form" flow —
  // role is now a segmented toggle inside a single split-screen auth view.
  function showAuth(role, mode) {
    currentRole = role || "patient";
    authMode = mode || "login";
    els.formError.classList.add("hidden");
    els.formSuccess.classList.add("hidden");
    clearFieldErrors();
    els.authForm.reset();
    if (els.fieldConsent) els.fieldConsent.checked = false;
    syncAuthModeUI();
    enterAuthMode();
    showAuthView(els.viewAuth);
    els.userChip.classList.add("hidden");
    if (els.headerSosBtn) els.headerSosBtn.classList.add("hidden");
    els.mainContent.classList.remove("main-content--landing");
    setHeaderLandingNav(false);
  }

  function setRoleToggleUI(role) {
    els.rolePatientBtn.classList.toggle("active", role === "patient");
    els.rolePatientBtn.setAttribute("aria-selected", String(role === "patient"));
    els.roleDoctorBtn.classList.toggle("active", role === "doctor");
    els.roleDoctorBtn.setAttribute("aria-selected", String(role === "doctor"));
  }

  function syncAuthModeUI() {
    const i18n = window.CareCrewI18n;
    const isRegister = authMode === "register";
    const isDoctor = currentRole === "doctor";
    const isPatientRegister = isRegister && !isDoctor;

    setRoleToggleUI(currentRole);

    els.authHeading.setAttribute("data-i18n", isRegister ? "welcome_register" : "welcome_login");
    els.authSubheading.setAttribute("data-i18n", isRegister ? "subtitle_register" : "subtitle_login");
    els.authSubmit.setAttribute("data-i18n", isRegister ? "btn_register" : "btn_login");
    els.authToggleText.setAttribute("data-i18n", isRegister ? "toggle_to_login_text" : "toggle_to_register_text");
    els.authToggleMode.setAttribute("data-i18n", isRegister ? "toggle_to_login_link" : "toggle_to_register_link");
    els.fieldIdentifierLabel.setAttribute("data-i18n", isDoctor ? "label_doctor_id" : "label_abha");
    els.fieldIdentifier.setAttribute("data-i18n-placeholder", isDoctor ? "placeholder_doctor_id" : "placeholder_abha");
    els.fieldIdentifier.autocomplete = isRegister ? "off" : "username";

    document.querySelectorAll(".register-only").forEach((el) => {
      el.classList.toggle("hidden", !isRegister);
    });
    document.querySelectorAll(".doctor-only").forEach((el) => {
      el.classList.toggle("hidden", !isRegister || !isDoctor);
    });

    if (els.authConsentWrap) {
      els.authConsentWrap.classList.toggle("hidden", !isPatientRegister);
    }
    if (isPatientRegister) {
      els.authSubmit.disabled = !els.fieldConsent.checked;
    } else {
      els.authSubmit.disabled = false;
    }

    els.fieldName.required = isRegister;
    els.fieldConfirmPassword.required = isRegister;

    if (i18n) i18n.applyToDOM();
  }

  // ---------- Auth form validation ----------
  const FIELD_ERROR_IDS = {
    name: "err-name",
    identifier: "err-identifier",
    email: "err-email",
    password: "err-password",
    "confirm-password": "err-confirm-password",
    consent: "err-consent",
  };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ABHA_RE = /^\d{14}$/;

  function validateIdentifierRealtime(eventType) {
    if (currentRole === "doctor") return;
    const val = els.fieldIdentifier.value.trim();
    const i18n = window.CareCrewI18n;
    if (!val) {
      if (eventType === "blur") {
        setFieldError("identifier", i18n.t("err_abha_required"));
      } else {
        const errEl = document.getElementById(FIELD_ERROR_IDS.identifier);
        if (errEl) errEl.textContent = "";
        const f = els.fieldIdentifier.closest(".field");
        if (f) f.classList.remove("has-error");
      }
      return;
    }
    // Reject any input that has non-digits or exceeds 14 digits immediately on input
    if (!/^\d+$/.test(val) || val.length > 14) {
      setFieldError("identifier", i18n.t("err_abha_invalid"));
    } else if (val.length === 14) {
      // Exactly 14 digits
      const errEl = document.getElementById(FIELD_ERROR_IDS.identifier);
      if (errEl) errEl.textContent = "";
      const f = els.fieldIdentifier.closest(".field");
      if (f) f.classList.remove("has-error");
    } else if (eventType === "blur") {
      // Under 14 digits on blur
      setFieldError("identifier", i18n.t("err_abha_invalid"));
    }
  }

  function clearFieldErrors() {
    Object.values(FIELD_ERROR_IDS).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });
    document.querySelectorAll(".field.has-error").forEach((f) => f.classList.remove("has-error"));
  }

  function setFieldError(fieldKey, message) {
    const errEl = document.getElementById(FIELD_ERROR_IDS[fieldKey]);
    if (errEl) errEl.textContent = message;
    const input = errEl && errEl.closest(".field");
    if (input) input.classList.add("has-error");
  }

  // Returns true if valid; otherwise fills in inline field errors and returns false.
  function validateForm() {
    const i18n = window.CareCrewI18n;
    clearFieldErrors();
    let valid = true;

    const isRegister = authMode === "register";
    const isDoctor = currentRole === "doctor";
    const identifier = els.fieldIdentifier.value.trim();

    if (isRegister && !els.fieldName.value.trim()) {
      setFieldError("name", i18n.t("err_name_required"));
      valid = false;
    }

    if (!identifier) {
      setFieldError("identifier", i18n.t(isDoctor ? "err_doctor_id_required" : "err_abha_required"));
      valid = false;
    } else if (!isDoctor && !ABHA_RE.test(identifier)) {
      setFieldError("identifier", i18n.t("err_abha_invalid"));
      valid = false;
    }

    if (isRegister && els.fieldEmail.value.trim() && !EMAIL_RE.test(els.fieldEmail.value.trim())) {
      setFieldError("email", i18n.t("err_email_invalid"));
      valid = false;
    }

    if (!els.fieldPassword.value) {
      setFieldError("password", i18n.t("err_password_required"));
      valid = false;
    } else if (isRegister && els.fieldPassword.value.length < 6) {
      setFieldError("password", i18n.t("err_password_length"));
      valid = false;
    }

    if (isRegister && els.fieldConfirmPassword.value !== els.fieldPassword.value) {
      setFieldError("confirm-password", i18n.t("err_confirm_mismatch"));
      valid = false;
    }

    if (isRegister && !isDoctor && (!els.fieldConsent || !els.fieldConsent.checked)) {
      setFieldError("consent", i18n.t("err_consent_required"));
      valid = false;
    }

    return valid;
  }

  // Network-level failures (server unreachable) throw a raw TypeError from
  // fetch() itself, distinct from the app's own thrown Error(message) for a
  // handled API/HTTP error — give the first a friendlier, translated message.
  function describeAuthError(err) {
    const i18n = window.CareCrewI18n;
    if (err instanceof TypeError) {
      return i18n.t("err_network");
    }
    return i18n.translateBackendError(err.message) || i18n.t("err_generic");
  }

  // ---------- Splash sequence ----------
  function runSplash() {
    els.app.classList.remove("hidden");
    els.headerLogo.style.opacity = "0";

    requestAnimationFrame(() => {
      els.splashLogo.classList.add("forming");
    });

    setTimeout(() => {
      const target = els.headerLogo.getBoundingClientRect();
      const current = els.splashLogo.getBoundingClientRect();
      const scale = target.width / current.width;
      const dx = target.left + target.width / 2 - (current.left + current.width / 2);
      const dy = target.top + target.height / 2 - (current.top + current.height / 2);

      els.splashLogo.style.setProperty("--dx", `${dx}px`);
      els.splashLogo.style.setProperty("--dy", `${dy}px`);
      els.splashLogo.style.setProperty("--scale", scale);
      els.splashLogo.classList.add("moving");
      els.splash.classList.add("fading");
    }, 1700);

    els.splash.addEventListener("transitionend", function handler(e) {
      if (e.propertyName === "opacity" && els.splash.classList.contains("fading")) {
        els.splash.classList.add("hidden");
        els.headerLogo.style.opacity = "1";
        els.splash.removeEventListener("transitionend", handler);
      }
    });
  }

  // ---------- Session ----------
  function saveSession(token, user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // Shared with chat.js (and any other module) so the auth token/user don't
  // need their own copy of SESSION_KEY.
  window.CareCrewSession = {
    getToken() {
      const s = loadSession();
      return s ? s.token : null;
    },
    getUser() {
      const s = loadSession();
      return s ? s.user : null;
    },
  };

  function initials(name) {
    return (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      return iso;
    }
  }

  function setAvatar(avatarEl, user) {
    avatarEl.innerHTML = "";
    if (user && user.photo_url) {
      const img = document.createElement("img");
      let src = user.photo_url;
      if (src && src.startsWith("/") && !src.startsWith("//")) {
        const base = window.CARECREW_API_BASE || "http://localhost:8000";
        src = `${base}${src}`;
      }
      img.src = src;
      img.alt = (user && user.name) || "User";
      img.className = "avatar";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "50%";
      img.style.objectFit = "cover";
      avatarEl.appendChild(img);
    } else {
      avatarEl.textContent = initials((user && user.name) || "");
    }
  }

  // Builds one ID card (used for both the compact Dashboard card and the
  // full Profile card — same fields, DOM-built so user-supplied text
  // (name/email/etc.) is never interpolated as HTML).
  function renderIdCard(container, user) {
    const isDoctor = user.role === "doctor";
    container.innerHTML = "";
    container.className = `id-card-wrap ${isDoctor ? "neumorphic-scope" : "patient-scope"}`;

    const card = document.createElement("div");
    card.className = isDoctor ? "neu-card id-card" : "flat-card id-card";

    const avatar = document.createElement("div");
    avatar.className = "avatar avatar-clickable";
    avatar.title = "Click to change photo";
    avatar.style.cursor = "pointer";
    avatar.addEventListener("click", () => {
      if (els.avatarFileInput) els.avatarFileInput.click();
    });
    card.appendChild(avatar);

    const h2 = document.createElement("h2");
    h2.textContent = user.name;
    card.appendChild(h2);

    const badge = document.createElement("span");
    badge.className = "role-badge";
    badge.textContent = isDoctor ? "Doctor" : "Patient";
    card.appendChild(badge);

    const dl = document.createElement("dl");
    dl.className = "id-fields";
    const fields = isDoctor
      ? [
          ["Doctor ID", user.doctor_id || "—"],
          ["Department", user.department || "—"],
          ["Specialty", user.specialty || "—"],
          ["Email", user.email || "—"],
          ["Phone", user.phone || "—"],
          ["Member since", formatDate(user.created_at)],
        ]
      : [
          ["ABHA ID", user.abha_id || "—"],
          ["Email", user.email || "—"],
          ["Phone", user.phone || "—"],
          ["Member since", formatDate(user.created_at)],
        ];
    fields.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "field-row";
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = String(value);
      row.appendChild(dt);
      row.appendChild(dd);
      dl.appendChild(row);
    });
    card.appendChild(dl);
    container.appendChild(card);
    setAvatar(avatar, user);
  }

  function showDashboard(user, token) {
    enterShellMode();
    els.mainContent.classList.remove("main-content--landing");
    setHeaderLandingNav(false);
    els.userChip.classList.remove("hidden");
    els.userChipName.textContent = user.name;
    setAvatar(els.userChipAvatar, user);

    renderSidebar(user.role);
    renderSidebarProfile(user);
    renderIdCard(els.profileIdCard, user);

    const isDoctor = user.role === "doctor";

    // SOS button in header is for patients only; doctors see notification alert
    if (els.headerSosBtn) els.headerSosBtn.classList.toggle("hidden", isDoctor);
    if (isDoctor) {
      loadDoctorNotifications(token);
    } else {
      if (els.doctorSosAlertBanner) els.doctorSosAlertBanner.classList.add("hidden");
    }

    // Doctor dashboard is untouched: still gets the full ID card up top.
    // Patient home replaces it with the redesigned overview below.
    els.dashboardIdCard.classList.toggle("hidden", !isDoctor);
    if (isDoctor) renderIdCard(els.dashboardIdCard, user);

    els.dashboardWelcome.textContent = isDoctor
      ? `Welcome back, Dr. ${user.name}`
      : `${greeting()}, ${user.name} 👋`;
    if (!isDoctor && els.dashboardSubtitle) {
      els.dashboardSubtitle.textContent = window.CareCrewI18n
        ? window.CareCrewI18n.t("dashboard_subtitle_patient")
        : "Here's your health overview.";
      els.dashboardSubtitle.setAttribute("data-i18n", "dashboard_subtitle_patient");
    }

    els.dashboardPatientHome.classList.toggle("hidden", isDoctor);
    els.dashboardDoctorActions.classList.toggle("hidden", !isDoctor);

    if (!isDoctor) {
      window.CareCrewDashboard.renderHome(token);
    }

    showShellView("dashboard");
  }

  // Every "back to dashboard" / "Home" action goes through this — not just
  // showShellView("dashboard") — so a just-booked appointment or a
  // just-completed Symptom Check shows up immediately on return, instead of
  // only right after login (renderHome() is otherwise only called once).
  function goToDashboardHome() {
    showShellView("dashboard");
    const user = window.CareCrewSession.getUser();
    if (user && user.role === "patient") {
      window.CareCrewDashboard.renderHome(window.CareCrewSession.getToken());
    }
  }

  // ---------- Navigation actions (driven by chat.js's action buttons too) ----------
  window.CareCrewNav = {
    goTo(target, opts) {
      opts = opts || {};
      if (target === "appointments") {
        const user = window.CareCrewSession.getUser();
        if (user && user.role === "patient") {
          showShellView("chat");
          if (window.CareCrewChat && window.CareCrewChat.isWorkflowComplete && window.CareCrewChat.isWorkflowComplete()) {
            window.CareCrewChat.goToStep(3);
          } else {
            window.CareCrewChat.resumeOrStart();
          }
        } else {
          openAppointments(opts.department);
        }
      } else if (target === "reports") {
        openReports();
      } else if (target === "my_doctors") {
        openMyDoctors();
      } else if (target === "doctor_appointments") {
        openDoctorAppointments();
      } else if (target === "chat") {
        showShellView("chat");
        window.CareCrewChat.resumeOrStart();
      } else if (target === "profile") {
        showShellView("profile");
      } else {
        // Unknown target — fail safe back to the dashboard rather than a blank screen.
        goToDashboardHome();
      }
    },
  };

  // ---------- Appointments ----------
  function openAppointments(suggestedDepartment) {
    els.appointmentsError.classList.add("hidden");
    if (suggestedDepartment) {
      const options = Array.from(els.apptDepartment.options).map((o) => o.value);
      if (options.includes(suggestedDepartment)) {
        els.apptDepartment.value = suggestedDepartment;
      }
    }
    showShellView("appointments");
    loadAppointments();
  }

  function renderAppointments(list) {
    els.appointmentsList.innerHTML = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "list-empty";
      p.textContent = "No appointments requested yet.";
      els.appointmentsList.appendChild(p);
      return;
    }
    list.forEach((a) => {
      const row = document.createElement("div");
      row.className = "list-item";

      const main = document.createElement("div");
      main.className = "list-item-main";
      const title = document.createElement("span");
      title.className = "list-item-title";
      title.textContent = a.department;
      const meta = document.createElement("span");
      meta.className = "list-item-meta";
      meta.textContent = `${a.preferred_date || "No date given"} · ${a.status}${a.note ? " · " + a.note : ""}`;
      main.appendChild(title);
      main.appendChild(meta);
      row.appendChild(main);

      if (a.urgent) {
        const badge = document.createElement("span");
        badge.className = "role-badge urgent";
        badge.textContent = "Urgent";
        row.appendChild(badge);
      }

      els.appointmentsList.appendChild(row);
    });
  }

  async function loadAppointments() {
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.listAppointments(token);
      renderAppointments(res.data || []);
    } catch (err) {
      els.appointmentsError.textContent = err.message;
      els.appointmentsError.classList.remove("hidden");
    }
  }

  // ---------- Reports ----------
  function openReports() {
    els.reportsError.classList.add("hidden");
    els.reportDetail.classList.add("hidden");
    els.reportsListWrap.classList.remove("hidden");
    showShellView("reports");
    loadReports();
  }

  function renderReports(list) {
    els.reportsList.innerHTML = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "list-empty";
      p.textContent = "No completed case sessions yet — finish a symptom check to see it here.";
      els.reportsList.appendChild(p);
      return;
    }
    list.forEach((report) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.style.cursor = "pointer";

      const main = document.createElement("div");
      main.className = "list-item-main";
      const title = document.createElement("span");
      title.className = "list-item-title";
      title.textContent = (report.chief_complaint && report.chief_complaint.value) || report.condition_key || "Case report";
      const meta = document.createElement("span");
      meta.className = "list-item-meta";
      meta.textContent = `${formatDate(report.completed_at)} · ${report.department || "General Medicine"}`;
      main.appendChild(title);
      main.appendChild(meta);
      row.appendChild(main);

      if (report.is_urgent) {
        const badge = document.createElement("span");
        badge.className = "role-badge urgent";
        badge.textContent = "Urgent";
        row.appendChild(badge);
      }

      row.addEventListener("click", () => showReportDetail(report));
      els.reportsList.appendChild(row);
    });
  }

  async function loadReports() {
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.listReports(token);
      renderReports(res.data || []);
    } catch (err) {
      els.reportsError.textContent = err.message;
      els.reportsError.classList.remove("hidden");
    }
  }

  function showReportDetail(report) {
    els.reportsListWrap.classList.add("hidden");
    els.reportDetail.classList.remove("hidden");
    els.reportSummaryBody.classList.add("hidden");
    els.reportSummaryBody.textContent = "";
    window.CareCrewChat.renderCaseSheet(els.reportDetailBody, report);
    els.reportDetail.dataset.sessionId = report.session_id;
  }

  async function loadReportSummary(audience) {
    const sessionId = els.reportDetail.dataset.sessionId;
    if (!sessionId) return;
    els.reportSummaryBody.classList.remove("hidden");
    els.reportSummaryBody.textContent = "Generating summary...";
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.getReportSummary(sessionId, audience, token);
      els.reportSummaryBody.textContent = res.data.summary;
    } catch (err) {
      els.reportSummaryBody.textContent = `Could not generate summary: ${err.message}`;
    }
  }

  // ---------- Doctor appointments (department-wide, read-only) ----------
  function openDoctorAppointments() {
    els.doctorAppointmentsError.classList.add("hidden");
    showShellView("doctor_appointments");
    loadDoctorAppointments();
  }

  function renderDoctorAppointments(list) {
    els.doctorAppointmentsList.innerHTML = "";
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "list-empty";
      p.textContent = "No appointments requested for your department yet.";
      els.doctorAppointmentsList.appendChild(p);
      return;
    }
    list.forEach((a) => {
      const row = document.createElement("div");
      row.className = "list-item";
      if (a.is_sos || a.type === "sos") {
        row.classList.add("list-item--sos");
      }

      const main = document.createElement("div");
      main.className = "list-item-main";
      const title = document.createElement("span");
      title.className = "list-item-title";
      title.textContent = a.department;
      const meta = document.createElement("span");
      meta.className = "list-item-meta";
      const patText = a.patient_name ? `Patient: ${a.patient_name} · ` : "";
      meta.textContent = `${patText}${a.preferred_date || "Immediate"} · ${a.status}${a.note ? " · " + a.note : ""}`;
      main.appendChild(title);
      main.appendChild(meta);
      row.appendChild(main);

      if (a.is_sos || a.type === "sos") {
        const badge = document.createElement("span");
        badge.className = "urgent-sos-tag";
        badge.textContent = "EMERGENCY SOS";
        row.appendChild(badge);
      } else if (a.urgent) {
        const badge = document.createElement("span");
        badge.className = "role-badge urgent";
        badge.textContent = "Urgent";
        row.appendChild(badge);
      }

      els.doctorAppointmentsList.appendChild(row);
    });
  }

  async function loadDoctorAppointments() {
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.listDoctorAppointments(token);
      renderDoctorAppointments(res.data || []);
    } catch (err) {
      els.doctorAppointmentsError.textContent = err.message;
      els.doctorAppointmentsError.classList.remove("hidden");
    }
  }

  // ---------- Doctor Notifications (SOS alerts) ----------
  async function loadDoctorNotifications(token) {
    if (!els.doctorSosAlertBanner) return;
    try {
      const res = await CareCrewAPI.listDoctorNotifications(token);
      const data = res.data || {};
      const count = data.urgent_count || (data.notifications && data.notifications.length) || 0;
      if (count > 0) {
        els.doctorSosAlertBanner.classList.remove("hidden");
        if (els.doctorSosAlertMsg) {
          els.doctorSosAlertMsg.textContent = `${count} Emergency SOS alert(s) reported by patients in your department.`;
        }
      } else {
        els.doctorSosAlertBanner.classList.add("hidden");
      }
    } catch (err) {
      els.doctorSosAlertBanner.classList.add("hidden");
    }
  }

  // ---------- My Doctors ----------
  function openMyDoctors() {
    els.myDoctorsError.classList.add("hidden");
    showShellView("my_doctors");
    loadMyDoctors();
  }

  function renderMyDoctors(list) {
    els.myDoctorsList.innerHTML = "";
    if (!list || !list.length) {
      const p = document.createElement("p");
      p.className = "list-empty";
      p.setAttribute("data-i18n", "my_doctors_empty");
      p.textContent = window.CareCrewI18n ? window.CareCrewI18n.t("my_doctors_empty") : "No assigned doctors found.";
      els.myDoctorsList.appendChild(p);
      return;
    }

    list.forEach((doc) => {
      const card = document.createElement("div");
      card.className = "doctor-assigned-card";

      const header = document.createElement("div");
      header.className = "doctor-assigned-header";

      const avatar = document.createElement("div");
      avatar.className = "doctor-assigned-avatar";
      setAvatar(avatar, { name: doc.name, photo_url: doc.photo_url, role: "doctor" });

      const info = document.createElement("div");
      info.className = "doctor-assigned-info";
      const name = document.createElement("h3");
      name.className = "doctor-assigned-name";
      name.textContent = `Dr. ${doc.name}`;

      const spec = document.createElement("p");
      spec.className = "doctor-assigned-spec";
      spec.textContent = `${doc.specialisation || "Physician"} · ${doc.department || "General Medicine"}`;

      info.appendChild(name);
      info.appendChild(spec);
      header.appendChild(avatar);
      header.appendChild(info);
      card.appendChild(header);

      const meta = document.createElement("div");
      meta.className = "doctor-assigned-meta";

      const hosp = document.createElement("div");
      hosp.className = "doctor-assigned-meta-row";
      const hospLabel = document.createElement("span");
      hospLabel.className = "meta-label";
      hospLabel.textContent = (window.CareCrewI18n ? window.CareCrewI18n.t("my_doctors_hospital") : "Hospital") + ": ";
      const hospVal = document.createElement("span");
      hospVal.className = "meta-val";
      hospVal.textContent = doc.hospital_name || "Care Crew Central Hospital";
      hosp.appendChild(hospLabel);
      hosp.appendChild(hospVal);
      meta.appendChild(hosp);

      const contactNum = doc.hospital_contact || doc.phone;
      if (contactNum) {
        const contact = document.createElement("div");
        contact.className = "doctor-assigned-meta-row";
        const contactLabel = document.createElement("span");
        contactLabel.className = "meta-label";
        contactLabel.textContent = (window.CareCrewI18n ? window.CareCrewI18n.t("my_doctors_contact") : "Contact") + ": ";
        const contactVal = document.createElement("a");
        contactVal.href = `tel:${contactNum}`;
        contactVal.className = "meta-val doctor-phone-link";
        contactVal.textContent = contactNum;
        contact.appendChild(contactLabel);
        contact.appendChild(contactVal);
        meta.appendChild(contact);
      }

      card.appendChild(meta);
      els.myDoctorsList.appendChild(card);
    });
  }

  async function loadMyDoctors() {
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.listMyDoctors(token);
      renderMyDoctors(res.data || []);
    } catch (err) {
      els.myDoctorsError.textContent = err.message;
      els.myDoctorsError.classList.remove("hidden");
    }
  }

  // ---------- Events ----------
  els.authBackHome.addEventListener("click", showLanding);

  els.rolePatientBtn.addEventListener("click", () => {
    if (currentRole === "patient") return;
    currentRole = "patient";
    els.formError.classList.add("hidden");
    clearFieldErrors();
    syncAuthModeUI();
  });
  els.roleDoctorBtn.addEventListener("click", () => {
    if (currentRole === "doctor") return;
    currentRole = "doctor";
    els.formError.classList.add("hidden");
    clearFieldErrors();
    syncAuthModeUI();
  });

  // ---------- Landing page CTAs (all funnel into the single split-screen auth view) ----------
  els.headerLoginBtn.addEventListener("click", () => showAuth("patient", "login"));
  els.headerGetStartedBtn.addEventListener("click", () => showAuth("patient", "register"));

  const heroGetStartedBtn = document.getElementById("hero-get-started");
  const heroHowItWorksBtn = document.getElementById("hero-how-it-works");
  const finalGetStartedBtn = document.getElementById("final-get-started");
  const footerLoginBtn = document.getElementById("footer-login");

  if (heroGetStartedBtn) heroGetStartedBtn.addEventListener("click", () => showAuth("patient", "register"));
  if (finalGetStartedBtn) finalGetStartedBtn.addEventListener("click", () => showAuth("patient", "register"));
  if (footerLoginBtn) footerLoginBtn.addEventListener("click", () => showAuth("patient", "login"));
  if (heroHowItWorksBtn) {
    heroHowItWorksBtn.addEventListener("click", () => {
      document.getElementById("how-it-works").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  els.authToggleMode.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    els.formError.classList.add("hidden");
    els.formSuccess.classList.add("hidden");
    clearFieldErrors();
    syncAuthModeUI();
  });

  document.querySelectorAll(".password-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁" : "🙈";
      btn.classList.toggle("is-visible", !showing);
      btn.setAttribute("data-i18n-aria-label", showing ? "show_password" : "hide_password");
      if (window.CareCrewI18n) window.CareCrewI18n.applyToDOM();
    });
  });

  els.authLangSelect.addEventListener("change", () => {
    window.CareCrewI18n.setLang(els.authLangSelect.value);
  });

  els.fieldIdentifier.addEventListener("input", () => validateIdentifierRealtime("input"));
  els.fieldIdentifier.addEventListener("blur", () => validateIdentifierRealtime("blur"));

  if (els.fieldConsent) {
    els.fieldConsent.addEventListener("change", () => {
      const errEl = document.getElementById(FIELD_ERROR_IDS.consent);
      if (errEl) errEl.textContent = "";
      const f = els.fieldConsent.closest(".field");
      if (f) f.classList.remove("has-error");

      if (authMode === "register" && currentRole === "patient") {
        els.authSubmit.disabled = !els.fieldConsent.checked;
      }
    });
  }

  function openPdfModal() {
    if (els.pdfViewerModal) {
      els.pdfViewerModal.classList.remove("hidden");
    }
  }

  function closePdfModal() {
    if (els.pdfViewerModal) {
      els.pdfViewerModal.classList.add("hidden");
    }
  }

  if (els.linkTermsConditions) {
    els.linkTermsConditions.addEventListener("click", (e) => {
      e.preventDefault();
      openPdfModal();
    });
  }
  if (els.btnClosePdfModal) {
    els.btnClosePdfModal.addEventListener("click", closePdfModal);
  }
  if (els.btnClosePdfModalFooter) {
    els.btnClosePdfModalFooter.addEventListener("click", closePdfModal);
  }
  if (els.pdfViewerModal) {
    els.pdfViewerModal.addEventListener("click", (e) => {
      if (e.target === els.pdfViewerModal) closePdfModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (els.pdfViewerModal && !els.pdfViewerModal.classList.contains("hidden")) {
        closePdfModal();
      }
      if (els.sosConfirmModal && !els.sosConfirmModal.classList.contains("hidden")) {
        closeSosConfirmModal();
      }
      if (els.sosSuccessModal && !els.sosSuccessModal.classList.contains("hidden")) {
        closeSosSuccessModal();
      }
    }
  });

  function syncThemeIcons() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const icon = isDark ? "☀️" : "🌙";
    if (els.authThemeToggle) els.authThemeToggle.textContent = icon;
  }

  els.themeToggle.addEventListener("click", () => {
    window.CareCrewTheme.toggleTheme();
    syncThemeIcons();
  });
  els.authThemeToggle.addEventListener("click", () => {
    window.CareCrewTheme.toggleTheme();
    syncThemeIcons();
  });

  els.hamburgerBtn.addEventListener("click", () => {
    if (els.sidebar.classList.contains("open")) closeSidebarDrawer();
    else openSidebarDrawer();
  });
  els.sidebarBackdrop.addEventListener("click", closeSidebarDrawer);

  els.sidebarProfile.addEventListener("click", () => showShellView("profile"));
  els.diagnosisBack.addEventListener("click", goToDashboardHome);
  document.querySelectorAll(".diagnosis-tab").forEach((btn) => {
    btn.addEventListener("click", () => openDiagnosis(btn.dataset.tab));
  });

  // Header language selector — same CareCrewI18n as the auth screens, kept
  // in sync with the auth panel's selector via the shared change event.
  els.headerLangSelect.addEventListener("change", () => {
    window.CareCrewI18n.setLang(els.headerLangSelect.value);
  });
  document.addEventListener("carecrew-lang-changed", (e) => {
    if (els.headerLangSelect) els.headerLangSelect.value = e.detail.lang;
    if (els.authLangSelect) els.authLangSelect.value = e.detail.lang;
  });

  els.startCaseBtn.addEventListener("click", () => {
    showShellView("chat");
    window.CareCrewChat.resumeOrStart();
  });

  els.chatBack.addEventListener("click", goToDashboardHome);

  if (els.goAppointmentsBtn) {
    els.goAppointmentsBtn.addEventListener("click", () => window.CareCrewNav.goTo("appointments"));
  }
  els.goReportsBtn.addEventListener("click", () => openReports());
  els.appointmentsBack.addEventListener("click", goToDashboardHome);
  els.reportsBack.addEventListener("click", goToDashboardHome);
  els.goDoctorAppointmentsBtn.addEventListener("click", () => openDoctorAppointments());
  els.doctorAppointmentsBack.addEventListener("click", goToDashboardHome);
  els.reportDetailBack.addEventListener("click", () => {
    els.reportDetail.classList.add("hidden");
    els.reportsListWrap.classList.remove("hidden");
  });
  els.reportSummaryPatientBtn.addEventListener("click", () => loadReportSummary("patient"));
  els.reportSummaryDoctorBtn.addEventListener("click", () => loadReportSummary("doctor"));

  const linkStartSymptom = document.getElementById("link-start-symptom-check");
  if (linkStartSymptom) {
    linkStartSymptom.addEventListener("click", () => {
      showShellView("chat");
      window.CareCrewChat.resumeOrStart();
    });
  }

  els.appointmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.appointmentsError.classList.add("hidden");
    els.apptSubmit.disabled = true;
    try {
      const token = window.CareCrewSession.getToken();
      const caseSheetId = (window.CareCrewChat && window.CareCrewChat.getSessionId) ? window.CareCrewChat.getSessionId() : null;
      const res = await CareCrewAPI.createAppointment(
        {
          department: els.apptDepartment.value,
          preferred_date: els.apptDate.value || null,
          note: els.apptNote.value.trim() || null,
          urgent: els.apptUrgent.checked,
          case_sheet_id: caseSheetId,
        },
        token
      );
      els.apptNote.value = "";
      els.apptUrgent.checked = false;
      await loadAppointments();

      if (window.CareCrewChat && window.CareCrewChat.showConfirmation) {
        window.CareCrewChat.showConfirmation(res.data || res);
      }
    } catch (err) {
      els.appointmentsError.textContent = err.message;
      els.appointmentsError.classList.remove("hidden");
    } finally {
      els.apptSubmit.disabled = false;
    }
  });

  // ---------- My Doctors Back ----------
  if (els.myDoctorsBack) {
    els.myDoctorsBack.addEventListener("click", goToDashboardHome);
  }

  // ---------- Doctor SOS Banner Action ----------
  if (els.btnViewSosAppointments) {
    els.btnViewSosAppointments.addEventListener("click", () => {
      openDoctorAppointments();
    });
  }

  // ---------- Emergency SOS Handlers ----------
  function closeSosConfirmModal() {
    if (els.sosConfirmModal) els.sosConfirmModal.classList.add("hidden");
  }

  function closeSosSuccessModal() {
    if (els.sosSuccessModal) els.sosSuccessModal.classList.add("hidden");
    goToDashboardHome();
  }

  if (els.headerSosBtn) {
    els.headerSosBtn.addEventListener("click", () => {
      if (els.sosConfirmModal) els.sosConfirmModal.classList.remove("hidden");
    });
  }

  if (els.btnCloseSosModal) els.btnCloseSosModal.addEventListener("click", closeSosConfirmModal);
  if (els.btnCancelSos) els.btnCancelSos.addEventListener("click", closeSosConfirmModal);
  if (els.sosConfirmModal) {
    els.sosConfirmModal.addEventListener("click", (e) => {
      if (e.target === els.sosConfirmModal) closeSosConfirmModal();
    });
  }

  if (els.btnConfirmSos) {
    els.btnConfirmSos.addEventListener("click", async () => {
      els.btnConfirmSos.disabled = true;
      els.btnConfirmSos.textContent = "...";
      try {
        const token = window.CareCrewSession.getToken();
        const res = await CareCrewAPI.triggerSOS(token);
        closeSosConfirmModal();

        const data = res.data || {};
        const appt = data.appointment || {};
        const doc = data.doctor || {};

        if (els.sosAppointmentSummary) {
          els.sosAppointmentSummary.innerHTML = "";
          const summaryList = document.createElement("div");
          summaryList.className = "sos-summary-details";

          const rows = [
            ["Appointment Ref", `#${appt.id || "SOS"}`],
            ["Status", (appt.status || "confirmed").toUpperCase()],
            ["Attending Doctor", doc.name ? `Dr. ${doc.name}` : (appt.doctor_name || "Emergency On-Duty Physician")],
            ["Department", doc.department || appt.department || "Emergency Medicine"],
            ["Emergency Helpline", data.emergency_helpline || "112"],
            ["Hospital Desk", data.hospital_contact || "+91-11-26588500"],
          ];

          rows.forEach(([k, v]) => {
            const item = document.createElement("div");
            item.className = "sos-summary-row";
            const dt = document.createElement("span");
            dt.className = "sos-summary-k";
            dt.textContent = k;
            const dd = document.createElement("span");
            dd.className = "sos-summary-v";
            dd.textContent = v;
            item.appendChild(dt);
            item.appendChild(dd);
            summaryList.appendChild(item);
          });
          els.sosAppointmentSummary.appendChild(summaryList);
        }

        if (els.sosSuccessModal) els.sosSuccessModal.classList.remove("hidden");
      } catch (err) {
        alert(err.message || "Failed to trigger SOS alert.");
      } finally {
        els.btnConfirmSos.disabled = false;
        els.btnConfirmSos.textContent = window.CareCrewI18n ? window.CareCrewI18n.t("btn_sos_confirm") : "Send SOS Immediately";
      }
    });
  }

  if (els.btnCloseSosSuccess) els.btnCloseSosSuccess.addEventListener("click", closeSosSuccessModal);
  if (els.btnDoneSosSuccess) els.btnDoneSosSuccess.addEventListener("click", closeSosSuccessModal);
  if (els.sosSuccessModal) {
    els.sosSuccessModal.addEventListener("click", (e) => {
      if (e.target === els.sosSuccessModal) closeSosSuccessModal();
    });
  }

  // ---------- Profile Picture Upload Handlers ----------
  if (els.userChipAvatar) {
    els.userChipAvatar.addEventListener("click", () => {
      if (els.avatarFileInput) els.avatarFileInput.click();
    });
  }

  if (els.avatarFileInput) {
    els.avatarFileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      e.target.value = "";

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const allowedExts = ["jpg", "jpeg", "png", "webp"];

      if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
        alert(window.CareCrewI18n ? window.CareCrewI18n.t("err_file_type") : "Only JPG, PNG, and WebP images are allowed.");
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(window.CareCrewI18n ? window.CareCrewI18n.t("err_file_size") : "File size must be under 5 MB.");
        return;
      }

      try {
        const token = window.CareCrewSession.getToken();
        const res = await CareCrewAPI.uploadProfilePicture(file, token);
        const updatedUser = (res.data && res.data.user) || res.data || res;
        if (updatedUser) {
          saveSession(token, updatedUser);
          setAvatar(els.userChipAvatar, updatedUser);
          setAvatar(els.sidebarProfileAvatar, updatedUser);
          renderIdCard(els.profileIdCard, updatedUser);
          if (updatedUser.role === "doctor") {
            renderIdCard(els.dashboardIdCard, updatedUser);
          }
        }
      } catch (err) {
        alert(err.message || "Failed to upload profile picture.");
      }
    });
  }

  els.logoutBtn.addEventListener("click", () => {
    clearSession();
    showAuth("patient", "login");
  });

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formError.classList.add("hidden");
    els.formSuccess.classList.add("hidden");

    if (!validateForm()) return;

    const i18n = window.CareCrewI18n;
    const isRegister = authMode === "register";
    const isDoctor = currentRole === "doctor";
    const identifier = els.fieldIdentifier.value.trim();

    els.authSubmit.disabled = true;
    els.authSubmit.classList.add("is-loading");
    els.authSubmit.textContent = i18n.t(isRegister ? "btn_register_loading" : "btn_login_loading");

    try {
      if (isRegister) {
        const payload = {
          name: els.fieldName.value.trim(),
          email: els.fieldEmail.value.trim() || null,
          password: els.fieldPassword.value,
          role: currentRole,
          phone: els.fieldPhone.value.trim() || null,
        };
        if (isDoctor) {
          payload.doctor_id = identifier;
          payload.department = els.fieldDepartment.value.trim() || null;
          payload.specialty = els.fieldSpecialty.value.trim() || null;
        } else {
          payload.abha_id = identifier;
          payload.consent = !!(els.fieldConsent && els.fieldConsent.checked);
        }

        await CareCrewAPI.register(payload);

        // Do NOT auto-login — show a success state and drop the user into
        // the login form (their identifier pre-filled) instead.
        els.formSuccess.textContent = `${i18n.t("register_success_title")} ${i18n.t("register_success_body")}`;
        els.formSuccess.classList.remove("hidden");
        authMode = "login";
        if (els.fieldConsent) els.fieldConsent.checked = false;
        syncAuthModeUI();
        els.fieldIdentifier.value = identifier;
      } else {
        const res = await CareCrewAPI.login({ identifier, password: els.fieldPassword.value });
        if (res.data.user.role !== currentRole) {
          throw new Error(i18n.t("err_wrong_role"));
        }
        saveSession(res.data.access_token, res.data.user);
        showDashboard(res.data.user, res.data.access_token);
      }
    } catch (err) {
      els.formError.textContent = describeAuthError(err);
      els.formError.classList.remove("hidden");
    } finally {
      els.authSubmit.classList.remove("is-loading");
      syncAuthModeUI();
    }
  });

  // ---------- Boot ----------
  async function boot() {
    window.CareCrewI18n.initLang();
    els.authLangSelect.value = window.CareCrewI18n.getLang();
    els.headerLangSelect.value = window.CareCrewI18n.getLang();
    window.CareCrewTheme.initTheme();
    syncThemeIcons();
    runSplash();

    const session = loadSession();
    if (session && session.token) {
      try {
        const res = await CareCrewAPI.me(session.token);
        saveSession(session.token, res.data);
        setTimeout(() => showDashboard(res.data, session.token), 1900);
        return;
      } catch (e) {
        clearSession();
      }
    }
    setTimeout(showLanding, 1900);
  }

  boot();
})();
