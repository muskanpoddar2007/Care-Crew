// Case-taking chat screen — intent-aware assistant. No hardcoded complaint:
// the backend classifies the condition from the patient's own first message
// (see POST /api/session/start, POST /api/session/turn in app/api/routes.py).
(function () {
  // Ordered (slot, label) pairs for the fields every tree tends to share —
  // anything else (new ROS keys from fever/stomach_pain/etc. trees, or from
  // the no-tree dynamic fallback) is auto-rendered under "Additional Details".
  const SLOT_GROUPS = [
    {
      title: "Shikayat / शिकायत",
      slots: [["chief_complaint", "Main Problem / मुख्य शिकायत"]],
    },
    {
      title: "Bimari ka Vivaran / बीमारी का विवरण",
      slots: [
        ["hopi.onset", "Kab se / कब से"],
        ["hopi.location", "Kahan / कहाँ"],
        ["hopi.character", "Kaisa / कैसा"],
        ["hopi.duration", "Kitni der / कितनी देर"],
        ["hopi.radiation", "Kahin aur failta hai / कहीं और"],
        ["hopi.aggravating", "Kis se badhta hai / किससे बढ़ता है"],
        ["hopi.relieving", "Kis se aaram / किससे आराम"],
        ["hopi.timing", "Lagatar ya aata-jaata / लगातार या आता-जाता"],
        ["hopi.severity", "Kitna tez (1-10) / कितना तेज़"],
      ],
    },
    {
      title: "Aur Lakshan / अन्य लक्षण",
      slots: [
        ["review_of_systems.sweating", "Pasina aana / पसीना आना"],
        ["review_of_systems.breathlessness", "Saans phoolna / साँस फूलना"],
        ["review_of_systems.nausea", "Ulti jaisa lagna / उल्टी जैसा लगना"],
      ],
    },
    {
      title: "Purani Jaankari / पुरानी जानकारी",
      slots: [
        ["past_history", "Purani bimari / पुरानी बीमारी"],
        ["drug_history", "Chal rahi dawai / दवाई"],
        ["family_history", "Ghar me kisi ko / घर में किसी को"],
        ["personal_history.tobacco", "Tambaku/beedi/gutka / तंबाकू"],
      ],
    },
  ];

  const KNOWN_ROS_KEYS = new Set(
    SLOT_GROUPS.flatMap((g) =>
      g.slots
        .filter(([path]) => path.startsWith("review_of_systems."))
        .map(([path]) => path.split(".")[1])
    )
  );

  const els = {};
  let sessionId = null;
  let currentSlot = null;
  let lastDepartment = null;
  let lastConditionKey = null;
  let busy = false;

  function humanizeKey(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function cacheEls() {
    els.banner = document.getElementById("urgent-banner");
    els.bannerFlags = document.getElementById("urgent-banner-flags");
    els.messages = document.getElementById("chat-messages");
    els.form = document.getElementById("chat-form");
    els.input = document.getElementById("chat-input");
    els.send = document.getElementById("chat-send");
    els.error = document.getElementById("chat-error");
    els.live = document.getElementById("casesheet-live");
    els.finalWrap = document.getElementById("chat-final");
    els.finalBody = document.getElementById("casesheet-final");
    els.summaryPanel = document.getElementById("chat-summary");
    els.summaryBody = document.getElementById("chat-summary-body");
    els.summaryClose = document.getElementById("chat-summary-close");
    els.summaryPatientBtn = document.getElementById("chat-summary-patient");
    els.summaryDoctorBtn = document.getElementById("chat-summary-doctor");
  }

  function addMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.textContent = text;
    els.messages.appendChild(bubble);
    els.messages.scrollTop = els.messages.scrollHeight;
    return bubble;
  }

  function addActionButton(action) {
    const wrap = document.createElement("div");
    wrap.className = "chat-action-wrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-primary btn-inline chat-action-btn";
    btn.textContent = action.label;
    btn.addEventListener("click", () => handleAction(action));
    wrap.appendChild(btn);
    els.messages.appendChild(wrap);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function handleAction(action) {
    if (action.target === "summary") {
      openSummary();
      return;
    }
    window.CareCrewNav.goTo(action.target, { department: lastDepartment, conditionKey: lastConditionKey });
  }

  async function openSummary() {
    els.summaryPanel.classList.remove("hidden");
    await loadSummary("patient");
  }

  async function loadSummary(audience) {
    els.summaryPatientBtn.classList.toggle("active", audience === "patient");
    els.summaryDoctorBtn.classList.toggle("active", audience === "doctor");
    els.summaryBody.textContent = "Generating summary...";
    try {
      const res = await CareCrewAPI.getSessionSummary(sessionId, audience);
      els.summaryBody.textContent = res.summary;
    } catch (err) {
      els.summaryBody.textContent = `Could not generate summary: ${err.message}`;
    }
  }

  function getNested(obj, dottedPath) {
    return dottedPath.split(".").reduce(
      (node, key) => (node && typeof node === "object" ? node[key] : undefined),
      obj
    );
  }

  function renderLeaf(node) {
    if (node == null) return null;
    if (Array.isArray(node)) {
      if (node.length === 0) return null;
      const dd = document.createElement("dd");
      dd.textContent = node.join(", ");
      return dd;
    }
    if (typeof node === "object") {
      if (node.value == null || node.value === "") return null;
      const dd = document.createElement("dd");
      dd.textContent = node.value;
      if (node.evidence) {
        const quote = document.createElement("blockquote");
        quote.className = "cs-evidence";
        quote.textContent = `"${node.evidence}"`;
        dd.appendChild(quote);
      }
      return dd;
    }
    const dd = document.createElement("dd");
    dd.textContent = String(node);
    return dd;
  }

  function renderCaseSheet(container, data) {
    container.innerHTML = "";
    let any = false;

    SLOT_GROUPS.forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = "cs-group";
      const heading = document.createElement("h4");
      heading.textContent = group.title;
      groupEl.appendChild(heading);

      const dl = document.createElement("dl");
      let groupHasFields = false;

      group.slots.forEach(([path, label]) => {
        const node = getNested(data, path);
        const dd = renderLeaf(node);
        if (!dd) return;
        groupHasFields = true;
        any = true;
        const dt = document.createElement("dt");
        dt.textContent = label;
        dl.appendChild(dt);
        dl.appendChild(dd);
      });

      if (groupHasFields) {
        groupEl.appendChild(dl);
        container.appendChild(groupEl);
      }
    });

    // Additional Details — ROS fields introduced by a new tree, or by the
    // dynamic no-tree fallback, that SLOT_GROUPS doesn't already cover.
    const ros = data.review_of_systems || {};
    const extraKeys = Object.keys(ros).filter((k) => !KNOWN_ROS_KEYS.has(k));
    if (extraKeys.length) {
      const groupEl = document.createElement("div");
      groupEl.className = "cs-group";
      const heading = document.createElement("h4");
      heading.textContent = "Additional Details";
      groupEl.appendChild(heading);

      const dl = document.createElement("dl");
      let groupHasFields = false;

      extraKeys.forEach((k) => {
        const dd = renderLeaf(ros[k]);
        if (!dd) return;
        groupHasFields = true;
        any = true;
        const dt = document.createElement("dt");
        dt.textContent = humanizeKey(k);
        dl.appendChild(dt);
        dl.appendChild(dd);
      });

      if (groupHasFields) {
        groupEl.appendChild(dl);
        container.appendChild(groupEl);
      }
    }

    if (!any) {
      const empty = document.createElement("p");
      empty.className = "casesheet-empty";
      empty.textContent = "Answers will appear here as you go.";
      container.appendChild(empty);
    }
  }

  function updateBanner(isUrgent, redFlags) {
    if (!isUrgent) {
      els.banner.classList.add("hidden");
      return;
    }
    els.bannerFlags.innerHTML = "";
    (redFlags || []).forEach((flag) => {
      const li = document.createElement("li");
      li.textContent = flag;
      els.bannerFlags.appendChild(li);
    });
    els.banner.classList.remove("hidden");
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.classList.remove("hidden");
  }

  function clearError() {
    els.error.classList.add("hidden");
  }

  function setBusy(state) {
    busy = state;
    els.input.disabled = state;
    els.send.disabled = state;
  }

  function resetUI() {
    els.messages.innerHTML = "";
    els.live.innerHTML = "";
    els.finalBody.innerHTML = "";
    els.finalWrap.classList.add("hidden");
    els.banner.classList.add("hidden");
    els.summaryPanel.classList.add("hidden");
    clearError();
    els.form.classList.remove("hidden");
    renderCaseSheet(els.live, {});
  }

  async function start() {
    cacheEls();
    resetUI();
    sessionId = null;
    currentSlot = null;
    lastDepartment = null;
    lastConditionKey = null;

    setBusy(true);
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.startCase(token);
      sessionId = res.session_id;
      currentSlot = res.next_slot;
      addMessage("agent", res.next_question);
      updateBanner(res.is_urgent, []);
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
      els.input.focus();
    }
  }

  async function finish() {
    try {
      const finalSheet = await CareCrewAPI.getFinalCaseSheet(sessionId);
      renderCaseSheet(els.finalBody, finalSheet);
      els.finalWrap.classList.remove("hidden");
      els.form.classList.add("hidden");
    } catch (err) {
      showError(err.message);
    }
  }

  async function submitAnswer(text) {
    addMessage("patient", text);
    clearError();
    setBusy(true);

    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.sendCaseTurn(
        { session_id: sessionId, patient_text: text, asked_slot: currentSlot },
        token
      );

      renderCaseSheet(els.live, res.state);
      updateBanner(res.is_urgent, res.state ? res.state.red_flags : []);
      currentSlot = res.next_slot;
      lastDepartment = res.department || lastDepartment;
      lastConditionKey = res.condition_key || lastConditionKey;

      if (res.is_complete) {
        addMessage("agent", res.next_question || "Thank you — I have everything I need. Preparing your case summary...");
        await finish();
      } else {
        addMessage("agent", res.next_question);
      }

      if (res.action) {
        addActionButton(res.action);
      } else if (res.is_urgent) {
        addActionButton({ action: "navigate", target: "appointments", label: "Book Urgent Appointment" });
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
      if (!els.form.classList.contains("hidden")) els.input.focus();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheEls();
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (busy) return;
      const text = els.input.value.trim();
      if (!text) return;
      els.input.value = "";
      submitAnswer(text);
    });
    els.summaryClose.addEventListener("click", () => els.summaryPanel.classList.add("hidden"));
    els.summaryPatientBtn.addEventListener("click", () => loadSummary("patient"));
    els.summaryDoctorBtn.addEventListener("click", () => loadSummary("doctor"));
  });

  window.CareCrewChat = { start, renderCaseSheet };
})();
