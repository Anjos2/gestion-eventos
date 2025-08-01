'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';
import Pagination from '@/app/components/ui/Pagination';
import AsyncSelect from 'react-select/async';

// --- CONSTANTES ---
const ITEMS_PER_PAGE = 10;

// --- INTERFACES ---
interface TipoContrato { id: number; nombre: string; }
interface Contrato {
  id: number;
  fecha_hora_evento: string;
  estado: string;
  estado_asignacion: 'PENDIENTE' | 'COMPLETO';
  Contratadores: { nombre: string } | null;
  Tipos_Contrato: { nombre: string } | null;
  Personal: { nombre: string } | null;
}
interface SelectOption { value: number; label: string; }

// --- ESTILOS PERSONALIZADOS para React-Select ---
const selectStyles = {
  control: (provided: any) => ({
    ...provided,
    backgroundColor: '#374151', // bg-slate-700
    borderColor: '#4b5563', // border-slate-600
    color: 'white',
    minHeight: '42px',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: '#1f2937', // bg-slate-800
    borderColor: '#4b5563', // border-slate-600
  }),
  option: (provided: any, state: { isSelected: boolean; isFocused: boolean; }) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#0ea5e9' : state.isFocused ? '#374151' : '#1f2937',
    color: 'white',
    ':active': {
      backgroundColor: '#374151',
    },
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: 'white',
  }),
  input: (provided: any) => ({
    ...provided,
    color: 'white',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#9ca3af', // text-slate-400
  }),
};


