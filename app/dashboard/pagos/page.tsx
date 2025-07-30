'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { FiCheckCircle } from 'react-icons/fi';
import Link from 'next/link';

// Definición de tipos actualizada
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
  const [personalConPagos, setPersonalConPagos] = useState<PersonalConPendientes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Record<number, number>>({});

  useEffect(() => {
    const fetchPagosPendientes = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuario no autenticado. Redirigiendo...');

        const { data: adminData, error: adminError } = await supabase
          .from('Personal')
          .select('id_organizacion')
          .eq('supabase_user_id', user.id)
          .single();

        if (adminError || !adminData) throw new Error('No se pudo encontrar la organización del administrador.');

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
                  created_at,
                  Tipos_Contrato!inner(nombre)
                )
              )
            ),
            Servicios!inner(nombre)
          `)
          .eq('id_organizacion', adminData.id_organizacion)
          .eq('estado_pago', 'PENDIENTE')
          .eq('Participaciones_Personal.Eventos_Contrato.Contratos.estado', 'COMPLETADO');

        if (pagosError) throw new Error(pagosError.message);

        const agrupados: Record<number, PersonalConPendientes> = {};

        pagosPendientes.forEach(pago => {
          const participacion = pago.Participaciones_Personal;
          const personal = participacion?.Personal;
          const contrato = participacion?.Eventos_Contrato?.Contratos;
          const tipoContrato = contrato?.Tipos_Contrato;
          const servicio = pago.Servicios;

          if (personal && contrato && servicio && tipoContrato) {
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
              fecha_contrato: new Date(contrato.created_at).toLocaleString(),
              tipo_contrato_nombre: tipoContrato.nombre,
            });
          }
        });

        setPersonalConPagos(Object.values(agrupados));

      } catch (err: any) {
        setError(err.message);
        if (err.message.includes('autenticado')) {
          window.location.href = '/auth/login';
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPagosPendientes();
  }, []);

  const handleDiscountChange = (id: number, value: string) => {
    const percentage = parseFloat(value);
    if (percentage >= 0 && percentage <= 100) {
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

  if (loading) return <div className="flex justify-center items-center h-64"><p className="text-lg text-slate-400">Cargando pagos pendientes...</p></div>;
  if (error) return <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg" role="alert"><p>{error}</p></div>;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Pagos Pendientes al Personal</h1>
      
      <div className="space-y-8">
        {personalConPagos.length > 0 ? (
          personalConPagos.map(personal => {
            const totalPendiente = personal.servicios_pendientes.reduce((acc, service) => acc + calculateFinalAmount(service), 0);

            return (
              <div key={personal.id_personal} className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                  <h2 className="text-2xl font-bold text-white mb-2 md:mb-0">{personal.nombre_personal}</h2>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Total a Pagar</p>
                    <p className="text-3xl font-bold text-yellow-400">S/{totalPendiente.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Servicio</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-center">Contrato</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Tipo Contrato</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Fecha Contrato</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider">Asistencia</th>
                        <th className="px-4 py-2 font-semibold text-slate-400 uppercase tracking-wider text-right">Monto a Pagar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {personal.servicios_pendientes.map(servicio => (
                        <tr key={servicio.id_servicio_asignado} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-3">{servicio.servicio_nombre}</td>
                          <td className="px-4 py-3 text-center">
                            <Link 
                              href={`/dashboard/contratos/${servicio.contrato_id}`}
                              className="bg-slate-700 hover:bg-slate-600 text-sky-300 font-semibold py-1 px-3 rounded-lg text-xs transition-colors duration-200"
                            >
                              Ver Contrato
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
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-6 text-right">
                    <button 
                      className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 transform hover:scale-105"
                    >
                      Crear Lote de Pago
                    </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700">
            <FiCheckCircle className="mx-auto text-6xl text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-white">¡Excelente!</h2>
            <p className="text-slate-400 mt-2">No hay pagos pendientes para contratos completados.</p>
          </div>
        )}
      </div>
    </div>
  )
}