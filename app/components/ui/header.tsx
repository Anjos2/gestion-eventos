'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/app/context/OrganizationContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { FiMenu, FiUser, FiLogOut, FiPhone } from 'react-icons/fi';

interface HeaderProps {
  toggleSidebar: () => void;
}

export default function Header({ toggleSidebar }: HeaderProps) {
  const { session, userRole } = useOrganization();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isMenuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <header className="bg-slate-900/50 backdrop-blur-sm text-white p-4 flex justify-between items-center border-b border-slate-800">
      {/* Botón de menú para móviles */}
      <button onClick={toggleSidebar} className="md:hidden text-2xl">
        <FiMenu />
      </button>

      {/* Título o espacio en pantallas grandes */}
      <div className="hidden md:block">
        {/* Puedes poner un título aquí si lo deseas */}
      </div>

      {/* Menú de usuario */}
      <div className="flex items-center gap-6">
        {/* Botón de Soporte por WhatsApp */}
        {(userRole === 'ADMINISTRATIVO' || userRole === 'ADMINISTRATIVO_APOYO') && (
          <a
            href="https://wa.me/51999636452?text=Hola%2C%20tengo%20una%20consulta%20sobre%20la%20plataforma%20de%20gesti%C3%B3n%20de%20eventos."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
            title="Contactar a soporte por WhatsApp"
          >
            <FiPhone className="text-xl"/>
            <span className="hidden sm:inline text-sm font-semibold">Soporte</span>
          </a>
        )}

        {/* Menú de Usuario */}
        <div className="relative">
          <button onClick={() => setMenuOpen(!isMenuOpen)} className="flex items-center space-x-3">
            <FiUser className="text-lg" />
            <span className="font-semibold text-sm truncate">{session?.user?.email || 'Usuario'}</span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-md shadow-lg py-1 z-50">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                <FiLogOut className="mr-2" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

