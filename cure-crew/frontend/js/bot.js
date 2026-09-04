// Floating AI Bot widget — navigation/query assistant ONLY.
// Talks exclusively to POST /api/bot/query (app/api/bot_routes.py). Never
// touches /api/session/* — history-taking lives entirely in chat.js's
// Symptom Check flow, which this widget can only navigate TO, never run.
(function () {
  const els = {};
  let recognizing = false;
  let recognition = null;

  function cacheEls() {
    els.fab = document.getElementById("ai-bot-fab");
    els.popup = document.getElementById("bot-popup");
    els.messages = document.getElementById("bot-messages");
    els.form = document.getElementById("bot-form");
    els.input = document.getElementById("bot-input");
    els.send = document.getElementById("bot-send-btn");
    els.minimizeBtn = document.getElementById("bot-minimize-btn");
    els.closeBtn = document.getElementById("bot-close-btn");
    els.langSelect = document.getElementById("bot-lang-select");
    els.micBtn = document.getElementById("bot-mic-btn");
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bot-bubble bot-bubble-${role}`;
    bubble.textContent = text;
    els.messages.appendChild(bubble);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function addActionButton(action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bot-action-btn";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      window.CareCrewNav.goTo(action.target);
      closePopup();
    });
    els.messages.appendChild(btn);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function openPopup() {
    els.popup.classList.add("open");
    els.fab.classList.add("hidden");
    if (!els.messages.children.length) {
      addBubble("bot", "How may I help you? / Main aapki kya madad karun?");
    }
    els.input.focus();
  }

  function closePopup() {
    els.popup.classList.remove("open");
    els.fab.classList.remove("hidden");
  }

  async function send(text) {
    addBubble("user", text);
    els.input.value = "";
    els.send.disabled = true;
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.botQuery(text, els.langSelect.value, token);
      addBubble("bot", res.reply);
      if (res.action) addActionButton(res.action);
    } catch (err) {
      addBubble("bot", `Sorry, something went wrong: ${err.message}`);
    } finally {
      els.send.disabled = false;
      els.input.focus();
    }
  }

  // Voice input via the browser's native SpeechRecognition API — real when
  // supported, a visibly-disabled placeholder otherwise. No external library.
  function setupVoice() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      els.micBtn.disabled = true;
      els.micBtn.title = "Voice input isn't supported in this browser";
      return;
    }

    recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      els.input.value = e.results[0][0].transcript;
    };
    recognition.onend = () => {
      recognizing = false;
      els.micBtn.classList.remove("recording");
    };
    recognition.onerror = () => {
      recognizing = false;
      els.micBtn.classList.remove("recording");
    };

    els.micBtn.addEventListener("click", () => {
      if (recognizing) {
        recognition.stop();
        return;
      }
      recognition.lang = els.langSelect.value === "hi" ? "hi-IN" : "en-IN";
      recognizing = true;
      els.micBtn.classList.add("recording");
      try {
        recognition.start();
      } catch (e) {
        recognizing = false;
        els.micBtn.classList.remove("recording");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheEls();
    setupVoice();

    els.fab.addEventListener("click", openPopup);
    els.minimizeBtn.addEventListener("click", closePopup);
    els.closeBtn.addEventListener("click", closePopup);

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = els.input.value.trim();
      if (!text) return;
      send(text);
    });
  });

  window.CareCrewBot = { open: openPopup, close: closePopup };
})();
