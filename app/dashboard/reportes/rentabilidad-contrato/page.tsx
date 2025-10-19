'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useOrganization } from '@/app/context/OrganizationContext';
import { FiFilter, FiCalendar, FiFileText, FiDollarSign, FiTrendingUp, FiTrendingDown, FiBarChart2, FiDownload } from 'react-icons/fi';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// Tipos de datos
interface TipoContrato {
  id: number;
  nombre: string;
}

interface DetalleIngreso {
  id: number;
  fecha: string;
  ingreso: number;
  contratadorNombre: string;
}

interface DetalleCosto {
  contratoId: number;
  servicioNombre: string;
  montoPagado: number;
  personalNombre: string;
  fechaEvento: string;
}

interface ReportData {
  tipoContratoNombre: string;
  ingresoTotal: number;
  costoTotal: number;
  ingresoNeto: number;
  cantidadContratos: number;
  detallesIngreso: DetalleIngreso[];
  detallesCosto: DetalleCosto[];
}

export default function RentabilidadContratoReportePage() {
  const { organization } = useOrganization();
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchTiposContrato = async () => {
      if (!organization) return;

      const { data, error } = await supabase
        .from('Tipos_Contrato')
        .select('id, nombre')
        .eq('id_organizacion', organization.id)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error fetching tipos de contrato:', error);
      } else {
        setTiposContrato(data || []);
      }
    };
    fetchTiposContrato();
  }, [organization, supabase]);

  const handleGenerateReport = async () => {
    if (selectedTipos.length === 0 || !startDate || !endDate) {
      setError('Por favor, seleccione al menos un tipo de contrato y un rango de fechas.');
      return;
    }
    setLoading(true);
    setError(null);
    setReportData([]);

    try {
      const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);

      // QUERY 1: Get contracts that match filters (date is in Contratos table)
      const { data: contratos, error: contratosError } = await supabase
        .from('Contratos')
        .select('id, id_tipo_contrato, fecha_hora_evento')
        .in('id_tipo_contrato', selectedTipos)
        .gte('fecha_hora_evento', startDate)
        .lte('fecha_hora_evento', endDate);

      if (contratosError) throw contratosError;
      if (!contratos || contratos.length === 0) {
        setReportData([]);
        setLoading(false);
        return;
      }

      const contratoIds = contratos.map(c => c.id);
      const tipoContratoIds = Array.from(new Set(contratos.map(c => c.id_tipo_contrato)));

      // QUERY 2: Get Tipos_Contrato info
      const { data: tiposContratoData, error: tiposError } = await supabase
        .from('Tipos_Contrato')
        .select('id, nombre, ingreso_base')
        .in('id', tipoContratoIds);

      if (tiposError) throw tiposError;

      // QUERY 3: Get Contratadores info
      const { data: contratadoresData, error: contratadoresError } = await supabase
        .from('Contratadores')
        .select('id')
        .in('id', contratoIds);

      if (contratadoresError) throw contratadoresError;

      // Get contratador names (since Contratadores uses id_contrato as FK)
      const { data: contratadoresNombres, error: contratadoresNombresError } = await supabase
        .from('Contratos')
        .select('id, Contratadores(nombre)')
        .in('id', contratoIds);

      if (contratadoresNombresError) throw contratadoresNombresError;

      // QUERY 4: Get Eventos_Contrato (intermediate table)
      const { data: eventosContrato, error: eventosError } = await supabase
        .from('Eventos_Contrato')
        .select('id, id_contrato')
        .in('id_contrato', contratoIds);

      if (eventosError) throw eventosError;
      if (!eventosContrato || eventosContrato.length === 0) {
        // No events, so no costs - just show income
        const dataMap = buildIngresoData(contratos, tiposContratoData, contratadoresNombres, getSingle);
        setReportData(Object.values(dataMap));
        setLoading(false);
        return;
      }

      const eventoContratoIds = eventosContrato.map(ec => ec.id);

      // QUERY 5: Get Participaciones_Personal
      const { data: participaciones, error: participacionesError } = await supabase
        .from('Participaciones_Personal')
        .select('id, id_evento_contrato, id_personal_participante')
        .in('id_evento_contrato', eventoContratoIds);

      if (participacionesError) throw participacionesError;
      if (!participaciones || participaciones.length === 0) {
        const dataMap = buildIngresoData(contratos, tiposContratoData, contratadoresNombres, getSingle);
        setReportData(Object.values(dataMap));
        setLoading(false);
        return;
      }

      const participacionIds = participaciones.map(p => p.id);
      const personalIds = Array.from(new Set(participaciones.map(p => p.id_personal_participante)));

      // QUERY 6: Get Evento_Servicios_Asignados
      const { data: serviciosAsignados, error: serviciosError } = await supabase
        .from('Evento_Servicios_Asignados')
        .select('id, id_participacion, id_servicio, estado_pago')
        .in('id_participacion', participacionIds);

      if (serviciosError) throw serviciosError;
      if (!serviciosAsignados || serviciosAsignados.length === 0) {
        const dataMap = buildIngresoData(contratos, tiposContratoData, contratadoresNombres, getSingle);
        setReportData(Object.values(dataMap));
        setLoading(false);
        return;
      }

      const servicioAsignadoIds = serviciosAsignados.map(sa => sa.id);
      const servicioIds = Array.from(new Set(serviciosAsignados.map(sa => sa.id_servicio)));

      // QUERY 7: Get Detalles_Lote_Pago (only for PAID services)
      const { data: detallesLote, error: detallesError } = await supabase
        .from('Detalles_Lote_Pago')
        .select('id_evento_servicio_asignado, monto_pagado')
        .in('id_evento_servicio_asignado', servicioAsignadoIds);

      if (detallesError) throw detallesError;

      // QUERY 8: Get Servicios info
      const { data: serviciosInfo, error: serviciosInfoError } = await supabase
        .from('Servicios')
        .select('id, nombre')
        .in('id', servicioIds);

      if (serviciosInfoError) throw serviciosInfoError;

      // QUERY 9: Get Personal info
      const { data: personalInfo, error: personalError } = await supabase
        .from('Personal')
        .select('id, nombre')
        .in('id', personalIds);

      if (personalError) throw personalError;

      // Create Maps for O(1) lookups
      const tipoContratoMap = new Map(tiposContratoData?.map(tc => [tc.id, tc]));
      const contratoMap = new Map(contratos.map(c => [c.id, c]));
      const eventoContratoMap = new Map(eventosContrato.map(ec => [ec.id, ec]));
      const participacionMap = new Map(participaciones.map(p => [p.id, p]));
      const servicioAsignadoMap = new Map(serviciosAsignados.map(sa => [sa.id, sa]));
      const servicioInfoMap = new Map(serviciosInfo?.map(s => [s.id, s]));
      const personalInfoMap = new Map(personalInfo?.map(p => [p.id, p]));
      const contratadorMap = new Map(
        contratadoresNombres?.map(c => {
          const contratador = getSingle(c.Contratadores);
          return [c.id, contratador?.nombre || 'N/A'];
        })
      );

      // Build income data first
      const dataMap = buildIngresoData(contratos, tiposContratoData, contratadoresNombres, getSingle);

      // Add cost data
      detallesLote?.forEach((detalle: any) => {
        const servicioAsignado = servicioAsignadoMap.get(detalle.id_evento_servicio_asignado);
        if (!servicioAsignado) return;

        // Only count costs for actually PAID services
        if (servicioAsignado.estado_pago !== 'PAGADO') return;

        const participacion = participacionMap.get(servicioAsignado.id_participacion);
        if (!participacion) return;

        const eventoContrato = eventoContratoMap.get(participacion.id_evento_contrato);
        if (!eventoContrato) return;

        const contrato = contratoMap.get(eventoContrato.id_contrato);
        if (!contrato) return;

        const tipoContrato = tipoContratoMap.get(contrato.id_tipo_contrato);
        if (!tipoContrato) return;

        const servicio = servicioInfoMap.get(servicioAsignado.id_servicio);
        const personal = personalInfoMap.get(participacion.id_personal_participante);

        const tipoNombre = tipoContrato.nombre;
        if (dataMap[tipoNombre]) {
          dataMap[tipoNombre].costoTotal += detalle.monto_pagado;
          dataMap[tipoNombre].detallesCosto.push({
            contratoId: contrato.id,
            servicioNombre: servicio?.nombre || 'N/A',
            montoPagado: detalle.monto_pagado,
            personalNombre: personal?.nombre || 'N/A',
            fechaEvento: contrato.fecha_hora_evento,
          });
        }
      });

      // Calculate net income and sort
      Object.values(dataMap).forEach(d => {
        d.ingresoNeto = d.ingresoTotal - d.costoTotal;
        d.detallesIngreso.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        d.detallesCosto.sort((a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime());
      });

      setReportData(Object.values(dataMap));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to build income data
  const buildIngresoData = (
    contratos: any[],
    tiposContratoData: any[] | null,
    contratadoresNombres: any[] | null,
    getSingle: (data: any) => any
  ): { [key: string]: ReportData } => {
    const dataMap: { [key: string]: ReportData } = {};
    const tipoContratoMap = new Map(tiposContratoData?.map(tc => [tc.id, tc]));
    const contratadorMap = new Map(
      contratadoresNombres?.map(c => {
        const contratador = getSingle(c.Contratadores);
        return [c.id, contratador?.nombre || 'N/A'];
      })
    );

    contratos.forEach(contrato => {
      const tipoContrato = tipoContratoMap.get(contrato.id_tipo_contrato);
      const contratadorNombre = contratadorMap.get(contrato.id);
      if (!tipoContrato) return;

      const nombre = tipoContrato.nombre;
      if (!dataMap[nombre]) {
        dataMap[nombre] = {
          tipoContratoNombre: nombre,
          ingresoTotal: 0,
          costoTotal: 0,
          ingresoNeto: 0,
          cantidadContratos: 0,
          detallesIngreso: [],
          detallesCosto: [],
        };
      }
      dataMap[nombre].ingresoTotal += tipoContrato.ingreso_base;
      dataMap[nombre].cantidadContratos++;
      dataMap[nombre].detallesIngreso.push({
        id: contrato.id,
        fecha: contrato.fecha_hora_evento,
        ingreso: tipoContrato.ingreso_base,
        contratadorNombre: contratadorNombre || 'N/A',
      });
    });

    return dataMap;
  };

  const handleExport = () => {
    if (reportData.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const wb = XLSX.utils.book_new();

    reportData.forEach(data => {
      // 1. Preparar datos
      const title = `Reporte de rentabilidad: ${data.tipoContratoNombre}`;
      const dateRange = `Periodo: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
      
      const summary = [
        { Key: 'Contratos en el periodo', Value: data.cantidadContratos },
        { Key: 'Ingreso total', Value: `S/${data.ingresoTotal.toFixed(2)}` },
        { Key: 'Costo total', Value: `S/${data.costoTotal.toFixed(2)}` },
        { Key: 'Ingreso neto', Value: `S/${data.ingresoNeto.toFixed(2)}` },
      ];

      const ingresosData = data.detallesIngreso.map(ingreso => ({
        'Contrato ID': ingreso.id,
        'Contratador': ingreso.contratadorNombre,
        'Fecha evento': new Date(ingreso.fecha).toLocaleString(),
        'Ingreso': { v: ingreso.ingreso, t: 'n', z: '"S/"#,##0.00' },
      }));

      const costosData = data.detallesCosto.map(costo => ({
        'Contrato ID ': costo.contratoId, // Espacio para diferenciar de la otra tabla
        'Personal': costo.personalNombre,
        'Servicio': costo.servicioNombre,
        'Fecha evento ': new Date(costo.fechaEvento).toLocaleString(), // Espacio
        'Costo': { v: costo.montoPagado, t: 'n', z: '"S/"#,##0.00' },
      }));

      // 2. Crear la hoja y añadir datos por secciones
      let finalData: any[] = [];
      finalData.push([title]);
      finalData.push([dateRange]);
      finalData.push([]); // Spacer
      finalData.push(['Resumen del periodo']);
      finalData = finalData.concat(summary.map(s => [s.Key, s.Value]));
      finalData.push([]); // Spacer
      finalData.push(['Desglose de ingresos']);
      const ingresosHeader = ['Contrato ID', 'Contratador', 'Fecha evento', 'Ingreso'];
      finalData.push(ingresosHeader);
      ingresosData.forEach(item => finalData.push(Object.values(item)));
      finalData.push([]); // Spacer
      finalData.push(['Desglose de costos']);
      const costosHeader = ['Contrato ID', 'Personal', 'Servicio', 'Fecha evento', 'Costo'];
      finalData.push(costosHeader);
      costosData.forEach(item => finalData.push(Object.values(item)));

      const ws = XLSX.utils.aoa_to_sheet(finalData);

      // 3. Calcular anchos de columna
      const colWidths = finalData.reduce((acc, row) => {
        row.forEach((cell: any, colIndex: number) => {
          const cellValue = cell?.v ?? cell?.toString() ?? '';
          const len = cellValue.length;
          if (!acc[colIndex] || len > acc[colIndex]) {
            acc[colIndex] = len;
          }
        });
        return acc;
      }, [] as number[]);

      ws['!cols'] = colWidths.map((w: number) => ({ wch: w + 2 })); // Añadir padding

      // 4. Añadir la hoja al libro
      const sheetName = data.tipoContratoNombre.replace(/[^a-zA-Z0-9]/g, '').substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, "ReporteRentabilidad.xlsx");
  };

  const handleTipoContratoChange = (id: number) => {
    setSelectedTipos(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Reporte de rentabilidad por tipo de contrato</h1>

      <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center"><FiFileText className="mr-2"/>Tipos de contrato</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {tiposContrato.map(tc => (
                        <button 
                            key={tc.id} 
                            onClick={() => handleTipoContratoChange(tc.id)}
                            className={`p-2 text-sm rounded-lg border transition-colors ${selectedTipos.includes(tc.id) ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>
                            {tc.nombre}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiCalendar className="mr-2"/>Fecha de inicio</label>
                <input type="date" id="start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiCalendar className="mr-2"/>Fecha de fin</label>
                <input type="date" id="end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="self-end">
                <button onClick={handleGenerateReport} disabled={loading} className="w-full flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:bg-slate-600">
                    {loading ? 'Generando...' : <><FiFilter className="mr-2" /> Generar reporte</>}
                </button>
            </div>
        </div>
        {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>

      {/* Results Header */}
      {reportData.length > 0 && (
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Resultados</h2>
            <button 
                onClick={handleExport}
                className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200">
                <FiDownload className="mr-2"/> Exportar a Excel
            </button>
        </div>
      )}

      {/* Results */}
      <div className="space-y-6">
        {reportData.map(data => (
            <div key={data.tipoContratoNombre} className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4 truncate">{data.tipoContratoNombre}</h3>
                <p className="text-sm text-slate-400 mb-4">{data.cantidadContratos} contratos en el período</p>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-300 flex items-center"><FiTrendingUp className="mr-2 text-green-400"/>Ingreso total</span>
                        <span className="font-bold text-green-400 text-lg">S/{data.ingresoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-300 flex items-center"><FiTrendingDown className="mr-2 text-red-400"/>Costo total</span>
                        <span className="font-bold text-red-400 text-lg">S/{data.costoTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center">
                        <span className="text-white font-bold flex items-center"><FiBarChart2 className="mr-2 text-sky-400"/>Ingreso neto</span>
                        <span className="font-bold text-sky-400 text-2xl">S/{data.ingresoNeto.toFixed(2)}</span>
                    </div>
                </div>
                <div className="text-center mt-4">
                    <button onClick={() => setExpandedCard(expandedCard === data.tipoContratoNombre ? null : data.tipoContratoNombre)} className="text-sky-400 hover:text-sky-300 text-sm font-semibold">
                        {expandedCard === data.tipoContratoNombre ? 'Ocultar detalles' : 'Ver detalles'}
                    </button>
                </div>
                {expandedCard === data.tipoContratoNombre && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-white mb-2">Desglose de ingresos</h4>
                                <div className="overflow-auto max-h-60">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-900">
                                            <tr>
                                                <th className="p-2 text-left text-slate-400">Contratador / Fecha</th>
                                                <th className="p-2 text-right text-slate-400">Ingreso</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {data.detallesIngreso.map(ingreso => (
                                                <tr key={ingreso.id}>
                                                    <td className="p-2">
                                                        <Link href={`/dashboard/contratos/${ingreso.id}`} className="hover:text-sky-400">
                                                            <p className="font-semibold">{ingreso.contratadorNombre}</p>
                                                            <p className="text-xs text-slate-400">{new Date(ingreso.fecha).toLocaleString()}</p>
                                                        </Link>
                                                    </td>
                                                    <td className="p-2 text-right font-mono">S/{ingreso.ingreso.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-2">Desglose de costos</h4>
                                <div className="overflow-auto max-h-60">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-900">
                                            <tr>
                                                <th className="p-2 text-left text-slate-400">Personal / Servicio</th>
                                                <th className="p-2 text-right text-slate-400">Costo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {data.detallesCosto.map((costo, i) => (
                                                <tr key={i}>
                                                    <td className="p-2">
                                                        <Link href={`/dashboard/contratos/${costo.contratoId}`} className="hover:text-sky-400">
                                                            <p className="font-semibold">{costo.personalNombre}</p>
                                                            <p className="text-xs text-slate-400">{costo.servicioNombre} - {new Date(costo.fechaEvento).toLocaleString()}</p>
                                                        </Link>
                                                    </td>
                                                    <td className="p-2 text-right font-mono">S/{costo.montoPagado.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ))}
      </div>
      {loading && <p className="text-center text-slate-400 mt-8">Cargando...</p>}
      {!loading && reportData.length === 0 && !error && (
        <div className="text-center py-16 bg-slate-800 rounded-xl border border-slate-700 mt-8">
            <p className="text-slate-400">No hay datos de rentabilidad para los filtros seleccionados.</p>
        </div>
      )}
    </div>
  );
}
