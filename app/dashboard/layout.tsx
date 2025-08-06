'use client';

import { useEffect, useState } from 'react';
import { OrganizationProvider, useOrganization } from '../context/OrganizationContext';
import Sidebar from '../components/ui/sidebar';
import Header from '../components/ui/header';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { session, organization, billingInfo, isLoading, supabase } = useOrganization();
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
  const showAlert = organization?.alerta_activa && !isSuspended;

  const handleMarkAlertAsRead = async () => {
    if (!organization) return;

    const { error } = await supabase
      .from('Organizaciones')
      .update({ alerta_activa: false, mensaje_alerta: null })
      .eq('id', organization.id);

    if (error) {
      toast.error('Error al marcar la alerta como leída.');
    } else {
      // Optimistamente actualizamos la UI, pero el contexto se recargará de todos modos.
      window.location.reload(); // Forzar recarga para asegurar que el contexto se actualice
    }
  };

  return (
    <div className="flex bg-slate-900 text-slate-100 min-h-screen">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#334155',
            color: '#fff',
          },
        }}
      />
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
      <div className="flex-1 flex flex-col h-screen w-0">
        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        {showAlert && (
          <div className="bg-amber-600 text-white p-4 text-center">
            <p>{organization.mensaje_alerta}</p>
            <button 
              onClick={handleMarkAlertAsRead}
              className="mt-2 px-4 py-1 bg-white text-amber-700 rounded-md font-semibold hover:bg-gray-200"
            >
              Entendido
            </button>
          </div>
        )}
        {isSuspended && billingInfo && (
          <div className="bg-red-800 border-t-4 border-red-500 text-white p-6 shadow-lg">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold mb-2">Acceso Suspendido</h2>
              <p className="mb-4">Tu organización tiene un pago pendiente. Para reactivar tu servicio, por favor, realiza el pago a través de Yape.</p>
              <div className="bg-slate-900/50 p-6 rounded-lg flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-slate-400 text-sm">Monto a Pagar</p>
                  <p className="text-sky-400 font-bold text-4xl mb-4">S/ {billingInfo.costo_actual.toFixed(2)}</p>
                  <p className="text-lg">Titular: <span className="font-semibold">Joseph Huayhualla</span></p>
                  <p className="text-lg">Número: <span className="font-semibold">999 636 452</span></p>
                  <p className="text-xs text-slate-500 mt-2">Una vez realizado el pago, envía el comprobante al soporte para la reactivación.</p>
                </div>
                <div className="bg-white p-2 rounded-lg shadow-md flex-shrink-0">
                  <Image 
                    src="/yape-qr.png" 
                    alt="Código QR de Yape" 
                    width={180} 
                    height={180} 
                    className="rounded-md" 
                    style={{ width: 'auto', height: 'auto' }}
                  />
                </div>
              </div>
            </div>
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

