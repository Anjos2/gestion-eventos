'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiCreditCard, FiAlertTriangle } from 'react-icons/fi';
import Image from 'next/image';

interface AdminDashboardStats {
  registrosActuales: number;
  precioPorRegistro: string;
}

export default function FacturacionPage() {
  const { organization, session, isSuperAdmin, isLoading: isContextLoading } = useOrganization();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchBillingData = async () => {
      if (isContextLoading || !organization) return;

      try {
        setLoading(true);
        // 1. Obtener el consumo actual
        const { data: registrosActualesRes, error: registrosError } = await supabase
          .from('Contadores_Uso')
          .select('conteo_registros_nuevos')
          .eq('id_organizacion', organization.id)
          .single();

        if (registrosError) throw new Error('No se pudo cargar el consumo actual.');

        let finalPrice = organization.precio_por_registro?.toString();

        // 2. Si no hay precio personalizado, obtener el global
        if (!finalPrice) {
          const { data: configRes, error: configError } = await supabase
            .from('Configuracion_Plataforma')
            .select('valor')
            .eq('clave', 'precio_por_registro')
            .single();
          
          if (configError) throw new Error('No se pudo cargar la configuración de precios.');
          finalPrice = configRes?.valor || '0';
        }

        setStats({
          registrosActuales: registrosActualesRes?.conteo_registros_nuevos || 0,
          precioPorRegistro: finalPrice,
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, [organization, isContextLoading, supabase]);

  if (loading || isContextLoading) {
    return <div className="p-8"><p className="text-slate-400">Cargando datos de facturación...</p></div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center">
          <FiAlertTriangle className="mr-3 text-2xl"/>
          <div>
            <p className="font-bold">Error al cargar la página</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-4xl font-bold text-white mb-8">Facturación</h1>
      
      <div className="bg-slate-800 shadow-md rounded-lg p-6 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Consumo del ciclo actual</h2>
          <FiCreditCard className="text-pink-400 text-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-slate-400 text-sm">Precio por registro</p>
            <p className="text-white font-bold text-2xl">S/ {stats?.precioPorRegistro}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Registros actuales</p>
            <p className="text-white font-bold text-2xl">{stats?.registrosActuales}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Monto a facturar</p>
            <p className="text-sky-400 font-bold text-2xl">S/ {( (stats?.registrosActuales || 0) * parseFloat(stats?.precioPorRegistro || '0') ).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0 md:mr-6">
            <h3 className="text-2xl font-bold">¡Paga tu suscripción con Yape!</h3>
            <p className="mt-2">Escanea el código QR o usa nuestro número para renovar tu servicio de forma rápida y segura.</p>
            <div className="mt-4 text-lg">
              <p>Titular: <span className="font-semibold">Joseph Huayhualla</span></p>
              <p>Número: <span className="font-semibold">999 636 452</span></p>
            </div>
          </div>
          <div className="bg-white p-2 rounded-lg shadow-md">
            <Image 
              src="/yape-qr.png" 
              alt="Código QR de Yape" 
              width={150} 
              height={150} 
              className="rounded-md" 
              style={{ width: 'auto', height: 'auto' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
