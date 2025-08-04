'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiLock, FiMail } from 'react-icons/fi';

function RegisterPersonalForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('org_id');
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!orgId) {
      setError('Enlace de registro inválido. Falta el identificador de la organización. Por favor, solicita un nuevo enlace.');
    }
  }, [orgId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
        setError('No se puede registrar sin un ID de organización válido.');
        return;
    }

    setError(null);
    setLoading(true);

    try {
      // 1. Verificar si el email existe en la tabla Personal DENTRO de la organización especificada.
      const { data: personalData, error: personalError } = await supabase
        .from('Personal')
        .select('id, supabase_user_id')
        .eq('email', email)
        .eq('id_organizacion', orgId)
        .single();

      if (personalError || !personalData) {
        throw new Error('Tu email no corresponde a un miembro del personal de esta organización.');
      }

      if (personalData.supabase_user_id) {
        throw new Error('Este email ya tiene una cuenta de usuario asociada. Intenta iniciar sesión.');
      }

      // 2. Crear el usuario en Supabase Auth
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/login`,
        },
      });

      if (authError) throw authError;
      if (!signUpData.user) throw new Error('No se pudo crear el usuario.');

      // 3. Vincular el nuevo ID de usuario con el registro de Personal
      const { error: updateError } = await supabase
        .from('Personal')
        .update({ supabase_user_id: signUpData.user.id })
        .eq('id', personalData.id);

      if (updateError) {
        // Opcional: Intentar eliminar el usuario de auth si la vinculación falla
        // para evitar usuarios huérfanos. Requiere permisos de administrador.
        console.error('Error de vinculación, el usuario de auth podría quedar huérfano:', updateError);
        throw new Error('Ocurrió un error al vincular tu cuenta con tu registro de personal.');
      }

      alert('¡Registro completado con éxito! Revisa tu correo para confirmar tu cuenta y luego podrás iniciar sesión.');
      router.push('/auth/login');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700">
          <h1 className="text-4xl font-bold text-white text-center mb-2">Registro de Personal</h1>
          <p className="text-slate-400 text-center mb-8">Crea tu cuenta para acceder al sistema.</p>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6" role="alert">
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="relative">
              <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="Tu Correo Electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              />
            </div>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Crea una Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading || !orgId}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                {loading ? 'Registrando...' : 'Crear Cuenta'}
              </button>
            </div>
          </form>
        </div>
        <div className="text-center mt-6">
          <Link href="/auth/login" className="text-sm font-medium text-sky-400 hover:text-sky-300">
            ¿Ya tienes una cuenta? Inicia Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterOperativePage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <RegisterPersonalForm />
        </Suspense>
    )
}