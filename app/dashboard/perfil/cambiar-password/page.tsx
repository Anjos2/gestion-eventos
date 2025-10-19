'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { FiLock, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CambiarPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Por favor, completa todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Cambiando contraseña...');

    try {
      // 1. Verificar la contraseña actual
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error('No se pudo obtener el usuario actual');
      }

      // Intentar hacer login con la contraseña actual para verificarla
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('La contraseña actual es incorrecta');
      }

      // 2. Actualizar a la nueva contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      toast.success('¡Contraseña actualizada exitosamente!', { id: toastId });

      // Limpiar formulario
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar la contraseña', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <FiArrowLeft />
          Volver al dashboard
        </Link>
      </div>

      <div className="bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 border border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-slate-900 p-3 rounded-full">
            <FiLock className="text-sky-400 text-2xl" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Cambiar contraseña</h1>
            <p className="text-slate-400 text-sm">Actualiza tu contraseña de acceso</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-6">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-semibold text-slate-300 mb-2">
              Contraseña actual
            </label>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                placeholder="Ingresa tu contraseña actual"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-300 mb-2">
              Nueva contraseña
            </label>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">La contraseña debe tener al menos 6 caracteres</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-300 mb-2">
              Confirmar nueva contraseña
            </label>
            <div className="relative">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                placeholder="Repite la nueva contraseña"
                disabled={loading}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Cambiando contraseña...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-2">💡 Consejos de seguridad:</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Usa una contraseña única que no uses en otros sitios</li>
            <li>• Combina letras, números y símbolos</li>
            <li>• Evita usar información personal fácil de adivinar</li>
            <li>• Cambia tu contraseña regularmente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
