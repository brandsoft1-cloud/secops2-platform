// Cliente mínimo para hablar con el backend FastAPI.
// Guarda el token JWT en localStorage (suficiente para el MVP).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "radar_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Auth ---
export async function login(email: string, password: string): Promise<string> {
  // El backend usa OAuth2PasswordRequestForm (x-www-form-urlencoded)
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? "No se pudo iniciar sesión");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
  company_name: string;
  nit?: string;
}

export async function register(payload: RegisterPayload): Promise<string> {
  const data = await request<{ access_token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(data.access_token);
  return data.access_token;
}

export interface Me {
  id: number;
  email: string;
  full_name: string | null;
  company: { id: number; name: string; plan: string; trial_ends_at: string };
}

export const getMe = () => request<Me>("/api/auth/me");

// --- Oportunidades (CRM) ---
export type EstadoPostulacion =
  | "nueva"
  | "revisando"
  | "postulada"
  | "ganada"
  | "descartada";

export interface Opportunity {
  id: number;
  secop_id: string;
  entidad: string | null;
  objeto: string | null;
  valor: number | null;
  ciudad: string | null;
  departamento: string | null;
  estado_secop: string | null;
  modalidad: string | null;
  tipo_contrato: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  url: string | null;
}

export interface Postulacion {
  id: number;
  estado: EstadoPostulacion;
  notas: string | null;
  updated_at: string;
  opportunity: Opportunity;
}

export const listOpportunities = (estado?: EstadoPostulacion) =>
  request<Postulacion[]>(`/api/opportunities${estado ? `?estado=${estado}` : ""}`);

export const updatePostulacion = (
  id: number,
  data: { estado?: EstadoPostulacion; notas?: string }
) =>
  request<Postulacion>(`/api/opportunities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// --- Perfiles de búsqueda ---
export interface SearchProfile {
  id: number;
  name: string;
  sector: string | null;
  keywords: string[];
  ciudad: string | null;
  departamento: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  active: boolean;
}

export const listProfiles = () => request<SearchProfile[]>("/api/profiles");

export const createProfile = (data: Partial<SearchProfile>) =>
  request<SearchProfile>("/api/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProfile = (id: number, data: Partial<SearchProfile>) =>
  request<SearchProfile>(`/api/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteProfile = (id: number) =>
  request<void>(`/api/profiles/${id}`, { method: "DELETE" });
