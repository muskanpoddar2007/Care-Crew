// Thin wrapper around the backend's /api/auth routes.
// Change API_BASE if the backend isn't running on the default local port.
const API_BASE = "http://localhost:8000";

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
};
