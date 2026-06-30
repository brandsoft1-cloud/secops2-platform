"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";

const RECORDAR_KEY = "radar_email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Al cargar, prellena el correo si quedó guardado.
  useEffect(() => {
    const guardado = localStorage.getItem(RECORDAR_KEY);
    if (guardado) {
      setEmail(guardado);
      setRecordar(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Trim del correo: evita que espacios al copiar/pegar rompan el login.
    const correo = email.trim();
    try {
      await login(correo, password);
      // Recordar solo el usuario; la contraseña la guarda el navegador de forma segura.
      if (recordar) localStorage.setItem(RECORDAR_KEY, correo);
      else localStorage.removeItem(RECORDAR_KEY);
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

        <label htmlFor="email" className="mt-6 block text-sm font-medium">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium">Contraseña</label>
        <div className="relative mt-1">
          <input
            id="password"
            name="password"
            type={verPass ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setVerPass((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-brand"
          >
            {verPass ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={recordar}
            onChange={(e) => setRecordar(e.target.checked)}
          />
          Recordar mi usuario
        </label>

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
