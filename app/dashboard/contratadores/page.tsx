'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';
import Pagination from '@/app/components/ui/Pagination';

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
      alert('Por favor, completa todos los campos.');
      return;
    }

    // Validación de formato de documento
    const docRegex: { [key: string]: RegExp } = {
      DNI: /^\d{8}$/,
      RUC: /^\d{11}$/,
      Pasaporte: /^[a-zA-Z0-9]+$/
    };

    if (!docRegex[tipoDocumento].test(numeroDocumento)) {
      alert(`El formato del ${tipoDocumento} no es válido.`);
      return;
    }

    onAddContratador({ nombre, tipo_documento: tipoDocumento, numero_documento: numeroDocumento });
    setNombre('');
    setTipoDocumento('DNI');
    setNumeroDocumento('');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Añadir nuevo contratador</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
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
        <button type="submit" className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Añadir contratador</button>
      </form>
    </div>
  );
};

const ContratadoresTable = ({ contratadores, onToggleStatus }: { contratadores: Contratador[], onToggleStatus: (id: number, currentStatus: boolean) => void }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Nombre</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Documento</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Acciones</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {contratadores.length > 0 ? (
          contratadores.map((c) => (
            <tr key={c.id} className="hover:bg-slate-700">
              <td className="px-6 py-4 text-sm font-medium text-white">{c.nombre}</td>
              <td className="px-6 py-4 text-sm text-slate-300">{c.tipo_documento}: {c.numero_documento}</td>
              <td className="px-6 py-4 text-sm">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${c.es_activo ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                  {c.es_activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm font-medium">
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
);

// --- COMPONENTE DE LÓGICA Y CARGA DE DATOS ---
function ContratadoresPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [contratadores, setContratadores] = useState<Contratador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    const fetchUserAndContratadores = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado. Redirigiendo...');
        setUser(user);

        const { data: adminData, error: adminError } = await supabase.from('Personal').select('id_organizacion').eq('supabase_user_id', user.id).single();
        if (adminError || !adminData) throw new Error('No se pudo encontrar la organización del administrador.');

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data: contratadoresData, error: contratadoresError, count } = await supabase
          .from('Contratadores')
          .select('*', { count: 'exact' })
          .eq('id_organizacion', adminData.id_organizacion)
          .order('id', { ascending: false })
          .range(from, to);

        if (contratadoresError) throw new Error(contratadoresError.message);

        setContratadores(contratadoresData || []);
        setTotalCount(count || 0);

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
  }, [currentPage]);

  const handleAddContratador = async (contratador: Omit<Contratador, 'id' | 'es_activo'>) => {
    if (!user) return;
    try {
      const { data: adminData } = await supabase.from('Personal').select('id_organizacion').eq('supabase_user_id', user.id).single();
      if (!adminData) throw new Error('No se pudo obtener la organización.');

      const { data, error } = await supabase.from('Contratadores').insert({ ...contratador, id_organizacion: adminData.id_organizacion, es_activo: true }).select().single();

      if (error) throw error;
      if (!data) throw new Error('No se recibió respuesta al crear el contratador.');

      if (currentPage === 1) {
        setContratadores([data, ...contratadores.slice(0, ITEMS_PER_PAGE - 1)]);
        setTotalCount(prev => prev + 1);
      }
      alert('Contratador añadido con éxito!');
    } catch (err: any) {
      alert(`Error al añadir contratador: ${err.message}`);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase.from('Contratadores').update({ es_activo: !currentStatus }).eq('id', id).select().single();
      if (error) throw error;
      setContratadores(contratadores.map(c => c.id === id ? data : c));
      alert(`Contratador ${!currentStatus ? 'activado' : 'desactivado'} con éxito.`);
    } catch (err: any) {
      alert(`Error al cambiar el estado: ${err.message}`);
    }
  };

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

// --- COMPONENTE PRINCIPAL DE LA PÁGINA (con Suspense) ---
export default function ContratadoresPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando página...</p></div>}>
      <ContratadoresPageContent />
    </Suspense>
  );
}