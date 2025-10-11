'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

function SetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>('Verificando...');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Verificar si es un reset de contraseña basado en los parámetros de la URL
    const type = searchParams.get('type');
    setIsPasswordReset(type === 'recovery');

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        if (type === 'recovery') {
          setMessage('¡Enlace de recuperación verificado! Por favor, establece tu nueva contraseña.');
        } else {
          setMessage('¡Invitación verificada! Por favor, establece tu contraseña.');
        }
        setError(null);
      }
    });

    // Limpia el listener cuando el componente se desmonta
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, searchParams]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      if (isPasswordReset) {
        // Para reset de contraseña, simplemente redirigir al dashboard
        setMessage('¡Contraseña actualizada con éxito! Redirigiendo al dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        // Para invitación de personal, vincular el usuario con el registro de Personal
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          const { error: linkError } = await supabase
            .from('Personal')
            .update({ supabase_user_id: user.id })
            .eq('email', user.email);

          if (linkError) {
            console.error('Error al vincular el usuario con el personal:', linkError);
            setError('Tu contraseña ha sido creada, pero hubo un problema al configurar tu cuenta. Por favor, contacta a soporte.');
          } else {
            setMessage('¡Contraseña establecida con éxito! Redirigiendo al dashboard...');
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          }
        } else {
          throw new Error('No se pudo obtener la información del usuario para finalizar la configuración.');
        }
      }

    } catch (err: any) {
      setError(`Error al establecer la contraseña: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700">
        <h1 className="text-4xl font-bold text-white text-center mb-2">
          {isPasswordReset ? 'Actualizar Contraseña' : 'Crea tu Contraseña'}
        </h1>
        <p className="text-slate-400 text-center mb-8">
          {isPasswordReset 
            ? 'Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.'
            : 'Bienvenido/a. Tu usuario será tu correo electrónico.'
          }
        </p>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6" role="alert">
            <p>{error}</p>
          </div>
        )}
        {message && !error && (
          <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded-lg mb-6" role="alert">
            <p>{message}</p>
          </div>
        )}

        <form onSubmit={handleSetPassword} className="space-y-6">
          <div className="relative">
            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nueva Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          <div className="relative">
            <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirmar Contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : (isPasswordReset ? 'Actualizar Contraseña' : 'Guardar Contraseña y Acceder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-slate-400">Cargando...</p></div>}>
      <SetPasswordForm />
    </Suspense>
  );
}
