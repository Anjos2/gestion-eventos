'use client';

import Link from 'next/link';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-slate-900 text-white">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-600">
          Plataforma de Gestión de Eventos
        </h1>
        <p className="mt-6 text-lg md:text-xl text-slate-300">
          Organiza, gestiona y paga a tu personal de forma centralizada, eficiente y sin complicaciones.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link
            href="/auth/login"
            className="w-full sm:w-auto rounded-lg bg-sky-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 transition-transform transform hover:scale-105"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/auth/register"
            className="w-full sm:w-auto rounded-lg border-2 border-slate-600 px-8 py-4 text-lg font-semibold text-slate-300 hover:bg-slate-800 hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 transition-all"
          >
            Registrarse <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
