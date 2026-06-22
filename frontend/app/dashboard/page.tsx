"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearToken,
  getMe,
  getToken,
  listOpportunities,
  updatePostulacion,
  type EstadoPostulacion,
  type Me,
  type Postulacion,
} from "@/lib/api";

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
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const [meData, oportunidades] = await Promise.all([getMe(), listOpportunities()]);
    setMe(meData);
    setPosts(oportunidades);
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

  async function mover(post: Postulacion, estado: EstadoPostulacion) {
    const actualizado = await updatePostulacion(post.id, { estado });
    setPosts((prev) => prev.map((p) => (p.id === post.id ? actualizado : p)));
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
          <span className="text-gray-600">
            {me?.company.name} · plan <strong className="uppercase">{me?.company.plan}</strong>
          </span>
          <button onClick={salir} className="text-gray-500 hover:text-brand">
            Salir
          </button>
        </div>
      </header>

      <div className="px-6 py-6">
        <h1 className="text-2xl font-bold">Tus oportunidades</h1>
        <p className="text-gray-600">
          {posts.length} proceso(s) detectados por el rastreador para tu empresa.
        </p>

        {posts.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
            Todavía no hay oportunidades. Cuando el rastreador encuentre procesos de SECOP
            que encajen con tu perfil de búsqueda, aparecerán aquí.
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
                      <article key={post.id} className="rounded-lg bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium text-gray-500">{o.entidad ?? "Entidad"}</p>
                        <p className="mt-1 text-sm font-medium line-clamp-3">{o.objeto ?? "—"}</p>
                        <p className="mt-2 text-xs text-gray-600">{formatoCOP(o.valor)}</p>
                        {o.fecha_cierre && (
                          <p className="text-xs text-gray-500">
                            Cierra: {new Date(o.fecha_cierre).toLocaleDateString("es-CO")}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {o.url && (
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-brand hover:underline"
                            >
                              Ver en SECOP ↗
                            </a>
                          )}
                          {siguiente && (
                            <button
                              onClick={() => mover(post, siguiente)}
                              className="ml-auto rounded bg-brand px-2 py-1 text-xs text-white hover:bg-brand-dark"
                            >
                              → {siguiente}
                            </button>
                          )}
                          {post.estado !== "descartada" && post.estado !== "ganada" && (
                            <button
                              onClick={() => mover(post, "descartada")}
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
    </main>
  );
}
