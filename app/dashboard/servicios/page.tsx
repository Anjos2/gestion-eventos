'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Define la interfaz para un Servicio
interface Servicio {
  id: number;
  nombre: string;
  monto_base: number;
  es_activo: boolean;
}

// Componente para el formulario de añadir servicio
const AddServicioForm = ({ onAddServicio }: { onAddServicio: (servicio: Omit<Servicio, 'id' | 'es_activo'>) => void }) => {
  const [nombre, setNombre] = useState('');
  const [montoBase, setMontoBase] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !montoBase.trim()) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    onAddServicio({ nombre, monto_base: parseFloat(montoBase) });
    setNombre('');
    setMontoBase('');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir Nuevo Servicio</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-1">
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-400 mb-1">Nombre del Servicio</label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="Ej: Fotografía, Sonido"
          />
        </div>
        <div>
          <label htmlFor="monto_base" className="block text-sm font-medium text-slate-400 mb-1">Monto Base (S/.)</label>
          <input
            id="monto_base"
            type="number"
            value={montoBase}
            onChange={(e) => setMontoBase(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="250.00"
            step="0.01"
          />
        </div>
        <button
          type="submit"
          className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105"
        >
          Añadir Servicio
        </button>
      </form>
    </div>
  );
};

// Componente para la tabla de servicios
const ServiciosTable = ({ servicios, onToggleStatus }: { servicios: Servicio[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Monto Base</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {servicios.length > 0 ? (
          servicios.map((s) => (
            <tr key={s.id} className="hover:bg-slate-700 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{s.nombre}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">S/. {s.monto_base.toFixed(2)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  s.es_activo 
                    ? 'bg-green-900 text-green-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {s.es_activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button 
                  onClick={() => onToggleStatus(s.id, s.es_activo)}
                  className="text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {s.es_activo ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="text-center py-10 text-slate-400">
              No hay servicios registrados todavía.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// Componente principal de la página
export default function ServiciosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
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

        const { data: serviciosData, error: serviciosError } = await supabase
          .from('Servicios')
          .select('*')
          .eq('id_organizacion', adminData.id_organizacion)
          .order('id', { ascending: false });

        if (serviciosError) throw new Error(serviciosError.message);

        setServicios(serviciosData || []);
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

  const handleAddServicio = async (servicio: Omit<Servicio, 'id' | 'es_activo'>) => {
    if (!user) return;

    try {
      const { data: adminData } = await supabase
        .from('Personal')
        .select('id_organizacion')
        .eq('supabase_user_id', user.id)
        .single();

      if (!adminData) throw new Error('No se pudo obtener la organización para añadir el servicio.');

      const { data, error } = await supabase
        .from('Servicios')
        .insert({ ...servicio, id_organizacion: adminData.id_organizacion, es_activo: true })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el servicio.');

      setServicios([data, ...servicios]);
      alert('Servicio añadido con éxito!');
    } catch (err: any) {
      setError(`Error al añadir servicio: ${err.message}`);
      alert(`Error al añadir servicio: ${err.message}`);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase
        .from('Servicios')
        .update({ es_activo: !currentStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setServicios(servicios.map(s => s.id === id ? data : s));
      alert(`Servicio ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`);

    } catch (err: any) {
      setError(`Error al cambiar el estado: ${err.message}`);
      alert(`Error al cambiar el estado: ${err.message}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Servicios</h1>
      <AddServicioForm onAddServicio={handleAddServicio} />
      <ServiciosTable servicios={servicios} onToggleStatus={handleToggleStatus} />
    </div>
  );
}