// --- COMPONENTES DE UI ---
const AddContratoForm = ({ 
  loadContratadores, 
  tiposContrato,
  onAddContrato 
}: { 
  loadContratadores: (inputValue: string, callback: (options: SelectOption[]) => void) => void, 
  tiposContrato: TipoContrato[],
  onAddContrato: (data: any) => void 
}) => {
  const [idContratador, setIdContratador] = useState<SelectOption | null>(null);
  const [idTipoContrato, setIdTipoContrato] = useState('');
  const [fechaHoraEvento, setFechaHoraEvento] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idContratador || !idTipoContrato || !fechaHoraEvento) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    onAddContrato({ 
      id_contratador: idContratador.value,
      id_tipo_contrato: parseInt(idTipoContrato),
      fecha_hora_evento: new Date(fechaHoraEvento).toISOString(),
    });
    setIdContratador(null);
    setIdTipoContrato('');
    setFechaHoraEvento('');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Registrar nuevo contrato</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
        <div>
          <label htmlFor="id_contratador" className="block text-sm font-medium text-slate-400 mb-1">Contratador</label>
          <AsyncSelect
            id="id_contratador"
            value={idContratador}
            onChange={(option) => setIdContratador(option as SelectOption)}
            loadOptions={loadContratadores}
            placeholder="Busque un contratador..."
            cacheOptions
            defaultOptions
            styles={selectStyles}
            classNamePrefix="react-select"
          />
        </div>
        <div>
          <label htmlFor="id_tipo_contrato" className="block text-sm font-medium text-slate-400 mb-1">Tipo de contrato</label>
          <select id="id_tipo_contrato" value={idTipoContrato} onChange={(e) => setIdTipoContrato(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white h-[42px]">
            <option value="">Seleccione</option>
            {tiposContrato.map(tc => <option key={tc.id} value={tc.id}>{tc.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fecha_hora_evento" className="block text-sm font-medium text-slate-400 mb-1">Fecha y hora</label>
          <input id="fecha_hora_evento" type="datetime-local" value={fechaHoraEvento} onChange={(e) => setFechaHoraEvento(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" />
        </div>
        <button type="submit" className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Registrar</button>
      </form>
    </div>
  );
};

const ContratosTable = ({ contratos }: { contratos: Contrato[] }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Cliente</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Tipo</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Fecha Evento</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Responsable</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Asignación</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {contratos.length > 0 ? contratos.map((c) => (
          <tr key={c.id} className={`hover:bg-slate-700 ${c.estado_asignacion === 'PENDIENTE' ? 'bg-yellow-900/20' : ''}`}>
            <td className="px-6 py-4 text-sm text-white"><Link href={`/dashboard/contratos/${c.id}`} className="hover:underline">{c.Contratadores?.nombre}</Link></td>
            <td className="px-6 py-4 text-sm text-slate-300"><Link href={`/dashboard/contratos/${c.id}`} className="hover:underline">{c.Tipos_Contrato?.nombre}</Link></td>
            <td className="px-6 py-4 text-sm text-slate-300"><Link href={`/dashboard/contratos/${c.id}`} className="hover:underline">{new Date(c.fecha_hora_evento).toLocaleString()}</Link></td>
            <td className="px-6 py-4 text-sm text-slate-300">{c.Personal?.nombre}</td>
            <td className="px-6 py-4 text-sm"><span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-200">{c.estado}</span></td>
            <td className="px-6 py-4 text-sm">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${c.estado_asignacion === 'COMPLETO' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'}`}>
                {c.estado_asignacion}
              </span>
            </td>
          </tr>
        )) : (
          <tr><td colSpan={6} className="text-center py-10 text-slate-400">No hay contratos registrados.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

// --- COMPONENTE DE LÓGICA Y CARGA DE DATOS ---
function ContratosPageContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [orgId, setOrgId] = useState<number | null>(null);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const fetchContratos = useCallback(async (orgId: number, page: number) => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error, count } = await supabase
      .from('Contratos')
      .select(`*, Contratadores(nombre), Tipos_Contrato(nombre), Personal!id_personal_administrativo(nombre)`, { count: 'exact' })
      .eq('id_organizacion', orgId)
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      setError(error.message);
      setContratos([]);
    } else {
      setContratos(data || []);
      setTotalCount(count || 0);
    }
  }, []);

  const loadContratadores = async (inputValue: string, callback: (options: SelectOption[]) => void) => {
    if (!orgId) return callback([]);

    const { data, error } = await supabase
      .from('Contratadores')
      .select('id, nombre')
      .eq('id_organizacion', orgId)
      .eq('es_activo', true)
      .ilike('nombre', `%${inputValue}%`)
      .limit(20);

    if (error) {
      console.error('Error buscando contratadores:', error);
      return callback([]);
    }

    const options = data.map(c => ({ value: c.id, label: c.nombre }));
    callback(options);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');
        setUser(user);

        const { data: adminData } = await supabase.from('Personal').select('id_organizacion').eq('supabase_user_id', user.id).single();
        if (!adminData) throw new Error('No se encontró la organización del admin.');
        setOrgId(adminData.id_organizacion);

        const { data: tiposContratoRes, error: tiposContratoError } = await supabase.from('Tipos_Contrato').select('id, nombre').eq('id_organizacion', adminData.id_organizacion).eq('es_activo', true);
        if (tiposContratoError) throw tiposContratoError;
        setTiposContrato(tiposContratoRes || []);

        await fetchContratos(adminData.id_organizacion, currentPage);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [fetchContratos, currentPage]);

  const handleAddContrato = async (contratoData: any) => {
    if (!user) return;
    try {
      const { data: adminData } = await supabase.from('Personal').select('id, id_organizacion').eq('supabase_user_id', user.id).single();
      if (!adminData) throw new Error('No se pudo obtener el perfil del admin.');

      const { data: newContrato, error: contratoError } = await supabase.from('Contratos').insert({ ...contratoData, id_organizacion: adminData.id_organizacion, id_personal_administrativo: adminData.id, created_by: adminData.id, estado: 'ACTIVO', estado_asignacion: 'PENDIENTE' }).select('id').single();
      if (contratoError) throw contratoError;
      if (!newContrato) throw new Error('No se pudo obtener el ID del nuevo contrato.');

      const { error: eventoError } = await supabase.from('Eventos_Contrato').insert({ id_contrato: newContrato.id, id_organizacion: adminData.id_organizacion });
      if (eventoError) {
        await supabase.from('Contratos').delete().eq('id', newContrato.id);
        throw eventoError;
      }

      await fetchContratos(adminData.id_organizacion, 1);
      alert('Contrato y evento registrados con éxito!');
    } catch (err: any) {
      alert(`Error al registrar el contrato: ${err.message}`);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando datos...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg"><p>{error}</p></div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de contratos</h1>
      <AddContratoForm 
        loadContratadores={loadContratadores} 
        tiposContrato={tiposContrato} 
        onAddContrato={handleAddContrato} 
      />
      <ContratosTable contratos={contratos} />
      <Pagination 
        currentPage={currentPage} 
        totalCount={totalCount} 
        itemsPerPage={ITEMS_PER_PAGE} 
        path="/dashboard/contratos"
      />
    </div>
  );
}

// --- COMPONENTE PRINCIPAL DE LA PÁGINA (con Suspense) ---
export default function ContratosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando página...</p></div>}>
      <ContratosPageContent />
    </Suspense>
  );
}