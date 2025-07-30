'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { User } from '@supabase/supabase-js';

// Interfaces para los datos
interface Contratador {
  id: number;
  nombre: string;
}

interface TipoContrato {
  id: number;
  nombre: string;
}

interface Contrato {
  id: number;
  fecha_hora_evento: string;
  estado: string;
  estado_asignacion: 'PENDIENTE' | 'COMPLETO';
  Contratadores: { nombre: string } | null;
  Tipos_Contrato: { nombre: string } | null;
  Personal: { nombre: string } | null;
}

// Componente para el formulario de añadir contrato
const AddContratoForm = ({
  contratadores, 
  tiposContrato, 
  onAddContrato
}: {
  contratadores: Contratador[];
  tiposContrato: TipoContrato[];
  onAddContrato: (contrato: Omit<Contrato, 'id' | 'estado' | 'estado_asignacion' | 'Contratadores' | 'Tipos_Contrato' | 'Personal'> & { id_contratador: number; id_tipo_contrato: number }) => void;
}) => {
  const [idContratador, setIdContratador] = useState('');
  const [idTipoContrato, setIdTipoContrato] = useState('');
  const [fechaHoraEvento, setFechaHoraEvento] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idContratador || !idTipoContrato || !fechaHoraEvento) {
      alert('Por favor, completa todos los campos.');
      return;
    }
    onAddContrato({ 
      id_contratador: parseInt(idContratador),
      id_tipo_contrato: parseInt(idTipoContrato),
      fecha_hora_evento: new Date(fechaHoraEvento).toISOString(),
    });
    setIdContratador('');
    setIdTipoContrato('');
    setFechaHoraEvento('');
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Registrar Nuevo Contrato</h2>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
        <div>
          <label htmlFor="id_contratador" className="block text-sm font-medium text-slate-400 mb-1">Contratador</label>
          <select id="id_contratador" value={idContratador} onChange={(e) => setIdContratador(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
            <option value="">Seleccione un contratador</option>
            {contratadores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="id_tipo_contrato" className="block text-sm font-medium text-slate-400 mb-1">Tipo de Contrato</label>
          <select id="id_tipo_contrato" value={idTipoContrato} onChange={(e) => setIdTipoContrato(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
            <option value="">Seleccione un tipo</option>
            {tiposContrato.map(tc => <option key={tc.id} value={tc.id}>{tc.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fecha_hora_evento" className="block text-sm font-medium text-slate-400 mb-1">Fecha y Hora del Evento</label>
          <input id="fecha_hora_evento" type="datetime-local" value={fechaHoraEvento} onChange={(e) => setFechaHoraEvento(e.target.value)} className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white" />
        </div>
        <button type="submit" className="w-full md:w-auto justify-self-start px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700">Registrar Contrato</button>
      </form>
    </div>
  );
};

// Componente para la tabla de contratos
const ContratosTable = ({ contratos }: { contratos: Contrato[] }) => (
  <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
    <table className="min-w-full divide-y divide-slate-700">
      <thead className="bg-slate-900">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Cliente</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Tipo Contrato</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Fecha Evento</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Responsable</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado</th>
          <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Asignación</th>
        </tr>
      </thead>
      <tbody className="bg-slate-800 divide-y divide-slate-700">
        {contratos.length > 0 ? contratos.map((c) => (
          <tr key={c.id} className={`hover:bg-slate-700 cursor-pointer ${c.estado_asignacion === 'PENDIENTE' ? 'bg-yellow-900/20' : ''}`}>
            <td className="px-6 py-4 text-sm text-white"><Link href={`/dashboard/contratos/${c.id}`}>{c.Contratadores?.nombre}</Link></td>
            <td className="px-6 py-4 text-sm text-slate-300"><Link href={`/dashboard/contratos/${c.id}`}>{c.Tipos_Contrato?.nombre}</Link></td>
            <td className="px-6 py-4 text-sm text-slate-300"><Link href={`/dashboard/contratos/${c.id}`}>{new Date(c.fecha_hora_evento).toLocaleString()}</Link></td>
            <td className="px-6 py-4 text-sm text-slate-300"><Link href={`/dashboard/contratos/${c.id}`}>{c.Personal?.nombre}</Link></td>
            <td className="px-6 py-4 text-sm"><Link href={`/dashboard/contratos/${c.id}`}><span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-200">{c.estado}</span></Link></td>
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

// Componente principal
export default function ContratosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratadores, setContratadores] = useState<Contratador[]>([]);
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContratos = useCallback(async (orgId: number) => {
    const { data, error } = await supabase
      .from('Contratos')
      .select(`*, Contratadores(nombre), Tipos_Contrato(nombre), Personal!id_personal_administrativo(nombre)`)
      .eq('id_organizacion', orgId)
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching contratos:', error);
      setError(error.message);
      setContratos([]);
    } else {
      setContratos(data || []);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado');
        setUser(user);

        const { data: adminData } = await supabase.from('Personal').select('id_organizacion').eq('supabase_user_id', user.id).single();
        if (!adminData) throw new Error('No se encontró la organización del admin.');
        const orgId = adminData.id_organizacion;

        const [contratadoresRes, tiposContratoRes] = await Promise.all([
          supabase.from('Contratadores').select('id, nombre').eq('id_organizacion', orgId).eq('es_activo', true),
          supabase.from('Tipos_Contrato').select('id, nombre').eq('id_organizacion', orgId).eq('es_activo', true),
        ]);

        if (contratadoresRes.error) throw contratadoresRes.error;
        if (tiposContratoRes.error) throw tiposContratoRes.error;

        setContratadores(contratadoresRes.data || []);
        setTiposContrato(tiposContratoRes.data || []);
        fetchContratos(orgId);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [fetchContratos]);

  const handleAddContrato = async (contratoData: Omit<Contrato, 'id' | 'estado' | 'estado_asignacion' | 'Contratadores' | 'Tipos_Contrato' | 'Personal'> & { id_contratador: number; id_tipo_contrato: number }) => {
    if (!user) return;
    try {
      const { data: adminData } = await supabase.from('Personal').select('id, id_organizacion').eq('supabase_user_id', user.id).single();
      if (!adminData) throw new Error('No se pudo obtener el perfil del admin.');

      const { data: newContrato, error: contratoError } = await supabase.from('Contratos').insert({
        ...contratoData,
        id_organizacion: adminData.id_organizacion,
        id_personal_administrativo: adminData.id,
        created_by: adminData.id,
        estado: 'ACTIVO',
        estado_asignacion: 'PENDIENTE',
      }).select('id').single();

      if (contratoError) throw contratoError;
      if (!newContrato) throw new Error('No se pudo obtener el ID del nuevo contrato.');

      const { error: eventoError } = await supabase.from('Eventos_Contrato').insert({
        id_contrato: newContrato.id,
        id_organizacion: adminData.id_organizacion,
      });

      if (eventoError) {
        await supabase.from('Contratos').delete().eq('id', newContrato.id);
        throw eventoError;
      }

      fetchContratos(adminData.id_organizacion);
      alert('Contrato y evento registrados con éxito!');
    } catch (err: any) {
      alert(`Error al registrar el contrato: ${err.message}`);
    }
  };

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Gestión de Contratos</h1>
      <AddContratoForm contratadores={contratadores} tiposContrato={tiposContrato} onAddContrato={handleAddContrato} />
      <ContratosTable contratos={contratos} />
    </div>
  );
}