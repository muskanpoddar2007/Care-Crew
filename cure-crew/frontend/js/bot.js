// Floating AI Bot widget — navigation/query assistant ONLY.
// Talks exclusively to POST /api/bot/query (app/api/bot_routes.py). Never
// touches /api/session/* — history-taking lives entirely in chat.js's
// Symptom Check flow, which this widget can only navigate TO, never run.
(function () {
  const els = {};
  let recording = false;

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

  // Voice input — records raw PCM via the Web Audio API and hand-encodes a
  // WAV file client-side, then sends it to Sarvam AI speech-to-text
  // (app/services/voice_service.py). Sarvam handles Hindi/Hinglish/English
  // code-mixed speech far better than the browser's built-in
  // SpeechRecognition (English-centric, patchy Hindi, Chrome-only) that this
  // replaces, and it auto-detects the spoken language, so this doesn't need
  // the reply-language selector at all.
  //
  // WHY NOT MediaRecorder: it only produces webm/opus in Chromium, and
  // Sarvam's API rejects that content type outright (verified against the
  // live API — only wav/mp3/aac/pcm/etc. are accepted). Encoding WAV
  // ourselves from raw PCM sidesteps that entirely, regardless of browser.
  let audioContext = null;
  let sourceNode = null;
  let processorNode = null;
  let silentGainNode = null;
  let mediaStream = null;
  let pcmChunks = [];

  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format = PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: "audio/wav" });
  }

  async function transcribeAndFill(blob) {
    const originalPlaceholder = els.input.placeholder;
    els.input.disabled = true;
    els.input.placeholder = "Transcribing...";
    try {
      const token = window.CareCrewSession.getToken();
      const res = await CareCrewAPI.transcribeVoice(blob, token);
      const transcript = res && res.data && res.data.transcript;
      if (transcript) {
        els.input.value = transcript;
      } else {
        addBubble("bot", "I couldn't make out any speech in that — please try again or type instead.");
      }
    } catch (err) {
      addBubble("bot", `Sorry, voice transcription failed: ${err.message}`);
    } finally {
      els.input.disabled = false;
      els.input.placeholder = originalPlaceholder;
      els.input.focus();
    }
  }

  function stopRecording() {
    recording = false;
    els.micBtn.classList.remove("recording");

    processorNode.disconnect();
    sourceNode.disconnect();
    silentGainNode.disconnect();
    mediaStream.getTracks().forEach((track) => track.stop());

    const sampleRate = audioContext.sampleRate;
    const totalLength = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    audioContext.close();

    const blob = encodeWav(merged, sampleRate);
    if (blob.size > 44) transcribeAndFill(blob); // more than just the empty-header size
  }

  function setupVoice() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AudioContextCtor) {
      els.micBtn.disabled = true;
      els.micBtn.title = "Voice input isn't supported in this browser";
      return;
    }

    els.micBtn.addEventListener("click", async () => {
      if (recording) {
        stopRecording();
        return;
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContextCtor();
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        // 4096-sample buffer, mono in, mono out — ScriptProcessorNode is
        // deprecated but universally supported; AudioWorklet would need a
        // separate module file for a modest gain here.
        processorNode = audioContext.createScriptProcessor(4096, 1, 1);
        pcmChunks = [];

        processorNode.onaudioprocess = (e) => {
          pcmChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };

        // ScriptProcessorNode only fires while connected to a destination —
        // route through a zero-gain node so the patient doesn't hear their
        // own mic echoed back.
        silentGainNode = audioContext.createGain();
        silentGainNode.gain.value = 0;
        sourceNode.connect(processorNode);
        processorNode.connect(silentGainNode);
        silentGainNode.connect(audioContext.destination);

        recording = true;
        els.micBtn.classList.add("recording");
      } catch (e) {
        // Mic permission denied or unavailable — fail quietly, user can still type.
        recording = false;
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
