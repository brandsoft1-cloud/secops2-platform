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
  phone?: string;
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

export type Rol = "admin" | "miembro";

export interface Me {
  id: number;
  email: string;
  full_name: string | null;
  role: Rol;
  company: {
    id: number;
    name: string;
    plan: string;
    trial_ends_at: string;
    last_searched_at: string | null;
    telegram_chat_id: string | null;
  };
}

export const getMe = () => request<Me>("/api/auth/me");

export interface BuscarResult {
  nuevas: number;
  last_searched_at: string | null;
}

// Dispara la búsqueda en SECOP para la empresa (botón "Buscar ahora").
export const buscarOportunidades = () =>
  request<BuscarResult>("/api/opportunities/buscar", { method: "POST" });

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

export interface Assignee {
  id: number;
  full_name: string | null;
  email: string;
}

export interface Postulacion {
  id: number;
  estado: EstadoPostulacion;
  notas: string | null;
  updated_at: string;
  assignee: Assignee | null;
  // Análisis de IA (null hasta que se solicita).
  ia_resumen: string | null;
  ia_afinidad: number | null;
  ia_motivo: string | null;
  ia_checklist: string[] | null;
  ia_carta: string | null;
  opportunity: Opportunity;
}

export const listOpportunities = (estado?: EstadoPostulacion, profileId?: number) => {
  const qs = new URLSearchParams();
  if (estado) qs.set("estado", estado);
  if (profileId != null) qs.set("profile_id", String(profileId));
  const q = qs.toString();
  return request<Postulacion[]>(`/api/opportunities${q ? `?${q}` : ""}`);
};

// Explorador: TODO SECOP II (abierto reciente), paginado de N en N. Son procesos
// crudos (sin estado/CRM ni id propio), para navegar sin filtro de empresa.
export interface ExploreItem {
  secop_id: string;
  entidad: string | null;
  objeto: string | null;
  valor: number | null;
  ciudad: string | null;
  departamento: string | null;
  estado_secop: string | null;
  modalidad: string | null;
  tipo_contrato: string | null;
  unspsc_codes: string[];
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  url: string | null;
}

export const explorarSecop = (offset: number, limit = 10) =>
  request<ExploreItem[]>(`/api/opportunities/explorar?offset=${offset}&limit=${limit}`);

export const explorarTotal = () =>
  request<{ total: number }>("/api/opportunities/explorar/total");

// Sigue un proceso del explorador: lo agrega al panel (crea la postulación).
export const seguirProceso = (secopId: string) =>
  request<Postulacion>("/api/opportunities/seguir", {
    method: "POST",
    body: JSON.stringify({ secop_id: secopId }),
  });

export const updatePostulacion = (
  id: number,
  data: {
    estado?: EstadoPostulacion;
    notas?: string;
    assignee_id?: number | null;
    set_assignee?: boolean;
  }
) =>
  request<Postulacion>(`/api/opportunities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// IA: resume la oportunidad y puntúa su afinidad con el perfil.
export const analizarPostulacion = (id: number) =>
  request<Postulacion>(`/api/opportunities/${id}/analizar`, { method: "POST" });

// IA: genera checklist de requisitos y borrador de carta de presentación.
export const asistentePostulacion = (id: number) =>
  request<Postulacion>(`/api/opportunities/${id}/asistente`, { method: "POST" });

// --- Equipo (multiusuario) ---
export interface TeamMember {
  id: number;
  email: string;
  full_name: string | null;
  role: Rol;
  is_active: boolean;
}

export const listTeam = () => request<TeamMember[]>("/api/team");

export const createTeamMember = (data: {
  email: string;
  password: string;
  full_name?: string;
  role: Rol;
}) => request<TeamMember>("/api/team", { method: "POST", body: JSON.stringify(data) });

export const deleteTeamMember = (id: number) =>
  request<void>(`/api/team/${id}`, { method: "DELETE" });

// Ajustes de empresa (solo admin). Por ahora, el chat de Telegram para alertas.
export const updateCompanySettings = (data: { telegram_chat_id: string | null }) =>
  request<Me["company"]>("/api/team/empresa", {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// --- Perfiles de búsqueda ---
export interface SearchProfile {
  id: number;
  name: string;
  sector: string | null;
  unspsc_codes: string[];
  keywords: string[];
  exclude_keywords: string[];
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

// --- Documentos por postulación ---
export interface Documento {
  id: number;
  nombre: string;
  content_type: string | null;
  tamano: number;
  created_at: string;
}

export const listDocumentos = (postId: number) =>
  request<Documento[]>(`/api/postulaciones/${postId}/documentos`);

export const deleteDocumento = (id: number) =>
  request<void>(`/api/documentos/${id}`, { method: "DELETE" });

// La subida usa multipart/form-data; no se puede pasar por request() (que fuerza JSON).
export async function subirDocumento(postId: number, file: File): Promise<Documento> {
  const fd = new FormData();
  fd.append("archivo", file);
  const token = getToken();
  const res = await fetch(`${API_URL}/api/postulaciones/${postId}/documentos`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `Error ${res.status}`);
  }
  return res.json();
}

// Descarga con el token en el header (no sirve un <a href> simple).
export async function descargarDocumento(id: number, nombre: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/documentos/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("No se pudo descargar");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
