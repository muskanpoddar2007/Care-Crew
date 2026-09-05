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
    userChip: document.getElementById("user-chip"),
    userChipName: document.getElementById("user-chip-name"),
    logoutBtn: document.getElementById("logout-btn"),

    headerLoginBtn: document.getElementById("header-login-btn"),
    headerGetStartedBtn: document.getElementById("header-get-started-btn"),

    mainContent: document.getElementById("main-content"),
    viewLanding: document.getElementById("view-landing"),
    viewRoleSelect: document.getElementById("view-role-select"),
    viewLogin: document.getElementById("view-login"),

    appShell: document.getElementById("app-shell"),
    hamburgerBtn: document.getElementById("hamburger-btn"),
    sidebar: document.getElementById("sidebar"),
    sidebarNav: document.getElementById("sidebar-nav"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    aiBotFab: document.getElementById("ai-bot-fab"),

    viewDashboard: document.getElementById("view-dashboard"),
    viewProfile: document.getElementById("view-profile"),
    viewChat: document.getElementById("view-chat"),
    viewAppointments: document.getElementById("view-appointments"),
    viewReports: document.getElementById("view-reports"),

    dashboardWelcome: document.getElementById("dashboard-welcome"),
    dashboardIdCard: document.getElementById("dashboard-id-card"),
    dashboardPatientActions: document.getElementById("dashboard-patient-actions"),
    dashboardDoctorActions: document.getElementById("dashboard-doctor-actions"),
    profileIdCard: document.getElementById("profile-id-card"),

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

    backToRoles: document.getElementById("back-to-roles"),
    authTitle: document.getElementById("auth-title"),
    authSubtitle: document.getElementById("auth-subtitle"),
    authForm: document.getElementById("auth-form"),
    authSubmit: document.getElementById("auth-submit"),
    authToggleMode: document.getElementById("auth-toggle-mode"),
    authToggleText: document.getElementById("auth-toggle-text"),
    formError: document.getElementById("form-error"),

    fieldName: document.getElementById("field-name"),
    fieldEmail: document.getElementById("field-email"),
    fieldPassword: document.getElementById("field-password"),
    fieldPhone: document.getElementById("field-phone"),
    fieldDepartment: document.getElementById("field-department"),
    fieldSpecialty: document.getElementById("field-specialty"),
  };

  // ---------- Sidebar / shell config ----------
  const SIDEBAR_ICONS = {
    dashboard: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    "symptom-check": '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><rect x="5" y="6" width="14" height="15" rx="2"/><path d="M9 13l2 2 4-4"/>',
    reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
    appointments: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    profile: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  };

  const SIDEBAR_ITEMS_BY_ROLE = {
    patient: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "chat", label: "Symptom Check", icon: "symptom-check" },
      { key: "reports", label: "Reports", icon: "reports" },
      { key: "appointments", label: "Appointments", icon: "appointments" },
      { key: "profile", label: "Profile", icon: "profile" },
    ],
    // Doctor's "Appointments" is a separate, read-only, department-wide view
    // (view-doctor-appointments) — NOT the patient's self-booking form.
    doctor: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "doctor_appointments", label: "Appointments", icon: "appointments" },
      { key: "profile", label: "Profile", icon: "profile" },
    ],
  };

  const SHELL_VIEWS = {
    dashboard: els.viewDashboard,
    profile: els.viewProfile,
    chat: els.viewChat,
    appointments: els.viewAppointments,
    reports: els.viewReports,
    doctor_appointments: els.viewDoctorAppointments,
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
    els.viewRoleSelect.classList.add("hidden");
    els.viewLogin.classList.add("hidden");
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

  function showShellView(key) {
    Object.values(SHELL_VIEWS).forEach((v) => v.classList.add("hidden"));
    (SHELL_VIEWS[key] || SHELL_VIEWS.dashboard).classList.remove("hidden");
    setActiveSidebarItem(key);
    closeSidebarDrawer();
  }

  function renderSidebar(role) {
    const items = SIDEBAR_ITEMS_BY_ROLE[role] || SIDEBAR_ITEMS_BY_ROLE.patient;
    els.sidebarNav.innerHTML = "";
    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sidebar-item";
      btn.dataset.key = item.key;
      btn.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SIDEBAR_ICONS[item.icon]}</svg><span>${item.label}</span>`;
      btn.addEventListener("click", () => {
        if (item.key === "chat") {
          showShellView("chat");
          window.CareCrewChat.start();
        } else if (item.key === "appointments") {
          openAppointments();
        } else if (item.key === "reports") {
          openReports();
        } else if (item.key === "doctor_appointments") {
          openDoctorAppointments();
        } else {
          showShellView(item.key);
        }
      });
      els.sidebarNav.appendChild(btn);
    });
  }

  function showLanding() {
    enterAuthMode();
    showAuthView(els.viewLanding);
    els.userChip.classList.add("hidden");
    els.mainContent.classList.add("main-content--landing");
    setHeaderLandingNav(true);
  }

  function showRoleSelect() {
    enterAuthMode();
    showAuthView(els.viewRoleSelect);
    els.userChip.classList.add("hidden");
    els.mainContent.classList.remove("main-content--landing");
    setHeaderLandingNav(false);
  }

  function openLogin(role) {
    currentRole = role;
    authMode = "login";
    els.formError.classList.add("hidden");
    els.authForm.reset();
    syncAuthModeUI();
    showAuthView(els.viewLogin);
  }

  function syncAuthModeUI() {
    const roleLabel = currentRole === "doctor" ? "Doctor" : "Patient";
    const isRegister = authMode === "register";

    els.authTitle.textContent = `${roleLabel} ${isRegister ? "Sign Up" : "Login"}`;
    els.authSubtitle.textContent = isRegister
      ? "Create an account to get started."
      : "Sign in with your email and password.";
    els.authSubmit.textContent = isRegister ? "Create account" : "Log in";
    els.authToggleText.textContent = isRegister ? "Already have an account?" : "New here?";
    els.authToggleMode.textContent = isRegister ? "Log in instead" : "Create an account";

    document.querySelectorAll(".register-only").forEach((el) => {
      el.classList.toggle("hidden", !isRegister);
    });
    document.querySelectorAll(".doctor-only").forEach((el) => {
      el.classList.toggle("hidden", !isRegister || currentRole !== "doctor");
    });

    els.fieldName.required = isRegister;
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
    if (user.photo_url) {
      const img = document.createElement("img");
      img.src = user.photo_url;
      img.alt = user.name;
      img.className = "avatar";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "50%";
      img.style.objectFit = "cover";
      avatarEl.appendChild(img);
    } else {
      avatarEl.textContent = initials(user.name);
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
    avatar.className = "avatar";
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
          ["Doctor ID", user.id],
          ["Department", user.department || "—"],
          ["Specialty", user.specialty || "—"],
          ["Email", user.email],
          ["Phone", user.phone || "—"],
          ["Member since", formatDate(user.created_at)],
        ]
      : [
          ["Patient ID", user.id],
          ["Email", user.email],
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

    renderSidebar(user.role);
    renderIdCard(els.dashboardIdCard, user);
    renderIdCard(els.profileIdCard, user);

    const isDoctor = user.role === "doctor";
    els.dashboardWelcome.textContent = isDoctor ? `Welcome back, Dr. ${user.name}` : `Welcome, ${user.name}`;
    els.dashboardPatientActions.classList.toggle("hidden", isDoctor);
    els.dashboardDoctorActions.classList.toggle("hidden", !isDoctor);

    showShellView("dashboard");
  }

  // ---------- Navigation actions (driven by chat.js's action buttons too) ----------
  window.CareCrewNav = {
    goTo(target, opts) {
      opts = opts || {};
      if (target === "appointments") {
        openAppointments(opts.department);
      } else if (target === "reports") {
        openReports();
      } else if (target === "doctor_appointments") {
        openDoctorAppointments();
      } else if (target === "chat") {
        showShellView("chat");
        window.CareCrewChat.start();
      } else if (target === "profile") {
        showShellView("profile");
      } else {
        // Unknown target — fail safe back to the dashboard rather than a blank screen.
        showShellView("dashboard");
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

  // ---------- Events ----------
  document.querySelectorAll(".role-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => openLogin(btn.dataset.role));
  });

  els.backToRoles.addEventListener("click", showRoleSelect);

  // ---------- Landing page CTAs (all funnel into the existing role-select -> login/signup flow) ----------
  els.headerLoginBtn.addEventListener("click", showRoleSelect);
  els.headerGetStartedBtn.addEventListener("click", showRoleSelect);

  const heroGetStartedBtn = document.getElementById("hero-get-started");
  const heroHowItWorksBtn = document.getElementById("hero-how-it-works");
  const finalGetStartedBtn = document.getElementById("final-get-started");
  const footerLoginBtn = document.getElementById("footer-login");

  if (heroGetStartedBtn) heroGetStartedBtn.addEventListener("click", showRoleSelect);
  if (finalGetStartedBtn) finalGetStartedBtn.addEventListener("click", showRoleSelect);
  if (footerLoginBtn) footerLoginBtn.addEventListener("click", showRoleSelect);
  if (heroHowItWorksBtn) {
    heroHowItWorksBtn.addEventListener("click", () => {
      document.getElementById("how-it-works").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  els.authToggleMode.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    els.formError.classList.add("hidden");
    syncAuthModeUI();
  });

  els.themeToggle.addEventListener("click", () => window.CareCrewTheme.toggleTheme());

  els.hamburgerBtn.addEventListener("click", () => {
    if (els.sidebar.classList.contains("open")) closeSidebarDrawer();
    else openSidebarDrawer();
  });
  els.sidebarBackdrop.addEventListener("click", closeSidebarDrawer);

  els.startCaseBtn.addEventListener("click", () => {
    showShellView("chat");
    window.CareCrewChat.start();
  });

  els.chatBack.addEventListener("click", () => showShellView("dashboard"));

  els.goAppointmentsBtn.addEventListener("click", () => openAppointments());
  els.goReportsBtn.addEventListener("click", () => openReports());
  els.appointmentsBack.addEventListener("click", () => showShellView("dashboard"));
  els.reportsBack.addEventListener("click", () => showShellView("dashboard"));
  els.goDoctorAppointmentsBtn.addEventListener("click", () => openDoctorAppointments());
  els.doctorAppointmentsBack.addEventListener("click", () => showShellView("dashboard"));
  els.reportDetailBack.addEventListener("click", () => {
    els.reportDetail.classList.add("hidden");
    els.reportsListWrap.classList.remove("hidden");
  });
  els.reportSummaryPatientBtn.addEventListener("click", () => loadReportSummary("patient"));
  els.reportSummaryDoctorBtn.addEventListener("click", () => loadReportSummary("doctor"));

  els.appointmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.appointmentsError.classList.add("hidden");
    els.apptSubmit.disabled = true;
    try {
      const token = window.CareCrewSession.getToken();
      await CareCrewAPI.createAppointment(
        {
          department: els.apptDepartment.value,
          preferred_date: els.apptDate.value || null,
          note: els.apptNote.value.trim() || null,
          urgent: els.apptUrgent.checked,
        },
        token
      );
      els.apptNote.value = "";
      els.apptUrgent.checked = false;
      await loadAppointments();
    } catch (err) {
      els.appointmentsError.textContent = err.message;
      els.appointmentsError.classList.remove("hidden");
    } finally {
      els.apptSubmit.disabled = false;
    }
  });

  els.logoutBtn.addEventListener("click", () => {
    clearSession();
    showRoleSelect();
  });

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formError.classList.add("hidden");
    els.authSubmit.disabled = true;

    try {
      if (authMode === "register") {
        const payload = {
          name: els.fieldName.value.trim(),
          email: els.fieldEmail.value.trim(),
          password: els.fieldPassword.value,
          role: currentRole,
          phone: els.fieldPhone.value.trim() || null,
        };
        if (currentRole === "doctor") {
          payload.department = els.fieldDepartment.value.trim() || null;
          payload.specialty = els.fieldSpecialty.value.trim() || null;
        }
        const res = await CareCrewAPI.register(payload);
        saveSession(res.data.access_token, res.data.user);
        showDashboard(res.data.user, res.data.access_token);
      } else {
        const payload = {
          email: els.fieldEmail.value.trim(),
          password: els.fieldPassword.value,
        };
        const res = await CareCrewAPI.login(payload);
        if (res.data.user.role !== currentRole) {
          throw new Error(`This account is registered as ${res.data.user.role}, not ${currentRole}.`);
        }
        saveSession(res.data.access_token, res.data.user);
        showDashboard(res.data.user, res.data.access_token);
      }
    } catch (err) {
      els.formError.textContent = err.message;
      els.formError.classList.remove("hidden");
    } finally {
      els.authSubmit.disabled = false;
    }
  });

  // ---------- Boot ----------
  async function boot() {
    window.CareCrewTheme.initTheme();
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
