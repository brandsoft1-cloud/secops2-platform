"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  buscarOportunidades,
  clearToken,
  getMe,
  getToken,
  listOpportunities,
  listProfiles,
  updatePostulacion,
  type EstadoPostulacion,
  type Me,
  type Postulacion,
  type SearchProfile,
} from "@/lib/api";
import DetalleDrawer from "./DetalleDrawer";

function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const seg = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "hace un momento";
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  return `hace ${Math.floor(seg / 86400)} día(s)`;
}

const COLUMNAS: { estado: EstadoPostulacion; titulo: string; color: string }[] = [
  { estado: "nueva", titulo: "Nuevas", color: "bg-blue-50 border-blue-200" },
  { estado: "revisando", titulo: "Revisando", color: "bg-amber-50 border-amber-200" },
  { estado: "postulada", titulo: "Postuladas", color: "bg-purple-50 border-purple-200" },
  { estado: "ganada", titulo: "Ganadas", color: "bg-green-50 border-green-200" },
  { estado: "descartada", titulo: "Descartadas", color: "bg-gray-100 border-gray-200" },
];

const SIGUIENTE: Record<EstadoPostulacion, EstadoPostulacion | null> = {
  nueva: "revisando",
  revisando: "postulada",
  postulada: "ganada",
  ganada: null,
  descartada: null,
};

function formatoCOP(valor: number | null): string {
  if (valor == null) return "Sin valor";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Postulacion[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    const [meData, oportunidades, perfiles] = await Promise.all([
      getMe(),
      listOpportunities(),
      listProfiles(),
    ]);
    setMe(meData);
    setPosts(oportunidades);
    setProfiles(perfiles);
    setLoading(false);
  }

  async function buscar() {
    setBuscando(true);
    setAviso(null);
    try {
      const res = await buscarOportunidades();
      await cargar();
      setAviso(
        res.nuevas > 0
          ? `✓ Encontramos ${res.nuevas} oportunidad(es) nueva(s).`
          : "Búsqueda completa. No hay procesos nuevos por ahora."
      );
    } catch {
      setAviso("No se pudo completar la búsqueda. Intenta de nuevo.");
    } finally {
      setBuscando(false);
    }
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

  async function mover(id: number, estado: EstadoPostulacion) {
    const actualizado = await updatePostulacion(id, { estado });
    setPosts((prev) => prev.map((p) => (p.id === id ? actualizado : p)));
  }

  async function guardarNotas(id: number, notas: string) {
    const actualizado = await updatePostulacion(id, { notas });
    setPosts((prev) => prev.map((p) => (p.id === id ? actualizado : p)));
  }

  function salir() {
    clearToken();
    router.push("/");
  }

  if (loading) {
    return <main className="min-h-screen grid place-items-center text-gray-400">Cargando…</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <span className="font-bold text-brand">🎯 Radar de Licitaciones</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard/perfiles" className="text-gray-500 hover:text-brand">
            ⚙ Perfiles de búsqueda
          </Link>
          <span className="text-gray-600">
            {me?.company.name} · plan <strong className="uppercase">{me?.company.plan}</strong>
          </span>
          <button onClick={salir} className="text-gray-500 hover:text-brand">
            Salir
          </button>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tus oportunidades</h1>
            <p className="text-gray-600">
              {posts.length} proceso(s) que encajan con tu perfil · última búsqueda{" "}
              {haceCuanto(me?.company.last_searched_at ?? null)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={buscar}
              disabled={buscando || profiles.length === 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {buscando ? "Buscando en SECOP…" : "🔄 Buscar ahora"}
            </button>
            {aviso && <span className="text-xs text-gray-600">{aviso}</span>}
          </div>
        </div>

        {/* Guía paso a paso para que el flujo se entienda solo */}
        {profiles.length === 0 && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-6">
            <p className="font-semibold">👋 Empecemos · Paso 1 de 2</p>
            <p className="mt-1 text-sm text-gray-600">
              Crea tu perfil de búsqueda (tu sector y dónde operas) para que el radar sepa qué
              vigilar en SECOP por ti.
            </p>
            <Link
              href="/dashboard/perfiles"
              className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Crear mi perfil →
            </Link>
          </div>
        )}
        {profiles.length > 0 && posts.length === 0 && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-6">
            <p className="font-semibold">Paso 2 de 2 · Busca oportunidades</p>
            <p className="mt-1 text-sm text-gray-600">
              Ya tienes {profiles.length} perfil(es). Presiona <strong>Buscar ahora</strong> y el
              radar revisará SECOP. También lo hace solo cada día.
            </p>
            <button
              onClick={buscar}
              disabled={buscando}
              className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {buscando ? "Buscando…" : "🔄 Buscar ahora"}
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {COLUMNAS.map((col) => {
            const items = posts.filter((p) => p.estado === col.estado);
            return (
              <div key={col.estado} className={`rounded-xl border p-3 ${col.color}`}>
                <h2 className="mb-3 text-sm font-semibold text-gray-700">
                  {col.titulo} <span className="text-gray-400">({items.length})</span>
                </h2>
                <div className="space-y-3">
                  {items.map((post) => {
                    const o = post.opportunity;
                    const siguiente = SIGUIENTE[post.estado];
                    return (
                      <article
                        key={post.id}
                        onClick={() => setSeleccion(post.id)}
                        className="cursor-pointer rounded-lg bg-white p-3 shadow-sm hover:ring-1 hover:ring-brand"
                      >
                        <p className="text-xs font-medium text-gray-500">{o.entidad ?? "Entidad"}</p>
                        <p className="mt-1 text-sm font-medium line-clamp-3">{o.objeto ?? "—"}</p>
                        <p className="mt-2 text-xs text-gray-600">{formatoCOP(o.valor)}</p>
                        {o.fecha_cierre && (
                          <p className="text-xs text-gray-500">
                            Cierra: {new Date(o.fecha_cierre).toLocaleDateString("es-CO")}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-brand">Ver detalle →</span>
                          {siguiente && (
                            <button
                              onClick={(e) => { e.stopPropagation(); mover(post.id, siguiente); }}
                              className="ml-auto rounded bg-brand px-2 py-1 text-xs text-white hover:bg-brand-dark"
                            >
                              → {siguiente}
                            </button>
                          )}
                          {post.estado !== "descartada" && post.estado !== "ganada" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); mover(post.id, "descartada"); }}
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-gray-400"
                            >
                              Descartar
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {seleccion != null && posts.find((p) => p.id === seleccion) && (
        <DetalleDrawer
          post={posts.find((p) => p.id === seleccion)!}
          onClose={() => setSeleccion(null)}
          onMover={(estado) => mover(seleccion, estado)}
          onGuardarNotas={(notas) => guardarNotas(seleccion, notas)}
        />
      )}
    </main>
  );
}
