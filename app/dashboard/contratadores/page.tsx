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
interface Contratador {
  id: number;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  es_activo: boolean;
}

// --- COMPONENTES DE UI ---
const AddContratadorForm = ({ onAddContratador }: { onAddContratador: (contratador: Omit<Contratador, 'id' | 'es_activo'>) => void }) => {
  const [nombre, setNombre] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('DNI');
  const [numeroDocumento, setNumeroDocumento] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !numeroDocumento.trim()) {
      toast.error('Por favor, completa todos los campos.');
      return;
    }

    // Validación de formato de documento
    const docRegex: { [key: string]: RegExp } = {
      DNI: /^\d{8}$/,
      RUC: /^\d{11}$/,
      Pasaporte: /^[a-zA-Z0-9]+$/
    };

    if (!docRegex[tipoDocumento].test(numeroDocumento)) {
      toast.error(`El formato del ${tipoDocumento} no es válido.`);
      return;
    }

    onAddContratador({ nombre, tipo_documento: tipoDocumento, numero_documento: numeroDocumento });
    setNombre('');
    setTipoDocumento('DNI');
    setNumeroDocumento('');
  };

  return (
    <div className="bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir nuevo contratador</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-400 mb-1">Nombre o razón social</label>
          <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="Ej: Empresa XYZ S.A.C." />
        </div>
        <div>
          <label htmlFor="tipo_documento" className="block text-sm font-medium text-slate-400 mb-1">Tipo de documento</label>
          <select id="tipo_documento" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
            <option>DNI</option>
            <option>RUC</option>
            <option>Pasaporte</option>
          </select>
        </div>
        <div>
          <label htmlFor="numero_documento" className="block text-sm font-medium text-slate-400 mb-1">Número de documento</label>
          <input id="numero_documento" type="text" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" placeholder="12345678" />
        </div>
        <button type="submit" className="w-full lg:w-auto justify-self-stretch lg:justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Añadir contratador</button>
      </form>
    </div>
  );
};

const ContratadoresTable = ({ contratadores, onToggleStatus }: { contratadores: Contratador[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Documento</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Estado</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-slate-800 divide-y divide-slate-700">
          {contratadores.length > 0 ? (
            contratadores.map((c) => (
              <tr key={c.id} className="hover:bg-slate-700">
                <td className="px-6 py-4 text-sm font-medium text-white whitespace-nowrap">{c.nombre}</td>
                <td className="px-6 py-4 text-sm text-slate-300 whitespace-nowrap">{c.tipo_documento}: {c.numero_documento}</td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${c.es_activo ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                    {c.es_activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                  <button onClick={() => onToggleStatus(c.id, c.es_activo)} className="text-sky-400 hover:text-sky-300">
                    {c.es_activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="text-center py-10 text-slate-400">No hay contratadores registrados todavía.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// --- COMPONENTE DE LÓGICA Y CARGA DE DATOS ---
function ContratadoresPageContent() {
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const [contratadores, setContratadores] = useState<Contratador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const supabase = createClientComponentClient();

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    const fetchContratadores = async () => {
      if (!organization) return;

      try {
        setLoading(true);
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data: contratadoresData, error: contratadoresError, count } = await supabase
          .from('Contratadores')
          .select('*', { count: 'exact' })
          .eq('id_organizacion', organization.id)
          .order('id', { ascending: false })
          .range(from, to);

        if (contratadoresError) throw new Error(contratadoresError.message);

        setContratadores(contratadoresData || []);
        setTotalCount(count || 0);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContratadores();
  }, [currentPage, organization, supabase]);

  const handleAddContratador = async (contratador: Omit<Contratador, 'id' | 'es_activo'>) => {
    if (!organization) return;
    const toastId = toast.loading('Añadiendo contratador...');
    try {
      const { data, error } = await supabase.from('Contratadores').insert({ ...contratador, id_organizacion: organization.id, es_activo: true }).select().single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el contratador.');

      if (currentPage === 1) {
        setContratadores([data, ...contratadores.slice(0, ITEMS_PER_PAGE - 1)]);
        setTotalCount(prev => prev + 1);
      }
      toast.success('Contratador añadido con éxito!', { id: toastId });
    } catch (err: any) {
      toast.error(`Error al añadir contratador: ${err.message}`, { id: toastId });
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const actionText = currentStatus ? 'desactivar' : 'activar';
    toast((t) => (
      <span>
        ¿Seguro que quieres {actionText} a este contratador?
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
      const { data, error } = await supabase.from('Contratadores').update({ es_activo: !currentStatus }).eq('id', id).select().single();
      if (error) throw error;
      setContratadores(contratadores.map(c => c.id === id ? data : c));
      toast.success(`Contratador ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`, { id: toastId });
    } catch (err: any) {
      toast.error(`Error al cambiar el estado: ${err.message}`, { id: toastId });
    }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de contratadores</h1>
      <AddContratadorForm onAddContratador={handleAddContratador} />
      <ContratadoresTable contratadores={contratadores} onToggleStatus={handleToggleStatus} />
      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
        path="/dashboard/contratadores"
      />
    </div>
  );
}

// --- COMPONENTE PRINCIPAL EXPORTADO POR DEFECTO ---
export default function ContratadoresPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando página...</p></div>}>
      <ContratadoresPageContent />
    </Suspense>
  );
}