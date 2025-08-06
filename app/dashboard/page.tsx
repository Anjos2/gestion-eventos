'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiClipboard, FiClock, FiCheckSquare, FiCalendar, FiAlertTriangle, FiThumbsUp, FiAlertCircle, FiXCircle, FiCreditCard, FiGrid, FiDollarSign } from 'react-icons/fi';
import Link from 'next/link';
import Image from 'next/image';

// --- Tipos de Datos ---
type UserRole = 'ADMINISTRATIVO' | 'OPERATIVO' | 'ADMINISTRATIVO_APOYO';

interface AdminDashboardStats {
  orgName: string;
  contratosPorConfirmar: number;
  pagosPendientesAprobacion: number;
  contratosCompletadosMes: number;
  registrosActuales: number;
  precioPorRegistro: string;
  proximoEvento: {
    contratador: string;
    fecha: string;
    id: number;
  } | null;
}

interface OperativoDashboardStats {
  nombre: string;
  asistenciasPuntuales: number;
  asistenciasTardanzas: number;
  asistenciasAusencias: number;
}

interface SuperAdminDashboardStats {
  organizacionesActivas: number;
  organizacionesConAltoConsumo: number;
  montoTotalFacturado: number;
}

// --- Componente de UI ---
const DashboardCard = ({ title, value, link, icon, children }: { title: string, value: string | number, link?: string, icon: React.ReactNode, children?: React.ReactNode }) => {
  const cardContent = (
    <div className={`bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 ${link ? 'hover:border-sky-500 transition-all duration-300 transform hover:-translate-y-1' : ''} h-full flex flex-col justify-between`}>
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
  );

  return link ? <Link href={link}>{cardContent}</Link> : cardContent;
};

