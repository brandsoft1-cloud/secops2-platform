"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: "",
    full_name: "",
    email: "",
    password: "",
    nit: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(campo: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [campo]: e.target.value });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow">
        <Link href="/" className="text-brand font-bold">
          🎯 Radar de Licitaciones
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Crea tu cuenta</h1>
        <p className="text-sm text-gray-500">14 días gratis. Sin tarjeta.</p>

        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <label className="mt-6 block text-sm font-medium">Nombre de la empresa</label>
        <input
          required
          value={form.company_name}
          onChange={update("company_name")}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium">Tu nombre</label>
        <input
          value={form.full_name}
          onChange={update("full_name")}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium">NIT (opcional)</label>
        <input
          value={form.nit}
          onChange={update("nit")}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium">Correo</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={update("email")}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update("password")}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
