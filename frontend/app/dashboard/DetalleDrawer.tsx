"use client";

import { useEffect, useState } from "react";
import type { EstadoPostulacion, Postulacion } from "@/lib/api";

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
  onClose,
  onMover,
  onGuardarNotas,
}: {
  post: Postulacion;
  onClose: () => void;
  onMover: (estado: EstadoPostulacion) => void;
  onGuardarNotas: (notas: string) => Promise<void>;
}) {
  const o = post.opportunity;
  const [notas, setNotas] = useState(post.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Solo al cambiar de postulación (no al guardar, que actualiza post.notas).
  useEffect(() => {
    setNotas(post.notas ?? "");
    setGuardado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const vencida = o.fecha_cierre ? new Date(o.fecha_cierre) < new Date() : false;

  async function guardar() {
    setGuardando(true);
    await onGuardarNotas(notas);
    setGuardando(false);
    setGuardado(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
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
              Los pliegos y la lista exacta de documentos están en el proceso en SECOP.
              Documentos que suelen pedir:
            </p>
            <ul className="mt-2 space-y-1">
              {DOCS_TIPICOS.map((d) => (
                <li key={d} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-gray-300">☐</span> {d}
                </li>
              ))}
            </ul>
            {o.url && (
              <a
                href={o.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Ver pliegos y requisitos en SECOP ↗
              </a>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Pronto podrás adjuntar aquí tus documentos para cada postulación.
            </p>
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
