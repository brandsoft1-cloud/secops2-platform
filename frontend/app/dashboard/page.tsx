"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  analizarPostulacion,
  asistentePostulacion,
  buscarOportunidades,
  clearToken,
  explorarSecop,
  explorarTotal,
  getMe,
  getToken,
  listOpportunities,
  listProfiles,
  listTeam,
  seguirProceso,
  updatePostulacion,
  type EstadoPostulacion,
  type ExploreItem,
  type Me,
  type Postulacion,
  type SearchProfile,
  type TeamMember,
} from "@/lib/api";
import DetalleDrawer from "./DetalleDrawer";

type Vista = "explorar" | "seguidos" | number; // number = id de perfil

const SIGUIENTE: Record<EstadoPostulacion, EstadoPostulacion | null> = {
  nueva: "revisando", revisando: "postulada", postulada: "ganada", ganada: null, descartada: null,
};
const ESTADO_META: Record<EstadoPostulacion, { label: string; clase: string }> = {
  nueva: { label: "Nueva", clase: "bg-blue-100 text-blue-700" },
  revisando: { label: "Revisando", clase: "bg-amber-100 text-amber-700" },
  postulada: { label: "Postulada", clase: "bg-purple-100 text-purple-700" },
  ganada: { label: "Ganada", clase: "bg-green-100 text-green-700" },
  descartada: { label: "Descartada", clase: "bg-gray-100 text-gray-500" },
};
const PASO = 10;
const RANGOS = [
  { d: 30, label: "Último mes" },
  { d: 90, label: "3 meses" },
  { d: 180, label: "6 meses" },
  { d: 365, label: "1 año" },
  { d: 730, label: "2 años" },
];

function formatoCOP(v: number | null) {
  if (v == null) return "Sin valor";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}
function fechaHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-CO") : "—";
}
function ubicacion(o: { ciudad: string | null; departamento: string | null }) {
  return [o.ciudad, o.departamento].filter(Boolean).join(", ") || "—";
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [posts, setPosts] = useState<Postulacion[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("explorar");
  const [dias, setDias] = useState(30);
  const [visibles, setVisibles] = useState(PASO);
  const [seguidos, setSeguidos] = useState<Set<string>>(new Set());
  const [siguiendo, setSiguiendo] = useState<string | null>(null);

  // Explorador en vivo (modo "Todas" y modo perfil)
  const [explorar, setExplorar] = useState<ExploreItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hayMasEx, setHayMasEx] = useState(true);
  const offsetRef = useRef(0);
  const cargandoRef = useRef(false);
  const hayMasRef = useRef(true);
  const profileIdRef = useRef<number | undefined>(undefined);
  const diasRef = useRef(30);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function cargarMasEx() {
    if (cargandoRef.current || !hayMasRef.current) return;
    cargandoRef.current = true;
    try {
      const batch = await explorarSecop(offsetRef.current, PASO, profileIdRef.current, diasRef.current);
      setExplorar((prev) => {
        const vistos = new Set(prev.map((p) => p.secop_id));
        const nuevos: ExploreItem[] = [];
        for (const b of batch) if (!vistos.has(b.secop_id)) { vistos.add(b.secop_id); nuevos.push(b); }
        return [...prev, ...nuevos];
      });
      offsetRef.current += batch.length;
      hayMasRef.current = batch.length === PASO;
      setHayMasEx(hayMasRef.current);
      setAviso(null);
    } catch {
      // Detener el scroll ante fallo de red (si no, el observador reintenta sin parar).
      hayMasRef.current = false;
      setHayMasEx(false);
      setAviso("No se pudo cargar más (red). Recarga para reintentar.");
    } finally {
      cargandoRef.current = false;
    }
  }
  function reiniciarExplorar() {
    offsetRef.current = 0; hayMasRef.current = true; cargandoRef.current = false;
    setExplorar([]); setHayMasEx(true); cargarMasEx();
  }
  async function cargarLista() {
    setPosts(await listOpportunities()); setVisibles(PASO);
  }
  async function cargarBase() {
    const [meData, perfiles, equipo] = await Promise.all([getMe(), listProfiles(), listTeam()]);
    setMe(meData); setProfiles(perfiles); setTeam(equipo); setLoading(false);
  }

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    cargarBase().catch(() => { clearToken(); router.push("/login"); });
  }, [router]);

  // Cambio de vista o de rango → recarga la lista correspondiente.
  useEffect(() => {
    if (!getToken()) return;
    if (vista === "seguidos") { cargarLista().catch(() => setAviso("No se pudo cargar.")); return; }
    profileIdRef.current = typeof vista === "number" ? vista : undefined;
    diasRef.current = dias;
    reiniciarExplorar();
    setTotal(null);
    explorarTotal(profileIdRef.current, dias).then((t) => setTotal(t.total)).catch(() => setTotal(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, dias]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      if (vista === "seguidos") setVisibles((v) => v + PASO);
      else cargarMasEx();
    });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, explorar.length, posts.length, visibles, hayMasEx]);

  async function buscar() {
    setBuscando(true); setAviso(null);
    try {
      const res = await buscarOportunidades();
      setMe(await getMe());
      if (vista === "seguidos") await cargarLista(); else reiniciarExplorar();
      setAviso(res.nuevas > 0 ? `✓ ${res.nuevas} nueva(s).` : "Sin procesos nuevos por ahora.");
    } catch { setAviso("No se pudo completar la búsqueda."); }
    finally { setBuscando(false); }
  }

  function upsertPost(post: Postulacion) {
    setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev.map((p) => (p.id === post.id ? post : p)) : [post, ...prev]));
  }
  async function seguir(item: ExploreItem, abrir = false, analizarTras = false) {
    setSiguiendo(item.secop_id);
    try {
      const post = await seguirProceso(item.secop_id);
      upsertPost(post);
      setSeguidos((s) => new Set(s).add(item.secop_id));
      if (analizarTras) upsertPost(await analizarPostulacion(post.id));
      if (abrir) setSeleccion(post.id);
    } catch { setAviso("No se pudo seguir el proceso."); }
    finally { setSiguiendo(null); }
  }
  async function mover(id: number, estado: EstadoPostulacion) { upsertPost(await updatePostulacion(id, { estado })); }
  async function guardarNotas(id: number, notas: string) { upsertPost(await updatePostulacion(id, { notas })); }
  async function asignar(id: number, a: number | null) { upsertPost(await updatePostulacion(id, { assignee_id: a, set_assignee: true })); }
  async function analizar(id: number) { upsertPost(await analizarPostulacion(id)); }
  async function asistente(id: number) { upsertPost(await asistentePostulacion(id)); }
  function salir() { clearToken(); router.push("/"); }

  if (loading) return <main className="min-h-screen grid place-items-center text-gray-400">Cargando…</main>;

  const esSeguidos = vista === "seguidos";
  const perfilActivo = typeof vista === "number" ? profiles.find((p) => p.id === vista) : null;
  const visibleProfile = posts.slice(0, visibles);
  const sentinelVisible = esSeguidos ? visibles < posts.length : hayMasEx;
  const titulo = esSeguidos ? "Procesos seguidos" : perfilActivo ? perfilActivo.name : "Procesos de contratación activos";

  const itemNav = (v: Vista, label: string, icon: string) => (
    <button onClick={() => setVista(v)}
      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${vista === v ? "bg-brand text-white" : "text-gray-700 hover:bg-gray-100"}`}>
      {icon} {label}
    </button>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <span className="font-bold text-brand">🎯 Radar de Licitaciones</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard/equipo" className="text-gray-500 hover:text-brand">👥 Equipo</Link>
          <span className="text-gray-600">{me?.company.name} · <strong className="uppercase">{me?.company.plan}</strong></span>
          <button onClick={salir} className="text-gray-500 hover:text-brand">Salir</button>
        </div>
      </header>

      <div className="flex">
        <aside className="w-60 shrink-0 border-r border-gray-200 bg-white p-4">
          <nav className="space-y-1">
            {itemNav("explorar", "Inicio (explorar)", "🌎")}
            {itemNav("seguidos", "Procesos seguidos", "❤️")}
            <Link href="/dashboard/equipo" className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">👥 Equipo</Link>
          </nav>
          <div className="mt-5 mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Perfiles</h2>
            <Link href="/dashboard/perfiles" className="text-xs text-brand hover:underline">+ Editar</Link>
          </div>
          <nav className="space-y-1">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => setVista(p.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${vista === p.id ? "bg-brand text-white" : "text-gray-700 hover:bg-gray-100"}`}>
                <span className="block font-medium">{p.name}</span>
                <span className={`block text-xs ${vista === p.id ? "text-teal-100" : "text-gray-400"}`}>
                  {p.departamento ?? "Sin zona"}{p.ciudad ? ` · ${p.ciudad}` : ""}
                </span>
              </button>
            ))}
            {profiles.length === 0 && (
              <Link href="/dashboard/perfiles" className="block rounded-lg bg-brand px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-dark">+ Crear mi perfil</Link>
            )}
          </nav>
        </aside>

        <section className="flex-1 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{titulo}</h1>
              <p className="text-sm text-gray-500">
                {esSeguidos
                  ? `${posts.length} proceso(s)`
                  : total != null && total >= 0
                    ? `Encontrados: ${total.toLocaleString("es-CO")} · mostrando ${explorar.length}`
                    : `Mostrando ${explorar.length}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={buscar} disabled={buscando || profiles.length === 0}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
                {buscando ? "Buscando…" : "🔄 Buscar ahora"}
              </button>
              {!esSeguidos && (
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  Rango:
                  <select value={dias} onChange={(e) => setDias(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none">
                    {RANGOS.map((r) => <option key={r.d} value={r.d}>{r.label}</option>)}
                  </select>
                </label>
              )}
              {aviso && <span className="text-xs text-gray-600">{aviso}</span>}
            </div>
          </div>

          {esSeguidos && posts.length === 0 && (
            <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-6 text-sm text-gray-600">
              Aún no sigues ningún proceso. Ve a un perfil o a “Inicio”, y dale ❤️ Seguir a los que te interesen.
            </div>
          )}

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {!esSeguidos
              ? explorar.map((o) => {
                  const yaSeg = seguidos.has(o.secop_id);
                  const cargando = siguiendo === o.secop_id;
                  return (
                    <article key={o.secop_id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-bold leading-snug">{o.entidad ?? "Entidad"}</p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Descripción</p>
                      <p className="text-sm line-clamp-3">{o.objeto ?? "—"}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Campo label="Modalidad"><span className="text-blue-600">{o.modalidad ?? "—"}</span></Campo>
                        <Campo label="Valor"><span className="font-semibold text-green-600">{formatoCOP(o.valor)}</span></Campo>
                        <Campo label="Ubicación">{ubicacion(o)}</Campo>
                        <Campo label="Estado"><span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{o.estado_secop ?? "—"}</span></Campo>
                      </div>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">📅 Publicado</p>
                      <p className="text-sm text-gray-600">{fechaHora(o.fecha_publicacion)}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        <button onClick={() => seguir(o, true, true)} disabled={cargando}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">✨ Analizar con IA</button>
                        <button onClick={() => seguir(o, true)} disabled={cargando}
                          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50">Ver más detalles</button>
                        <button onClick={() => seguir(o)} disabled={cargando || yaSeg}
                          className={`rounded-lg border px-3 py-1.5 text-xs ${yaSeg ? "border-red-200 text-red-500" : "border-gray-300 text-gray-600 hover:border-brand"}`}>
                          {yaSeg ? "❤️ Siguiendo" : "🤍 Seguir"}
                        </button>
                        {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-gray-400 hover:text-brand">SECOP ↗</a>}
                      </div>
                    </article>
                  );
                })
              : visibleProfile.map((post) => {
                  const o = post.opportunity;
                  const sig = SIGUIENTE[post.estado];
                  const em = ESTADO_META[post.estado];
                  return (
                    <article key={post.id} onClick={() => setSeleccion(post.id)}
                      className="flex cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:ring-1 hover:ring-brand">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold leading-snug">{o.entidad ?? "Entidad"}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${em.clase}`}>{em.label}</span>
                      </div>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Descripción</p>
                      <p className="text-sm line-clamp-2">{o.objeto ?? "—"}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Campo label="Modalidad"><span className="text-blue-600">{o.modalidad ?? "—"}</span></Campo>
                        <Campo label="Valor"><span className="font-semibold text-green-600">{formatoCOP(o.valor)}</span></Campo>
                        <Campo label="Ubicación">{ubicacion(o)}</Campo>
                        <Campo label="Cierre">{o.fecha_cierre ? new Date(o.fecha_cierre).toLocaleDateString("es-CO") : "—"}</Campo>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs">
                        {post.ia_afinidad != null && <span className="text-gray-500">✨ {post.ia_afinidad}/100</span>}
                        {post.assignee && <span className="text-gray-500">👤 {post.assignee.full_name || post.assignee.email}</span>}
                        <span className="text-brand">Ver detalle →</span>
                        {sig && <button onClick={(e) => { e.stopPropagation(); mover(post.id, sig); }} className="ml-auto rounded bg-brand px-2 py-1 text-white hover:bg-brand-dark">→ {sig}</button>}
                        {post.estado !== "descartada" && post.estado !== "ganada" && (
                          <button onClick={(e) => { e.stopPropagation(); mover(post.id, "descartada"); }} className="rounded border border-gray-300 px-2 py-1 text-gray-500 hover:border-gray-400">Descartar</button>
                        )}
                      </div>
                    </article>
                  );
                })}
            {sentinelVisible && <div ref={sentinelRef} className="col-span-full py-4 text-center text-xs text-gray-400">Cargando más…</div>}
          </div>
        </section>
      </div>

      {seleccion != null && posts.find((p) => p.id === seleccion) && (
        <DetalleDrawer
          post={posts.find((p) => p.id === seleccion)!}
          equipo={team}
          onClose={() => setSeleccion(null)}
          onMover={(estado) => mover(seleccion, estado)}
          onGuardarNotas={(notas) => guardarNotas(seleccion, notas)}
          onAsignar={(assigneeId) => asignar(seleccion, assigneeId)}
          onAnalizar={() => analizar(seleccion)}
          onAsistente={() => asistente(seleccion)}
        />
      )}
    </main>
  );
}
