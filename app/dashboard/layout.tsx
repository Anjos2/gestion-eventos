'use client';

import { useEffect, useState } from 'react';
import { OrganizationProvider, useOrganization } from '../context/OrganizationContext';
import Sidebar from '../components/ui/sidebar';
import Header from '../components/ui/header';
import { useRouter } from 'next/navigation';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { session, organization, isLoading } = useOrganization();
  const router = useRouter();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/auth/login');
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <p className="text-white text-lg">Cargando...</p>
      </div>
    );
  }

  const isSuspended = organization?.estado === 'SUSPENDIDA';

  return (
    <div className="flex bg-slate-900 text-slate-100 min-h-screen">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
      <div className="flex-1 flex flex-col h-screen">
        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        {isSuspended && (
          <div className="bg-red-500 text-white text-center p-4">
            <p>Tu organización está suspendida. Todas las funcionalidades de creación y edición han sido deshabilitadas. Por favor, contacta al soporte para regularizar tu situación.</p>
          </div>
        )}
        <main className={`flex-1 p-4 md:p-8 overflow-y-auto ${isSuspended ? 'pointer-events-none opacity-50' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider>
      <DashboardContent>{children}</DashboardContent>
    </OrganizationProvider>
  );
}

