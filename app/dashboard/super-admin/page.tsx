'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [precioPorRegistro, setPrecioPorRegistro] = useState<string>('0');
  const [editPrecio, setEditPrecio] = useState<boolean>(false);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('Configuracion_Plataforma')
      .select('valor')
      .eq('clave', 'precio_por_registro')
      .single();

    if (data) {
      setPrecioPorRegistro(data.valor);
    }
  };

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
    fetchConfig();
  }, []);

  const handleGuardarPrecio = async () => {
    const { error } = await supabase
      .from('Configuracion_Plataforma')
      .update({ valor: precioPorRegistro })
      .eq('clave', 'precio_por_registro');

    if (error) {
      alert('Error al actualizar el precio.');
    } else {
      alert('Precio actualizado con éxito.');
      setEditPrecio(false);
    }
  };

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

  const handleCerrarCiclo = async (organizacionId: number, conteoActual: number) => {
    if (window.confirm(`¿Estás seguro de que quieres cerrar el ciclo de facturación para esta organización? Se facturarán ${conteoActual} registros.`)) {
      // 1. Insertar en Historial_Facturacion
      const { error: historialError } = await supabase
        .from('Historial_Facturacion')
        .insert({
          id_organizacion: organizacionId,
          registros_facturados: conteoActual
        });

      if (historialError) {
        alert('Error al guardar en el historial de facturación: ' + historialError.message);
        return;
      }

      // 2. Resetear el contador
      const { error: contadorError } = await supabase
        .from('Contadores_Uso')
        .update({
          conteo_registros_nuevos: 0,
          ultimo_reseteo: new Date().toISOString(),
        })
        .eq('id_organizacion', organizacionId);

      if (contadorError) {
        alert('Error al resetear el contador de uso: ' + contadorError.message);
      } else {
        alert('Ciclo de facturación cerrado con éxito.');
        fetchOrganizaciones(); // Recargar datos
      }
    }
  };

  if (loading) return <p className="text-slate-400">Cargando panel de super-admin...</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold text-white mb-6">Panel de Superadministrador</h1>
      
      <div className="bg-slate-800 shadow-md rounded-lg p-6 border border-slate-700 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Configuración de Facturación</h2>
        <div className="flex items-center">
          <label className="text-slate-300 mr-4">Precio por Registro (S/):</label>
          {editPrecio ? (
            <input 
              type="number"
              value={precioPorRegistro}
              onChange={(e) => setPrecioPorRegistro(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white w-24"
            />
          ) : (
            <p className="text-white font-bold text-lg">S/ {precioPorRegistro}</p>
          )}
          {editPrecio ? (
            <button onClick={handleGuardarPrecio} className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-semibold">Guardar</button>
          ) : (
            <button onClick={() => setEditPrecio(true)} className="ml-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md text-white font-semibold">Editar</button>
          )}
        </div>
      </div>

      <div className="bg-slate-800 shadow-md rounded-lg overflow-hidden border border-slate-700">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Organización</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Estado</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Consumo Actual</th>
              <th className="px-5 py-3 border-b-2 border-slate-700 bg-slate-900 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Monto a Facturar</th>
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
                  <p className="text-white font-bold">S/ {(org.conteo_registros_nuevos * parseFloat(precioPorRegistro)).toFixed(2)}</p>
                </td>
                <td className="px-5 py-4 border-b border-slate-700 text-sm">
                  <button
                    onClick={() => toggleEstadoOrganizacion(org.id, org.estado)}
                    className={`px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 ${org.estado === 'ACTIVA' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {org.estado === 'ACTIVA' ? 'Suspender' : 'Reactivar'}
                  </button>
                  <button
                    onClick={() => handleCerrarCiclo(org.id, org.conteo_registros_nuevos)}
                    className="ml-2 px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 bg-blue-600 hover:bg-blue-700"
                  >
                    Cerrar ciclo
                  </button>
                  <Link href={`/dashboard/super-admin/historial/${org.id}`}>
                    <button className="ml-2 px-4 py-2 rounded-md text-white font-semibold transition-transform transform hover:scale-105 bg-gray-600 hover:bg-gray-700">
                      Ver historial
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
