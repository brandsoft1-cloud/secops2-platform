import Link from "next/link";

const planes = [
  {
    nombre: "Esencial",
    precio: "79.000",
    features: ["Alertas por correo", "1 sector", "Panel CRM completo"],
    destacado: false,
  },
  {
    nombre: "Pro",
    precio: "149.000",
    features: ["Todo lo de Esencial", "Alertas por WhatsApp", "Varios sectores", "Multiusuario"],
    destacado: true,
  },
  {
    nombre: "Agencia",
    precio: "299.000+",
    features: ["Todo lo de Pro", "Varias empresas/clientes", "Soporte prioritario"],
    destacado: false,
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-xl font-bold text-brand">🎯 Radar de Licitaciones</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-gray-600 hover:text-brand">
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
          >
            Prueba gratis
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
          Vigilamos <span className="text-brand">SECOP II</span> por tu empresa
          y te avisamos qué contratos públicos puedes ganar.
        </h1>
        <p className="mt-6 text-lg text-gray-600">
          Deja de revisar SECOP a mano y de perder los cierres. Recibe alertas de
          los procesos que encajan con tu negocio y gestiónalos en un panel simple.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
          >
            Empieza gratis 14 días
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:border-brand"
          >
            Ya tengo cuenta
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-400">Sin tarjeta. Cancela cuando quieras.</p>
      </section>

      {/* Cómo funciona */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
          {[
            ["1. Configura tu sector", "Eliges tu rubro y palabras clave. El sistema sugiere las mejores."],
            ["2. Te avisamos", "Cada proceso nuevo de SECOP que encaja te llega por correo (o WhatsApp)."],
            ["3. Gestionas y ganas", "Mueves cada oportunidad de Nueva → Postulada → Ganada en tu panel."],
          ].map(([titulo, texto]) => (
            <div key={titulo}>
              <h3 className="font-semibold text-lg text-brand">{titulo}</h3>
              <p className="mt-2 text-gray-600">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <h2 className="text-center text-3xl font-bold">Planes</h2>
        <p className="text-center text-gray-600 mt-2">Empieza con 14 días gratis en cualquier plan.</p>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {planes.map((plan) => (
            <div
              key={plan.nombre}
              className={`rounded-2xl border p-6 ${
                plan.destacado ? "border-brand shadow-lg ring-1 ring-brand" : "border-gray-200"
              }`}
            >
              {plan.destacado && (
                <span className="text-xs font-semibold text-brand">MÁS POPULAR</span>
              )}
              <h3 className="text-xl font-bold mt-1">{plan.nombre}</h3>
              <p className="mt-2">
                <span className="text-3xl font-bold">${plan.precio}</span>
                <span className="text-gray-500"> COP/mes</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-600">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-6 block rounded-lg px-4 py-2 text-center font-medium ${
                  plan.destacado
                    ? "bg-brand text-white hover:bg-brand-dark"
                    : "border border-gray-300 hover:border-brand"
                }`}
              >
                Empezar
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
        Radar de Licitaciones · de Brandsoft / Aura Sabor · Ibagué, Colombia
      </footer>
    </main>
  );
}
