'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiPrinter, FiDownload, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// --- INTERFACES ---
interface PersonalEnLote {
  id_personal: number;
  nombre_personal: string;
  monto_asignado: number;
  cobro_realizado: boolean;
  contratos_por_tipo: Record<string, { cantidad: number; monto: number }>;
  total_contratos: number;
}

interface TipoContrato {
  nombre: string;
}

export default function LotePagoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [loteInfo, setLoteInfo] = useState<any>(null);
  const [personalEnLote, setPersonalEnLote] = useState<PersonalEnLote[]>([]);
  const [tiposContrato, setTiposContrato] = useState<string[]>([]);
  const [fechaPago, setFechaPago] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const supabase = createClientComponentClient();

  // Estilos de impresión
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-area, #print-area * {
          visibility: visible;
        }
        #print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        table {
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        .print-header {
          margin-bottom: 20px;
          text-align: center;
        }
        .print-signature-line {
          border-bottom: 1px solid #000;
          height: 40px;
          width: 150px;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (id && organization) {
      fetchLoteData();
    }
  }, [id, organization]);

  const fetchLoteData = async () => {
    try {
      setLoading(true);

      // 1. Obtener información del lote
      const { data: lote, error: loteError } = await supabase
        .from('Lotes_Pago')
        .select('*')
        .eq('id', id)
        .eq('id_organizacion', organization?.id)
        .single();

      if (loteError) throw loteError;
      setLoteInfo(lote);
      setFechaPago(lote.fecha_pago_programada || '');

      // 2. Obtener personal del lote
      const { data: lotesPersonal, error: personalError } = await supabase
        .from('Lotes_Pago_Personal')
        .select(`
          id_personal,
          monto_asignado,
          cobro_realizado,
          Personal(nombre)
        `)
        .eq('id_lote_pago', id);

      if (personalError) throw personalError;

      // 3. Obtener detalles de los servicios del lote
      const { data: detalles, error: detallesError } = await supabase
        .from('Detalles_Lote_Pago')
        .select(`
          id_evento_servicio_asignado,
          monto_pagado,
          Evento_Servicios_Asignados!inner(
            Participaciones_Personal!inner(
              id_personal_participante,
              Eventos_Contrato!inner(
                Contratos!inner(
                  Tipos_Contrato(nombre)
                )
              )
            )
          )
        `)
        .eq('id_lote_pago', id);

      if (detallesError) throw detallesError;

      // 4. Procesar datos para construir la tabla
      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);
      const tiposSet = new Set<string>();
      const personalMap: Record<number, PersonalEnLote> = {};

      // Inicializar personal
      lotesPersonal.forEach((lp: any) => {
        const personal = getSingle(lp.Personal);
        personalMap[lp.id_personal] = {
          id_personal: lp.id_personal,
          nombre_personal: personal?.nombre || 'Desconocido',
          monto_asignado: lp.monto_asignado,
          cobro_realizado: lp.cobro_realizado,
          contratos_por_tipo: {},
          total_contratos: 0
        };
      });

      // Agrupar por tipo de contrato
      detalles.forEach((detalle: any) => {
        const esa = getSingle(detalle.Evento_Servicios_Asignados);
        const participacion = getSingle(esa?.Participaciones_Personal);
        const idPersonal = participacion?.id_personal_participante;
        const contrato = getSingle(getSingle(participacion?.Eventos_Contrato)?.Contratos);
        const tipoContrato = getSingle(contrato?.Tipos_Contrato);
        const nombreTipo = tipoContrato?.nombre || 'Sin tipo';

        if (personalMap[idPersonal]) {
          tiposSet.add(nombreTipo);

          if (!personalMap[idPersonal].contratos_por_tipo[nombreTipo]) {
            personalMap[idPersonal].contratos_por_tipo[nombreTipo] = {
              cantidad: 0,
              monto: 0
            };
          }

          personalMap[idPersonal].contratos_por_tipo[nombreTipo].cantidad += 1;
          personalMap[idPersonal].contratos_por_tipo[nombreTipo].monto += detalle.monto_pagado;
          personalMap[idPersonal].total_contratos += 1;
        }
      });

      setTiposContrato(Array.from(tiposSet).sort());
      setPersonalEnLote(Object.values(personalMap));

    } catch (err: any) {
      toast.error(`Error al cargar el lote: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCobro = async (idPersonal: number) => {
    try {
      const personal = personalEnLote.find(p => p.id_personal === idPersonal);
      if (!personal) return;

      const { error } = await supabase
        .from('Lotes_Pago_Personal')
        .update({ cobro_realizado: !personal.cobro_realizado })
        .eq('id_lote_pago', id)
        .eq('id_personal', idPersonal);

      if (error) throw error;

      setPersonalEnLote(prev =>
        prev.map(p =>
          p.id_personal === idPersonal
            ? { ...p, cobro_realizado: !p.cobro_realizado }
            : p
        )
      );

      toast.success('Estado de cobro actualizado');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleActualizarFecha = async () => {
    if (!fechaPago) {
      toast.error('Por favor, ingresa una fecha de pago');
      return;
    }

    try {
      const { error } = await supabase
        .from('Lotes_Pago')
        .update({ fecha_pago_programada: fechaPago })
        .eq('id', id);

      if (error) throw error;

      toast.success('Fecha de pago actualizada');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDescargarExcel = () => {
    // Construir datos para Excel
    const excelData: any[] = [];

    // Encabezados
    const headers = ['Nombre', 'Total Contratos', 'Monto Total'];
    tiposContrato.forEach(tipo => {
      headers.push(`${tipo} (Cant)`);
      headers.push(`${tipo} (S/)`);
    });
    headers.push('Firma');
    excelData.push(headers);

    // Datos
    personalEnLote.forEach(personal => {
      const row: any[] = [
        personal.nombre_personal,
        personal.total_contratos,
        `S/ ${personal.monto_asignado.toFixed(2)}`
      ];

      tiposContrato.forEach(tipo => {
        const data = personal.contratos_por_tipo[tipo] || { cantidad: 0, monto: 0 };
        row.push(data.cantidad);
        row.push(`S/ ${data.monto.toFixed(2)}`);
      });

      row.push(''); // Columna firma
      excelData.push(row);
    });

    // Crear workbook y worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Pagos');

    // Descargar
    XLSX.writeFile(wb, `Lote_Pago_${id}_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Excel descargado exitosamente');
  };

  const handleFinalizarLote = async () => {
    const confirmacion = window.confirm(
      '¿Estás seguro de finalizar este lote? Los que cobraron se marcarán como PAGADO y los que no volverán a PENDIENTE.'
    );
    if (!confirmacion) return;

    setFinalizando(true);
    const toastId = toast.loading('Finalizando lote...');

    try {
      // 1. Obtener detalles del lote
      const { data: detalles, error: detallesError } = await supabase
        .from('Detalles_Lote_Pago')
        .select(`
          id_evento_servicio_asignado,
          Evento_Servicios_Asignados!inner(
            Participaciones_Personal!inner(
              id_personal_participante
            )
          )
        `)
        .eq('id_lote_pago', id);

      if (detallesError) throw detallesError;

      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);

      // 2. Separar servicios por personal que cobró y que no cobró
      const serviciosCobrados: number[] = [];
      const serviciosNoCobrados: number[] = [];

      detalles.forEach((det: any) => {
        const esa = getSingle(det.Evento_Servicios_Asignados);
        const participacion = getSingle(esa?.Participaciones_Personal);
        const idPersonal = participacion?.id_personal_participante;

        const personalInfo = personalEnLote.find(p => p.id_personal === idPersonal);

        if (personalInfo?.cobro_realizado) {
          serviciosCobrados.push(det.id_evento_servicio_asignado);
        } else {
          serviciosNoCobrados.push(det.id_evento_servicio_asignado);
        }
      });

      // 3. Actualizar servicios cobrados a PAGADO
      if (serviciosCobrados.length > 0) {
        const { error: pagadosError } = await supabase
          .from('Evento_Servicios_Asignados')
          .update({ estado_pago: 'PAGADO' })
          .in('id', serviciosCobrados);

        if (pagadosError) throw pagadosError;
      }

      // 4. Actualizar servicios no cobrados a PENDIENTE
      if (serviciosNoCobrados.length > 0) {
        const { error: pendientesError } = await supabase
          .from('Evento_Servicios_Asignados')
          .update({ estado_pago: 'PENDIENTE' })
          .in('id', serviciosNoCobrados);

        if (pendientesError) throw pendientesError;
      }

      // 5. Actualizar estado del lote a FINALIZADO
      const { error: loteError } = await supabase
        .from('Lotes_Pago')
        .update({
          estado: 'FINALIZADO',
          fecha_pago_programada: fechaPago || loteInfo.fecha_pago
        })
        .eq('id', id);

      if (loteError) throw loteError;

      toast.success(
        `Lote finalizado. ${serviciosCobrados.length} servicios pagados, ${serviciosNoCobrados.length} vueltos a pendientes.`,
        { id: toastId, duration: 5000 }
      );

      setTimeout(() => {
        router.push('/dashboard/pagos');
      }, 2000);

    } catch (err: any) {
      toast.error(`Error al finalizar lote: ${err.message}`, { id: toastId });
    } finally {
      setFinalizando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-lg text-slate-400">Cargando lote de pago...</p>
      </div>
    );
  }

  if (!loteInfo) {
    return (
      <div className="p-8">
        <p className="text-red-400">No se encontró el lote de pago.</p>
        <Link href="/dashboard/pagos" className="text-sky-400 hover:underline mt-4 inline-block">
          Volver a pagos
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 no-print">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/pagos"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <FiArrowLeft />
            Volver
          </Link>
          <h1 className="text-3xl font-bold text-white">
            Lote de Pago #{id}
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            loteInfo.estado === 'EN_PREPARACION'
              ? 'bg-yellow-900 text-yellow-200'
              : loteInfo.estado === 'FINALIZADO'
              ? 'bg-green-900 text-green-200'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {loteInfo.estado}
          </span>
        </div>
      </div>

      {/* Fecha de pago */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700 no-print">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Fecha programada de pago
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              disabled={loteInfo.estado === 'FINALIZADO'}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleActualizarFecha}
            disabled={loteInfo.estado === 'FINALIZADO' || !fechaPago}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            Actualizar fecha
          </button>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-4 mb-6 no-print">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
        >
          <FiPrinter /> Imprimir
        </button>
        <button
          onClick={handleDescargarExcel}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
        >
          <FiDownload /> Descargar Excel
        </button>
        {loteInfo.estado === 'EN_PREPARACION' && (
          <button
            onClick={handleFinalizarLote}
            disabled={finalizando || !fechaPago}
            className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            <FiCheckCircle />
            {finalizando ? 'Finalizando...' : 'Finalizar lote'}
          </button>
        )}
      </div>

      {/* Área de impresión */}
      <div id="print-area">
        <div className="print-header hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Lote de Pago #{id}</h1>
          <p className="text-sm mt-2">Organización: {organization?.nombre}</p>
          {fechaPago && <p className="text-sm">Fecha de Pago: {new Date(fechaPago).toLocaleDateString()}</p>}
        </div>

        {/* Tabla de reporte */}
        <div className="bg-slate-800 print:bg-white rounded-xl shadow-lg border border-slate-700 print:border-black overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">
                  Nombre
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">
                  Total Contratos
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">
                  Monto Total
                </th>
                {tiposContrato.map(tipo => (
                  <React.Fragment key={tipo}>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase border-l border-slate-700">
                      {tipo} (Cant)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">
                      {tipo} (S/)
                    </th>
                  </React.Fragment>
                ))}
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase border-l border-slate-700">
                  Firma
                </th>
                {loteInfo.estado === 'EN_PREPARACION' && (
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase">
                    Cobró
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {personalEnLote.map(personal => (
                <tr
                  key={personal.id_personal}
                  className={`hover:bg-slate-700/50 transition-colors ${
                    personal.cobro_realizado ? 'bg-green-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {personal.nombre_personal}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-300">
                    {personal.total_contratos}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-yellow-400">
                    S/ {personal.monto_asignado.toFixed(2)}
                  </td>
                  {tiposContrato.map(tipo => {
                    const data = personal.contratos_por_tipo[tipo] || { cantidad: 0, monto: 0 };
                    return (
                      <React.Fragment key={tipo}>
                        <td className="px-4 py-3 text-center text-slate-300 border-l border-slate-700">
                          {data.cantidad}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          S/ {data.monto.toFixed(2)}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-4 py-3 border-l border-slate-700">
                    <div className="h-8 border-b border-slate-600" />
                  </td>
                  {loteInfo.estado === 'EN_PREPARACION' && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={personal.cobro_realizado}
                        onChange={() => handleToggleCobro(personal.id_personal)}
                        className="form-checkbox h-5 w-5 bg-slate-700 border-slate-600 text-green-500 rounded focus:ring-green-500 cursor-pointer"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* Cierre de print-area */}
    </div>
  );
}
