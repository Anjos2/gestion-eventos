'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Define la interfaz para un Tipo de Contrato
interface TipoContrato {
  id: number;
  nombre: string;
  ingreso_base: number;
  es_activo: boolean;
}

// Componente para el formulario de añadir tipo de contrato
const AddTipoContratoForm = ({ onAddTipoContrato }: { onAddTipoContrato: (tipoContrato: Omit<TipoContrato, 'id' | 'es_activo'>) => void }) => {
  const [nombre, setNombre] = useState('');
  const [ingresoBase, setIngresoBase] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !ingresoBase.trim()) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    onAddTipoContrato({ nombre, ingreso_base: parseFloat(ingresoBase) });
    setNombre('');
    setIngresoBase('');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir Nuevo Tipo de Contrato</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-1">
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-400 mb-1">Nombre del Servicio</label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="Ej: Evento Corporativo"
          />
        </div>
        <div>
          <label htmlFor="ingreso_base" className="block text-sm font-medium text-slate-400 mb-1">Ingreso Base (S/.)</label>
          <input
            id="ingreso_base"
            type="number"
            value={ingresoBase}
            onChange={(e) => setIngresoBase(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="1500.00"
            step="0.01"
          />
        </div>
        <button
          type="submit"
          className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105"
        >
          Añadir Tipo
        </button>
      </form>
    </div>
  );
};

// Componente para la tabla de tipos de contrato
const TiposContratoTable = ({ tiposContrato, onToggleStatus }: { tiposContrato: TipoContrato[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Ingreso Base</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {tiposContrato.length > 0 ? (
          tiposContrato.map((tc) => (
            <tr key={tc.id} className="hover:bg-slate-700 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{tc.nombre}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">S/. {tc.ingreso_base.toFixed(2)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  tc.es_activo 
                    ? 'bg-green-900 text-green-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {tc.es_activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button 
                  onClick={() => onToggleStatus(tc.id, tc.es_activo)}
                  className="text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {tc.es_activo ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="text-center py-10 text-slate-400">
              No hay tipos de contrato registrados todavía.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// Componente principal de la página
export default function TiposContratoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado. Redirigiendo...');
        setUser(user);

        const { data: adminData, error: adminError } = await supabase
          .from('Personal')
          .select('id_organizacion')
          .eq('supabase_user_id', user.id)
          .single();

        if (adminError || !adminData) throw new Error('No se pudo encontrar la organización del administrador.');

        const { data: tiposContratoData, error: tiposContratoError } = await supabase
          .from('Tipos_Contrato')
          .select('*')
          .eq('id_organizacion', adminData.id_organizacion)
          .order('id', { ascending: false });

        if (tiposContratoError) throw new Error(tiposContratoError.message);

        setTiposContrato(tiposContratoData || []);
      } catch (err: any) {
        setError(err.message);
        if (err.message.includes('autenticado')) {
          window.location.href = '/auth/login';
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndData();
  }, []);

  const handleAddTipoContrato = async (tipoContrato: Omit<TipoContrato, 'id' | 'es_activo'>) => {
    if (!user) return;

    try {
      const { data: adminData } = await supabase
        .from('Personal')
        .select('id_organizacion')
        .eq('supabase_user_id', user.id)
        .single();

      if (!adminData) throw new Error('No se pudo obtener la organización para añadir el tipo de contrato.');

      const { data, error } = await supabase
        .from('Tipos_Contrato')
        .insert({ ...tipoContrato, id_organizacion: adminData.id_organizacion, es_activo: true })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el tipo de contrato.');

      setTiposContrato([data, ...tiposContrato]);
      alert('Tipo de contrato añadido con éxito!');
    } catch (err: any) {
      setError(`Error al añadir tipo de contrato: ${err.message}`);
      alert(`Error al añadir tipo de contrato: ${err.message}`);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase
        .from('Tipos_Contrato')
        .update({ es_activo: !currentStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTiposContrato(tiposContrato.map(tc => tc.id === id ? data : tc));
      alert(`Tipo de contrato ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`);

    } catch (err: any) {
      setError(`Error al cambiar el estado: ${err.message}`);
      alert(`Error al cambiar el estado: ${err.message}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Tipos de Contrato</h1>
      <AddTipoContratoForm onAddTipoContrato={handleAddTipoContrato} />
      <TiposContratoTable tiposContrato={tiposContrato} onToggleStatus={handleToggleStatus} />
    </div>
  );
}
