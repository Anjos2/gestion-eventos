'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiCalendar, FiFilter } from 'react-icons/fi';

// --- Tipos de Datos ---
interface Participacion {
  id_contrato: number;
  fecha_hora_evento: string;
  tipo_contrato_nombre: string;
  servicio_nombre: string;
  monto_pactado: number;
  estado_asistencia: string;
}

// --- Componente Principal ---
export default function MisParticipacionesPage() {
  const [participaciones, setParticipaciones] = useState<Participacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchParticipaciones = async (start?: string, end?: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      const { data: personal, error: personalError } = await supabase
        .from('Personal')
        .select('id')
        .eq('supabase_user_id', user.id)
        .single();

      if (personalError || !personal) throw new Error('No se pudo encontrar tu registro de personal.');

      let query = supabase
        .from('reporte_participacion_flat')
        .select('*')
        .eq('id_personal_participante', personal.id);

      if (start) {
        query = query.gte('fecha_hora_evento', new Date(start).toISOString());
      }
      if (end) {
        query = query.lte('fecha_hora_evento', new Date(end).toISOString());
      }

      const { data, error: queryError } = await query.order('fecha_hora_evento', { ascending: false });

      if (queryError) throw queryError;

      setParticipaciones(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    setStartDate(firstDayOfMonth);
    fetchParticipaciones(firstDayOfMonth);
  }, []);

  const handleFilter = () => {
    fetchParticipaciones(startDate, endDate);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Mis Asistencias y Participaciones</h1>

      {/* --- Filtros --- */}
      <div className="bg-slate-800 p-4 rounded-xl shadow-lg mb-8 border border-slate-700 flex items-end gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-slate-400 mb-1">Fecha de Inicio</label>
          <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-slate-400 mb-1">Fecha de Fin</label>
          <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" />
        </div>
        <button onClick={handleFilter} className="px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 flex items-center gap-2">
          <FiFilter />
          <span>Filtrar</span>
        </button>
      </div>

      {/* --- Tabla de Resultados --- */}
      {loading ? (
        <p className="text-slate-400">Cargando participaciones...</p>
      ) : error ? (
        <p className="text-red-400">Error: {error}</p>
      ) : (
        <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Fecha Evento</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Tipo Contrato</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Servicio Realizado</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado Asistencia</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Monto Pactado</th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {participaciones.length > 0 ? (
                participaciones.map((p, index) => (
                  <tr key={index} className="hover:bg-slate-700">
                    <td className="px-6 py-4 text-sm text-white">{new Date(p.fecha_hora_evento).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{p.tipo_contrato_nombre}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{p.servicio_nombre}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${p.estado_asistencia === 'PUNTUAL' ? 'bg-green-900 text-green-200' : p.estado_asistencia === 'TARDANZA' ? 'bg-yellow-900 text-yellow-200' : 'bg-red-900 text-red-200'}`}>
                        {p.estado_asistencia}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">S/ {p.monto_pactado.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">No se encontraron participaciones en el rango de fechas seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
