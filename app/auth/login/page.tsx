'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [supabase] = useState(() => createClientComponentClient());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('No se pudo autenticar al usuario.');

      // Llamar a la función de base de datos para verificar el estado de la organización
      const { data: estado, error: rpcError } = await supabase.rpc('verificar_estado_organizacion', { p_user_id: authData.user.id });

      if (rpcError) {
        throw new Error(`Error al verificar el estado de la organización: ${rpcError.message}`);
      }

      if (estado === 'SUSPENDIDA') {
        // Redirigir a la página de suspensión
        window.location.href = '/auth/suspended';
      } else {
        // Para cualquier otro caso (ACTIVA, NO_ASOCIADO, etc.), ir al dashboard
        window.location.href = '/dashboard';
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico para recuperar la contraseña');
      return;
    }

    setLoadingReset(true);
    setError(null);
    setResetMessage(null);

    try {
      const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/set-password`;

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw error;
      }

      setResetMessage('Se ha enviado un enlace de recuperación a tu correo electrónico. Revisa tu bandeja de entrada y spam.');
      setShowResetModal(true);
    } catch (err: any) {
      setError(`Error al enviar el correo: ${err.message}`);
    } finally {
      setLoadingReset(false);
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
          {resetMessage && (
            <p className="text-sm text-green-400 bg-green-900/50 p-3 rounded-lg">{resetMessage}</p>
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
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loadingReset}
              className="font-medium text-sky-400 hover:text-sky-300 disabled:text-sky-600 disabled:cursor-not-allowed"
            >
              {loadingReset ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
            </button>
          </p>
          <p>
            ¿Quieres crear una nueva organización?{' '}
            <Link href="/auth/register" className="font-medium text-sky-400 hover:text-sky-300">
              Regístrate como administrador
            </Link>
          </p>
        </div>
      </div>

      {/* Modal de información sobre recuperación de contraseña */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">📧 Email de recuperación enviado</h3>
            <div className="text-slate-300 space-y-3 mb-6">
              <p>Se ha enviado un enlace de recuperación a <strong className="text-white">{email}</strong></p>
              <div className="bg-slate-700 p-3 rounded-lg text-sm">
                <p className="text-slate-200 font-semibold mb-2">Si no recibes el correo:</p>
                <ul className="space-y-1 text-slate-300">
                  <li>• Revisa tu carpeta de <strong>spam/correo no deseado</strong></li>
                  <li>• Verifica que escribiste correctamente tu email</li>
                  <li>• Espera hasta 10 minutos para que llegue</li>
                  <li>• Contacta al administrador si persiste el problema</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowResetModal(false)}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
