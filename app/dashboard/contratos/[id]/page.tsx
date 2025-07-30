'use client';

import { useEffect, useState, Fragment } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { FiPlus, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import Link from 'next/link';

// --- INTERFACES ---
interface ContratoDetails {
  id: number;
  fecha_hora_evento: string;
  estado: string;
  estado_asignacion: 'PENDIENTE' | 'COMPLETO';
  id_organizacion: number;
  Contratadores: { nombre: string } | null;
  Tipos_Contrato: { nombre: string, ingreso_base: number } | null;
  Personal: { nombre: string } | null;
  Eventos_Contrato: { id: number }[];
}

interface PersonalOperativo {
  id: number;
  nombre: string;
}

interface Servicio {
  id: number;
  nombre: string;
  monto_base: number;
}

interface Participacion {
  id: number;
  estado_asistencia: string;
  hora_llegada: string | null;
  Personal: { nombre: string } | null;
  Evento_Servicios_Asignados: { id: number, Servicios: { nombre: string } | null }[];
}

// --- MODAL COMPONENT ---
const AsignarServicioModal = ({ isOpen, onClose, servicios, onAsignar }) => {
  const [selectedServicio, setSelectedServicio] = useState('');

  if (!isOpen) return null;

  const handleAsignar = () => {
    if (!selectedServicio) {
      alert('Por favor, selecciona un servicio.');
      return;
    }
    onAsignar(parseInt(selectedServicio));
    setSelectedServicio('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">Asignar Servicio</h3>
        <select 
          value={selectedServicio}
          onChange={(e) => setSelectedServicio(e.target.value)}
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-6"
        >
          <option value="">-- Elige un servicio --</option>
          {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} (S/. {s.monto_base.toFixed(2)})</option>)}
        </select>
        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition-colors">Cancelar</button>
          <button onClick={handleAsignar} className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">Asignar</button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN PAGE COMPONENT ---
export default function ContratoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [contrato, setContrato] = useState<ContratoDetails | null>(null);
  const [personalOperativo, setPersonalOperativo] = useState<PersonalOperativo[]>([]);
  const [participaciones, setParticipaciones] = useState<Participacion[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [selectedPersonal, setSelectedPersonal] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentParticipacionId, setCurrentParticipacionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchAllData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data: contratoData, error: contratoError } = await supabase
          .from('Contratos')
          .select(`*, Contratadores(nombre), Tipos_Contrato(nombre, ingreso_base), Personal!id_personal_administrativo(nombre), Eventos_Contrato(id)`)
          .eq('id', id)
          .single();

        if (contratoError) throw contratoError;
        if (!contratoData) throw new Error('Contrato no encontrado.');
        setContrato(contratoData);

        let eventoId = contratoData.Eventos_Contrato[0]?.id;
        if (!eventoId) {
          const { data: nuevoEvento, error: eventoError } = await supabase.from('Eventos_Contrato').insert({ id_contrato: contratoData.id, id_organizacion: contratoData.id_organizacion }).select('id').single();
          if (eventoError) throw eventoError;
          eventoId = nuevoEvento.id;
        }

        const [personalRes, participacionesRes, serviciosRes] = await Promise.all([
          supabase.from('Personal').select('id, nombre').eq('id_organizacion', contratoData.id_organizacion).eq('rol', 'OPERATIVO').eq('es_activo', true),
          supabase.from('Participaciones_Personal').select(`*, Personal(nombre), Evento_Servicios_Asignados(*, Servicios(nombre))`).eq('id_evento_contrato', eventoId),
          supabase.from('Servicios').select('id, nombre, monto_base').eq('id_organizacion', contratoData.id_organizacion).eq('es_activo', true)
        ]);

        if (personalRes.error) throw personalRes.error;
        if (participacionesRes.error) throw participacionesRes.error;
        if (serviciosRes.error) throw serviciosRes.error;

        setPersonalOperativo(personalRes.data || []);
        setParticipaciones(participacionesRes.data || []);
        setServicios(serviciosRes.data || []);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [id]);

  // --- HANDLERS ---
  const handleAsignarPersonal = async () => { 
    if (!selectedPersonal || !contrato || !contrato.Eventos_Contrato[0]?.id) {
      alert('Selecciona un miembro del personal.');
      return;
    }

    try {
      const { data: nuevaParticipacion, error } = await supabase
        .from('Participaciones_Personal')
        .insert({
          id_organizacion: contrato.id_organizacion,
          id_evento_contrato: contrato.Eventos_Contrato[0].id,
          id_personal_participante: parseInt(selectedPersonal),
          estado_asistencia: 'ASIGNADO',
        })
        .select('*, Personal(nombre), Evento_Servicios_Asignados(*, Servicios(nombre))')
        .single();

      if (error) throw error;
      
      setParticipaciones([...participaciones, nuevaParticipacion]);
      setSelectedPersonal('');
      alert('Personal asignado con éxito.');
    } catch (err: any) {
      alert(`Error al asignar personal: ${err.message}`);
    }
   };

  const handleOpenModal = (participacionId: number) => {
    setCurrentParticipacionId(participacionId);
    setIsModalOpen(true);
  };

  const handleAsignarServicio = async (servicioId: number) => {
    if (!currentParticipacionId || !contrato) return;

    const servicioSeleccionado = servicios.find(s => s.id === servicioId);
    if (!servicioSeleccionado) return;

    try {
      const { data: nuevoServicioAsignado, error } = await supabase
        .from('Evento_Servicios_Asignados')
        .insert({
          id_organizacion: contrato.id_organizacion,
          id_participacion: currentParticipacionId,
          id_servicio: servicioId,
          monto_pactado: servicioSeleccionado.monto_base,
          estado_pago: 'PENDIENTE',
        })
        .select('*, Servicios(nombre)')
        .single();

      if (error) throw error;

      const updatedParticipaciones = participaciones.map(p => 
        p.id === currentParticipacionId 
          ? { ...p, Evento_Servicios_Asignados: [...p.Evento_Servicios_Asignados, nuevoServicioAsignado] }
          : p
      );
      setParticipaciones(updatedParticipaciones);

      alert('Servicio asignado correctamente.');
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error al asignar servicio: ${err.message}`);
    }
  };

  const handleUpdateAsistencia = async (participacionId: number, nuevoEstado: string) => {
    let updateData: { estado_asistencia: string; hora_llegada?: string | null } = { estado_asistencia: nuevoEstado };

    if (nuevoEstado === 'PUNTUAL' || nuevoEstado === 'TARDANZA') {
      updateData.hora_llegada = new Date().toISOString();
    } else {
      updateData.hora_llegada = null;
    }

    try {
      const { data, error } = await supabase
        .from('Participaciones_Personal')
        .update(updateData)
        .eq('id', participacionId)
        .select('*, Personal(nombre), Evento_Servicios_Asignados(*, Servicios(nombre))')
        .single();

      if (error) throw error;

      const updatedParticipaciones = participaciones.map(p => p.id === participacionId ? data : p);
      setParticipaciones(updatedParticipaciones);
      alert('Estado de asistencia actualizado.');
    } catch (err: any) {
      alert(`Error al actualizar la asistencia: ${err.message}`);
    }
  };

  const handleCerrarContrato = async () => {
    if (!contrato) return;
    if (window.confirm('¿Estás seguro de que quieres cerrar este contrato? Esta acción es irreversible.')) {
      try {
        const { data, error } = await supabase
          .from('Contratos')
          .update({ estado: 'COMPLETADO' })
          .eq('id', contrato.id)
          .select('*')
          .single();

        if (error) throw error;

        setContrato(prev => prev ? { ...prev, estado: 'COMPLETADO' } : null);
        alert('El contrato ha sido cerrado y ya no se puede modificar.');
      } catch (err: any) {
        alert(`Error al cerrar el contrato: ${err.message}`);
      }
    }
  };

  const handleConfirmarAsignaciones = async () => {
    if (!contrato) return;
    if (window.confirm('¿Estás seguro de que has terminado de asignar personal y servicios? Esta acción marcará el contrato como listo para los siguientes pasos.')) {
      try {
        const { data, error } = await supabase
          .from('Contratos')
          .update({ estado_asignacion: 'COMPLETO' })
          .eq('id', contrato.id)
          .select()
          .single();

        if (error) throw error;

        setContrato(prev => prev ? { ...prev, estado_asignacion: 'COMPLETO' } : null);
        alert('Las asignaciones han sido confirmadas.');
      } catch (err: any) {
        alert(`Error al confirmar las asignaciones: ${err.message}`);
      }
    }
  };

  const handleEliminarContrato = async () => {
    if (!contrato) return;
    const confirmation = window.prompt('Para confirmar la eliminación, escribe "eliminar" en el campo de abajo. Esta acción no se puede deshacer.');
    if (confirmation === 'eliminar') {
      try {
        const { error } = await supabase
          .from('Contratos')
          .delete()
          .eq('id', contrato.id);

        if (error) throw error;

        alert('El contrato ha sido eliminado permanentemente.');
        router.push('/dashboard/contratos');
      } catch (err: any) {
        alert(`Error al eliminar el contrato: ${err.message}`);
      }
    }
  };

  // --- RENDER ---
  if (loading) return <p className="text-center text-slate-400">Cargando datos...</p>;
  if (error) return <p className="text-center text-red-400">Error: {error}</p>;
  if (!contrato) return <p>Contrato no encontrado.</p>;

  return (
    <Fragment>
      <div className="mb-6 flex justify-between items-center">
        <Link href="/dashboard/contratos" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <FiArrowLeft />
          Volver a Contratos
        </Link>
        <div className="flex items-center gap-4">
          {contrato.estado !== 'COMPLETADO' && contrato.estado_asignacion === 'PENDIENTE' && (
            <button 
              onClick={handleConfirmarAsignaciones}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiCheckCircle />
              Confirmar Asignaciones
            </button>
          )}
          {contrato.estado !== 'COMPLETADO' && (
            <button 
              onClick={handleCerrarContrato}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Cerrar Contrato
            </button>
          )}
          {contrato.estado !== 'COMPLETADO' && (
            <button 
              onClick={handleEliminarContrato}
              className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Eliminar Contrato
            </button>
          )}
        </div>
      </div>
      <div className="space-y-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">Asignación de Personal y Servicios</h2>
          <div className="flex gap-4 mb-6">
          <select 
            value={selectedPersonal}
            onChange={(e) => setSelectedPersonal(e.target.value)}
            className="flex-grow px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white disabled:bg-slate-800 disabled:cursor-not-allowed"
            disabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}
          >
            <option value="">-- Seleccionar personal --</option>
            {personalOperativo.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <button onClick={handleAsignarPersonal} className="px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed" disabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}>Asignar</button>
        </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Participante</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Servicios Asignados</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado Asistencia</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Hora Llegada</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {participaciones.map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 align-top text-sm text-white">{p.Personal?.nombre}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {p.Evento_Servicios_Asignados.map(esa => (
                          <span key={esa.id} className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
                            {esa.Servicios?.nombre}
                          </span>
                        ))}
                        {p.Evento_Servicios_Asignados.length === 0 && <span className="text-xs text-slate-500">Ninguno</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-sm">
                      <select
                        value={p.estado_asistencia}
                        onChange={(e) => handleUpdateAsistencia(p.id, e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded-lg text-white p-2 disabled:bg-slate-800 disabled:cursor-not-allowed"
                        disabled={contrato.estado === 'COMPLETADO'}
                      >
                        <option value="ASIGNADO">ASIGNADO</option>
                        <option value="PUNTUAL">PUNTUAL</option>
                        <option value="TARDANZA">TARDANZA</option>
                        <option value="AUSENTE">AUSENTE</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 align-top text-sm">
                      {p.hora_llegada ? new Date(p.hora_llegada).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 align-top text-sm">
                      <button onClick={() => handleOpenModal(p.id)} className="flex items-center gap-2 text-sky-400 hover:text-sky-300 font-semibold disabled:text-slate-500 disabled:cursor-not-allowed" disabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}>
                        <FiPlus /> Asignar Servicio
                      </button>
                    </td>
                  </tr>
                ))}
                {participaciones.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-500">No hay personal asignado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AsignarServicioModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        servicios={servicios} 
        onAsignar={handleAsignarServicio} 
      />
    </Fragment>
  );
}
