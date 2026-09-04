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

    viewRoleSelect: document.getElementById("view-role-select"),
    viewLogin: document.getElementById("view-login"),
    viewDoctor: document.getElementById("view-doctor"),
    viewPatient: document.getElementById("view-patient"),
    viewChat: document.getElementById("view-chat"),
    viewAppointments: document.getElementById("view-appointments"),
    viewReports: document.getElementById("view-reports"),

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

  // ---------- View switching ----------
  const ALL_VIEWS = [
    els.viewRoleSelect,
    els.viewLogin,
    els.viewDoctor,
    els.viewPatient,
    els.viewChat,
    els.viewAppointments,
    els.viewReports,
  ];

  function showView(view) {
    ALL_VIEWS.forEach((v) => v.classList.add("hidden"));
    view.classList.remove("hidden");
  }

  function showRoleSelect() {
    showView(els.viewRoleSelect);
    els.userChip.classList.add("hidden");
  }

  function openLogin(role) {
    currentRole = role;
    authMode = "login";
    els.formError.classList.add("hidden");
    els.authForm.reset();
    syncAuthModeUI();
    showView(els.viewLogin);
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

  function renderDoctor(user) {
    document.getElementById("doctor-welcome").textContent = `Welcome back, Dr. ${user.name}`;
    document.getElementById("doctor-name").textContent = user.name;
    document.getElementById("doctor-id").textContent = user.id;
    document.getElementById("doctor-department").textContent = user.department || "—";
    document.getElementById("doctor-specialty").textContent = user.specialty || "—";
    document.getElementById("doctor-email").textContent = user.email;
    document.getElementById("doctor-phone").textContent = user.phone || "—";
    document.getElementById("doctor-since").textContent = formatDate(user.created_at);
    setAvatar(document.getElementById("doctor-avatar"), user);
    resetTabs("doctor");
    showView(els.viewDoctor);
  }

  function renderPatient(user) {
    document.getElementById("patient-welcome").textContent = `Welcome, ${user.name}`;
    document.getElementById("patient-name").textContent = user.name;
    document.getElementById("patient-id").textContent = user.id;
    document.getElementById("patient-email").textContent = user.email;
    document.getElementById("patient-phone").textContent = user.phone || "—";
    document.getElementById("patient-since").textContent = formatDate(user.created_at);
    setAvatar(document.getElementById("patient-avatar"), user);
    resetTabs("patient");
    showView(els.viewPatient);
  }

  function resetTabs(scope) {
    document.querySelectorAll(`.neu-btn[data-scope="${scope}"]`).forEach((btn, i) => {
      btn.classList.toggle("active", i === 0);
    });
    document.getElementById(`${scope}-tab-overview`).classList.remove("hidden");
    document.getElementById(`${scope}-tab-profile`).classList.add("hidden");
  }

  function showDashboard(user, token) {
    els.userChip.classList.remove("hidden");
    els.userChipName.textContent = user.name;
    if (user.role === "doctor") {
      renderDoctor(user);
    } else {
      renderPatient(user);
    }
  }

  // ---------- Navigation actions (driven by chat.js's action buttons too) ----------
  window.CareCrewNav = {
    goTo(target, opts) {
      opts = opts || {};
      if (target === "appointments") {
        openAppointments(opts.department);
      } else if (target === "reports") {
        openReports();
      } else if (target === "patient") {
        showView(els.viewPatient);
      } else {
        // Unknown target — fail safe back to the dashboard rather than a blank screen.
        showView(els.viewPatient);
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
    showView(els.viewAppointments);
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
      row.innerHTML = `
        <div class="list-item-main">
          <span class="list-item-title">${a.department}</span>
          <span class="list-item-meta">${a.preferred_date || "No date given"} · ${a.status}${a.note ? " · " + a.note : ""}</span>
        </div>
        ${a.urgent ? '<span class="role-badge urgent">Urgent</span>' : ""}
      `;
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
    showView(els.viewReports);
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
      const title = (report.chief_complaint && report.chief_complaint.value) || report.condition_key || "Case report";
      row.innerHTML = `
        <div class="list-item-main">
          <span class="list-item-title">${title}</span>
          <span class="list-item-meta">${formatDate(report.completed_at)} · ${report.department || "General Medicine"}</span>
        </div>
        ${report.is_urgent ? '<span class="role-badge urgent">Urgent</span>' : ""}
      `;
      row.style.cursor = "pointer";
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

  // ---------- Events ----------
  document.querySelectorAll(".role-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => openLogin(btn.dataset.role));
  });

  els.backToRoles.addEventListener("click", showRoleSelect);

  els.authToggleMode.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    els.formError.classList.add("hidden");
    syncAuthModeUI();
  });

  document.querySelectorAll(".neu-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scope = btn.dataset.scope;
      const tab = btn.dataset.tab;
      document.querySelectorAll(`.neu-btn[data-scope="${scope}"]`).forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
      document.getElementById(`${scope}-tab-overview`).classList.toggle("hidden", tab !== "overview");
      document.getElementById(`${scope}-tab-profile`).classList.toggle("hidden", tab !== "profile");
    });
  });

  els.themeToggle.addEventListener("click", () => window.CareCrewTheme.toggleTheme());

  els.startCaseBtn.addEventListener("click", () => {
    showView(els.viewChat);
    window.CareCrewChat.start();
  });

  els.chatBack.addEventListener("click", () => showView(els.viewPatient));

  els.goAppointmentsBtn.addEventListener("click", () => openAppointments());
  els.goReportsBtn.addEventListener("click", () => openReports());
  els.appointmentsBack.addEventListener("click", () => showView(els.viewPatient));
  els.reportsBack.addEventListener("click", () => showView(els.viewPatient));
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
    setTimeout(showRoleSelect, 1900);
  }

  boot();
})();
