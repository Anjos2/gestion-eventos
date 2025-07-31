'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiClipboard, FiClock, FiCheckSquare, FiCalendar, FiAlertTriangle } from 'react-icons/fi';
import Link from 'next/link';

// --- Tipos de Datos ---
interface DashboardStats {
  orgName: string;
  contratosPorConfirmar: number;
  pagosPendientesAprobacion: number;
  contratosCompletadosMes: number;
  proximoEvento: {
    contratador: string;
    fecha: string;
    id: number;
  } | null;
}

// --- Componente de UI ---
const DashboardCard = ({ title, value, link, icon, children }: { title: string, value: string | number, link: string, icon: React.ReactNode, children?: React.ReactNode }) => (
  <Link href={link}>
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-sky-500 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start">
          <p className="text-base font-semibold text-slate-400">{title}</p>
          <div className="bg-slate-900 p-3 rounded-full">
            {icon}
          </div>
        </div>
        <p className="text-4xl font-bold text-white mt-2">{value}</p>
      </div>
      {children && <div className="mt-4 text-sm text-slate-300">{children}</div>}
    </div>
  </Link>
);

// --- Página Principal del Dashboard ---
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado.');

        const { data: adminData, error: adminError } = await supabase
          .from('Personal')
          .select('id_organizacion, Organizaciones:id_organizacion (nombre)')
          .eq('supabase_user_id', user.id)
          .single();

        if (adminError || !adminData) throw new Error('No se pudo encontrar la organización del administrador.');
        const orgId = adminData.id_organizacion;
        const orgName = adminData.Organizaciones.nombre;

        // --- Consultas para los KPIs en Paralelo ---
        const today = new Date();
        const last30Days = new Date(new Date().setDate(today.getDate() - 30)).toISOString();

        const [ 
          contratosPorConfirmarRes, 
          pagosPendientesAprobacionRes, 
          contratosCompletadosMesRes,
          proximoEventoRes
        ] = await Promise.all([
          // 1. Contratos con asignaciones pendientes
          supabase.from('Contratos').select('id', { count: 'exact', head: true }).eq('id_organizacion', orgId).eq('estado_asignacion', 'PENDIENTE').eq('estado', 'ACTIVO'),
          // 2. Lotes de pago pendientes de aprobación por el personal
          supabase.from('Lotes_Pago').select('id', { count: 'exact', head: true }).eq('id_organizacion', orgId).eq('estado', 'PENDIENTE_APROBACION'),
          // 3. Contratos completados en los últimos 30 días
          supabase.from('Contratos').select('id', { count: 'exact', head: true }).eq('id_organizacion', orgId).eq('estado', 'COMPLETADO').gte('updated_at', last30Days),
          // 4. Próximo evento activo
          supabase.from('Contratos').select('id, fecha_hora_evento, Contratadores(nombre)').eq('id_organizacion', orgId).eq('estado', 'ACTIVO').order('fecha_hora_evento', { ascending: true }).limit(1).single()
        ]);

        if (contratosPorConfirmarRes.error) throw new Error(`Contratos por confirmar: ${contratosPorConfirmarRes.error.message}`);
        if (pagosPendientesAprobacionRes.error) throw new Error(`Pagos pendientes: ${pagosPendientesAprobacionRes.error.message}`);
        if (contratosCompletadosMesRes.error) throw new Error(`Contratos completados: ${contratosCompletadosMesRes.error.message}`);
        if (proximoEventoRes.error && proximoEventoRes.error.code !== 'PGRST116') { // Ignorar si no se encuentra ninguno
            throw new Error(`Próximo evento: ${proximoEventoRes.error.message}`);
        }

        setStats({
          orgName,
          contratosPorConfirmar: contratosPorConfirmarRes.count || 0,
          pagosPendientesAprobacion: pagosPendientesAprobacionRes.count || 0,
          contratosCompletadosMes: contratosCompletadosMesRes.count || 0,
          proximoEvento: proximoEventoRes.data ? {
            id: proximoEventoRes.data.id,
            contratador: proximoEventoRes.data.Contratadores.nombre,
            fecha: new Date(proximoEventoRes.data.fecha_hora_evento).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
          } : null
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="p-8"><p className="text-slate-400">Cargando dashboard...</p></div>;
  }

  if (error) {
    return (
        <div className="p-8">
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center">
                <FiAlertTriangle className="mr-3 text-2xl"/>
                <div>
                    <p className="font-bold">Error al cargar el dashboard</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-4xl font-bold text-white mb-8">{stats?.orgName || 'Dashboard'}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <DashboardCard title="Contratos por Confirmar" value={stats?.contratosPorConfirmar || 0} link="/dashboard/contratos" icon={<FiClipboard className="text-sky-400 text-2xl" />}>
          <p>Eventos que requieren asignación final de personal y servicios.</p>
        </DashboardCard>

        <DashboardCard title="Pagos Pend. Aprobación" value={stats?.pagosPendientesAprobacion || 0} link="/dashboard/pagos/gestion" icon={<FiClock className="text-yellow-400 text-2xl" />}>
          <p>Lotes de pago esperando la confirmación del personal.</p>
        </DashboardCard>

        <DashboardCard title="Contratos Completados" value={stats?.contratosCompletadosMes || 0} link="/dashboard/contratos" icon={<FiCheckSquare className="text-green-400 text-2xl" />}>
          <p>En los últimos 30 días.</p>
        </DashboardCard>

        <DashboardCard title="Próximo Evento" value={stats?.proximoEvento?.contratador || 'Ninguno'} link={stats?.proximoEvento ? `/dashboard/contratos/${stats.proximoEvento.id}` : '/dashboard/contratos'} icon={<FiCalendar className="text-purple-400 text-2xl" />}>
          {stats?.proximoEvento ? 
            <p>{stats.proximoEvento.fecha}</p> : 
            <p>No hay eventos programados.</p>
          }
        </DashboardCard>

      </div>
    </div>
  );
}
