'use client';

import { useEffect, useState, Fragment } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useParams, useRouter } from 'next/navigation';
import { FiPlus, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import Link from 'next/link';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';

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

interface Servicio {
  id: number;
  nombre: string;
  monto_base: number;
}

interface CanalPago {
  id: number;
  nombre: string;
  es_principal: boolean;
}

interface Participacion {
  id: number;
  estado_asistencia: string;
  hora_llegada: string | null;
  incluir_en_calculos: boolean;
  id_canal_pago_egreso: number | null;
  Personal: { nombre: string } | null;
  Canales_Pago: { nombre: string, es_principal: boolean } | null;
  Evento_Servicios_Asignados: { id: number, Servicios: { nombre: string } | null }[];
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

// --- MODAL COMPONENT ---
const AsignarServicioModal = ({ isOpen, onClose, servicios, onAsignar }: any) => {
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
        <h3 className="text-xl font-bold text-white mb-4">Asignar servicio</h3>
        <select 
          value={selectedServicio}
          onChange={(e) => setSelectedServicio(e.target.value)}
          className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-6"
        >
          <option value="">-- Elige un servicio --</option>
          {servicios.map((s: Servicio) => <option key={s.id} value={s.id}>{s.nombre} (S/. {s.monto_base.toFixed(2)})</option>)}
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
  const [participaciones, setParticipaciones] = useState<Participacion[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [canalesPago, setCanalesPago] = useState<CanalPago[]>([]);
  const [selectedPersonal, setSelectedPersonal] = useState<SelectOption[]>([]);
  const [selectedCanalPago, setSelectedCanalPago] = useState<string>('');
  const [incluirEnCalculos, setIncluirEnCalculos] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentParticipacionId, setCurrentParticipacionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

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

        const [participacionesRes, serviciosRes, canalesPagoRes] = await Promise.all([
          supabase.from('Participaciones_Personal').select(`*, Personal(nombre), Canales_Pago(nombre, es_principal), Evento_Servicios_Asignados(*, Servicios(nombre))`).eq('id_evento_contrato', eventoId),
          supabase.from('Servicios').select('id, nombre, monto_base').eq('id_organizacion', contratoData.id_organizacion).eq('es_activo', true),
          supabase.from('Canales_Pago').select('id, nombre, es_principal').eq('id_organizacion', contratoData.id_organizacion).eq('es_activo', true).order('es_principal', { ascending: false })
        ]);

        if (participacionesRes.error) throw participacionesRes.error;
        if (serviciosRes.error) throw serviciosRes.error;
        if (canalesPagoRes.error) throw canalesPagoRes.error;

        setParticipaciones(participacionesRes.data || []);
        setServicios(serviciosRes.data || []);
        setCanalesPago(canalesPagoRes.data || []);

        // Establecer canal principal por defecto
        const canalPrincipal = canalesPagoRes.data?.find(c => c.es_principal);
        if (canalPrincipal) {
          setSelectedCanalPago(canalPrincipal.id.toString());
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [id, supabase]);

  const loadPersonal = async (inputValue: string): Promise<SelectOption[]> => {
    if (!contrato) return [];

    const { data, error } = await supabase.rpc('search_organization_personnel', {
      p_search_text: inputValue,
      p_limit: 10
    });

    if (error) {
      console.error('Error buscando personal:', error);
      return [];
    }

    return data.map((p: any) => ({ value: p.id, label: p.nombre }));
  };

  // --- HANDLERS ---
  const handleAsignarPersonal = async () => {
    if (!selectedPersonal.length || !contrato || !contrato.Eventos_Contrato[0]?.id) {
      alert('Selecciona al menos un miembro del personal.');
      return;
    }

    try {
      const insertDataArray = selectedPersonal.map(person => {
        const insertData: any = {
          id_organizacion: contrato.id_organizacion,
          id_evento_contrato: contrato.Eventos_Contrato[0].id,
          id_personal_participante: person.value,
          estado_asistencia: 'ASIGNADO',
          incluir_en_calculos: incluirEnCalculos,
        };

        // Solo agregar id_canal_pago_egreso si se seleccionó uno diferente al principal
        if (selectedCanalPago) {
          insertData.id_canal_pago_egreso = parseInt(selectedCanalPago);
        }

        return insertData;
      });

      const { data: nuevasParticipaciones, error } = await supabase
        .from('Participaciones_Personal')
        .insert(insertDataArray)
        .select('*, Personal(nombre), Canales_Pago(nombre, es_principal), Evento_Servicios_Asignados(*, Servicios(nombre))');

      if (error) throw error;

      setParticipaciones([...participaciones, ...(nuevasParticipaciones || [])]);
      setSelectedPersonal([]);
      setIncluirEnCalculos(true);
      // Resetear al canal principal
      const canalPrincipal = canalesPago.find(c => c.es_principal);
      setSelectedCanalPago(canalPrincipal ? canalPrincipal.id.toString() : '');
      alert(`${selectedPersonal.length} miembro(s) del personal asignado(s) con éxito.`);
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
          Volver a contratos
        </Link>
        <div className="flex items-center gap-4">
          {contrato.estado !== 'COMPLETADO' && contrato.estado_asignacion === 'PENDIENTE' && (
            <button 
              onClick={handleConfirmarAsignaciones}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiCheckCircle />
              Confirmar asignaciones
            </button>
          )}
          {contrato.estado !== 'COMPLETADO' && (
            <button 
              onClick={handleCerrarContrato}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Cerrar contrato
            </button>
          )}
          {contrato.estado !== 'COMPLETADO' && (
            <button 
              onClick={handleEliminarContrato}
              className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Eliminar contrato
            </button>
          )}
        </div>
      </div>
      <div className="space-y-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">Asignación de personal y servicios</h2>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Personal (puedes seleccionar múltiples)</label>
                <AsyncSelect
                  value={selectedPersonal}
                  onChange={(options) => setSelectedPersonal(options as SelectOption[])}
                  loadOptions={loadPersonal}
                  placeholder="Buscar y seleccionar personal..."
                  cacheOptions
                  defaultOptions
                  styles={selectStyles}
                  classNamePrefix="react-select"
                  isMulti={true}
                  isDisabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Canal de Pago (Egreso)</label>
                <select
                  value={selectedCanalPago}
                  onChange={(e) => setSelectedCanalPago(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white h-[42px]"
                  disabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}
                >
                  <option value="">Seleccione</option>
                  {canalesPago.map(cp => <option key={cp.id} value={cp.id}>{cp.nombre}{cp.es_principal ? ' ⭐' : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="incluir_en_calculos"
                checked={incluirEnCalculos}
                onChange={(e) => setIncluirEnCalculos(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded focus:ring-2 focus:ring-sky-500"
                disabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}
              />
              <label htmlFor="incluir_en_calculos" className="text-sm text-slate-300">
                Incluir en cálculos de ingresos y egresos
              </label>
              <span className="text-xs text-slate-500 ml-2">(Desmarcar si se paga desde otra fuente)</span>
            </div>
            <div>
              <button
                onClick={handleAsignarPersonal}
                className="w-full md:w-auto px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed"
                disabled={contrato.estado === 'COMPLETADO' || contrato.estado_asignacion === 'COMPLETO'}
              >
                {selectedPersonal.length > 0 ? `Asignar ${selectedPersonal.length} Personal` : 'Asignar Personal'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Participante</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Canal de Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Servicios asignados</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Estado de asistencia</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Hora de llegada</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {participaciones.map((p: Participacion) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 align-top text-sm text-white">{p.Personal?.nombre}</td>
                    <td className="px-6 py-4 align-top text-sm text-slate-300">
                      <span className={`px-2 py-1 text-xs rounded-full ${p.Canales_Pago?.es_principal ? 'bg-blue-900 text-blue-200' : 'bg-slate-700 text-slate-300'}`}>
                        {p.Canales_Pago?.nombre || 'Canal Principal'}
                      </span>
                    </td>
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
                        <FiPlus /> Asignar servicio
                      </button>
                    </td>
                  </tr>
                ))}
                {participaciones.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">No hay personal asignado.</td></tr>}
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