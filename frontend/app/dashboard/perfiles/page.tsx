"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  clearToken,
  createProfile,
  deleteProfile,
  getToken,
  listProfiles,
  updateProfile,
  type SearchProfile,
} from "@/lib/api";

// Departamentos de Colombia (+ Bogotá). El radar busca en SECOP por este alcance.
const DEPARTAMENTOS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar",
  "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó",
  "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
  "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío",
  "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
  "Valle del Cauca", "Vaupés", "Vichada",
];

// Categorías sugeridas de palabras clave (la empresa puede añadir las suyas).
const SUGERIDAS = [
  "alimentación", "catering", "refrigerios", "comidas", "restaurante",
  "almuerzos", "víveres", "mercados", "panadería", "raciones",
];

// Palabras que descartan ruido común (p.ej. "alimentación animal").
const EXCL_SUGERIDAS = ["animal", "veterinario", "pecuario", "bovino", "porcino", "mascotas"];

// Ejemplos de códigos UNSPSC por sector (el usuario usa los de SU RUP). Son
// orientativos; el matching empareja por clase (primeros 6 dígitos).
const UNSPSC_SUGERIDOS: { code: string; label: string }[] = [
  { code: "80141600", label: "Eventos y ferias" },
  { code: "90101600", label: "Catering / banquetes" },
  { code: "82101500", label: "Publicidad y difusión" },
  { code: "90151800", label: "Logística de eventos" },
  { code: "72101500", label: "Construcción / obra" },
  { code: "76111500", label: "Aseo y limpieza" },
  { code: "44120000", label: "Papelería / útiles" },
  { code: "81111500", label: "Servicios de TI" },
  { code: "78111800", label: "Transporte" },
  { code: "53100000", label: "Dotación / uniformes" },
];

type Form = {
  name: string;
  departamento: string;
  ciudad: string;
  sector: string;
  unspsc_codes: string[];
  keywords: string[];
  exclude_keywords: string[];
  presupuesto_min: string;
  presupuesto_max: string;
  active: boolean;
};

const VACIO: Form = {
  name: "",
  departamento: "",
  ciudad: "",
  sector: "",
  unspsc_codes: [],
  keywords: [],
  exclude_keywords: [],
  presupuesto_min: "",
  presupuesto_max: "",
  active: true,
};

function aForm(p: SearchProfile): Form {
  return {
    name: p.name,
    departamento: p.departamento ?? "",
    ciudad: p.ciudad ?? "",
    sector: p.sector ?? "",
    unspsc_codes: p.unspsc_codes ?? [],
    keywords: p.keywords ?? [],
    exclude_keywords: p.exclude_keywords ?? [],
    presupuesto_min: p.presupuesto_min?.toString() ?? "",
    presupuesto_max: p.presupuesto_max?.toString() ?? "",
    active: p.active,
  };
}

