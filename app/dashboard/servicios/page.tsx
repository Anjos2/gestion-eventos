'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import Pagination from '@/app/components/ui/Pagination';
import toast from 'react-hot-toast';

// --- CONSTANTES ---
const ITEMS_PER_PAGE = 10;

// --- INTERFACES ---
interface Servicio {
  id: number;
  nombre: string;
  monto_base: number;
  es_activo: boolean;
}

// --- COMPONENTES DE UI ---
const AddServicioForm = ({ onAddServicio }: { onAddServicio: (servicio: Omit<Servicio, 'id' | 'es_activo'>) => void }) => {
  const [nombre, setNombre] = useState('');
  const [montoBase, setMontoBase] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !montoBase.trim()) {
      toast.error('Por favor, completa todos los campos.');
      return;
    }
    onAddServicio({ nombre, monto_base: parseFloat(montoBase) });
    setNombre('');
    setMontoBase('');
  };

  return (
    <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir nuevo servicio</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-1">
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-400 mb-1">Nombre del servicio</label>
          <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="Ej: Fotografía" />
        </div>
        <div>
          <label htmlFor="monto_base" className="block text-sm font-medium text-slate-400 mb-1">Monto base (S/.)</label>
          <input id="monto_base" type="number" value={montoBase} onChange={(e) => setMontoBase(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="250.00" step="0.01" />
        </div>
        <button type="submit" className="w-full md:w-auto justify-self-stretch md:justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Añadir servicio</button>
      </form>
    </div>
  );
};

const ServiciosTable = ({ servicios, onToggleStatus }: { servicios: Servicio[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Monto Base</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Estado</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-slate-800 divide-y divide-slate-700">
          {servicios.length > 0 ? (
            servicios.map((s) => (
              <tr key={s.id} className="hover:bg-slate-700">
                <td className="px-6 py-4 text-sm font-medium text-white whitespace-nowrap">{s.nombre}</td>
                <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">S/. {s.monto_base.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${s.es_activo ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                    {s.es_activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                  <button onClick={() => onToggleStatus(s.id, s.es_activo)} className="text-sky-400 hover:text-sky-300">
                    {s.es_activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="text-center py-10 text-slate-400">No hay servicios registrados todavía.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// --- COMPONENTE DE LÓGICA Y CARGA DE DATOS ---
function ServiciosPageContent() {
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const supabase = createClientComponentClient();

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    const fetchData = async () => {
      if (!organization) return;

      try {
        setLoading(true);
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data: serviciosData, error: serviciosError, count } = await supabase
          .from('Servicios')
          .select('*', { count: 'exact' })
          .eq('id_organizacion', organization.id)
          .order('id', { ascending: false })
          .range(from, to);

        if (serviciosError) throw new Error(serviciosError.message);

        setServicios(serviciosData || []);
        setTotalCount(count || 0);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, organization, supabase]);

  const handleAddServicio = async (servicio: Omit<Servicio, 'id' | 'es_activo'>) => {
    if (!organization) return;
    const toastId = toast.loading('Añadiendo servicio...');
    try {
      const { data, error } = await supabase.from('Servicios').insert({ ...servicio, id_organizacion: organization.id, es_activo: true }).select().single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el servicio.');

      if (currentPage === 1) {
        setServicios([data, ...servicios.slice(0, ITEMS_PER_PAGE - 1)]);
        setTotalCount(prev => prev + 1);
      }
      toast.success('Servicio añadido con éxito!', { id: toastId });
    } catch (err: any) {
      toast.error(`Error al añadir servicio: ${err.message}`, { id: toastId });
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const actionText = currentStatus ? 'desactivar' : 'activar';
    toast((t) => (
      <span>
        ¿Seguro que quieres {actionText} este servicio?
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
      const { data, error } = await supabase.from('Servicios').update({ es_activo: !currentStatus }).eq('id', id).select().single();
      if (error) throw error;
      setServicios(servicios.map(s => s.id === id ? data : s));
      toast.success(`Servicio ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`, { id: toastId });
    } catch (err: any) {
      toast.error(`Error al cambiar el estado: ${err.message}`, { id: toastId });
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de servicios</h1>
      <AddServicioForm onAddServicio={handleAddServicio} />
      <ServiciosTable servicios={servicios} onToggleStatus={handleToggleStatus} />
      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
        path="/dashboard/servicios"
      />
    </div>
  );
}

// --- COMPONENTE PRINCIPAL EXPORTADO POR DEFECTO ---
export default function ServiciosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando página...</p></div>}>
      <ServiciosPageContent />
    </Suspense>
  );
}