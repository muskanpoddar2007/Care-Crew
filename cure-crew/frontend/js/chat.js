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
    {
      title: "Ayurveda Core / आयुर्वेदिक मूल जानकारी",
      slots: [
        ["review_of_systems.ayurveda_agni_appetite", "Agni (Appetite) / भूख व अग्नि"],
        ["review_of_systems.ayurveda_agni_bowel", "Agni (Bowel) / पाचन व शौच"],
        ["review_of_systems.ayurveda_sleep", "Sleep Quality / निद्रा"],
        ["review_of_systems.ayurveda_thermal", "Thermal Preference / तापीय संवेदनशीलता"],
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

  const STORAGE_KEY = "carecrew_workflow_state";

  const els = {};
  let sessionId = null;
  let currentSlot = null;
  let lastDepartment = null;
  let lastConditionKey = null;
  let isUrgent = false;
  let isComplete = false;
  let finalSheetData = null;
  let currentStep = 1;
  let chatTranscript = [];
  let busy = false;
  let bookedAppointment = null;

  function humanizeKey(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function cacheEls() {
    // Stepper & Stages
    els.stepper = document.getElementById("workflow-stepper");
    els.step1 = document.getElementById("stepper-step-1");
    els.step2 = document.getElementById("stepper-step-2");
    els.step3 = document.getElementById("stepper-step-3");
    els.stage1 = document.getElementById("workflow-stage-1");
    els.stage2 = document.getElementById("workflow-stage-2");
    els.stage3 = document.getElementById("workflow-stage-3");
    els.stageConfirmation = document.getElementById("workflow-stage-confirmation");

    // Stage 1 (Chat)
    els.banner = document.getElementById("urgent-banner");
    els.bannerFlags = document.getElementById("urgent-banner-flags");
    els.messages = document.getElementById("chat-messages");
    els.quickReplies = document.getElementById("chat-quick-replies");
    els.form = document.getElementById("chat-form");
    els.input = document.getElementById("chat-input");
    els.send = document.getElementById("chat-send");
    els.error = document.getElementById("chat-error");
    els.live = document.getElementById("casesheet-live");

    // Stage 2 (Case Sheet Review)
    els.triageBadge = document.getElementById("casesheet-triage-badge");
    els.btnBackToChat = document.getElementById("btn-back-to-chat");
    els.btnContinueToBooking = document.getElementById("btn-continue-to-booking");
    els.btnContinueToBookingBottom = document.getElementById("btn-continue-to-booking-bottom");
    els.finalWrap = document.getElementById("chat-final");
    els.finalBody = document.getElementById("casesheet-final");
    els.summaryPanel = document.getElementById("chat-summary");
    els.summaryBody = document.getElementById("chat-summary-body");
    els.summaryPatientBtn = document.getElementById("chat-summary-patient");
    els.summaryDoctorBtn = document.getElementById("chat-summary-doctor");

    // Stage 3 (Booking)
    els.btnBackToCasesheet = document.getElementById("btn-back-to-casesheet");
    els.bookingRecap = document.getElementById("booking-recap-details");
    els.appointmentForm = document.getElementById("appointment-form");
    els.appointmentsError = document.getElementById("appointments-error");
    els.apptDepartment = document.getElementById("appt-department");
    els.apptDate = document.getElementById("appt-date");
    els.apptNote = document.getElementById("appt-note");
    els.apptUrgent = document.getElementById("appt-urgent");
    els.apptSubmit = document.getElementById("appt-submit");

    // Stage 4 (Confirmation)
    els.confirmationDetails = document.getElementById("confirmation-details");
    els.btnConfirmationDashboard = document.getElementById("btn-confirmation-dashboard");
    els.btnConfirmationAppointments = document.getElementById("btn-confirmation-appointments");
    els.btnConfirmationRestart = document.getElementById("btn-confirmation-restart");
  }

  // ---------- Workflow State Storage ----------
  function saveWorkflowState() {
    try {
      const state = {
        sessionId,
        currentStep,
        currentSlot,
        lastDepartment,
        lastConditionKey,
        isUrgent,
        isComplete,
        finalSheetData,
        chatTranscript,
        bookedAppointment,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Storage quota or disabled
    }
  }

  function loadWorkflowState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearWorkflowState() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  // ---------- Stepper & Stage Switching ----------
  function updateStepperUI(step) {
    if (!els.step1 || !els.step2 || !els.step3) return;

    [els.step1, els.step2, els.step3].forEach((el) => {
      el.classList.remove("active", "completed");
    });

    const dividers = els.stepper ? els.stepper.querySelectorAll(".step-divider") : [];
    dividers.forEach((d) => d.classList.remove("completed"));

    if (step === 1) {
      els.step1.classList.add("active");
    } else if (step === 2) {
      els.step1.classList.add("completed");
      els.step2.classList.add("active");
      if (dividers[0]) dividers[0].classList.add("completed");
    } else if (step === 3) {
      els.step1.classList.add("completed");
      els.step2.classList.add("completed");
      els.step3.classList.add("active");
      dividers.forEach((d) => d.classList.add("completed"));
    } else if (step >= 4) {
      els.step1.classList.add("completed");
      els.step2.classList.add("completed");
      els.step3.classList.add("completed");
      dividers.forEach((d) => d.classList.add("completed"));
    }
  }

  function goToStep(step) {
    cacheEls();

    // Guard: Patient cannot enter Case Sheet (Step 2) or Booking (Step 3) without finishing Symptom Check
    if (step > 1 && !isComplete) {
      step = 1;
    }

    currentStep = step;
    updateStepperUI(step);

    if (els.stage1) els.stage1.classList.toggle("hidden", step !== 1);
    if (els.stage2) els.stage2.classList.toggle("hidden", step !== 2);
    if (els.stage3) els.stage3.classList.toggle("hidden", step !== 3);
    if (els.stageConfirmation) els.stageConfirmation.classList.toggle("hidden", step !== 4);

    if (step === 2) {
      setupStep2View();
    } else if (step === 3) {
      setupStep3View();
    }

    saveWorkflowState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setupStep2View() {
    if (finalSheetData && els.finalBody) {
      renderCaseSheet(els.finalBody, finalSheetData);
    }
    if (lastDepartment && els.triageBadge) {
      els.triageBadge.textContent = `Identified Department: ${lastDepartment}`;
      els.triageBadge.classList.remove("hidden");
    } else if (els.triageBadge) {
      els.triageBadge.classList.add("hidden");
    }
    if (sessionId) {
      loadSummary("patient");
    }

    const btnText = bookedAppointment ? "View Booked Appointment →" : "Continue to Book Appointment →";
    if (els.btnContinueToBooking) els.btnContinueToBooking.textContent = btnText;
    if (els.btnContinueToBookingBottom) els.btnContinueToBookingBottom.textContent = btnText;
  }

  function setupStep3View() {
    if (els.bookingRecap) {
      const complaintText =
        (finalSheetData && finalSheetData.chief_complaint && finalSheetData.chief_complaint.value) ||
        (lastConditionKey ? humanizeKey(lastConditionKey) : "Symptom Assessment");
      const deptText = lastDepartment || "General Medicine";
      els.bookingRecap.innerHTML = `<strong>${complaintText}</strong> &middot; Routed to <strong>${deptText}</strong>${
        isUrgent ? ' &middot; <span class="role-badge urgent">Urgent</span>' : ""
      }`;
    }

    if (els.apptDepartment && lastDepartment) {
      const options = Array.from(els.apptDepartment.options).map((o) => o.value);
      if (options.includes(lastDepartment)) {
        els.apptDepartment.value = lastDepartment;
      }
    }

    if (els.apptUrgent) {
      els.apptUrgent.checked = isUrgent;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (els.apptDate) {
      els.apptDate.min = today;
      if (!els.apptDate.value) els.apptDate.value = today;
    }

    // Check if appointment is already booked for this session
    let lockedBanner = document.getElementById("booking-locked-banner");
    if (bookedAppointment) {
      if (!lockedBanner && els.stage3) {
        lockedBanner = document.createElement("div");
        lockedBanner.id = "booking-locked-banner";
        lockedBanner.className = "booking-locked-banner";
        const formCard = els.stage3.querySelector(".flat-card");
        if (formCard) {
          formCard.parentNode.insertBefore(lockedBanner, formCard);
        } else {
          els.stage3.prepend(lockedBanner);
        }
      }

      if (lockedBanner) {
        lockedBanner.classList.remove("hidden");
        lockedBanner.innerHTML = `
          <div class="booking-locked-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1b9c97" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span data-i18n="appt_already_booked_title">Appointment Already Booked</span>
          </div>
          <p class="booking-locked-desc" data-i18n="appt_already_booked_desc">An appointment has already been booked for this case sheet. Only one booking is allowed per symptom-check session.</p>
          <div class="booking-locked-actions">
            <button type="button" id="btn-view-locked-details" class="btn-primary btn-inline">View Confirmation Details</button>
            <button type="button" id="btn-start-fresh-from-locked" class="neu-btn">Start Fresh Symptom Check</button>
          </div>
        `;
        document.getElementById("btn-view-locked-details").addEventListener("click", () => showConfirmation(bookedAppointment));
        document.getElementById("btn-start-fresh-from-locked").addEventListener("click", () => start());
        if (window.CareCrewI18n) window.CareCrewI18n.applyToDOM();
      }

      if (els.apptSubmit) els.apptSubmit.disabled = true;
      if (els.appointmentForm) {
        Array.from(els.appointmentForm.elements).forEach((el) => {
          el.disabled = true;
        });
      }
    } else {
      if (lockedBanner) lockedBanner.classList.add("hidden");
      if (els.apptSubmit) els.apptSubmit.disabled = false;
      if (els.appointmentForm) {
        Array.from(els.appointmentForm.elements).forEach((el) => {
          el.disabled = false;
        });
      }
    }
  }

  function showConfirmation(appt) {
    cacheEls();
    isComplete = true;
    bookedAppointment = appt;
    saveWorkflowState();

    if (els.confirmationDetails) {
      els.confirmationDetails.innerHTML = "";
      const rows = [
        ["Department", appt.department || lastDepartment || "General Medicine"],
        ["Preferred Date", appt.preferred_date || "Earliest available"],
        ["Priority", appt.urgent || isUrgent ? "Urgent Priority" : "Standard OPD"],
        ["Status", appt.status || "Requested"],
        ["Case Sheet Ref", sessionId ? `Session #${sessionId}` : "Attached & Linked"],
      ];

      rows.forEach(([k, v]) => {
        const row = document.createElement("div");
        row.className = "detail-row";
        const keySpan = document.createElement("strong");
        keySpan.textContent = k;
        const valSpan = document.createElement("span");
        valSpan.textContent = v;
        row.appendChild(keySpan);
        row.appendChild(valSpan);
        els.confirmationDetails.appendChild(row);
      });
    }

    goToStep(4);
  }

  // ---------- Message Rendering ----------
  function addMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.textContent = text;
    els.messages.appendChild(bubble);
    els.messages.scrollTop = els.messages.scrollHeight;
    chatTranscript.push({ role, text });
    saveWorkflowState();
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
    if (action.target === "appointments") {
      if (isComplete) {
        goToStep(3);
        return;
      }
    }
    window.CareCrewNav.goTo(action.target, { department: lastDepartment, conditionKey: lastConditionKey });
  }

  async function openSummary() {
    if (els.summaryPanel) els.summaryPanel.classList.remove("hidden");
    await loadSummary("patient");
  }

  async function loadSummary(audience) {
    if (!els.summaryBody || !sessionId) return;
    if (els.summaryPatientBtn) els.summaryPatientBtn.classList.toggle("active", audience === "patient");
    if (els.summaryDoctorBtn) els.summaryDoctorBtn.classList.toggle("active", audience === "doctor");
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
    if (!container) return;
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

    const ros = (data && data.review_of_systems) || {};
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

  function updateBanner(urgent, redFlags) {
    isUrgent = Boolean(urgent);
    if (!els.banner) return;
    if (!isUrgent) {
      els.banner.classList.add("hidden");
      return;
    }
    if (els.bannerFlags) {
      els.bannerFlags.innerHTML = "";
      (redFlags || []).forEach((flag) => {
        const li = document.createElement("li");
        li.textContent = typeof flag === "string" ? flag : flag.text || JSON.stringify(flag);
        els.bannerFlags.appendChild(li);
      });
    }
    els.banner.classList.remove("hidden");
  }

  function showError(message) {
    if (!els.error) return;
    els.error.textContent = message;
    els.error.classList.remove("hidden");
  }

  function clearError() {
    if (els.error) els.error.classList.add("hidden");
  }

  function setBusy(state) {
    busy = state;
    if (els.input) els.input.disabled = state;
    if (els.send) els.send.disabled = state;
  }

  function clearQuickReplies() {
    if (els.quickReplies) {
      els.quickReplies.innerHTML = "";
      els.quickReplies.classList.add("hidden");
    }
  }

  function renderQuickReplies(options) {
    clearQuickReplies();
    if (!els.quickReplies || !Array.isArray(options) || options.length === 0) return;

    els.quickReplies.innerHTML = "";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-quick-reply-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        clearQuickReplies();
        submitAnswer(opt);
      });
      els.quickReplies.appendChild(btn);
    });
    els.quickReplies.classList.remove("hidden");

    if (els.messages) {
      els.messages.scrollTop = els.messages.scrollHeight;
    }
  }

  function resetUI() {
    cacheEls();
    if (els.messages) els.messages.innerHTML = "";
    if (els.live) els.live.innerHTML = "";
    if (els.finalBody) els.finalBody.innerHTML = "";
    if (els.banner) els.banner.classList.add("hidden");
    if (els.error) els.error.classList.add("hidden");
    if (els.form) els.form.classList.remove("hidden");
    clearQuickReplies();
    renderCaseSheet(els.live, {});
  }

  async function start() {
    cacheEls();
    resetUI();
    clearWorkflowState();
    sessionId = null;
    currentSlot = null;
    lastDepartment = null;
    lastConditionKey = null;
    isUrgent = false;
    isComplete = false;
    finalSheetData = null;
    chatTranscript = [];
    currentStep = 1;
    goToStep(1);

    setBusy(true);
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.startCase(token);
      sessionId = res.session_id;
      currentSlot = res.next_slot;
      addMessage("agent", res.next_question);
      renderQuickReplies(res.quick_replies);
      updateBanner(res.is_urgent, []);
      saveWorkflowState();
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
      if (els.input) els.input.focus();
    }
  }

  async function finish() {
    try {
      isComplete = true;
      const finalSheet = await CareCrewAPI.getFinalCaseSheet(sessionId);
      finalSheetData = finalSheet;
      if (finalSheet.department) lastDepartment = finalSheet.department;
      if (finalSheet.is_urgent) isUrgent = true;

      saveWorkflowState();
      // Seamlessly advance to Step 2 (Review Case Sheet)
      goToStep(2);
    } catch (err) {
      showError(err.message);
    }
  }

  async function submitAnswer(text) {
    clearQuickReplies();
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
        addMessage("agent", res.next_question || "Thank you — your clinical history is complete. Preparing your case sheet...");
        clearQuickReplies();
        await finish();
      } else {
        addMessage("agent", res.next_question);
        renderQuickReplies(res.quick_replies);
        saveWorkflowState();
      }

      if (res.action) {
        addActionButton(res.action);
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
      if (els.input && currentStep === 1) els.input.focus();
    }
  }

  function resumeOrStart() {
    cacheEls();
    const saved = loadWorkflowState();
    if (saved && saved.sessionId) {
      sessionId = saved.sessionId;
      currentSlot = saved.currentSlot;
      lastDepartment = saved.lastDepartment;
      lastConditionKey = saved.lastConditionKey;
      isUrgent = saved.isUrgent || false;
      isComplete = saved.isComplete || false;
      finalSheetData = saved.finalSheetData;
      chatTranscript = saved.chatTranscript || [];

      // Restore transcript in Step 1
      if (els.messages) {
        els.messages.innerHTML = "";
        chatTranscript.forEach((m) => {
          const bubble = document.createElement("div");
          bubble.className = `chat-bubble chat-bubble-${m.role}`;
          bubble.textContent = m.text;
          els.messages.appendChild(bubble);
        });
      }

      if (finalSheetData) {
        renderCaseSheet(els.live, finalSheetData);
      }

      // If user had reached Step 2 or Step 3, resume there
      if (saved.currentStep >= 2 && isComplete) {
        goToStep(saved.currentStep);
        return;
      }
      goToStep(1);
      return;
    }
    start();
  }

  function initListeners() {
    cacheEls();

    if (els.form) {
      els.form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (busy) return;
        const text = els.input.value.trim();
        if (!text) return;
        els.input.value = "";
        submitAnswer(text);
      });
    }

    // Stepper header item clicks for intuitive navigation
    if (els.step1) {
      els.step1.addEventListener("click", () => {
        if (currentStep > 1) goToStep(1);
      });
    }
    if (els.step2) {
      els.step2.addEventListener("click", () => {
        if (isComplete && currentStep !== 2) goToStep(2);
      });
    }
    if (els.step3) {
      els.step3.addEventListener("click", () => {
        if (isComplete && currentStep !== 3) goToStep(3);
      });
    }

    // Step 2 buttons
    if (els.btnBackToChat) {
      els.btnBackToChat.addEventListener("click", () => goToStep(1));
    }
    if (els.btnContinueToBooking) {
      els.btnContinueToBooking.addEventListener("click", () => goToStep(3));
    }
    if (els.btnContinueToBookingBottom) {
      els.btnContinueToBookingBottom.addEventListener("click", () => goToStep(3));
    }

    // Step 3 buttons
    if (els.btnBackToCasesheet) {
      els.btnBackToCasesheet.addEventListener("click", () => goToStep(2));
    }

    // Summary buttons
    if (els.summaryPatientBtn) {
      els.summaryPatientBtn.addEventListener("click", () => loadSummary("patient"));
    }
    if (els.summaryDoctorBtn) {
      els.summaryDoctorBtn.addEventListener("click", () => loadSummary("doctor"));
    }

    // Confirmation buttons
    if (els.btnConfirmationDashboard) {
      els.btnConfirmationDashboard.addEventListener("click", () => {
        window.CareCrewNav.goTo("dashboard");
      });
    }
    if (els.btnConfirmationAppointments) {
      els.btnConfirmationAppointments.addEventListener("click", () => {
        window.CareCrewNav.goTo("appointments");
      });
    }
    if (els.btnConfirmationRestart) {
      els.btnConfirmationRestart.addEventListener("click", () => {
        start();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initListeners);

  window.CareCrewChat = {
    start,
    resumeOrStart,
    goToStep,
    showConfirmation,
    isWorkflowComplete() {
      return Boolean(isComplete);
    },
    getSessionId() {
      return sessionId;
    },
    hasBookedSession() {
      return Boolean(bookedAppointment);
    },
    getBookedAppointment() {
      return bookedAppointment;
    },
    renderCaseSheet,
  };
})();
