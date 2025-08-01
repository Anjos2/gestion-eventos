'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiInbox, FiCalendar, FiFileText, FiDollarSign } from 'react-icons/fi';
import Link from 'next/link';

// Tipos de datos
interface ServicioPendiente {
  id_servicio_asignado: number;
  monto_pactado: number;
  servicio_nombre: string;
  contrato_id: number;
  fecha_hora_evento: string;
  tipo_contrato_nombre: string;
  estado_asistencia: string;
}

export default function ServiciosPendientesPage() {
  const [servicios, setServicios] = useState<ServicioPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServiciosPendientes = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      const { data: personalData, error: personalError } = await supabase
        .from('Personal')
        .select('id')
        .eq('supabase_user_id', user.id)
        .single();

      if (personalError || !personalData) throw new Error('No se pudo encontrar tu registro de personal.');

      const { data, error } = await supabase
        .from('vista_servicios_pendientes_por_personal')
        .select('*')
        .eq('id_personal_participante', personalData.id)
        .order('fecha_hora_evento', { ascending: false });

      if (error) throw error;

      const formattedServicios = data.map((s: any) => ({
        ...s,
        fecha_hora_evento: new Date(s.fecha_hora_evento).toLocaleDateString(),
      }));

      setServicios(formattedServicios);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiciosPendientes();
  }, []);

  if (loading) return <div className="text-center p-8"><p className="text-slate-400">Cargando servicios pendientes...</p></div>;
  if (error) return <div className="bg-red-900 text-red-200 p-4 rounded-lg">Error: {error}</div>;

  return (
    <div className="space-y-4">
      {servicios.length > 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="p-3">Contrato</th>
                  <th className="p-3">Servicio</th>
                  <th className="p-3">Fecha Evento</th>
                  <th className="p-3">Asistencia</th>
                  <th className="p-3 text-right">Monto a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map(servicio => (
                  <tr key={servicio.id_servicio_asignado} className="border-b border-slate-700 hover:bg-slate-800">
                    <td className="p-3">
                      <Link href={`/dashboard/contratos/${servicio.contrato_id}`} className="hover:text-sky-400 transition-colors">
                        <div className="font-bold text-white">#{servicio.contrato_id}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1"><FiFileText /> {servicio.tipo_contrato_nombre}</div>
                      </Link>
                    </td>
                    <td className="p-3 text-slate-300">{servicio.servicio_nombre}</td>
                    <td className="p-3 text-slate-400 flex items-center gap-1"><FiCalendar /> {servicio.fecha_hora_evento}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                        ${servicio.estado_asistencia === 'PUNTUAL' ? 'bg-green-500/20 text-green-300' : ''}
                        ${servicio.estado_asistencia === 'TARDANZA' ? 'bg-yellow-500/20 text-yellow-300' : ''}
                        ${servicio.estado_asistencia === 'AUSENTE' ? 'bg-red-500/20 text-red-300' : ''}
                        ${servicio.estado_asistencia === 'ASIGNADO' ? 'bg-slate-500/20 text-slate-300' : ''}
                      `}>
                        {servicio.estado_asistencia}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-sky-400 flex items-center justify-end gap-1"><FiDollarSign /> {servicio.monto_pactado.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
          <FiInbox className="mx-auto text-6xl text-slate-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">No hay servicios pendientes</h2>
          <p className="text-slate-400 mt-2">Todos tus servicios en contratos completados han sido procesados en lotes de pago.</p>
        </div>
      )}
    </div>
  );
}
