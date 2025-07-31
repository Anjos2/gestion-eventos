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
      alert('Error al cargar las organizaciones.');
    } else {
      // Aplanar la estructura de los datos para la relación uno a uno
      const aplanado = data.map(org => ({
        ...org,
        conteo_registros_nuevos: org.Contadores_Uso?.conteo_registros_nuevos ?? 0,
      }));
      setOrganizaciones(aplanado);
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
        fetchOrganizaciones(); // Recargar la lista
      }
    }
  };

  const cerrarCicloFacturacion = async (org: Organizacion) => {
    if (window.confirm(`¿Estás seguro de cerrar el ciclo de facturación para ${org.nombre} con ${org.conteo_registros_nuevos} registros?`)) {
      try {
        // 1. Obtener el ID del Super-Admin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No se pudo obtener el usuario autenticado.');

        // 2. Guardar en el historial
        const { error: historialError } = await supabase
          .from('Historial_Facturacion')
          .insert({
            id_organizacion: org.id,
            registros_facturados: org.conteo_registros_nuevos,
            facturado_por: user.id,
          });

        if (historialError) throw historialError;

        // 3. Reiniciar el contador
        const { error: contadorError } = await supabase
          .from('Contadores_Uso')
          .update({ conteo_registros_nuevos: 0, ultimo_reseteo: new Date().toISOString() })
          .eq('id_organizacion', org.id);

        if (contadorError) throw contadorError;

        alert('Ciclo de facturación cerrado con éxito.');
        fetchOrganizaciones(); // Recargar la lista

      } catch (error) {
        console.error('Error al cerrar el ciclo de facturación:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  if (loading) {
    return <p>Cargando organizaciones...</p>;
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-4">Gestión de Organizaciones</h1>
      <div className="bg-slate-800 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-700 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-700 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-700 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Consumo Actual
              </th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-700 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {organizaciones.map((org) => (
              <tr key={org.id}>
                <td className="px-5 py-5 border-b border-slate-700 bg-slate-800 text-sm">
                  <p className="text-slate-100 whitespace-no-wrap">{org.nombre}</p>
                </td>
                <td className="px-5 py-5 border-b border-slate-700 bg-slate-800 text-sm">
                  <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${org.estado === 'ACTIVA' ? 'text-green-900' : 'text-red-900'}`}>
                    <span aria-hidden className={`absolute inset-0 ${org.estado === 'ACTIVA' ? 'bg-green-200' : 'bg-red-200'} opacity-50 rounded-full`}></span>
                    <span className="relative">{org.estado}</span>
                  </span>
                </td>
                <td className="px-5 py-5 border-b border-slate-700 bg-slate-800 text-sm">
                  <p className="text-slate-100 whitespace-no-wrap">{org.conteo_registros_nuevos}</p>
                </td>
                <td className="px-5 py-5 border-b border-slate-700 bg-slate-800 text-sm space-x-2">
                  <button 
                    onClick={() => toggleEstadoOrganizacion(org.id, org.estado)}
                    className={`px-4 py-2 rounded-md text-white font-semibold ${
                      org.estado === 'ACTIVA' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}>
                    {org.estado === 'ACTIVA' ? 'Suspender' : 'Reactivar'}
                  </button>
                  <button 
                    onClick={() => cerrarCicloFacturacion(org)}
                    disabled={org.conteo_registros_nuevos === 0}
                    className="px-4 py-2 rounded-md text-white font-semibold bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed">
                    Cerrar Ciclo
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
