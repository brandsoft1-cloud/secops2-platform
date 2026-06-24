"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  clearToken,
  createTeamMember,
  deleteTeamMember,
  getMe,
  getToken,
  listTeam,
  type Me,
  type Rol,
  type TeamMember,
} from "@/lib/api";

export default function EquipoPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "miembro" as Rol });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [meData, miembros] = await Promise.all([getMe(), listTeam()]);
    setMe(meData);
    setTeam(miembros);
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

  const esAdmin = me?.role === "admin";

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await createTeamMember(form);
      setForm({ full_name: "", email: "", password: "", role: "miembro" });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id: number) {
    if (!confirm("¿Quitar a esta persona del equipo?")) return;
    await deleteTeamMember(id);
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

      <div className="mx-auto max-w-3xl px-6 py-6">
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-gray-600">
          Las personas de {me?.company.name} que usan el radar.
          {!esAdmin && " Solo un administrador puede agregar o quitar usuarios."}
        </p>

        <section className="mt-6 space-y-2">
          {team.map((u) => (
            <article key={u.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-medium">{u.full_name || u.email}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "admin" ? "bg-brand text-white" : "bg-gray-100 text-gray-600"}`}>
                  {u.role === "admin" ? "Administrador" : "Miembro"}
                </span>
                {esAdmin && u.id !== me?.id && (
                  <button onClick={() => quitar(u.id)} className="text-xs text-red-500 hover:underline">Quitar</button>
                )}
              </div>
            </article>
          ))}
        </section>

        {esAdmin && (
          <section className="mt-6">
            <form onSubmit={agregar} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700">Agregar persona</h2>
              {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Nombre</label>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Rol</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Rol })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                  >
                    <option value="miembro">Miembro</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">Correo</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Contraseña inicial</label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">Compártela con la persona; podrá entrar con su correo y esta clave.</p>
              </div>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {guardando ? "Agregando…" : "Agregar al equipo"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
