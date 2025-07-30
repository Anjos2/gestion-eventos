'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Sidebar from '../components/ui/sidebar';
import Header from '../components/ui/header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth/login';
      } else {
        setSession(session);
      }
    };

    getSession();
  }, []);

  if (!session) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <p className="text-white text-lg">Cargando...</p>
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
