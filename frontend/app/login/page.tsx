"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow">
        <Link href="/" className="text-brand font-bold">
          🎯 Radar de Licitaciones
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Entrar</h1>

        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <label className="mt-6 block text-sm font-medium">Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-brand py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-brand hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
    </main>
  );
}
