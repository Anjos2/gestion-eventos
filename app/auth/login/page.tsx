'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Iniciar sesión</h1>
          <p className="text-slate-400 mt-2">Bienvenido de nuevo</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2" htmlFor="email">
              Correo electrónico
            </label>
            <input
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2" htmlFor="password">
              Contraseña
            </label>
            <input
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>
          )}
          <div>
            <button
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Iniciando...' : 'Iniciar sesión'}
            </button>
          </div>
        </form>
        <div className="text-center text-sm text-slate-400 space-y-2">
          <p>
            ¿Quieres crear una nueva organización?{' '}
            <Link href="/auth/register" className="font-medium text-sky-400 hover:text-sky-300">
              Regístrate como administrador
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
