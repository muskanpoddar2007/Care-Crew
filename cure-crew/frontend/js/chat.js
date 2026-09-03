// Case-taking chat screen — wires the chest_pain triage endpoints
// (POST /api/session/start, POST /api/session/turn, GET /api/session/{id}/final)
// to a chat transcript + a live case-sheet panel.
(function () {
  const COMPLAINT = "chest_pain";

  // Ordered (slot, label) pairs — mirrors app/data/chest_pain.json's
  // mandatory_slots / screening_questions / background_slots groups, so the
  // case-sheet panel renders fields in the same order they're asked.
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
        ["hopi.character", "Kaisa dard / कैसा दर्द"],
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

  const els = {};
  let sessionId = null;
  let currentSlot = null;
  let busy = false;

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
  }

  function addMessage(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.textContent = text;
    els.messages.appendChild(bubble);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function getNested(obj, dottedPath) {
    return dottedPath.split(".").reduce(
      (node, key) => (node && typeof node === "object" ? node[key] : undefined),
      obj
    );
  }

  // A leaf is either an Evidence-shaped object ({value, evidence, turn_index} —
  // from the live `state`), a plain flattened value (from the /final endpoint),
  // or a list of plain strings (past_history etc).
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
    // plain scalar (from the flattened /final response)
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
    clearError();
    els.form.classList.remove("hidden");
    renderCaseSheet(els.live, {});
  }

  async function start() {
    cacheEls();
    resetUI();
    sessionId = null;
    currentSlot = null;

    setBusy(true);
    try {
      const res = await CareCrewAPI.startCase(COMPLAINT);
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
      const res = await CareCrewAPI.sendCaseTurn({
        session_id: sessionId,
        patient_text: text,
        asked_slot: currentSlot,
        complaint: COMPLAINT,
      });

      renderCaseSheet(els.live, res.state);
      updateBanner(res.is_urgent, res.state ? res.state.red_flags : []);
      currentSlot = res.next_slot;

      if (res.is_complete) {
        addMessage("agent", "Thank you — I have everything I need. Preparing your case summary...");
        await finish();
      } else {
        addMessage("agent", res.next_question);
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
  });

  window.CareCrewChat = { start };
})();
