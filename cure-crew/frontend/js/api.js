// Thin wrapper around the backend's /api/auth and /api/session routes.
// API_BASE comes from js/config.js (loaded before this file) — that's the
// one place to change for a different backend URL (e.g. after deploying).
const API_BASE = window.CARECREW_API_BASE || "http://localhost:8000";

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no JSON body
  }

  if (!res.ok) {
    const detail = data && data.detail;
    const message =
      (data && data.message) ||
      (detail && typeof detail === "object" && detail.message) ||
      (typeof detail === "string" ? detail : null) ||
      "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return data;
}

const CareCrewAPI = {
  register(payload) {
    return apiRequest("/api/auth/register", { method: "POST", body: payload });
  },
  login(payload) {
    return apiRequest("/api/auth/login", { method: "POST", body: payload });
  },
  me(token) {
    return apiRequest("/api/auth/me", { token });
  },

  // Case-taking — app/api/routes.py. No auth required, but an optional token
  // links the session to the logged-in patient's account (for Reports later).
  startCase(token) {
    return apiRequest("/api/session/start", { method: "POST", body: {}, token });
  },
  sendCaseTurn({ session_id, patient_text, asked_slot }, token) {
    return apiRequest("/api/session/turn", {
      method: "POST",
      body: { session_id, patient_text, asked_slot },
      token,
    });
  },
  getFinalCaseSheet(session_id) {
    return apiRequest(`/api/session/${session_id}/final`);
  },
  getSessionSummary(session_id, audience = "patient") {
    return apiRequest(`/api/session/${session_id}/summary?audience=${audience}`);
  },

  // Patient navigation-action destinations — app/api/patient_routes.py, auth required.
  createAppointment(payload, token) {
    return apiRequest("/api/patients/me/appointments", { method: "POST", body: payload, token });
  },
  listAppointments(token) {
    return apiRequest("/api/patients/me/appointments", { token });
  },
  listReports(token) {
    return apiRequest("/api/patients/me/reports", { token });
  },
  getReportSummary(session_id, audience, token) {
    return apiRequest(`/api/patients/me/reports/${session_id}/summary?audience=${audience}`, { token });
  },

  // Doctor navigation-action destination — app/api/doctor_routes.py, auth required.
  listDoctorAppointments(token) {
    return apiRequest("/api/doctors/me/appointments", { token });
  },

  // Floating AI Bot — app/api/bot_routes.py. Separate contract from the
  // Symptom Check session endpoints above; the bot never touches case-taking state.
  botQuery(message, lang, token) {
    return apiRequest("/api/bot/query", { method: "POST", body: { message, lang }, token });
  },

  // Voice input (Sarvam speech-to-text) — multipart upload, so it can't go
  // through apiRequest()'s JSON-only body handling.
  async transcribeVoice(audioBlob, token) {
    const form = new FormData();
    form.append("audio", audioBlob, "recording.webm");

    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/bot/transcribe`, {
      method: "POST",
      headers,
      body: form,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // no JSON body
    }

    if (!res.ok) {
      const message = (data && data.message) || "Voice transcription failed. Please try again or type instead.";
      throw new Error(message);
    }

    return data;
  },
};