// --- Página Principal del Dashboard ---
export default function DashboardPage() {
  const { userRole, organization, session, isSuperAdmin, isLoading: isContextLoading } = useOrganization();
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [operativoStats, setOperativoStats] = useState<OperativoDashboardStats | null>(null);
  const [superAdminStats, setSuperAdminStats] = useState<SuperAdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (isContextLoading) return;
      if (!session) {
          setLoading(false);
          return;
      };

      try {
        setLoading(true);

        if (isSuperAdmin) {
          const [orgsActivasRes, orgsAltoConsumoRes, totalFacturadoRes] = await Promise.all([
            supabase.from('Organizaciones').select('id', { count: 'exact', head: true }).eq('estado', 'ACTIVA'),
            supabase.from('Contadores_Uso').select('id_organizacion', { count: 'exact', head: true }).gt('conteo_registros_nuevos', 100),
            supabase.rpc('get_total_facturado')
          ]);

          setSuperAdminStats({
            organizacionesActivas: orgsActivasRes.count || 0,
            organizacionesConAltoConsumo: orgsAltoConsumoRes.count || 0,
            montoTotalFacturado: totalFacturadoRes.data || 0,
          });

        } else if (userRole && organization) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Usuario no autenticado.');

          const { data: personalData, error: personalError } = await supabase
            .from('Personal')
            .select('id, nombre')
            .eq('supabase_user_id', user.id)
            .single();

          if (personalError || !personalData) throw new Error('No se pudo encontrar la información del usuario.');

          if (userRole === 'OPERATIVO') {
            const { data: asistencias, error: asistenciasError } = await supabase
              .from('Participaciones_Personal')
              .select('estado_asistencia', { count: 'exact' })
              .eq('id_personal_participante', personalData.id);

            if (asistenciasError) throw new Error('No se pudieron cargar las estadísticas de asistencia.');

            setOperativoStats({
              nombre: personalData.nombre,
              asistenciasPuntuales: asistencias.filter(a => a.estado_asistencia === 'PUNTUAL').length,
              asistenciasTardanzas: asistencias.filter(a => a.estado_asistencia === 'TARDANZA').length,
              asistenciasAusencias: asistencias.filter(a => a.estado_asistencia === 'AUSENTE').length,
            });

          } else { // ADMINISTRATIVO o ADMINISTRATIVO_APOYO
            const orgId = organization.id;
            const orgName = organization.nombre;
            const today = new Date();
            const last30Days = new Date(new Date().setDate(today.getDate() - 30)).toISOString();

            const [
              contratosPorConfirmarRes,
              pagosPendientesAprobacionRes,
              contratosCompletadosMesRes,
              proximoEventoRes,
              registrosActualesRes,
              configRes
            ] = await Promise.all([
              supabase.from('Contratos').select('id', { count: 'exact', head: true }).eq('id_organizacion', orgId).eq('estado_asignacion', 'PENDIENTE').eq('estado', 'ACTIVO'),
              supabase.from('Lotes_Pago').select('id', { count: 'exact', head: true }).eq('id_organizacion', orgId).eq('estado', 'PENDIENTE_APROBACION'),
              supabase.from('Contratos').select('id', { count: 'exact', head: true }).eq('id_organizacion', orgId).eq('estado', 'COMPLETADO').gte('updated_at', last30Days),
              supabase.from('Contratos').select('id, fecha_hora_evento, id_contratador').eq('id_organizacion', orgId).eq('estado', 'ACTIVO').order('fecha_hora_evento', { ascending: true }).limit(1),
              supabase.from('Contadores_Uso').select('conteo_registros_nuevos').eq('id_organizacion', orgId).single(),
              supabase.from('Configuracion_Plataforma').select('valor').eq('clave', 'precio_por_registro').single()
            ]);

            let proximoEventoData = null;
            if (proximoEventoRes.data && proximoEventoRes.data.length > 0) {
              const primerEvento = proximoEventoRes.data[0];
              const { data: contratadorData } = await supabase.from('Contratadores').select('nombre').eq('id', primerEvento.id_contratador).single();
              if (contratadorData) {
                proximoEventoData = {
                  id: primerEvento.id,
                  contratador: contratadorData.nombre,
                  fecha: new Date(primerEvento.fecha_hora_evento).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })
                };
              }
            }

            setAdminStats({
              orgName,
              contratosPorConfirmar: contratosPorConfirmarRes.count || 0,
              pagosPendientesAprobacion: pagosPendientesAprobacionRes.count || 0,
              contratosCompletadosMes: contratosCompletadosMesRes.count || 0,
              registrosActuales: registrosActualesRes.data?.conteo_registros_nuevos || 0,
              precioPorRegistro: configRes.data?.valor || '0',
              proximoEvento: proximoEventoData
            });
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, userRole, organization, isSuperAdmin, supabase, isContextLoading]);

  if (loading || isContextLoading) {
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
      {isSuperAdmin ? (
        <>
          <h1 className="text-4xl font-bold text-white mb-8">Resumen de la plataforma</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardCard title="Organizaciones activas" value={superAdminStats?.organizacionesActivas || 0} link="/dashboard/super-admin" icon={<FiGrid className="text-teal-400 text-2xl" />} />
            <DashboardCard title="Organizaciones con alto consumo" value={superAdminStats?.organizacionesConAltoConsumo || 0} link="/dashboard/super-admin" icon={<FiAlertTriangle className="text-red-400 text-2xl" />}>
              <p>Con más de 100 registros sin facturar.</p>
            </DashboardCard>
            <DashboardCard title="Monto total facturado" value={`S/ ${(superAdminStats?.montoTotalFacturado || 0).toFixed(2)}`} link="/dashboard/super-admin" icon={<FiDollarSign className="text-emerald-400 text-2xl" />} />
          </div>
        </>
      ) : userRole === 'OPERATIVO' ? (
        <>
          <h1 className="text-4xl font-bold text-white mb-8">Hola, {operativoStats?.nombre}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DashboardCard title="Asistencias puntuales" value={operativoStats?.asistenciasPuntuales || 0} icon={<FiThumbsUp className="text-green-400 text-2xl" />} />
            <DashboardCard title="Asistencias con tardanza" value={operativoStats?.asistenciasTardanzas || 0} icon={<FiAlertCircle className="text-yellow-400 text-2xl" />} />
            <DashboardCard title="Ausencias registradas" value={operativoStats?.asistenciasAusencias || 0} icon={<FiXCircle className="text-red-400 text-2xl" />} />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-4xl font-bold text-white mb-8">{adminStats?.orgName || 'Dashboard'}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashboardCard title="Contratos por confirmar" value={adminStats?.contratosPorConfirmar || 0} link="/dashboard/contratos" icon={<FiClipboard className="text-sky-400 text-2xl" />}><p>Eventos que requieren asignación final.</p></DashboardCard>
            <DashboardCard title="Pagos pendientes de aprobación" value={adminStats?.pagosPendientesAprobacion || 0} link="/dashboard/pagos/gestion" icon={<FiClock className="text-yellow-400 text-2xl" />}><p>Lotes esperando confirmación.</p></DashboardCard>
            <DashboardCard title="Contratos completados" value={adminStats?.contratosCompletadosMes || 0} link="/dashboard/contratos" icon={<FiCheckSquare className="text-green-400 text-2xl" />}><p>En los últimos 30 días.</p></DashboardCard>
            <DashboardCard title="Próximo evento" value={adminStats?.proximoEvento?.contratador || 'Ninguno'} link={adminStats?.proximoEvento ? `/dashboard/contratos/${adminStats.proximoEvento.id}` : '/dashboard/contratos'} icon={<FiCalendar className="text-purple-400 text-2xl" />}>
              {adminStats?.proximoEvento ? <p>{adminStats.proximoEvento.fecha}</p> : <p>No hay eventos programados.</p>}
            </DashboardCard>
          </div>
          

        </>
      )}
    </div>
  );
}
