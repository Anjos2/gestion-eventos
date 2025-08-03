'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { FiClipboard, FiClock, FiCheckSquare, FiCalendar, FiAlertTriangle, FiThumbsUp, FiAlertCircle, FiXCircle, FiCreditCard } from 'react-icons/fi';
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
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [operativoStats, setOperativoStats] = useState<OperativoDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado.');

        // ID del Super Administrador
        const SUPER_ADMIN_USER_ID = '7f76aede-699d-463e-acf5-5c95a3e8b84e';

        // Redirección para Super Admin
        if (user.id === SUPER_ADMIN_USER_ID) {
          router.push('/dashboard/super-admin');
          return; // Detiene la ejecución para evitar cargar datos innecesarios
        }

        const { data: personalData, error: personalError } = await supabase
          .from('Personal')
          .select('id, nombre, rol, id_organizacion, Organizaciones:id_organizacion (nombre)')
          .eq('supabase_user_id', user.id)
          .single();

        if (personalError || !personalData) throw new Error('No se pudo encontrar la información del usuario.');
        
        const role = personalData.rol as UserRole;
        setUserRole(role);

        if (role === 'OPERATIVO') {
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
          const orgId = personalData.id_organizacion;
          const orgName = (personalData.Organizaciones as any).nombre;

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

          if (proximoEventoRes.error) {
              throw new Error(`Próximo evento: ${proximoEventoRes.error.message}`);
          }

          let proximoEventoData = null;
          if (proximoEventoRes.data && proximoEventoRes.data.length > 0) {
            const primerEvento = proximoEventoRes.data[0];
            const { data: contratadorData, error: contratadorError } = await supabase
              .from('Contratadores')
              .select('nombre')
              .eq('id', primerEvento.id_contratador)
              .single();

            if (!contratadorError && contratadorData) {
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
      {userRole === 'OPERATIVO' ? (
        <>
          <h1 className="text-4xl font-bold text-white mb-8">Hola, {operativoStats?.nombre}</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard title="Asistencias puntuales" value={operativoStats?.asistenciasPuntuales || 0} icon={<FiThumbsUp className="text-green-400 text-2xl" />} />
            <DashboardCard title="Asistencias con tardanza" value={operativoStats?.asistenciasTardanzas || 0} icon={<FiAlertCircle className="text-yellow-400 text-2xl" />} />
            <DashboardCard title="Ausencias registradas" value={operativoStats?.asistenciasAusencias || 0} icon={<FiXCircle className="text-red-400 text-2xl" />} />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-4xl font-bold text-white mb-8">{adminStats?.orgName || 'Dashboard'}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashboardCard title="Contratos por confirmar" value={adminStats?.contratosPorConfirmar || 0} link="/dashboard/contratos" icon={<FiClipboard className="text-sky-400 text-2xl" />}><p>Eventos que requieren asignación final.</p></DashboardCard>
            <DashboardCard title="Pagos pendientes de aprobación" value={adminStats?.pagosPendientesAprobacion || 0} link="/dashboard/pagos/gestion" icon={<FiClock className="text-yellow-400 text-2xl" />}><p>Lotes esperando confirmación.</p></DashboardCard>
            <DashboardCard title="Contratos completados" value={adminStats?.contratosCompletadosMes || 0} link="/dashboard/contratos" icon={<FiCheckSquare className="text-green-400 text-2xl" />}><p>En los últimos 30 días.</p></DashboardCard>
            <DashboardCard title="Próximo evento" value={adminStats?.proximoEvento?.contratador || 'Ninguno'} link={adminStats?.proximoEvento ? `/dashboard/contratos/${adminStats.proximoEvento.id}` : '/dashboard/contratos'} icon={<FiCalendar className="text-purple-400 text-2xl" />}>
              {adminStats?.proximoEvento ? <p>{adminStats.proximoEvento.fecha}</p> : <p>No hay eventos programados.</p>}
            </DashboardCard>
          </div>
          <div className="mt-8 bg-slate-800 shadow-md rounded-lg p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Facturación</h2>
              <FiCreditCard className="text-pink-400 text-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-slate-400 text-sm">Precio por Registro</p>
                <p className="text-white font-bold text-2xl">S/ {adminStats?.precioPorRegistro}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Registros Actuales</p>
                <p className="text-white font-bold text-2xl">{adminStats?.registrosActuales}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Monto a Facturar</p>
                <p className="text-sky-400 font-bold text-2xl">S/ {( (adminStats?.registrosActuales || 0) * parseFloat(adminStats?.precioPorRegistro || '0') ).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Sección de Pago con Yape */}
          <div className="mt-8 bg-gradient-to-r from-purple-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="mb-4 md:mb-0 md:mr-6">
                <h3 className="text-2xl font-bold">¡Paga tu suscripción con Yape!</h3>
                <p className="mt-2">Escanea el código QR o usa nuestro número para renovar tu servicio de forma rápida y segura.</p>
                <div className="mt-4 text-lg">
                  <p>Titular: <span className="font-semibold">Joseph Huayhualla</span></p>
                  <p>Número: <span className="font-semibold">999 636 425</span></p>
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-md">
                <Image 
                  src="/yape-qr.png" 
                  alt="Código QR de Yape" 
                  width={150} 
                  height={150} 
                  className="rounded-md"
                />
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
