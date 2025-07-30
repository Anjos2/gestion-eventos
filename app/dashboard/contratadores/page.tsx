'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Define la interfaz para un Contratador
interface Contratador {
  id: number;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  es_activo: boolean;
}

// Componente para el formulario de añadir contratador
const AddContratadorForm = ({ onAddContratador }: { onAddContratador: (contratador: Omit<Contratador, 'id' | 'es_activo'>) => void }) => {
  const [nombre, setNombre] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('DNI');
  const [numeroDocumento, setNumeroDocumento] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !numeroDocumento.trim()) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    onAddContratador({ nombre, tipo_documento: tipoDocumento, numero_documento: numeroDocumento });
    setNombre('');
    setTipoDocumento('DNI');
    setNumeroDocumento('');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir Nuevo Contratador</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-400 mb-1">Nombre o Razón Social</label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="Ej: Empresa XYZ S.A.C."
          />
        </div>
        <div>
          <label htmlFor="tipo_documento" className="block text-sm font-medium text-slate-400 mb-1">Tipo de Documento</label>
          <select
            id="tipo_documento"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
          >
            <option>DNI</option>
            <option>RUC</option>
            <option>Pasaporte</option>
          </select>
        </div>
        <div>
          <label htmlFor="numero_documento" className="block text-sm font-medium text-slate-400 mb-1">Número de Documento</label>
          <input
            id="numero_documento"
            type="text"
            value={numeroDocumento}
            onChange={(e) => setNumeroDocumento(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-sky-500 focus:border-sky-500 transition text-white"
            placeholder="12345678"
          />
        </div>
        <button
          type="submit"
          className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105"
        >
          Añadir Contratador
        </button>
      </form>
    </div>
  );
};

// Componente para la tabla de contratadores
const ContratadoresTable = ({ contratadores, onToggleStatus }: { contratadores: Contratador[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Documento</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {contratadores.length > 0 ? (
          contratadores.map((c) => (
            <tr key={c.id} className="hover:bg-slate-700 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{c.nombre}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{c.tipo_documento}: {c.numero_documento}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  c.es_activo 
                    ? 'bg-green-900 text-green-200' 
                    : 'bg-red-900 text-red-200'
                }`}>
                  {c.es_activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button 
                  onClick={() => onToggleStatus(c.id, c.es_activo)}
                  className="text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {c.es_activo ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4} className="text-center py-10 text-slate-400">
              No hay contratadores registrados todavía.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// Componente principal de la página
export default function ContratadoresPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contratadores, setContratadores] = useState<Contratador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndContratadores = async () => {
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

        const { data: contratadoresData, error: contratadoresError } = await supabase
          .from('Contratadores')
          .select('*')
          .eq('id_organizacion', adminData.id_organizacion)
          .order('id', { ascending: false });

        if (contratadoresError) throw new Error(contratadoresError.message);

        setContratadores(contratadoresData || []);
      } catch (err: any) {
        setError(err.message);
        if (err.message.includes('autenticado')) {
          window.location.href = '/auth/login';
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndContratadores();
  }, []);

  const handleAddContratador = async (contratador: Omit<Contratador, 'id' | 'es_activo'>) => {
    if (!user) return;

    try {
      const { data: adminData } = await supabase
        .from('Personal')
        .select('id_organizacion')
        .eq('supabase_user_id', user.id)
        .single();

      if (!adminData) throw new Error('No se pudo obtener la organización para añadir el contratador.');

      const { data, error } = await supabase
        .from('Contratadores')
        .insert({ ...contratador, id_organizacion: adminData.id_organizacion, es_activo: true })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el contratador.');

      setContratadores([data, ...contratadores]);
      alert('Contratador añadido con éxito!');
    } catch (err: any) {
      setError(`Error al añadir contratador: ${err.message}`);
      alert(`Error al añadir contratador: ${err.message}`);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase
        .from('Contratadores')
        .update({ es_activo: !currentStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setContratadores(contratadores.map(c => c.id === id ? data : c));
      alert(`Contratador ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`);

    } catch (err: any) {
      setError(`Error al cambiar el estado: ${err.message}`);
      alert(`Error al cambiar el estado: ${err.message}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Contratadores</h1>
      <AddContratadorForm onAddContratador={handleAddContratador} />
      <ContratadoresTable contratadores={contratadores} onToggleStatus={handleToggleStatus} />
    </div>
  );
}
