// Patient home dashboard — Next Appointment / Last Case Sheet / Recent
// Activity cards, and the Diagnosis page's tab switching. Reuses the SAME
// /api/patients/me/* endpoints app.js already calls for the Appointments and
// Reports pages — no new backend endpoints, no new data model.
//
// SAFETY SCOPE: this file only ever displays what already exists in a
// completed case sheet (chief complaint, urgency) or an appointment record.
// It never calls an LLM and never invents a diagnosis — the Diagnosis page's
// three tabs currently have no backend data source at all (no doctor-entered
// diagnosis field exists yet), so they always show the honest empty state
// defined in index.html. If/when a real doctor-diagnosis field is added on
// the backend, only this file's showDiagnosisTab() needs to change.
(function () {
  function t(key) {
    return window.CareCrewI18n ? window.CareCrewI18n.t(key) : key;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (e) {
      return iso;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- Next Appointment card ----------
  function renderNextAppointment(appointments) {
    const container = document.getElementById("next-appointment-body");
    if (!container) return;
    container.innerHTML = "";

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (appointments || [])
      .filter((a) => a.status !== "cancelled" && a.preferred_date && a.preferred_date >= today)
      .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date));

    if (!upcoming.length) {
      container.appendChild(el("p", "overview-empty", t("overview_no_appointment")));
      const link = el("button", "overview-card-link", "Book Appointment →");
      link.type = "button";
      link.addEventListener("click", () => window.CareCrewNav.goTo("appointments"));
      container.appendChild(link);
      return;
    }

    const next = upcoming[0];
    const title = el("strong", null, next.department);
    const meta = el("span", "overview-card-meta", `${formatDate(next.preferred_date)} · ${next.status}`);
    container.appendChild(title);
    container.appendChild(meta);
  }

  // ---------- Last Case Sheet card ----------
  function renderLastCaseSheet(reports) {
    const container = document.getElementById("last-casesheet-body");
    if (!container) return;
    container.innerHTML = "";

    if (!reports || !reports.length) {
      container.appendChild(el("p", "overview-empty", t("overview_no_casesheet")));
      const link = el("button", "overview-card-link", "Start Symptom Check →");
      link.type = "button";
      link.addEventListener("click", () => window.CareCrewNav.goTo("chat"));
      container.appendChild(link);
      return;
    }

    const latest = reports[0]; // already sorted newest-first by the backend
    const complaint = (latest.chief_complaint && latest.chief_complaint.value) || latest.condition_key || "Case report";
    const title = el("strong", null, complaint);
    const meta = el("span", "overview-card-meta", `${formatDate(latest.completed_at)} · ${latest.department || "General Medicine"}`);
    container.appendChild(title);
    container.appendChild(meta);
    if (latest.is_urgent) {
      const badge = el("span", "role-badge urgent", "Urgent");
      badge.style.marginTop = "8px";
      badge.style.display = "inline-block";
      container.appendChild(badge);
    }

    const link = el("button", "overview-card-link", "View Case Sheet →");
    link.type = "button";
    link.addEventListener("click", () => window.CareCrewNav.goTo("reports"));
    container.appendChild(link);
  }

  // ---------- Recent Health Activity ----------
  function renderRecentActivity(appointments, reports) {
    const container = document.getElementById("recent-activity-list");
    if (!container) return;
    container.innerHTML = "";

    const items = [
      ...(reports || []).map((r) => ({
        date: r.completed_at,
        icon: "reports",
        text: `Case sheet completed — ${(r.chief_complaint && r.chief_complaint.value) || r.condition_key || "case report"}`,
      })),
      ...(appointments || []).map((a) => ({
        date: a.created_at,
        icon: "appointments",
        text: `Appointment ${a.status} — ${a.department}`,
      })),
    ]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (!items.length) {
      container.appendChild(el("p", "list-empty", t("activity_empty")));
      return;
    }

    const icons = {
      reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
      appointments: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    };

    items.forEach((item) => {
      const row = el("div", "list-item activity-item");
      const icon = el("span", "activity-icon");
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[item.icon] || ""}</svg>`;
      const main = el("div", "list-item-main");
      main.appendChild(el("span", "list-item-title", item.text));
      main.appendChild(el("span", "list-item-meta", formatDate(item.date)));
      row.appendChild(icon);
      row.appendChild(main);
      container.appendChild(row);
    });
  }

  // ---------- Diagnosis page (always an honest empty state — see file header) ----------
  function showDiagnosisTab(tab) {
    ["previous", "current", "dietary"].forEach((name) => {
      const panel = document.getElementById(`diagnosis-panel-${name}`);
      if (panel) panel.classList.toggle("hidden", name !== tab);
    });
    document.querySelectorAll(".diagnosis-tab").forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    // Report Status is clickable only when there's at least one real case
    // sheet to point to — never fabricated, and never a diagnosis itself.
    const statusLink = document.getElementById("report-status-link");
    if (statusLink && tab === "current") {
      const hasReports = window.__careCrewLastReportsCount > 0;
      statusLink.classList.toggle("hidden", !hasReports);
      statusLink.textContent = t("report_status_pending");
      statusLink.onclick = () => window.CareCrewNav.goTo("reports");
    }
  }

  // ---------- Entry point, called from app.js's showDashboard() ----------
  async function renderHome(token) {
    const nextAppt = document.getElementById("next-appointment-body");
    const lastSheet = document.getElementById("last-casesheet-body");
    const activity = document.getElementById("recent-activity-list");

    let appointments = [];
    let reports = [];

    try {
      const [apptRes, reportRes] = await Promise.all([
        CareCrewAPI.listAppointments(token),
        CareCrewAPI.listReports(token),
      ]);
      appointments = apptRes.data || [];
      reports = reportRes.data || [];
    } catch (err) {
      if (nextAppt) nextAppt.textContent = err.message;
      if (lastSheet) lastSheet.textContent = err.message;
      if (activity) activity.textContent = err.message;
      return;
    }

    window.__careCrewLastReportsCount = reports.length;

    renderNextAppointment(appointments);
    renderLastCaseSheet(reports);
    renderRecentActivity(appointments, reports);
  }

  window.CareCrewDashboard = { renderHome, showDiagnosisTab };
})();
