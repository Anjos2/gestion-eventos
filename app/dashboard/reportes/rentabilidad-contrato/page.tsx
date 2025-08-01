'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
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
  const [tiposContrato, setTiposContrato] = useState<TipoContrato[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  useEffect(() => {
    const fetchTiposContrato = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminData } = await supabase
        .from('Personal')
        .select('id_organizacion')
        .eq('supabase_user_id', user.id)
        .single();

      if (adminData) {
        const { data, error } = await supabase
          .from('Tipos_Contrato')
          .select('id, nombre')
          .eq('id_organizacion', adminData.id_organizacion)
          .order('nombre', { ascending: true });

        if (error) {
          console.error('Error fetching tipos de contrato:', error);
        } else {
          setTiposContrato(data || []);
        }
      }
    };
    fetchTiposContrato();
  }, []);

  const handleGenerateReport = async () => {
    if (selectedTipos.length === 0 || !startDate || !endDate) {
      setError('Por favor, seleccione al menos un tipo de contrato y un rango de fechas.');
      return;
    }
    setLoading(true);
    setError(null);
    setReportData([]);

    const getSingle = (data: any) => (Array.isArray(data) ? data[0] : data);

    // 1. Obtener los contratos que cumplen con los filtros
    const { data: contratos, error: contratosError } = await supabase
      .from('Contratos')
      .select('id, id_tipo_contrato, fecha_hora_evento, Tipos_Contrato(nombre, ingreso_base), Contratadores(nombre)')
      .in('id_tipo_contrato', selectedTipos)
      .gte('fecha_hora_evento', startDate)
      .lte('fecha_hora_evento', endDate);

    if (contratosError) {
      setError(contratosError.message);
      setLoading(false);
      return;
    }

    const idContratos = contratos.map(c => c.id);

    // 2. Obtener los costos de los servicios pagados para esos contratos
    const { data: costos, error: costosError } = await supabase
      .from('Detalles_Lote_Pago')
      .select('monto_pagado, Evento_Servicios_Asignados!inner(Servicios!inner(nombre), Participaciones_Personal!inner(Personal!inner(nombre), Eventos_Contrato!inner(id_contrato)))')
      .in('Evento_Servicios_Asignados.Participaciones_Personal.Eventos_Contrato.id_contrato', idContratos);

    if (costosError) {
        setError(costosError.message);
        setLoading(false);
        return;
    }

    // 3. Procesar y agregar los datos
    const dataMap: { [key: string]: ReportData } = {};

    contratos.forEach(contrato => {
        const tipoContrato = getSingle(contrato.Tipos_Contrato);
        const contratador = getSingle(contrato.Contratadores);
        if (!tipoContrato || !contratador) return;

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
            contratadorNombre: contratador.nombre,
        });
    });

    costos.forEach(costo => {
        const eventoAsignado = getSingle(costo.Evento_Servicios_Asignados);
        const participacion = getSingle(eventoAsignado?.Participaciones_Personal);
        const eventoContrato = getSingle(participacion?.Eventos_Contrato);
        const servicio = getSingle(eventoAsignado?.Servicios);
        const personal = getSingle(participacion?.Personal);

        if (!eventoContrato || !servicio || !personal) return;

        const idContrato = eventoContrato.id_contrato;
        const contratoOriginal = contratos.find(c => c.id === idContrato);
        if (contratoOriginal) {
            const tipoContrato = getSingle(contratoOriginal.Tipos_Contrato);
            if (!tipoContrato) return;

            const nombre = tipoContrato.nombre;
            dataMap[nombre].costoTotal += costo.monto_pagado;
            dataMap[nombre].detallesCosto.push({
                contratoId: idContrato,
                servicioNombre: servicio.nombre,
                montoPagado: costo.monto_pagado,
                personalNombre: personal.nombre,
                fechaEvento: contratoOriginal.fecha_hora_evento,
            });
        }
    });

    Object.values(dataMap).forEach(d => {
        d.ingresoNeto = d.ingresoTotal - d.costoTotal;
        d.detallesIngreso.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        d.detallesCosto.sort((a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime());
    });

    setReportData(Object.values(dataMap));
    setLoading(false);
  };

  const handleExport = () => {
    if (reportData.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const wb = XLSX.utils.book_new();

    reportData.forEach(data => {
      const summaryData = [{
        'Tipo de Contrato': data.tipoContratoNombre,
        'Cantidad de Contratos': data.cantidadContratos,
        'Ingreso Total': data.ingresoTotal,
        'Costo Total': data.costoTotal,
        'Ingreso Neto': data.ingresoNeto,
      }];

      const ingresosData = data.detallesIngreso.map(ingreso => ({
        'Contrato ID': ingreso.id,
        'Contratador': ingreso.contratadorNombre,
        'Fecha Evento': new Date(ingreso.fecha).toLocaleString(),
        'Ingreso': ingreso.ingreso,
      }));

      const costosData = data.detallesCosto.map(costo => ({
        'Contrato ID': costo.contratoId,
        'Personal': costo.personalNombre,
        'Servicio': costo.servicioNombre,
        'Fecha Evento': new Date(costo.fechaEvento).toLocaleString(),
        'Costo': costo.montoPagado,
      }));

      const ws = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.sheet_add_json(ws, [{}], {header: [], skipHeader: true, origin: -1}); // Spacer
      XLSX.utils.sheet_add_json(ws, [{A: "Desglose de Ingresos"}], {header: ["A"], skipHeader: true, origin: -1});
      XLSX.utils.sheet_add_json(ws, ingresosData, {origin: -1});
      XLSX.utils.sheet_add_json(ws, [{}], {header: [], skipHeader: true, origin: -1}); // Spacer
      XLSX.utils.sheet_add_json(ws, [{A: "Desglose de Costos"}], {header: ["A"], skipHeader: true, origin: -1});
      XLSX.utils.sheet_add_json(ws, costosData, {origin: -1});

      // Clean sheet name
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
      <h1 className="text-3xl font-bold text-white mb-6">Reporte de Rentabilidad por Tipo de Contrato</h1>

      <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center"><FiFileText className="mr-2"/>Tipos de Contrato</label>
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
                <label htmlFor="start-date" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiCalendar className="mr-2"/>Fecha Inicio</label>
                <input type="date" id="start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-slate-400 mb-1 flex items-center"><FiCalendar className="mr-2"/>Fecha Fin</label>
                <input type="date" id="end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white p-2 focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="self-end">
                <button onClick={handleGenerateReport} disabled={loading} className="w-full flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 disabled:bg-slate-600">
                    {loading ? 'Generando...' : <><FiFilter className="mr-2" /> Generar Reporte</>}
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
                        <span className="text-slate-300 flex items-center"><FiTrendingUp className="mr-2 text-green-400"/>Ingreso Total</span>
                        <span className="font-bold text-green-400 text-lg">S/{data.ingresoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-300 flex items-center"><FiTrendingDown className="mr-2 text-red-400"/>Costo Total</span>
                        <span className="font-bold text-red-400 text-lg">S/{data.costoTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-700 my-2"></div>
                    <div className="flex justify-between items-center">
                        <span className="text-white font-bold flex items-center"><FiBarChart2 className="mr-2 text-sky-400"/>Ingreso Neto</span>
                        <span className="font-bold text-sky-400 text-2xl">S/{data.ingresoNeto.toFixed(2)}</span>
                    </div>
                </div>
                <div className="text-center mt-4">
                    <button onClick={() => setExpandedCard(expandedCard === data.tipoContratoNombre ? null : data.tipoContratoNombre)} className="text-sky-400 hover:text-sky-300 text-sm font-semibold">
                        {expandedCard === data.tipoContratoNombre ? 'Ocultar Detalles' : 'Ver Detalles'}
                    </button>
                </div>
                {expandedCard === data.tipoContratoNombre && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-white mb-2">Desglose de Ingresos</h4>
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
                                <h4 className="font-bold text-white mb-2">Desglose de Costos</h4>
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
