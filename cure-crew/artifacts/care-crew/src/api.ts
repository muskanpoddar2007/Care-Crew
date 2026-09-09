export type Role = 'patient' | 'doctor';
export type Lang = 'en' | 'hi' | 'hinglish';

export interface User {
  id: number | string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  department?: string | null;
  specialty?: string | null;
  photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SessionUser { token: string; user: User; }
export interface Evidence { value?: string; evidence?: string; turn_index?: number; }
export interface CaseSheet {
  session_id: string;
  patient_name?: string;
  age?: number | string;
  sex?: string;
  chief_complaint?: Evidence | string;
  hopi?: Evidence | string;
  past_history?: Evidence | string;
  drug_history?: Evidence | string;
  allergies?: Evidence | string;
  family_history?: Evidence | string;
  personal_history?: Evidence | string;
  review_of_systems?: Record<string, Evidence | string>;
  red_flags?: string[];
  is_urgent?: boolean;
  is_complete?: boolean;
  turn_count?: number;
  condition_key?: string;
  department?: string;
  patient_id?: string | number;
  completed_at?: string;
}
export interface Appointment {
  id: number | string;
  patient_id?: number | string;
  department: string;
  preferred_date?: string | null;
  note?: string | null;
  urgent?: boolean;
  status?: string;
  created_at?: string;
}

const API_BASE = (import.meta.env.VITE_CARECREW_API_BASE || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new ApiError(body?.message || body?.detail || 'Something went wrong. Please try again.', response.status);
  }
  return body?.data !== undefined ? body.data : body;
}

export const api = {
  auth: {
    register: (body: Record<string, unknown>) => request<{ access_token: string; token_type: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) => request<{ access_token: string; token_type: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: (token: string) => request<User>('/auth/me', {}, token),
  },
  session: {
    start: (token?: string) => request<{ session_id: string; next_question: string; next_slot?: string; is_urgent?: boolean }>('/session/start', { method: 'POST', body: JSON.stringify({}) }, token),
    turn: (body: { session_id: string; patient_text: string; asked_slot?: string }, token?: string) => request<{ next_question: string; next_slot?: string; is_urgent?: boolean; new_red_flags?: string[]; state: CaseSheet; is_complete?: boolean; department?: string; condition_key?: string; action?: string }>('/session/turn', { method: 'POST', body: JSON.stringify(body) }, token),
    final: (id: string, token?: string) => request<CaseSheet>(`/session/${id}/final`, {}, token),
    summary: (id: string, audience: 'patient' | 'doctor', token?: string) => request<{ summary: string; audience: string }>(`/session/${id}/summary?audience=${audience}`, {}, token),
    reports: (token: string) => request<CaseSheet[]>('/patients/me/reports', {}, token),
    reportSummary: (id: string, audience: 'patient' | 'doctor', token: string) => request<{ summary: string; audience: string }>(`/patients/me/reports/${id}/summary?audience=${audience}`, {}, token),
  },
  appointments: {
    patientList: (token: string) => request<Appointment[]>('/patients/me/appointments', {}, token),
    book: (body: { department: string; preferred_date: string | null; note: string | null; urgent: boolean }, token: string) => request<Appointment>('/patients/me/appointments', { method: 'POST', body: JSON.stringify(body) }, token),
    doctorList: (token: string) => request<Appointment[]>('/doctors/me/appointments', {}, token),
  },
  bot: {
    query: (body: { message: string; lang: Lang }, token?: string) => request<{ reply: string; action?: string }>('/bot/query', { method: 'POST', body: JSON.stringify(body) }, token),
  },
};

export function getStoredSession(): SessionUser | null {
  try { return JSON.parse(localStorage.getItem('carecrew-session') || 'null'); } catch { return null; }
}
export function saveSession(session: SessionUser) { localStorage.setItem('carecrew-session', JSON.stringify(session)); }
export function clearSession() { localStorage.removeItem('carecrew-session'); }