export default function PerfilesPage() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null); // null = creando
  const [form, setForm] = useState<Form>(VACIO);
  const [nuevaKw, setNuevaKw] = useState("");
  const [nuevaExcl, setNuevaExcl] = useState("");
  const [nuevaUnspsc, setNuevaUnspsc] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    const data = await listProfiles();
    setPerfiles(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    cargar().catch(() => {
      clearToken();
      router.push("/login");
    });
  }, [router]);

  // Lleva la vista al formulario y enfoca el primer campo. En pantallas
  // angostas el formulario queda abajo, así que sin esto "no pasa nada" visible.
  function irAlForm() {
    nombreRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nombreRef.current?.focus({ preventScroll: true });
  }

  function nuevo() {
    setEditId(null);
    setForm(VACIO);
    setError(null);
  }

  function editar(p: SearchProfile) {
    setEditId(p.id);
    setForm(aForm(p));
    setError(null);
    irAlForm();
  }

  function toggleKw(kw: string) {
    setForm((f) => ({
      ...f,
      keywords: f.keywords.includes(kw)
        ? f.keywords.filter((k) => k !== kw)
        : [...f.keywords, kw],
    }));
  }

  function agregarKw() {
    const kw = nuevaKw.trim().toLowerCase();
    if (kw && !form.keywords.includes(kw)) {
      setForm((f) => ({ ...f, keywords: [...f.keywords, kw] }));
    }
    setNuevaKw("");
  }

  function toggleExcl(kw: string) {
    setForm((f) => ({
      ...f,
      exclude_keywords: f.exclude_keywords.includes(kw)
        ? f.exclude_keywords.filter((k) => k !== kw)
        : [...f.exclude_keywords, kw],
    }));
  }

  function agregarExcl() {
    const kw = nuevaExcl.trim().toLowerCase();
    if (kw && !form.exclude_keywords.includes(kw)) {
      setForm((f) => ({ ...f, exclude_keywords: [...f.exclude_keywords, kw] }));
    }
    setNuevaExcl("");
  }

  function toggleUnspsc(code: string) {
    setForm((f) => ({
      ...f,
      unspsc_codes: f.unspsc_codes.includes(code)
        ? f.unspsc_codes.filter((c) => c !== code)
        : [...f.unspsc_codes, code],
    }));
  }

  function agregarUnspsc() {
    const code = nuevaUnspsc.replace(/\D/g, ""); // solo dígitos
    if (code.length >= 6 && code.length <= 8 && !form.unspsc_codes.includes(code)) {
      setForm((f) => ({ ...f, unspsc_codes: [...f.unspsc_codes, code] }));
    }
    setNuevaUnspsc("");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.departamento) {
      setError("Elige un departamento.");
      return;
    }
    if (form.keywords.length === 0 && form.unspsc_codes.length === 0) {
      setError("Agrega al menos una palabra clave o un código UNSPSC.");
      return;
    }
    setGuardando(true);
    const payload: Partial<SearchProfile> = {
      name: form.name || "Mi búsqueda",
      sector: form.sector || null,
      unspsc_codes: form.unspsc_codes,
      keywords: form.keywords,
      exclude_keywords: form.exclude_keywords,
      ciudad: form.ciudad || null,
      departamento: form.departamento,
      presupuesto_min: form.presupuesto_min ? Number(form.presupuesto_min) : null,
      presupuesto_max: form.presupuesto_max ? Number(form.presupuesto_max) : null,
      active: form.active,
    };
    try {
      if (editId == null) await createProfile(payload);
      else await updateProfile(editId, payload);
      await cargar();
      nuevo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este perfil de búsqueda?")) return;
    await deleteProfile(id);
    if (editId === id) nuevo();
    await cargar();
  }

  if (loading) {
    return <main className="min-h-screen grid place-items-center text-gray-400">Cargando…</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="font-bold text-brand">🎯 Radar de Licitaciones</Link>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-brand">← Volver al panel</Link>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="text-2xl font-bold">Perfiles de búsqueda</h1>
        <p className="text-gray-600">
          Define qué licitaciones quieres vigilar. El rastreador busca en SECOP según estos criterios.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Lista de perfiles */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Tus perfiles ({perfiles.length})</h2>
              <button onClick={() => { nuevo(); irAlForm(); }} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">+ Nuevo perfil</button>
            </div>
            {perfiles.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Aún no tienes perfiles. Crea el primero en el formulario.
              </p>
            )}
            {perfiles.map((p) => (
              <article
                key={p.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${editId === p.id ? "border-brand ring-1 ring-brand" : "border-gray-200"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.departamento ?? "Sin departamento"}{p.ciudad ? ` · ${p.ciudad}` : ""}
                      {!p.active && " · (inactivo)"}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => editar(p)} className="text-brand hover:underline">Editar</button>
                    <button onClick={() => eliminar(p.id)} className="text-red-500 hover:underline">Eliminar</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.keywords.map((k) => (
                    <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{k}</span>
                  ))}
                </div>
              </article>
            ))}
          </section>

          {/* Formulario */}
          <section>
            <form onSubmit={guardar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700">
                {editId == null ? "Nuevo perfil" : "Editar perfil"}
              </h2>

              {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

              <div>
                <label className="block text-sm font-medium">Nombre del perfil</label>
                <input
                  ref={nombreRef}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. Catering en Tolima"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Departamento *</label>
                  <select
                    value={form.departamento}
                    onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                  >
                    <option value="">Elige…</option>
                    {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Ciudad (opcional)</label>
                  <input
                    value={form.ciudad}
                    onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                    placeholder="Acota a una ciudad"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Códigos UNSPSC (de tu RUP)</label>
                <p className="text-xs text-gray-500">
                  Acotan tu sector y mejoran la precisión. Toca un ejemplo o agrega los de tu RUP. Opcional pero recomendado.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {UNSPSC_SUGERIDOS.map(({ code, label }) => {
                    const on = form.unspsc_codes.includes(code);
                    return (
                      <button
                        type="button"
                        key={code}
                        onClick={() => toggleUnspsc(code)}
                        title={code}
                        className={`rounded-full px-3 py-1 text-xs ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {on ? "✓ " : "+ "}{label}
                      </button>
                    );
                  })}
                </div>
                {/* códigos personalizados (no sugeridos) */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.unspsc_codes.filter((c) => !UNSPSC_SUGERIDOS.some((s) => s.code === c)).map((c) => (
                    <span key={c} className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs text-white">
                      {c}
                      <button type="button" onClick={() => toggleUnspsc(c)} className="font-bold">×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nuevaUnspsc}
                    onChange={(e) => setNuevaUnspsc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarUnspsc(); } }}
                    inputMode="numeric"
                    placeholder="Código UNSPSC (6 a 8 dígitos)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <button type="button" onClick={agregarUnspsc} className="rounded-lg border border-gray-300 px-3 text-sm hover:border-brand">
                    Agregar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Palabras clave *</label>
                <p className="text-xs text-gray-500">Toca para activar/desactivar, o agrega las tuyas.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGERIDAS.map((kw) => {
                    const on = form.keywords.includes(kw);
                    return (
                      <button
                        type="button"
                        key={kw}
                        onClick={() => toggleKw(kw)}
                        className={`rounded-full px-3 py-1 text-xs ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {on ? "✓ " : "+ "}{kw}
                      </button>
                    );
                  })}
                </div>
                {/* keywords personalizadas no sugeridas */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.keywords.filter((k) => !SUGERIDAS.includes(k)).map((k) => (
                    <span key={k} className="flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs text-white">
                      {k}
                      <button type="button" onClick={() => toggleKw(k)} className="font-bold">×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nuevaKw}
                    onChange={(e) => setNuevaKw(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarKw(); } }}
                    placeholder="Agregar palabra clave"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <button type="button" onClick={agregarKw} className="rounded-lg border border-gray-300 px-3 text-sm hover:border-brand">
                    Agregar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Excluir (palabras a descartar)</label>
                <p className="text-xs text-gray-500">Evita falsos positivos, p.ej. &quot;animal&quot; para no traer &quot;alimentación animal&quot;.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXCL_SUGERIDAS.map((kw) => {
                    const on = form.exclude_keywords.includes(kw);
                    return (
                      <button
                        type="button"
                        key={kw}
                        onClick={() => toggleExcl(kw)}
                        className={`rounded-full px-3 py-1 text-xs ${on ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {on ? "✓ " : "+ "}{kw}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.exclude_keywords.filter((k) => !EXCL_SUGERIDAS.includes(k)).map((k) => (
                    <span key={k} className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs text-white">
                      {k}
                      <button type="button" onClick={() => toggleExcl(k)} className="font-bold">×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nuevaExcl}
                    onChange={(e) => setNuevaExcl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarExcl(); } }}
                    placeholder="Agregar palabra a excluir"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <button type="button" onClick={agregarExcl} className="rounded-lg border border-gray-300 px-3 text-sm hover:border-brand">
                    Agregar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Presupuesto mín. (COP)</label>
                  <input
                    type="number"
                    value={form.presupuesto_min}
                    onChange={(e) => setForm({ ...form, presupuesto_min: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Presupuesto máx. (COP)</label>
                  <input
                    type="number"
                    value={form.presupuesto_max}
                    onChange={(e) => setForm({ ...form, presupuesto_max: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Perfil activo (el rastreador lo usa)
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : editId == null ? "Crear perfil" : "Guardar cambios"}
                </button>
                {editId != null && (
                  <button type="button" onClick={nuevo} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-400">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
