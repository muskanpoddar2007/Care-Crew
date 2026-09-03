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

    startCaseBtn: document.getElementById("start-case-btn"),
    chatBack: document.getElementById("chat-back"),

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
  function showView(view) {
    [els.viewRoleSelect, els.viewLogin, els.viewDoctor, els.viewPatient, els.viewChat].forEach((v) =>
      v.classList.add("hidden")
    );
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
