'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Sidebar from '../components/ui/sidebar';
import Header from '../components/ui/header';

// Este es el ID de usuario del Super-Administrador
const SUPER_ADMIN_USER_ID = process.env.NEXT_PUBLIC_SUPER_ADMIN_ID;

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth/login';
        return;
      }

      if (session.user.id === SUPER_ADMIN_USER_ID) {
        setIsAuthorized(true);
      } else {
        window.location.href = '/dashboard';
      }
    };

    checkAuthorization();
  }, []);

  if (!isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <p className="text-white text-lg">Verificando autorización...</p>
      </div>
    );
  }

  return (
    <div className="flex bg-slate-900 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
