"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteDocumento,
  descargarDocumento,
  listDocumentos,
  subirDocumento,
  type Documento,
  type EstadoPostulacion,
  type Postulacion,
  type TeamMember,
} from "@/lib/api";

const ESTADOS: { estado: EstadoPostulacion; label: string }[] = [
  { estado: "nueva", label: "Nueva" },
  { estado: "revisando", label: "Revisando" },
  { estado: "postulada", label: "Postulada" },
  { estado: "ganada", label: "Ganada" },
  { estado: "descartada", label: "Descartada" },
];

// Documentos habituales en una licitación pública colombiana. Sirven de guía;
// los requisitos exactos están en los pliegos del proceso en SECOP.
const DOCS_TIPICOS = [
  "Cámara de comercio (≤30 días)",
  "RUT actualizado",
  "RUP (Registro Único de Proponentes)",
  "Certificación de experiencia",
  "Propuesta económica",
  "Certificados de pago de seguridad social y parafiscales",
];

function fmtCOP(v: number | null) {
  if (v == null) return "Sin valor publicado";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}
function fmtFecha(f: string | null) {
  return f ? new Date(f).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) : "—";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className="text-sm">{valor}</dd>
    </div>
  );
}

export default function DetalleDrawer({
  post,
  equipo,
  onClose,
  onMover,
  onGuardarNotas,
  onAsignar,
  onAnalizar,
  onAsistente,
}: {
  post: Postulacion;
  equipo: TeamMember[];
  onClose: () => void;
  onMover: (estado: EstadoPostulacion) => void;
  onGuardarNotas: (notas: string) => Promise<void>;
  onAsignar: (assigneeId: number | null) => void;
  onAnalizar: () => Promise<void>;
  onAsistente: () => Promise<void>;
}) {
  const o = post.opportunity;
  const [notas, setNotas] = useState(post.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [analizando, setAnalizando] = useState(false);
  const [asistiendo, setAsistiendo] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);

  async function analizar() {
    setAnalizando(true);
    setErrorIA(null);
    try {
      await onAnalizar();
    } catch (err) {
      setErrorIA(err instanceof Error ? err.message : "La IA no está disponible");
    } finally {
      setAnalizando(false);
    }
  }

  async function asistir() {
    setAsistiendo(true);
    setErrorIA(null);
    try {
      await onAsistente();
    } catch (err) {
      setErrorIA(err instanceof Error ? err.message : "La IA no está disponible");
    } finally {
      setAsistiendo(false);
    }
  }

  function colorAfinidad(n: number) {
    if (n >= 70) return "bg-green-100 text-green-700";
    if (n >= 40) return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-600";
  }

  // Solo al cambiar de postulación (no al guardar, que actualiza post.notas).
  useEffect(() => {
    setNotas(post.notas ?? "");
    setGuardado(false);
    setErrorDoc(null);
    listDocumentos(post.id).then(setDocs).catch(() => setDocs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setErrorDoc(null);
    try {
      await subirDocumento(post.id, file);
      setDocs(await listDocumentos(post.id));
    } catch (err) {
      setErrorDoc(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function quitarDoc(id: number) {
    await deleteDocumento(id);
    setDocs((d) => d.filter((x) => x.id !== id));
  }

  function pesoKB(b: number) {
    return b < 1024 ? `${b} B` : `${Math.round(b / 1024)} KB`;
  }

  const vencida = o.fecha_cierre ? new Date(o.fecha_cierre) < new Date() : false;

  async function guardar() {
    setGuardando(true);
    await onGuardarNotas(notas);
    setGuardando(false);
    setGuardado(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <p className="text-xs font-medium text-gray-500">{o.entidad ?? "Entidad"}</p>
            <h2 className="mt-1 text-lg font-bold leading-snug">{o.objeto ?? "—"}</h2>
          </div>
          <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-700">✕</button>
        </header>

        <div className="space-y-6 p-5">
          {/* Estado / pipeline */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Estado en tu pipeline</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e.estado}
                  onClick={() => onMover(e.estado)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    post.estado === e.estado
                      ? "bg-brand text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </section>

          {/* Responsable */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Responsable</p>
            <select
              value={post.assignee?.id ?? ""}
              onChange={(e) => onAsignar(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">Sin asignar</option>
              {equipo.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </section>

          {/* Análisis con IA */}
          <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">✨ Análisis con IA</p>
              {post.ia_afinidad != null && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorAfinidad(post.ia_afinidad)}`}>
                  Afinidad {post.ia_afinidad}/100
                </span>
              )}
            </div>

            {post.ia_resumen ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-700">{post.ia_resumen}</p>
                {post.ia_motivo && <p className="text-xs text-gray-500">¿Por qué? {post.ia_motivo}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                Pide un resumen en lenguaje llano y un puntaje de qué tan bien encaja con tu perfil.
              </p>
            )}

            <button
              onClick={analizar}
              disabled={analizando}
              className="mt-3 rounded-lg border border-brand px-3 py-1.5 text-sm text-brand hover:bg-teal-50 disabled:opacity-50"
            >
              {analizando ? "Analizando…" : post.ia_resumen ? "Volver a analizar" : "Analizar con IA"}
            </button>

            {/* Asistente: checklist + carta */}
            {post.ia_checklist && post.ia_checklist.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-600">Checklist de requisitos</p>
                <ul className="mt-1 space-y-1">
                  {post.ia_checklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-gray-300">☐</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {post.ia_carta && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600">Borrador de carta de presentación</p>
                <textarea
                  readOnly
                  value={post.ia_carta}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                />
              </div>
            )}
            <button
              onClick={asistir}
              disabled={asistiendo}
              className="mt-3 ml-0 rounded-lg border border-brand px-3 py-1.5 text-sm text-brand hover:bg-teal-50 disabled:opacity-50"
            >
              {asistiendo ? "Generando…" : post.ia_carta ? "Regenerar checklist y carta" : "Generar checklist y carta"}
            </button>

            {errorIA && <p className="mt-2 text-xs text-red-500">{errorIA}</p>}
          </section>

          {/* Datos del proceso */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del proceso</p>
            <dl className="grid grid-cols-2 gap-3">
              <Dato etiqueta="Valor (precio base)" valor={fmtCOP(o.valor)} />
              <Dato etiqueta="Modalidad" valor={o.modalidad} />
              <Dato etiqueta="Tipo de contrato" valor={o.tipo_contrato} />
              <Dato etiqueta="Estado en SECOP" valor={o.estado_secop} />
              <Dato etiqueta="Ubicación" valor={[o.ciudad, o.departamento].filter(Boolean).join(", ") || null} />
              <Dato etiqueta="Publicado" valor={fmtFecha(o.fecha_publicacion)} />
              <div>
                <dt className="text-xs text-gray-500">Cierre de ofertas</dt>
                <dd className={`text-sm ${vencida ? "text-red-600" : ""}`}>
                  {fmtFecha(o.fecha_cierre)}{vencida ? " (vencida)" : ""}
                </dd>
              </div>
            </dl>
          </section>

          {/* Requisitos / documentos */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Requisitos y documentos</p>
            <p className="text-sm text-gray-600">
              Prepara aquí tus documentos. Los pliegos exactos están en SECOP; la oferta se
              presenta allá. Suelen pedir:
            </p>
            <ul className="mt-2 space-y-1">
              {DOCS_TIPICOS.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-gray-300">☐</span> {d}
                </li>
              ))}
            </ul>

            {/* Mis documentos */}
            <div className="mt-4 rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium">Mis documentos ({docs.length})</p>
              {docs.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">Aún no has subido documentos.</p>
              )}
              <ul className="mt-2 space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <button
                      onClick={() => descargarDocumento(d.id, d.nombre)}
                      className="truncate text-left text-brand hover:underline"
                      title={d.nombre}
                    >
                      📄 {d.nombre}
                    </button>
                    <span className="shrink-0 text-xs text-gray-400">{pesoKB(d.tamano)}</span>
                    <button onClick={() => quitarDoc(d.id)} className="shrink-0 text-xs text-red-500 hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <input ref={fileInput} type="file" onChange={onArchivo} className="hidden" />
              <button
                onClick={() => fileInput.current?.click()}
                disabled={subiendo}
                className="mt-3 rounded-lg border border-brand px-3 py-1.5 text-sm text-brand hover:bg-teal-50 disabled:opacity-50"
              >
                {subiendo ? "Subiendo…" : "+ Subir documento"}
              </button>
              {errorDoc && <p className="mt-1 text-xs text-red-500">{errorDoc}</p>}
            </div>

            {o.url && (
              <a
                href={o.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Presentar oferta en SECOP ↗
              </a>
            )}
          </section>

          {/* Notas */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notas internas</p>
            <textarea
              value={notas}
              onChange={(e) => { setNotas(e.target.value); setGuardado(false); }}
              rows={4}
              placeholder="Anota responsables, avances, dudas para la oferta…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={guardar}
                disabled={guardando}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar notas"}
              </button>
              {guardado && <span className="text-sm text-green-600">✓ Guardado</span>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
