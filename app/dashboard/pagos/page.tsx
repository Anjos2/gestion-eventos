'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiCheckCircle, FiSearch, FiUsers } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

// Definición de tipos
interface ServicioPendiente {
  id_servicio_asignado: number;
  servicio_nombre: string;
  monto_pactado: number;
  contrato_id: number;
  estado_asistencia: string;
  fecha_contrato: string;
  tipo_contrato_nombre: string;
}

interface PersonalConPendientes {
  id_personal: number;
  nombre_personal: string;
  servicios_pendientes: ServicioPendiente[];
}

export default function PagosPage() {
  const router = useRouter();
  const { organization, session } = useOrganization();
  const [personalConPagos, setPersonalConPagos] = useState<PersonalConPendientes[]>([]);
  const [loading, setLoading] = useState(true);
  const [creandoLote, setCreandoLote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Record<number, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServices, setSelectedServices] = useState<Record<number, number[]>>({});
  const [selectedPersonal, setSelectedPersonal] = useState<Set<number>>(new Set());
  const supabase = createClientComponentClient();

  const fetchPagosPendientes = async () => {
    if (!organization) return;

    try {
      setLoading(true);
      const { data: pagosPendientes, error: pagosError } = await supabase
        .from('Evento_Servicios_Asignados')
        .select(`
          id,
          monto_pactado,
          Participaciones_Personal!inner(
            estado_asistencia,
            Personal!inner(id, nombre),
            Eventos_Contrato!inner(
              Contratos!inner(
                id,
                fecha_hora_evento,
                estado,
                Tipos_Contrato!inner(nombre)
              )
            )
          ),
          Servicios!inner(nombre)
        `)
        .eq('id_organizacion', organization.id)
        .eq('estado_pago', 'PENDIENTE')
        .eq('Participaciones_Personal.Eventos_Contrato.Contratos.estado', 'COMPLETADO');

      if (pagosError) throw new Error(pagosError.message);

      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);

      pagosPendientes.sort((a, b) => {
        const contratoA = getSingle(getSingle(getSingle(a.Participaciones_Personal)?.Eventos_Contrato)?.Contratos);
        const contratoB = getSingle(getSingle(getSingle(b.Participaciones_Personal)?.Eventos_Contrato)?.Contratos);
        const fechaA = new Date(contratoA?.fecha_hora_evento || 0).getTime();
        const fechaB = new Date(contratoB?.fecha_hora_evento || 0).getTime();
        return fechaA - fechaB;
      });

      const agrupados: Record<number, PersonalConPendientes> = {};

      pagosPendientes.forEach(pago => {
        const participacion = getSingle(pago.Participaciones_Personal);
        const personal = getSingle(participacion?.Personal);
        const contrato = getSingle(getSingle(participacion?.Eventos_Contrato)?.Contratos);
        const tipoContrato = getSingle(contrato?.Tipos_Contrato);
        const servicio = getSingle(pago.Servicios);

        if (personal && contrato && servicio && tipoContrato && participacion) {
          const idPersonal = personal.id;
          if (!agrupados[idPersonal]) {
            agrupados[idPersonal] = {
              id_personal: idPersonal,
              nombre_personal: personal.nombre,
              servicios_pendientes: [],
            };
          }

          agrupados[idPersonal].servicios_pendientes.push({
            id_servicio_asignado: pago.id,
            servicio_nombre: servicio.nombre,
            monto_pactado: pago.monto_pactado,
            contrato_id: contrato.id,
            estado_asistencia: participacion.estado_asistencia,
            fecha_contrato: new Date(contrato.fecha_hora_evento).toLocaleString(),
            tipo_contrato_nombre: tipoContrato.nombre,
          });
        }
      });

      setPersonalConPagos(Object.values(agrupados));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagosPendientes();
  }, [organization, supabase]);

  const handleDiscountChange = (id: number, value: string) => {
    const percentage = parseFloat(value);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      setDiscounts(prev => ({ ...prev, [id]: percentage }));
    }
  };

  const calculateFinalAmount = (service: ServicioPendiente) => {
    if (service.estado_asistencia === 'AUSENTE') return 0;
    if (service.estado_asistencia === 'TARDANZA') {
      const discountPercentage = discounts[service.id_servicio_asignado] || 0;
      return service.monto_pactado * (1 - discountPercentage / 100);
    }
    return service.monto_pactado;
  };

  const handleServiceSelection = (personalId: number, serviceId: number) => {
    setSelectedServices(prev => {
      const currentSelection = prev[personalId] || [];
      const newSelection = currentSelection.includes(serviceId)
        ? currentSelection.filter(id => id !== serviceId)
        : [...currentSelection, serviceId];
      return { ...prev, [personalId]: newSelection };
    });
  };

  const handleSelectAll = (personalId: number, services: ServicioPendiente[]) => {
    setSelectedServices(prev => {
      const currentSelection = prev[personalId] || [];
      const allServiceIds = services.map(s => s.id_servicio_asignado);
      const allSelected = currentSelection.length === allServiceIds.length;
      return { ...prev, [personalId]: allSelected ? [] : allServiceIds };
    });
  };

  const handlePersonalSelection = (personalId: number) => {
    setSelectedPersonal(prev => {
      const newSet = new Set(prev);
      if (newSet.has(personalId)) {
        newSet.delete(personalId);
        // También deseleccionar sus servicios
        setSelectedServices(current => {
          const updated = { ...current };
          delete updated[personalId];
          return updated;
        });
      } else {
        newSet.add(personalId);
        // Auto-seleccionar todos sus servicios
        const personal = personalConPagos.find(p => p.id_personal === personalId);
        if (personal) {
          setSelectedServices(current => ({
            ...current,
            [personalId]: personal.servicios_pendientes.map(s => s.id_servicio_asignado)
          }));
        }
      }
      return newSet;
    });
  };

  const handleCreateLoteMultiple = async () => {
    if (selectedPersonal.size === 0) {
      toast.error('Por favor, selecciona al menos una persona para crear el lote de pago.');
      return;
    }

    const personalSeleccionado = personalConPagos.filter(p => selectedPersonal.has(p.id_personal));
    const totalGeneral = personalSeleccionado.reduce((acc, personal) => {
      const selectedForPerson = selectedServices[personal.id_personal] || [];
      const servicesToPay = personal.servicios_pendientes.filter(s => selectedForPerson.includes(s.id_servicio_asignado));
      return acc + servicesToPay.reduce((sum, service) => sum + calculateFinalAmount(service), 0);
    }, 0);

    toast((t) => (
      <span>
        ¿Seguro que quieres crear un lote de pago para <b>{selectedPersonal.size} persona(s)</b> por <b>S/{totalGeneral.toFixed(2)}</b>?
        <div className="flex gap-2 mt-2">
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm"
            onClick={() => {
              toast.dismiss(t.id);
              performCreateLoteMultiple(personalSeleccionado, totalGeneral);
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

  const performCreateLoteMultiple = async (personalSeleccionado: PersonalConPendientes[], monto_total: number) => {
    setCreandoLote(true);
    const toastId = toast.loading('Creando lote de pago...');

    try {
      if (!session || !organization) throw new Error('No se pudo obtener la sesión o la organización.');

      const { data: adminData, error: adminError } = await supabase
        .from('Personal')
        .select('id')
        .eq('supabase_user_id', session.user.id)
        .single();
      if (adminError || !adminData) throw new Error('No se pudo encontrar al administrador.');

      const { id: id_personal_administrativo } = adminData;

      // Crear lote principal con estado EN_PREPARACION
      const { data: lotePago, error: loteError } = await supabase
        .from('Lotes_Pago')
        .insert({
          id_organizacion: organization.id,
          id_personal: personalSeleccionado[0].id_personal, // Por compatibilidad, usar el primero
          id_personal_administrativo,
          monto_total,
          fecha_pago: new Date().toISOString().slice(0, 10),
          estado: 'EN_PREPARACION',
          created_by: id_personal_administrativo,
        })
        .select('id')
        .single();

      if (loteError) throw new Error(`Error al crear el lote de pago: ${loteError.message}`);
      const id_lote_pago = lotePago.id;

      // Crear registros en Lotes_Pago_Personal para cada persona
      const lotesPersonalData = personalSeleccionado.map(personal => {
        const selectedForPerson = selectedServices[personal.id_personal] || [];
        const servicesToPay = personal.servicios_pendientes.filter(s => selectedForPerson.includes(s.id_servicio_asignado));
        const monto_personal = servicesToPay.reduce((sum, service) => sum + calculateFinalAmount(service), 0);

        return {
          id_organizacion: organization.id,
          id_lote_pago,
          id_personal: personal.id_personal,
          monto_asignado: monto_personal,
          cobro_realizado: false
        };
      });

      const { error: lotesPersonalError } = await supabase
        .from('Lotes_Pago_Personal')
        .insert(lotesPersonalData);

      if (lotesPersonalError) throw new Error(`Error al crear registros de personal: ${lotesPersonalError.message}`);

      // Crear detalles del lote para todos los servicios
      const todosLosDetalles: any[] = [];
      personalSeleccionado.forEach(personal => {
        const selectedForPerson = selectedServices[personal.id_personal] || [];
        const servicesToPay = personal.servicios_pendientes.filter(s => selectedForPerson.includes(s.id_servicio_asignado));

        servicesToPay.forEach(service => {
          todosLosDetalles.push({
            id_organizacion: organization.id,
            id_lote_pago,
            id_evento_servicio_asignado: service.id_servicio_asignado,
            monto_pagado: calculateFinalAmount(service),
            estado_asistencia_registrado: service.estado_asistencia,
            descuento_aplicado_pct: service.estado_asistencia === 'TARDANZA' ? discounts[service.id_servicio_asignado] || 0 : 0,
          });
        });
      });

      const { error: detallesError } = await supabase.from('Detalles_Lote_Pago').insert(todosLosDetalles);
      if (detallesError) throw new Error(`Error al crear los detalles del lote: ${detallesError.message}`);

      // Marcar servicios como EN_LOTE (temporal)
      const todosLosServiciosIds = todosLosDetalles.map(d => d.id_evento_servicio_asignado);
      const { error: updateError } = await supabase
        .from('Evento_Servicios_Asignados')
        .update({ estado_pago: 'EN_LOTE' })
        .in('id', todosLosServiciosIds);

      if (updateError) throw new Error(`Error al actualizar el estado de los servicios: ${updateError.message}`);

      toast.success(`¡Lote de pago #${id_lote_pago} creado con éxito!`, { id: toastId });

      // Redirigir a la página de gestión del lote
      router.push(`/dashboard/pagos/lote/${id_lote_pago}`);

    } catch (err: any) {
      toast.error(`Error al crear el lote: ${err.message}`, { id: toastId });
    } finally {
      setCreandoLote(false);
    }
  };

  const filteredPersonal = personalConPagos.filter(p =>
    p.nombre_personal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando pagos pendientes...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Pagos pendientes al personal</h1>
        {selectedPersonal.size > 0 && (
          <button
            onClick={handleCreateLoteMultiple}
            disabled={creandoLote}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
          >
            <FiUsers />
            {creandoLote ? 'Creando lote...' : `Crear lote de pago (${selectedPersonal.size} personas)`}
          </button>
        )}
      </div>

      <div className="mb-6 relative">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar personal por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
        />
      </div>

      <div className="space-y-8">
        {filteredPersonal.length > 0 ? (
          filteredPersonal.map(personal => {
            const selectedForPerson = selectedServices[personal.id_personal] || [];
            const totalAPagar = personal.servicios_pendientes
              .filter(s => selectedForPerson.includes(s.id_servicio_asignado))
              .reduce((acc, service) => acc + calculateFinalAmount(service), 0);
            const allSelected = selectedForPerson.length === personal.servicios_pendientes.length && personal.servicios_pendientes.length > 0;
            const isPersonalSelected = selectedPersonal.has(personal.id_personal);

            return (
              <div
                key={personal.id_personal}
                className={`bg-slate-800 rounded-xl shadow-lg p-6 border-2 transition-all ${
                  isPersonalSelected ? 'border-sky-500 bg-sky-900/20' : 'border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                  <div className="flex items-center gap-4 mb-2 md:mb-0">
                    <input
                      type="checkbox"
                      checked={isPersonalSelected}
                      onChange={() => handlePersonalSelection(personal.id_personal)}
                      className="form-checkbox h-6 w-6 bg-slate-700 border-slate-600 text-sky-500 rounded focus:ring-sky-500 cursor-pointer"
                    />
                    <h2 className="text-2xl font-bold text-white">{personal.nombre_personal}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Total a pagar</p>
                    <p className="text-3xl font-bold text-yellow-400">S/{totalAPagar.toFixed(2)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => handleSelectAll(personal.id_personal, personal.servicios_pendientes)}
                            className="form-checkbox h-5 w-5 bg-slate-700 border-slate-600 text-sky-500 rounded focus:ring-sky-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Servicio</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-center">Contrato</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Tipo de contrato</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Fecha del evento</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Asistencia</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-right">Monto a pagar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {personal.servicios_pendientes.map(servicio => {
                        const isSelected = selectedForPerson.includes(servicio.id_servicio_asignado);
                        return (
                          <tr key={servicio.id_servicio_asignado} className={`hover:bg-slate-700/50 transition-colors ${isSelected ? 'bg-sky-900/50' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleServiceSelection(personal.id_personal, servicio.id_servicio_asignado)}
                                className="form-checkbox h-5 w-5 bg-slate-700 border-slate-600 text-sky-500 rounded focus:ring-sky-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3">{servicio.servicio_nombre}</td>
                            <td className="px-4 py-3 text-center">
                              <Link
                                href={`/dashboard/contratos/${servicio.contrato_id}`}
                                className="bg-slate-700 hover:bg-slate-600 text-sky-300 font-semibold py-1 px-3 rounded-lg text-xs transition-colors duration-200"
                              >
                                Ver contrato
                              </Link>
                            </td>
                            <td className="px-4 py-3">{servicio.tipo_contrato_nombre}</td>
                            <td className="px-4 py-3">{servicio.fecha_contrato}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${{
                                PUNTUAL: 'bg-green-900 text-green-200',
                                TARDANZA: 'bg-yellow-900 text-yellow-200',
                                AUSENTE: 'bg-red-900 text-red-200',
                                ASIGNADO: 'bg-blue-900 text-blue-200'
                              }[servicio.estado_asistencia]}`}>
                                {servicio.estado_asistencia}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {servicio.estado_asistencia === 'TARDANZA' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-slate-400 line-through">S/{servicio.monto_pactado.toFixed(2)}</span>
                                  <input
                                    type="number"
                                    placeholder="% Dcto."
                                    onChange={(e) => handleDiscountChange(servicio.id_servicio_asignado, e.target.value)}
                                    className="w-24 bg-slate-700 border border-slate-600 rounded-md p-1 text-center text-white"
                                  />
                                  <span className="font-bold text-yellow-400">S/{calculateFinalAmount(servicio).toFixed(2)}</span>
                                </div>
                              ) : (
                                <span className={`${servicio.estado_asistencia === 'AUSENTE' ? 'text-red-400' : 'text-white'}`}>
                                  S/{calculateFinalAmount(servicio).toFixed(2)}
                                </span>
                              )}
                            </td>
                          </tr>
                        )}
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
            {searchTerm ? (
              <>
                <FiSearch className="mx-auto text-6xl text-slate-500 mb-4" />
                <h2 className="text-2xl font-bold text-white">No se encontraron resultados</h2>
                <p className="text-slate-400 mt-2">No hay personal que coincida con "{searchTerm}".</p>
              </>
            ) : (
              <>
                <FiCheckCircle className="mx-auto text-6xl text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-white">¡Excelente!</h2>
                <p className="text-slate-400 mt-2">No hay pagos pendientes para contratos completados.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
