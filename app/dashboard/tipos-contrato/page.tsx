'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import toast from 'react-hot-toast';

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
      toast.error('Por favor, completa todos los campos.');
      return;
    }
    onAddTipoContrato({ nombre, ingreso_base: parseFloat(ingresoBase) });
    setNombre('');
    setIngresoBase('');
  };

  return (
    <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir nuevo tipo de contrato</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-1">
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-400 mb-1">Nombre del servicio</label>
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
          <label htmlFor="ingreso_base" className="block text-sm font-medium text-slate-400 mb-1">Ingreso base (S/.)</label>
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
          className="w-full md:w-auto justify-self-stretch md:justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform transform hover:scale-105"
        >
          Añadir tipo
        </button>
      </form>
    </div>
  );
};

// Componente para la tabla de tipos de contrato
const TiposContratoTable = ({ tiposContrato, onToggleStatus }: { tiposContrato: TipoContrato[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-900">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Nombre</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Ingreso Base</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Estado</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Acciones</th>
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
  </div>
);

// Componente principal de la página
export default function TiposContratoPage() {
  const { organization } = useOrganization();
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return;

      try {
        const { data: tiposContratoData, error: tiposContratoError } = await supabase
          .from('Tipos_Contrato')
          .select('*')
          .eq('id_organizacion', organization.id)
          .order('id', { ascending: false });

        if (tiposContratoError) throw new Error(tiposContratoError.message);

        setTiposContrato(tiposContratoData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organization, supabase]);

  const handleAddTipoContrato = async (tipoContrato: Omit<TipoContrato, 'id' | 'es_activo'>) => {
    if (!organization) return;
    const toastId = toast.loading('Añadiendo tipo de contrato...');
    try {
      const { data, error } = await supabase
        .from('Tipos_Contrato')
        .insert({ ...tipoContrato, id_organizacion: organization.id, es_activo: true })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el tipo de contrato.');

      setTiposContrato([data, ...tiposContrato]);
      toast.success('Tipo de contrato añadido con éxito!', { id: toastId });
    } catch (err: any) {
      toast.error(`Error al añadir tipo de contrato: ${err.message}`, { id: toastId });
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const actionText = currentStatus ? 'desactivar' : 'activar';
    toast((t) => (
      <span>
        ¿Seguro que quieres {actionText} este tipo de contrato?
        <div className="flex gap-2 mt-2">
          <button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => {
              toast.dismiss(t.id);
              performToggle(id, currentStatus);
            }}
          >
            Confirmar
          </button>
          <button 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancelar
          </button>
        </div>
      </span>
    ));
  };

  const performToggle = async (id: number, currentStatus: boolean) => {
    const toastId = toast.loading('Actualizando estado...');
    try {
      const { data, error } = await supabase
        .from('Tipos_Contrato')
        .update({ es_activo: !currentStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTiposContrato(tiposContrato.map(tc => tc.id === id ? data : tc));
      toast.success(`Tipo de contrato ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`, { id: toastId });

    } catch (err: any) {
      toast.error(`Error al cambiar el estado: ${err.message}`, { id: toastId });
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de tipos de contrato</h1>
      <AddTipoContratoForm onAddTipoContrato={handleAddTipoContrato} />
      <TiposContratoTable tiposContrato={tiposContrato} onToggleStatus={handleToggleStatus} />
    </div>
  );
}

