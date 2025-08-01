'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Organizacion {
  id: number;
  nombre: string;
  estado: string;
  conteo_registros_nuevos: number;
}

export default function SuperAdminPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizaciones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Organizaciones')
      .select(`
        id,
        nombre,
        estado,
        Contadores_Uso!inner ( conteo_registros_nuevos )
      `);

    if (error) {
      console.error('Error fetching organizaciones:', error);
      setError('No se pudieron cargar las organizaciones.');
    } else {
      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);
      const aplanado = data.map(org => ({
        ...org,
        conteo_registros_nuevos: getSingle(org.Contadores_Uso)?.conteo_registros_nuevos ?? 0,
      }));
      setOrganizaciones(aplanado as Organizacion[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrganizaciones();
  }, []);

  const toggleEstadoOrganizacion = async (id: number, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'ACTIVA' ? 'SUSPENDIDA' : 'ACTIVA';
    if (window.confirm(`¿Estás seguro de que quieres cambiar el estado a ${nuevoEstado}?`)) {
      const { error } = await supabase
        .from('Organizaciones')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (error) {
        alert('Error al cambiar el estado de la organización.');
      } else {
        alert('Estado actualizado con éxito.');
        fetchOrganizaciones();
      }
    }
  };

  if (loading) return <p className="text-slate-400">Cargando panel de super-admin...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Panel de Superadministrador</h1>
      <div className="bg-slate-800 shadow-md rounded-lg overflow-hidden border border-slate-700">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Organización</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Consumo Actual</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {organizaciones.map((org) => (
              <tr key={org.id} className="hover:bg-slate-700/50">
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <p className="text-white font-semibold">{org.nombre}</p>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${org.estado === 'ACTIVA' ? 'text-green-200 bg-green-900/50' : 'text-red-200 bg-red-900/50'}`}>
                    {org.estado}
                  </span>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <p className="text-slate-300">{org.conteo_registros_nuevos} registros</p>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <button 
                    onClick={() => toggleEstadoOrganizacion(org.id, org.estado)}
                    className={`px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 ${org.estado === 'ACTIVA' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                    {org.estado === 'ACTIVA' ? 'Suspender' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
